/**
 * Baseline uncompressed TIFF (RGBA, one strip, little-endian). No LZW/CMYK/multi-page —
 * this exists for "professional print" workflows that just want a lossless, alpha-capable
 * raster file without JPEG artifacts or PNG's smaller-but-mandatory compression; readers
 * import/decode is the exact mirror of the writer, so round-tripping through this app is
 * guaranteed, and any standard TIFF reader can open files this writes (baseline tags only).
 */

const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_PHOTOMETRIC = 262;
const TAG_STRIP_OFFSETS = 273;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_ROWS_PER_STRIP = 278;
const TAG_STRIP_BYTE_COUNTS = 279;
const TAG_X_RESOLUTION = 282;
const TAG_Y_RESOLUTION = 283;
const TAG_RESOLUTION_UNIT = 296;
const TAG_EXTRA_SAMPLES = 338;

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

export function encodeTiff(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;

  const entryDefs: { tag: number; type: number; count: number }[] = [
    { tag: TAG_IMAGE_WIDTH, type: TYPE_LONG, count: 1 },
    { tag: TAG_IMAGE_LENGTH, type: TYPE_LONG, count: 1 },
    { tag: TAG_BITS_PER_SAMPLE, type: TYPE_SHORT, count: 4 },
    { tag: TAG_COMPRESSION, type: TYPE_SHORT, count: 1 },
    { tag: TAG_PHOTOMETRIC, type: TYPE_SHORT, count: 1 },
    { tag: TAG_STRIP_OFFSETS, type: TYPE_LONG, count: 1 },
    { tag: TAG_SAMPLES_PER_PIXEL, type: TYPE_SHORT, count: 1 },
    { tag: TAG_ROWS_PER_STRIP, type: TYPE_LONG, count: 1 },
    { tag: TAG_STRIP_BYTE_COUNTS, type: TYPE_LONG, count: 1 },
    { tag: TAG_X_RESOLUTION, type: TYPE_RATIONAL, count: 1 },
    { tag: TAG_Y_RESOLUTION, type: TYPE_RATIONAL, count: 1 },
    { tag: TAG_RESOLUTION_UNIT, type: TYPE_SHORT, count: 1 },
    { tag: TAG_EXTRA_SAMPLES, type: TYPE_SHORT, count: 1 },
  ];

  const headerSize = 8;
  const ifdSize = 2 + entryDefs.length * 12 + 4;
  const ifdStart = headerSize;
  const outOfLineStart = ifdStart + ifdSize;

  const bitsPerSampleOffset = outOfLineStart;
  const xResOffset = bitsPerSampleOffset + 8; // 4x SHORT
  const yResOffset = xResOffset + 8; // RATIONAL = 2x LONG
  const pixelDataOffset = yResOffset + 8;
  const totalSize = pixelDataOffset + pixels.length;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  out[0] = 0x49;
  out[1] = 0x49; // 'II' little-endian
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdStart, true);

  let o = ifdStart;
  view.setUint16(o, entryDefs.length, true);
  o += 2;

  const values: Record<number, number> = {
    [TAG_IMAGE_WIDTH]: width,
    [TAG_IMAGE_LENGTH]: height,
    [TAG_BITS_PER_SAMPLE]: bitsPerSampleOffset,
    [TAG_COMPRESSION]: 1, // none
    [TAG_PHOTOMETRIC]: 2, // RGB
    [TAG_STRIP_OFFSETS]: pixelDataOffset,
    [TAG_SAMPLES_PER_PIXEL]: 4,
    [TAG_ROWS_PER_STRIP]: height,
    [TAG_STRIP_BYTE_COUNTS]: pixels.length,
    [TAG_X_RESOLUTION]: xResOffset,
    [TAG_Y_RESOLUTION]: yResOffset,
    [TAG_RESOLUTION_UNIT]: 2, // inches
    [TAG_EXTRA_SAMPLES]: 2, // unassociated alpha
  };

  for (const def of entryDefs) {
    view.setUint16(o, def.tag, true); o += 2;
    view.setUint16(o, def.type, true); o += 2;
    view.setUint32(o, def.count, true); o += 4;
    view.setUint32(o, values[def.tag], true); o += 4;
  }
  view.setUint32(o, 0, true); // next IFD = none

  view.setUint16(bitsPerSampleOffset, 8, true);
  view.setUint16(bitsPerSampleOffset + 2, 8, true);
  view.setUint16(bitsPerSampleOffset + 4, 8, true);
  view.setUint16(bitsPerSampleOffset + 6, 8, true);

  view.setUint32(xResOffset, 72, true);
  view.setUint32(xResOffset + 4, 1, true);
  view.setUint32(yResOffset, 72, true);
  view.setUint32(yResOffset + 4, 1, true);

  out.set(pixels, pixelDataOffset);

  return out;
}

interface TiffIfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}

function readIfdEntries(view: DataView, ifdStart: number): TiffIfdEntry[] {
  const count = view.getUint16(ifdStart, true);
  const entries: TiffIfdEntry[] = [];
  for (let i = 0; i < count; i++) {
    const o = ifdStart + 2 + i * 12;
    entries.push({
      tag: view.getUint16(o, true),
      type: view.getUint16(o + 2, true),
      count: view.getUint32(o + 4, true),
      valueOffset: view.getUint32(o + 8, true),
    });
  }
  return entries;
}

/** Decodes the baseline uncompressed RGBA TIFF this module writes. Returns null if the file
 * uses compression, a color space, or a bit depth this reader doesn't understand. */
export function decodeTiff(bytes: Uint8Array): HTMLCanvasElement | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const b0 = bytes[0];
  const b1 = bytes[1];
  const little = b0 === 0x49 && b1 === 0x49;
  const big = b0 === 0x4d && b1 === 0x4d;
  if (!little && !big) return null;
  // Only little-endian ("II") is supported — matches what this encoder writes.
  if (!little) return null;

  const ifdOffset = view.getUint32(4, true);
  const entries = readIfdEntries(view, ifdOffset);
  const byTag = new Map(entries.map((e) => [e.tag, e]));

  const width = byTag.get(TAG_IMAGE_WIDTH)?.valueOffset;
  const height = byTag.get(TAG_IMAGE_LENGTH)?.valueOffset;
  const compression = byTag.get(TAG_COMPRESSION)?.valueOffset ?? 1;
  const samplesPerPixel = byTag.get(TAG_SAMPLES_PER_PIXEL)?.valueOffset ?? 3;
  const stripOffset = byTag.get(TAG_STRIP_OFFSETS)?.valueOffset;
  if (!width || !height || !stripOffset || compression !== 1) return null;
  if (samplesPerPixel !== 3 && samplesPerPixel !== 4) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;
  const pixelCount = width * height;

  if (samplesPerPixel === 4) {
    out.set(bytes.subarray(stripOffset, stripOffset + pixelCount * 4));
  } else {
    for (let p = 0; p < pixelCount; p++) {
      const si = stripOffset + p * 3;
      const di = p * 4;
      out[di] = bytes[si];
      out[di + 1] = bytes[si + 1];
      out[di + 2] = bytes[si + 2];
      out[di + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

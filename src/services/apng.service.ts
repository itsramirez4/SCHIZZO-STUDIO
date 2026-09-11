import { concatUint8 } from '@/utils/binaryUtils';

/**
 * From-scratch APNG (animated PNG) reader/writer. The hard part of PNG — DEFLATE — is not
 * reimplemented: IDAT/fdAT payloads are zlib streams (RFC 1950), which is exactly what the
 * browser's native CompressionStream('deflate')/DecompressionStream('deflate') produce and
 * consume. Everything else here is PNG's well-documented chunk framing (length/type/data/crc)
 * and the APNG extension chunks (acTL/fcTL/fdAT) layered on top of it.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// TS's stream types pin BufferSource to a plain ArrayBuffer-backed view; our Uint8Arrays are
// structurally identical at runtime (never actually SharedArrayBuffer-backed here), so this
// cast is safe, not a real type mismatch.
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>);
  writer.close();
  return concatUint8(await readAll(cs.readable));
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>);
  writer.close();
  return concatUint8(await readAll(ds.readable));
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);
  return chunk;
}

/** Prefixes every scanline with filter-type 0 (None) — simple and correct; an adaptive
 * filter would compress smaller, but at the cost of real complexity for a stylistic export. */
function addFilterBytes(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const out = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    out[rowStart] = 0;
    out.set(rgba.subarray(y * stride, y * stride + stride), rowStart + 1);
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Reverses all 5 standard PNG filter types (needed to decode files from other tools, not
 * just the filter-0-only output this module's own encoder produces). */
function unfilter(data: Uint8Array, width: number, height: number): Uint8Array {
  const bpp = 4;
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  let inOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = data[inOffset++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = data[inOffset + x];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = y > 0 ? out[rowStart - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[rowStart - stride + x - bpp] : 0;
      let value = raw;
      if (filterType === 1) value = raw + a;
      else if (filterType === 2) value = raw + b;
      else if (filterType === 3) value = raw + Math.floor((a + b) / 2);
      else if (filterType === 4) value = raw + paeth(a, b, c);
      out[rowStart + x] = value & 0xff;
    }
    inOffset += stride;
  }
  return out;
}

export interface ApngFrameInput {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

export async function encodeApng(frames: ApngFrameInput[], loop: boolean): Promise<Uint8Array> {
  if (frames.length === 0) throw new Error('encodeApng: no frames');
  const width = frames[0].canvas.width;
  const height = frames[0].canvas.height;
  const parts: Uint8Array[] = [new Uint8Array(PNG_SIGNATURE)];

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  parts.push(buildChunk('IHDR', ihdr));

  const actl = new Uint8Array(8);
  const actlView = new DataView(actl.buffer);
  actlView.setUint32(0, frames.length, false);
  actlView.setUint32(4, loop ? 0 : 1, false); // 0 = infinite plays
  parts.push(buildChunk('acTL', actl));

  let seq = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const rgba = frame.canvas.getContext('2d')!.getImageData(0, 0, width, height).data;

    const fctl = new Uint8Array(26);
    const fctlView = new DataView(fctl.buffer);
    fctlView.setUint32(0, seq++, false);
    fctlView.setUint32(4, width, false);
    fctlView.setUint32(8, height, false);
    fctlView.setUint32(12, 0, false); // x offset
    fctlView.setUint32(16, 0, false); // y offset
    fctlView.setUint16(20, Math.min(65535, Math.round(frame.delayMs)), false); // delay_num (ms)
    fctlView.setUint16(22, 1000, false); // delay_den
    fctl[24] = 1; // dispose_op: BACKGROUND — clear to transparent, matches the GIF exporter's disposal method
    fctl[25] = 0; // blend_op: SOURCE
    parts.push(buildChunk('fcTL', fctl));

    const compressed = await deflate(addFilterBytes(rgba, width, height));
    if (i === 0) {
      parts.push(buildChunk('IDAT', compressed));
    } else {
      const fdat = new Uint8Array(4 + compressed.length);
      new DataView(fdat.buffer).setUint32(0, seq++, false);
      fdat.set(compressed, 4);
      parts.push(buildChunk('fdAT', fdat));
    }
  }

  parts.push(buildChunk('IEND', new Uint8Array(0)));
  return concatUint8(parts);
}

interface ParsedChunk {
  type: string;
  data: Uint8Array;
}

function parseChunks(bytes: Uint8Array): ParsedChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: ParsedChunk[] = [];
  let o = 8;
  while (o + 8 <= bytes.length) {
    const len = view.getUint32(o, false);
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]);
    const data = bytes.subarray(o + 8, o + 8 + len);
    o += 8 + len + 4; // skip data + crc
    chunks.push({ type, data });
    if (type === 'IEND') break;
  }
  return chunks;
}

export interface DecodedApngFrame {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

export interface DecodedApng {
  width: number;
  height: number;
  frames: DecodedApngFrame[];
}

interface RawFrame {
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
  delayMs: number;
  disposeOp: number;
  blendOp: number;
  dataParts: Uint8Array[];
}

/** Returns null for a non-animated PNG (no acTL chunk) so the caller can fall back to
 * treating it as a normal single image. */
export async function decodeApng(bytes: Uint8Array): Promise<DecodedApng | null> {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const chunks = parseChunks(bytes);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  const actl = chunks.find((c) => c.type === 'acTL');
  if (!ihdr || !actl) return null;

  const ihdrView = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = ihdrView.getUint32(0, false);
  const height = ihdrView.getUint32(4, false);

  const rawFrames: RawFrame[] = [];
  let current: RawFrame | null = null;

  for (const chunk of chunks) {
    if (chunk.type === 'fcTL') {
      const v = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
      const delayNum = v.getUint16(20, false);
      const delayDen = v.getUint16(22, false) || 100;
      current = {
        width: v.getUint32(4, false),
        height: v.getUint32(8, false),
        xOffset: v.getUint32(12, false),
        yOffset: v.getUint32(16, false),
        delayMs: (delayNum / delayDen) * 1000 || 100,
        disposeOp: chunk.data[24],
        blendOp: chunk.data[25],
        dataParts: [],
      };
      rawFrames.push(current);
    } else if (chunk.type === 'IDAT' && current) {
      current.dataParts.push(chunk.data);
    } else if (chunk.type === 'fdAT' && current) {
      current.dataParts.push(chunk.data.subarray(4)); // strip the sequence-number prefix
    }
  }
  if (rawFrames.length === 0) return null;

  // Composite frames onto a shared canvas in order, honoring dispose_op/blend_op — a frame
  // can be a partial-region update over what's already there, not a full repaint.
  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const compositeCtx = composite.getContext('2d')!;

  const frames: DecodedApngFrame[] = [];
  for (const raw of rawFrames) {
    const inflated = await inflate(concatUint8(raw.dataParts));
    const unfiltered = unfilter(inflated, raw.width, raw.height);

    const beforeDraw = compositeCtx.getImageData(0, 0, width, height);

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = raw.width;
    frameCanvas.height = raw.height;
    frameCanvas
      .getContext('2d')!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(unfiltered.buffer, unfiltered.byteOffset, unfiltered.byteLength) as Uint8ClampedArray<ArrayBuffer>,
          raw.width,
          raw.height
        ),
        0,
        0
      );

    if (raw.blendOp === 0) compositeCtx.clearRect(raw.xOffset, raw.yOffset, raw.width, raw.height);
    compositeCtx.drawImage(frameCanvas, raw.xOffset, raw.yOffset);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    outCanvas.getContext('2d')!.drawImage(composite, 0, 0);
    frames.push({ canvas: outCanvas, delayMs: raw.delayMs });

    if (raw.disposeOp === 1) compositeCtx.clearRect(raw.xOffset, raw.yOffset, raw.width, raw.height);
    else if (raw.disposeOp === 2) compositeCtx.putImageData(beforeDraw, 0, 0);
  }

  return { width, height, frames };
}

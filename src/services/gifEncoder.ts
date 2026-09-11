/**
 * From-scratch GIF89a encoder: median-cut color quantization down to a single shared
 * 256-color global palette (index 255 reserved for transparency), then per-frame GIF-flavor
 * LZW compression. No external dependency — just pixels in, bytes out.
 *
 * Takes `ImageData` rather than `HTMLCanvasElement` (no `getContext('2d')` calls anywhere in
 * this file) so it has zero DOM dependency and can run either on the main thread or inside a
 * Web Worker unchanged — the caller (animation.service.ts) does the actual worker plumbing and
 * decides where to run it.
 */

export interface GifFrameInput {
  imageData: ImageData;
  delayMs: number;
}

type RGB = [number, number, number];

const TRANSPARENT_INDEX = 255;

export function encodeGif(frames: GifFrameInput[], loop: boolean): Uint8Array {
  if (frames.length === 0) throw new Error('encodeGif: no frames');
  const width = frames[0].imageData.width;
  const height = frames[0].imageData.height;

  const palette = buildPalette(frames, width, height);
  const nearest = makeNearestColorLookup(palette);

  const bytes: number[] = [];
  writeHeader(bytes, width, height, palette);
  if (loop) writeLoopExtension(bytes);

  for (const frame of frames) {
    const indices = quantizeFrame(frame.imageData, width, height, nearest);
    writeFrame(bytes, indices, width, height, frame.delayMs);
  }

  bytes.push(0x3b); // trailer
  return new Uint8Array(bytes);
}

// --- Palette ---

function buildPalette(frames: GifFrameInput[], width: number, height: number): RGB[] {
  const totalPixels = width * height;
  const maxSamplesPerFrame = 20000;
  const step = Math.max(1, Math.floor(totalPixels / maxSamplesPerFrame));

  const sample: RGB[] = [];
  for (const frame of frames) {
    const data = frame.imageData.data;
    for (let p = 0; p < totalPixels; p += step) {
      const i = p * 4;
      if (data[i + 3] === 0) continue; // fully transparent pixels don't need a color slot
      sample.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  const palette = medianCut(sample.length ? sample : [[255, 255, 255]], 255);
  while (palette.length < 255) palette.push([0, 0, 0]);
  return palette;
}

function medianCut(colors: RGB[], numColors: number): RGB[] {
  let boxes: RGB[][] = [colors];

  while (boxes.length < numColors) {
    let splitIdx = -1;
    let splitChannel = 0;
    let maxRange = -1;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const color of box) {
          if (color[c] < lo) lo = color[c];
          if (color[c] > hi) hi = color[c];
        }
        const range = hi - lo;
        if (range > maxRange) {
          maxRange = range;
          splitIdx = i;
          splitChannel = c;
        }
      }
    }

    if (splitIdx === -1) break; // no box can be split further

    const box = boxes[splitIdx];
    box.sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(box.length / 2);
    boxes.splice(splitIdx, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const c of box) { r += c[0]; g += c[1]; b += c[2]; }
    const n = box.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function makeNearestColorLookup(palette: RGB[]): (r: number, g: number, b: number) => number {
  const cache = new Map<number, number>();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
}

function quantizeFrame(
  imageData: ImageData,
  width: number,
  height: number,
  nearest: (r: number, g: number, b: number) => number
): Uint8Array {
  const data = imageData.data;
  const indices = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    indices[p] = data[i + 3] === 0 ? TRANSPARENT_INDEX : nearest(data[i], data[i + 1], data[i + 2]);
  }
  return indices;
}

// --- GIF binary structure ---

function writeHeader(bytes: number[], width: number, height: number, palette: RGB[]) {
  pushString(bytes, 'GIF89a');
  push16(bytes, width);
  push16(bytes, height);
  bytes.push(0xf7); // global color table present, 256 entries
  bytes.push(TRANSPARENT_INDEX); // background color index
  bytes.push(0); // pixel aspect ratio
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = i < palette.length ? palette[i] : [0, 0, 0];
    bytes.push(r, g, b);
  }
}

function writeLoopExtension(bytes: number[]) {
  bytes.push(0x21, 0xff, 0x0b);
  pushString(bytes, 'NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);
}

function writeFrame(bytes: number[], indices: Uint8Array, width: number, height: number, delayMs: number) {
  // Graphic Control Extension: disposal=2 (restore to background) so transparent areas
  // stay transparent instead of showing the previous frame bleeding through.
  bytes.push(0x21, 0xf9, 0x04, 0x09);
  push16(bytes, Math.round(delayMs / 10));
  bytes.push(TRANSPARENT_INDEX, 0x00);

  // Image Descriptor
  bytes.push(0x2c);
  push16(bytes, 0);
  push16(bytes, 0);
  push16(bytes, width);
  push16(bytes, height);
  bytes.push(0x00); // no local color table

  const minCodeSize = 8; // full 256-entry global color table
  bytes.push(minCodeSize);
  const lzwData = lzwEncode(indices, minCodeSize);
  for (let offset = 0; offset < lzwData.length; offset += 255) {
    const chunk = lzwData.subarray(offset, offset + 255);
    bytes.push(chunk.length);
    for (let i = 0; i < chunk.length; i++) bytes.push(chunk[i]);
  }
  bytes.push(0x00); // block terminator
}

function pushString(bytes: number[], s: string) {
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
}

function push16(bytes: number[], n: number) {
  bytes.push(n & 0xff, (n >> 8) & 0xff);
}

/** GIF-flavor LZW: variable code width, integer-keyed nested dictionary (prefix code -> next byte -> code). */
function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;

  const output: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let codeSize = minCodeSize + 1;

  function emit(code: number) {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }

  let dict = new Map<number, Map<number, number>>();
  let nextCode = endCode + 1;

  function resetDict() {
    dict = new Map();
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  }

  emit(clearCode);
  if (indices.length === 0) {
    emit(endCode);
    if (bitCount > 0) output.push(bitBuffer & 0xff);
    return new Uint8Array(output);
  }

  let curCode = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const branch = dict.get(curCode);
    const existing = branch?.get(k);
    if (existing !== undefined) {
      curCode = existing;
      continue;
    }

    emit(curCode);
    if (nextCode < 4096) {
      if (branch) branch.set(k, nextCode);
      else dict.set(curCode, new Map([[k, nextCode]]));
      nextCode++;
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clearCode);
      resetDict();
    }
    curCode = k;
  }
  emit(curCode);
  emit(endCode);
  if (bitCount > 0) output.push(bitBuffer & 0xff);

  return new Uint8Array(output);
}

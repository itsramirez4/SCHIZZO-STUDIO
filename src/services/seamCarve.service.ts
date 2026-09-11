/**
 * Content-aware resize (seam carving, Avidan-Shamir). Repeatedly finds the lowest-energy
 * top-to-bottom path of pixels (a "seam") and removes or duplicates it, so the canvas
 * shrinks/grows by preferentially eating into low-detail regions instead of uniformly
 * scaling everything. Horizontal seams reuse the exact same vertical-seam code by
 * transposing the image first and transposing the result back.
 *
 * This is inherently O(seams × width × height) — each seam requires a fresh energy map
 * and DP pass over the current image, since removing/inserting a seam changes every pixel
 * position after it. There is no shortcut; large resizes on large canvases take real wall
 * time, which is why the caller drives this with progress + cancellation.
 */

function computeEnergy(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const energy = new Float32Array(width * height);
  const at = (x: number, y: number, c: number) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return data[(cy * width + cx) * 4 + c];
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx2 = 0;
      let dy2 = 0;
      for (let c = 0; c < 3; c++) {
        const gx = at(x + 1, y, c) - at(x - 1, y, c);
        const gy = at(x, y + 1, c) - at(x, y - 1, c);
        dx2 += gx * gx;
        dy2 += gy * gy;
      }
      energy[y * width + x] = Math.sqrt(dx2 + dy2);
    }
  }
  return energy;
}

/** Dynamic-programming minimum-cost top-to-bottom path; returns one x per row. */
function findVerticalSeam(energy: Float32Array, width: number, height: number): Int32Array {
  const cost = new Float32Array(width * height);
  const back = new Int8Array(width * height);
  for (let x = 0; x < width; x++) cost[x] = energy[x];

  for (let y = 1; y < height; y++) {
    const rowBase = y * width;
    const prevBase = (y - 1) * width;
    for (let x = 0; x < width; x++) {
      let best = cost[prevBase + x];
      let dir = 0;
      if (x > 0 && cost[prevBase + x - 1] < best) {
        best = cost[prevBase + x - 1];
        dir = -1;
      }
      if (x < width - 1 && cost[prevBase + x + 1] < best) {
        best = cost[prevBase + x + 1];
        dir = 1;
      }
      cost[rowBase + x] = best + energy[rowBase + x];
      back[rowBase + x] = dir;
    }
  }

  let minX = 0;
  const lastBase = (height - 1) * width;
  let minCost = cost[lastBase];
  for (let x = 1; x < width; x++) {
    if (cost[lastBase + x] < minCost) {
      minCost = cost[lastBase + x];
      minX = x;
    }
  }

  const seam = new Int32Array(height);
  let x = minX;
  for (let y = height - 1; y >= 0; y--) {
    seam[y] = x;
    if (y > 0) x += back[y * width + x];
  }
  return seam;
}

function removeVerticalSeam(src: ImageData, seam: Int32Array): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(width - 1, height);
  const od = out.data;
  for (let y = 0; y < height; y++) {
    const skip = seam[y];
    let ox = 0;
    const rowBase = y * width;
    for (let x = 0; x < width; x++) {
      if (x === skip) continue;
      const si = (rowBase + x) * 4;
      const oi = (y * (width - 1) + ox) * 4;
      od[oi] = data[si];
      od[oi + 1] = data[si + 1];
      od[oi + 2] = data[si + 2];
      od[oi + 3] = data[si + 3];
      ox++;
    }
  }
  return out;
}

/** Grows the image by one column: duplicates each seam pixel, averaged with its right neighbor. */
function insertVerticalSeam(src: ImageData, seam: Int32Array): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(width + 1, height);
  const od = out.data;
  for (let y = 0; y < height; y++) {
    const insertAt = seam[y];
    let ox = 0;
    const rowBase = y * width;
    for (let x = 0; x < width; x++) {
      const si = (rowBase + x) * 4;
      const oi = (y * (width + 1) + ox) * 4;
      od[oi] = data[si];
      od[oi + 1] = data[si + 1];
      od[oi + 2] = data[si + 2];
      od[oi + 3] = data[si + 3];
      ox++;
      if (x === insertAt) {
        const ni = (x + 1 < width ? rowBase + x + 1 : rowBase + x) * 4;
        const oi2 = (y * (width + 1) + ox) * 4;
        od[oi2] = (data[si] + data[ni]) / 2;
        od[oi2 + 1] = (data[si + 1] + data[ni + 1]) / 2;
        od[oi2 + 2] = (data[si + 2] + data[ni + 2]) / 2;
        od[oi2 + 3] = (data[si + 3] + data[ni + 3]) / 2;
        ox++;
      }
    }
  }
  return out;
}

function transpose(src: ImageData): ImageData {
  const { width, height, data } = src;
  const out = new ImageData(height, width);
  const od = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const oi = (x * height + y) * 4;
      od[oi] = data[si];
      od[oi + 1] = data[si + 1];
      od[oi + 2] = data[si + 2];
      od[oi + 3] = data[si + 3];
    }
  }
  return out;
}

export interface SeamCarveOptions {
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
}

/** Total seam operations a resize to `targetWidth`x`targetHeight` will need — for UI warnings. */
export function estimateSeamCount(width: number, height: number, targetWidth: number, targetHeight: number): number {
  return Math.abs(targetWidth - width) + Math.abs(targetHeight - height);
}

async function yieldToUI() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** Runs one dimension's worth of seam removal/insertion, yielding to the UI periodically. */
async function carveDimension(
  imageData: ImageData,
  delta: number,
  doneRef: { done: number },
  total: number,
  opts: SeamCarveOptions
): Promise<ImageData | null> {
  let current = imageData;
  const steps = Math.abs(delta);
  for (let i = 0; i < steps; i++) {
    if (opts.shouldCancel?.()) return null;
    const energy = computeEnergy(current.data, current.width, current.height);
    const seam = findVerticalSeam(energy, current.width, current.height);
    current = delta < 0 ? removeVerticalSeam(current, seam) : insertVerticalSeam(current, seam);
    doneRef.done++;
    opts.onProgress?.(doneRef.done, total);
    if (i % 2 === 0) await yieldToUI();
  }
  return current;
}

/**
 * Content-aware resizes `sourceCanvas` to `targetWidth`x`targetHeight`. Width is carved
 * first, then height (via transpose). Returns null if `shouldCancel` fired mid-run.
 */
export async function seamCarveResize(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  opts: SeamCarveOptions = {}
): Promise<HTMLCanvasElement | null> {
  const srcCtx = sourceCanvas.getContext('2d')!;
  let imageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  const widthDelta = targetWidth - sourceCanvas.width;
  const heightDelta = targetHeight - sourceCanvas.height;
  const total = Math.abs(widthDelta) + Math.abs(heightDelta);
  const doneRef = { done: 0 };

  if (widthDelta !== 0) {
    const result = await carveDimension(imageData, widthDelta, doneRef, total, opts);
    if (!result) return null;
    imageData = result;
  }

  if (heightDelta !== 0) {
    const transposed = transpose(imageData);
    const result = await carveDimension(transposed, heightDelta, doneRef, total, opts);
    if (!result) return null;
    imageData = transpose(result);
  }

  const out = document.createElement('canvas');
  out.width = imageData.width;
  out.height = imageData.height;
  out.getContext('2d')!.putImageData(imageData, 0, 0);
  return out;
}

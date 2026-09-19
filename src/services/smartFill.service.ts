import { RGBA, SelectionRect } from '@/types';

/**
 * "Smart" bucket fill for line-art colouring. Differences from the plain flood fill:
 *  - it can decide the region from ANY canvas (e.g. the flattened image), so you can colour on a
 *    separate layer beneath the line-art layer;
 *  - it closes gaps in the outline (up to ~2× `gapClose` px) so a slightly open contour doesn't
 *    flood the whole page;
 *  - it grows the result under the lines (`grow`) so no light halo is left between fill and line.
 */
export interface SmartFillOptions {
  tolerance: number;
  gapClose: number;
  grow: number;
}

function matches(d: Uint8ClampedArray, i: number, t: RGBA, tol: number): boolean {
  return (
    Math.abs(d[i] - t.r) <= tol &&
    Math.abs(d[i + 1] - t.g) <= tol &&
    Math.abs(d[i + 2] - t.b) <= tol &&
    Math.abs(d[i + 3] - t.a) <= tol
  );
}

/** Chebyshev dilation of a binary mask by `r` pixels, in O(n) per pass (separable, sliding window). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const row = y * w;
    for (let x = 0; x < Math.min(w, r); x++) count += mask[row + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) count += mask[row + x + r];
      if (x - r - 1 >= 0) count -= mask[row + x - r - 1];
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(h, r); y++) count += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) count += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) count -= tmp[(y - r - 1) * w + x];
      out[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

/** Computes the fill region (1 = fill) for a click at (x0,y0) on `sample`. Exposed for testing. */
export function computeFillRegion(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  opts: SmartFillOptions,
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
): Uint8Array | null {
  const b = bounds ?? { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 };
  if (x0 < b.minX || y0 < b.minY || x0 > b.maxX || y0 > b.maxY) return null;
  const si = (y0 * w + x0) * 4;
  const seed: RGBA = { r: data[si], g: data[si + 1], b: data[si + 2], a: data[si + 3] };

  // Barrier = everything that is not "the same colour as the click".
  const n = w * h;
  let barrier = new Uint8Array(n);
  for (let p = 0; p < n; p++) barrier[p] = matches(data, p * 4, seed, opts.tolerance) ? 0 : 1;

  // Close gaps by thickening the barrier; if that swallows the seed itself (clicking right next
  // to a line) fall back to the un-thickened barrier so the fill still works.
  let effective = opts.gapClose > 0 ? dilate(barrier, w, h, opts.gapClose) : barrier;
  if (effective[y0 * w + x0]) effective = barrier;

  // Scanline-free stack flood over non-barrier pixels.
  const region = new Uint8Array(n);
  const stack: number[] = [y0 * w + x0];
  while (stack.length) {
    const p = stack.pop()!;
    if (region[p] || effective[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    region[p] = 1;
    if (x + 1 <= b.maxX) stack.push(p + 1);
    if (x - 1 >= b.minX) stack.push(p - 1);
    if (y + 1 <= b.maxY) stack.push(p + w);
    if (y - 1 >= b.minY) stack.push(p - w);
  }

  // The thickened barrier ate `gapClose` px off every edge. Give it back with a *geodesic*
  // dilation: first grow into pixels of the original (un-thickened) free space, then `grow` more
  // px into the outline itself so the colour tucks under the line. Each phase can only enter its
  // own kind of pixel, so the fill can never hop across a line into a neighbouring flat area.
  const geodesic = (r: Uint8Array, steps: number, allowed: (p: number) => boolean): Uint8Array => {
    let cur: Uint8Array = r;
    for (let i = 0; i < steps; i++) {
      const next = dilate(cur, w, h, 1);
      for (let p = 0; p < n; p++) if (next[p] && !cur[p] && !allowed(p)) next[p] = 0;
      cur = next;
    }
    return cur;
  };
  let out: Uint8Array = region;
  if (opts.gapClose > 0 && effective !== barrier) out = geodesic(out, opts.gapClose, (p) => barrier[p] === 0);
  if (opts.grow > 0) out = geodesic(out, opts.grow, (p) => barrier[p] === 1);
  return out;
}

export function smartFill(
  target: HTMLCanvasElement,
  sample: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillColor: RGBA,
  opts: SmartFillOptions,
  bounds?: SelectionRect,
  lockAlpha = false
) {
  const { width: w, height: h } = target;
  const sctx = sample.getContext('2d', { willReadFrequently: true })!;
  const sdata = sctx.getImageData(0, 0, w, h).data;
  const b = bounds
    ? {
        minX: Math.max(0, Math.round(bounds.x)),
        minY: Math.max(0, Math.round(bounds.y)),
        maxX: Math.min(w - 1, Math.round(bounds.x + bounds.w) - 1),
        maxY: Math.min(h - 1, Math.round(bounds.y + bounds.h) - 1),
      }
    : undefined;
  const region = computeFillRegion(sdata, w, h, Math.round(startX), Math.round(startY), opts, b);
  if (!region) return;

  const tctx = target.getContext('2d')!;
  const img = tctx.getImageData(0, 0, w, h);
  const d = img.data;
  const a = Math.round(fillColor.a * 255);
  for (let p = 0; p < region.length; p++) {
    if (!region[p]) continue;
    if (b) {
      const x = p % w;
      const y = (p - x) / w;
      if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    }
    const i = p * 4;
    if (lockAlpha && d[i + 3] === 0) continue;
    d[i] = fillColor.r;
    d[i + 1] = fillColor.g;
    d[i + 2] = fillColor.b;
    d[i + 3] = lockAlpha ? d[i + 3] : a;
  }
  tctx.putImageData(img, 0, 0);
}

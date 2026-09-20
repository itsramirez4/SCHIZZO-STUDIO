/**
 * Clone stamp: paints a piece of the picture (the "source", offset from the cursor) somewhere else.
 * Copies come from a snapshot taken when the stroke started, so what was just cloned is never cloned
 * again (no smearing feedback), and go through a soft round mask so the patch blends in.
 */

const maskCache = new Map<string, HTMLCanvasElement>();

function softMask(size: number, hardness: number): HTMLCanvasElement {
  const key = `${size}|${hardness.toFixed(2)}`;
  let m = maskCache.get(key);
  if (m) return m;
  m = document.createElement('canvas');
  m.width = m.height = size;
  const ctx = m.getContext('2d')!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  const inner = Math.max(0, Math.min(0.98, hardness));
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(inner, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  maskCache.set(key, m);
  if (maskCache.size > 24) maskCache.delete(maskCache.keys().next().value as string);
  return m;
}

export interface CloneOptions {
  size: number;
  hardness: number;
  opacity: number;
  spacing: number;
  /** Healing: shift the copied patch so its average lightness matches what is already there. */
  healing?: boolean;
}

/** Brings the patch's average lightness to that of the picture under it. */
function heal(patch: HTMLCanvasElement, base: HTMLCanvasElement, dx: number, dy: number, d: number) {
  const pctx = patch.getContext('2d', { willReadFrequently: true })!;
  const src = pctx.getImageData(0, 0, d, d);
  const under = document.createElement('canvas');
  under.width = under.height = d;
  const uctx = under.getContext('2d', { willReadFrequently: true })!;
  uctx.drawImage(base, dx, dy, d, d, 0, 0, d, d);
  const dst = uctx.getImageData(0, 0, d, d).data;
  let wSum = 0;
  const sAvg = [0, 0, 0];
  const dAvg = [0, 0, 0];
  for (let i = 0; i < d * d; i++) {
    const w = (src.data[i * 4 + 3] / 255) * (dst[i * 4 + 3] / 255);
    if (w <= 0) continue;
    wSum += w;
    for (let c = 0; c < 3; c++) {
      sAvg[c] += src.data[i * 4 + c] * w;
      dAvg[c] += dst[i * 4 + c] * w;
    }
  }
  if (wSum < 1) return;
  // Only the lightness is matched (like Krita): shifting each colour channel separately turns a patch
  // with a different colour cast into a different hue instead of just a different brightness.
  const luma = (a: number[]) => (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) / wSum;
  const dl = luma(dAvg) - luma(sAvg);
  const shift = [dl, dl, dl];
  for (let i = 0; i < d * d; i++) {
    if (!src.data[i * 4 + 3]) continue;
    for (let c = 0; c < 3; c++) src.data[i * 4 + c] = Math.max(0, Math.min(255, src.data[i * 4 + c] + shift[c]));
  }
  pctx.putImageData(src, 0, 0);
}

/** One stamp centred on (x, y), taking its pixels from (x + dx, y + dy) of `base`. */
export function cloneStamp(layer: HTMLCanvasElement, base: HTMLCanvasElement, x: number, y: number, dx: number, dy: number, o: CloneOptions) {
  const d = Math.max(2, Math.ceil(o.size));
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = d;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(base, x + dx - d / 2, y + dy - d / 2, d, d, 0, 0, d, d);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(softMask(d, o.hardness), 0, 0);
  if (o.healing) heal(tmp, base, x - d / 2, y - d / 2, d);
  const ctx = layer.getContext('2d')!;
  ctx.save();
  ctx.globalAlpha = o.opacity;
  ctx.drawImage(tmp, x - d / 2, y - d / 2);
  ctx.restore();
}

/** Stamps along a segment at the brush spacing. */
export function cloneSegment(layer: HTMLCanvasElement, base: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }, dx: number, dy: number, o: CloneOptions) {
  const step = Math.max(1, o.size * Math.max(0.03, o.spacing));
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(1, Math.floor(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    cloneStamp(layer, base, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, dx, dy, o);
  }
}

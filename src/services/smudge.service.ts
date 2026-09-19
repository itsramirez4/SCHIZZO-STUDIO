import { hexToRgba } from '@/utils/colorUtils';

/**
 * Colour mixer / smudge brush. The brush carries a small "wet paint" buffer: at each step it
 * deposits a share of the carried colour onto the layer, then picks up a share of what is now
 * under it, so colours drag and blend along the stroke like wet paint. `strength` 0–1 is how much
 * paint is dragged; `paint` optionally loads the brush with the primary colour first.
 */
export interface SmudgeState {
  carried: HTMLCanvasElement;
  size: number;
}

export interface SmudgeOptions {
  size: number;
  strength: number;
  /** Fraction of the primary colour mixed into the carried paint on every step (0 = pure smudge). */
  paintLoad: number;
  color: string;
}

function softStamp(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(2, Math.ceil(size));
  const ctx = c.getContext('2d')!;
  const r = c.width / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.7)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

const stampCache = new Map<number, HTMLCanvasElement>();
function getStamp(size: number) {
  const key = Math.round(size);
  let s = stampCache.get(key);
  if (!s) {
    s = softStamp(key);
    stampCache.set(key, s);
    if (stampCache.size > 24) stampCache.delete(stampCache.keys().next().value as number);
  }
  return s;
}

/** Copies the layer region under the brush into the carried buffer. */
function pickUp(layer: HTMLCanvasElement, state: SmudgeState, x: number, y: number, amount: number, opts: SmudgeOptions) {
  const s = state.size;
  const ctx = state.carried.getContext('2d')!;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.drawImage(layer, x - s / 2, y - s / 2, s, s, 0, 0, s, s);
  if (opts.paintLoad > 0) {
    ctx.globalAlpha = opts.paintLoad;
    const { r, g, b } = hexToRgba(opts.color);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, s, s);
  }
  ctx.restore();
}

export function beginSmudge(layer: HTMLCanvasElement, x: number, y: number, opts: SmudgeOptions): SmudgeState {
  const size = Math.max(4, Math.round(opts.size));
  const carried = document.createElement('canvas');
  carried.width = carried.height = size;
  const state: SmudgeState = { carried, size };
  const ctx = carried.getContext('2d')!;
  ctx.drawImage(layer, x - size / 2, y - size / 2, size, size, 0, 0, size, size);
  return state;
}

/** One smudge step at (x, y): deposit the carried paint through a soft mask, then re-load. */
export function smudgeStep(layer: HTMLCanvasElement, state: SmudgeState, x: number, y: number, opts: SmudgeOptions) {
  const s = state.size;
  const lctx = layer.getContext('2d')!;

  // Carried paint masked by the soft stamp → deposited at strength.
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = s;
  const tctx = tmp.getContext('2d')!;
  tctx.drawImage(state.carried, 0, 0);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(getStamp(s), 0, 0, s, s);

  lctx.save();
  lctx.globalAlpha = Math.max(0.02, Math.min(1, opts.strength));
  lctx.drawImage(tmp, x - s / 2, y - s / 2);
  lctx.restore();

  // Pick up a share of what's under the brush now, so the carried colour drifts toward it.
  pickUp(layer, state, x, y, Math.max(0.05, 1 - opts.strength * 0.85), opts);
}

/** Smudges along a segment, stepping at a quarter of the brush size so the trail stays smooth. */
export function smudgeSegment(layer: HTMLCanvasElement, state: SmudgeState, from: { x: number; y: number }, to: { x: number; y: number }, opts: SmudgeOptions) {
  const step = Math.max(1, state.size * 0.2);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(1, Math.floor(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    smudgeStep(layer, state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, opts);
  }
}

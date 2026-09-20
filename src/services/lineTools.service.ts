import type { Brush } from '@/types';

export interface LinePoint {
  x: number;
  y: number;
  pressure?: number;
  /** Multiplier on the stamp radius — how the tapered ends of a line are produced. */
  scale?: number;
}

/** Size of a stroke end tapering in, as a factor 0–1: `pos` px from the end, taper `len` px long. */
export function taperRamp(pos: number, len: number): number {
  return ramp(pos, len);
}

function ramp(pos: number, len: number): number {
  if (len <= 0) return 1;
  const t = Math.max(0, Math.min(1, pos / len));
  // Smoothstep, so the point sharpens gently instead of forming a cone.
  return Math.max(0.04, t * t * (3 - 2 * t));
}

/** Snaps the direction from `a` to `b` to steps of `stepDeg` (Shift while dragging a line). */
export function snapAngle(a: { x: number; y: number }, b: { x: number; y: number }, stepDeg = 15) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const step = (stepDeg * Math.PI) / 180;
  const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / step) * step;
  return { x: a.x + Math.cos(ang) * dist, y: a.y + Math.sin(ang) * dist };
}

/**
 * Samples a straight line (no `c`) or a quadratic Bézier (`c` = control point) at the brush's own
 * stamp spacing and gives each sample the taper scale of its position along the path.
 */
export function buildLinePoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number } | null,
  brush: Brush
): LinePoint[] {
  const at = (t: number) => {
    if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  };
  // Path length by fine sampling (the Bézier has no closed form worth the trouble).
  const fine = 64;
  let length = 0;
  let prev = at(0);
  for (let i = 1; i <= fine; i++) {
    const p = at(i / fine);
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  const step = Math.max(1, brush.size * Math.max(0.02, brush.spacing));
  const n = Math.max(1, Math.ceil(length / step));
  const startLen = brush.taperStart ?? 0;
  const endLen = brush.taperEnd ?? 0;
  // Both tapers can't be longer than the line itself: shrink them proportionally.
  const over = startLen + endLen > length ? length / (startLen + endLen) : 1;
  const out: LinePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = at(t);
    const d = t * length;
    const scale = Math.min(ramp(d, startLen * over), ramp(length - d, endLen * over));
    out.push({ x: p.x, y: p.y, pressure: 1, scale });
  }
  return out;
}

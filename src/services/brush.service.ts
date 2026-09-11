import { v4 as uuid } from 'uuid';
import { Brush } from '@/types';
import presetsJson from '@/assets/brushes/presets.json';

export function loadPresets(): Brush[] {
  return (presetsJson.presets as Brush[]).map((b) => ({ ...b }));
}

export function createBrush(overrides: Partial<Brush> = {}): Brush {
  return {
    id: uuid(),
    name: overrides.name ?? 'Pincel nuevo',
    type: 'custom',
    size: 20,
    hardness: 0.8,
    opacity: 1,
    spacing: 0.1,
    scatter: 0,
    angleJitter: 0,
    sizeJitter: 0,
    ...overrides,
  };
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/** Draws a single soft-edged circular stamp of the brush at (x, y). */
export function applyBrushStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: Brush,
  color: string
) {
  const jitterScale = 1 + ((Math.random() * 2 - 1) * brush.sizeJitter) / 100;
  const radius = Math.max(0.5, (brush.size / 2) * jitterScale);
  const scatterOffset = brush.scatter * brush.size * (Math.random() - 0.5);
  const angle = Math.random() * Math.PI * 2;
  const sx = x + Math.cos(angle) * scatterOffset;
  const sy = y + Math.sin(angle) * scatterOffset;

  ctx.save();
  ctx.globalAlpha = brush.opacity;

  if (brush.hardness >= 0.98) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    const hardStop = Math.max(0, Math.min(1, brush.hardness));
    gradient.addColorStop(0, color);
    gradient.addColorStop(hardStop, color);
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const bigint = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/** Draws a smooth stroke by stamping the brush along the point path, spaced by brush.spacing. */
export function strokeBrush(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  brush: Brush,
  color: string
) {
  if (points.length === 0) return;
  if (points.length === 1) {
    applyBrushStamp(ctx, points[0].x, points[0].y, brush, color);
    return;
  }

  const step = Math.max(1, brush.size * Math.max(0.02, brush.spacing));
  let prev = points[0];
  applyBrushStamp(ctx, prev.x, prev.y, brush, color);

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / step));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      applyBrushStamp(ctx, prev.x + dx * t, prev.y + dy * t, brush, color);
    }
    prev = curr;
  }
}

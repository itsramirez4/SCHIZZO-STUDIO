import { PenPath, flattenToPolyline, pointAndTangentAtDistance, distance } from './path.service';

export interface TextOptions {
  font: string;
  size: number;
  color: string;
  align: CanvasTextAlign;
  weight: 'normal' | 'bold';
}

export const DEFAULT_TEXT_OPTIONS: TextOptions = {
  font: 'Arial',
  size: 48,
  color: '#000000',
  align: 'left',
  weight: 'normal',
};

export function drawText(
  canvas: HTMLCanvasElement,
  text: string,
  x: number,
  y: number,
  options: TextOptions
) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.font = `${options.weight} ${options.size}px ${options.font}`;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = 'top';
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * options.size * 1.2));
  ctx.restore();
}

export type TextEffect = 'normal' | 'emboss' | 'longShadow' | 'neon';

export const TEXT_EFFECT_LABELS: Record<TextEffect, string> = {
  normal: 'Normal',
  emboss: 'Relieve',
  longShadow: 'Sombra larga',
  neon: 'Neón',
};

/** Runs `draw` once per line of `text`, at the line's own baseline position. */
function forEachLine(
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  draw: (line: string, lineX: number, lineY: number) => void
) {
  text.split('\n').forEach((line, i) => draw(line, x, y + i * lineHeight));
}

function prepareTextContext(ctx: CanvasRenderingContext2D, options: TextOptions) {
  ctx.font = `${options.weight} ${options.size}px ${options.font}`;
  ctx.textAlign = options.align;
  ctx.textBaseline = 'top';
}

/** Raised/pressed look: a light highlight offset one way, a dark shadow offset the other. */
export function embossText(canvas: HTMLCanvasElement, text: string, x: number, y: number, options: TextOptions) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  prepareTextContext(ctx, options);
  const depth = Math.max(1, Math.round(options.size / 24));
  forEachLine(text, x, y, options.size * 1.2, (line, lx, ly) => {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(line, lx - depth, ly - depth);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(line, lx + depth, ly + depth);
    ctx.fillStyle = options.color;
    ctx.fillText(line, lx, ly);
  });
  ctx.restore();
}

/** A solid trail stretching away from the text at 45°, built by stacking semi-transparent
 * copies along the diagonal — overlapping copies compound into a smooth, solid-looking tail. */
export function longShadowText(canvas: HTMLCanvasElement, text: string, x: number, y: number, options: TextOptions) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  prepareTextContext(ctx, options);
  const length = Math.round(options.size * 1.1);
  const dx = Math.cos(Math.PI / 4);
  const dy = Math.sin(Math.PI / 4);
  forEachLine(text, x, y, options.size * 1.2, (line, lx, ly) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = length; i >= 1; i--) {
      ctx.fillText(line, lx + dx * i, ly + dy * i);
    }
    ctx.fillStyle = options.color;
    ctx.fillText(line, lx, ly);
  });
  ctx.restore();
}

/** Glowing tube look: canvas's native shadow blur (stacked for intensity) behind a bright core. */
export function neonText(canvas: HTMLCanvasElement, text: string, x: number, y: number, options: TextOptions) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  prepareTextContext(ctx, options);
  forEachLine(text, x, y, options.size * 1.2, (line, lx, ly) => {
    ctx.shadowColor = options.color;
    ctx.shadowBlur = options.size * 0.4;
    ctx.fillStyle = options.color;
    ctx.fillText(line, lx, ly);
    ctx.fillText(line, lx, ly);
    ctx.fillText(line, lx, ly);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, lx, ly);
  });
  ctx.restore();
}

/**
 * Draws `text` following `path` (the pen tool's bezier path) instead of a straight baseline:
 * each character is placed at its running arc-length offset along the curve and rotated to
 * match the curve's tangent there, so the text visibly bends and tilts with the path.
 */
export function drawTextAlongPath(canvas: HTMLCanvasElement, text: string, path: PenPath, options: TextOptions) {
  if (!text || path.points.length < 2) return;
  const ctx = canvas.getContext('2d')!;
  const polyline = flattenToPolyline(path);
  const totalLength = polyline.reduce((sum, p, i) => (i === 0 ? 0 : sum + distance(polyline[i - 1], p)), 0);

  ctx.save();
  ctx.font = `${options.weight} ${options.size}px ${options.font}`;
  ctx.fillStyle = options.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let offset = 0;
  for (const char of text) {
    const charWidth = ctx.measureText(char).width;
    if (offset + charWidth / 2 > totalLength) break;
    const { point, angle } = pointAndTangentAtDistance(polyline, offset + charWidth / 2);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    offset += charWidth;
  }

  ctx.restore();
}

export function drawStyledText(
  canvas: HTMLCanvasElement,
  text: string,
  x: number,
  y: number,
  options: TextOptions,
  effect: TextEffect
) {
  switch (effect) {
    case 'emboss':
      return embossText(canvas, text, x, y, options);
    case 'longShadow':
      return longShadowText(canvas, text, x, y, options);
    case 'neon':
      return neonText(canvas, text, x, y, options);
    default:
      return drawText(canvas, text, x, y, options);
  }
}

import { RGBA, SelectionRect } from '@/types';
import { cloneCanvas } from '@/utils/canvasUtils';

export function getPixel(ctx: CanvasRenderingContext2D, x: number, y: number): RGBA {
  const [r, g, b, a] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return { r, g, b, a: a / 255 };
}

export function setPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: RGBA) {
  const imageData = ctx.createImageData(1, 1);
  imageData.data.set([color.r, color.g, color.b, Math.round(color.a * 255)]);
  ctx.putImageData(imageData, Math.round(x), Math.round(y));
}

export function clearCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Mirrors the canvas in place via a transform + self-draw — GPU-accelerated, O(1) vs. a
 * manual per-pixel swap. Note: putImageData ignores the transform matrix entirely, so the
 * snapshot has to go through drawImage (which does respect it), not getImageData/putImageData.
 */
export function flipHorizontal(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const snapshot = cloneCanvas(canvas);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(snapshot, 0, 0);
  ctx.restore();
}

export function flipVertical(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const snapshot = cloneCanvas(canvas);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(0, canvas.height);
  ctx.scale(1, -1);
  ctx.drawImage(snapshot, 0, 0);
  ctx.restore();
}

function colorsMatch(data: Uint8ClampedArray, idx: number, target: RGBA, tolerance: number): boolean {
  const dr = data[idx] - target.r;
  const dg = data[idx + 1] - target.g;
  const db = data[idx + 2] - target.b;
  const da = data[idx + 3] - target.a * 255;
  return dr * dr + dg * dg + db * db + da * da <= tolerance * tolerance * 4;
}

/** Classic 4-way flood fill using a scanline-free stack approach. Confined to `bounds` when given. */
export function floodFill(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  fillColor: RGBA,
  tolerance = 32,
  bounds?: SelectionRect
) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const minX = bounds ? Math.max(0, Math.round(bounds.x)) : 0;
  const minY = bounds ? Math.max(0, Math.round(bounds.y)) : 0;
  const maxX = bounds ? Math.min(width - 1, Math.round(bounds.x + bounds.w) - 1) : width - 1;
  const maxY = bounds ? Math.min(height - 1, Math.round(bounds.y + bounds.h) - 1) : height - 1;

  const x0 = Math.round(startX);
  const y0 = Math.round(startY);
  if (x0 < minX || y0 < minY || x0 > maxX || y0 > maxY) return;

  const startIdx = (y0 * width + x0) * 4;
  const target: RGBA = {
    r: data[startIdx],
    g: data[startIdx + 1],
    b: data[startIdx + 2],
    a: data[startIdx + 3] / 255,
  };

  const fillR = fillColor.r;
  const fillG = fillColor.g;
  const fillB = fillColor.b;
  const fillA = Math.round(fillColor.a * 255);

  if (
    target.r === fillR &&
    target.g === fillG &&
    target.b === fillB &&
    Math.round(target.a * 255) === fillA
  ) {
    return;
  }

  const stack: [number, number][] = [[x0, y0]];
  const visited = new Uint8Array(width * height);

  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < minX || y < minY || x > maxX || y > maxY) continue;
    const pos = y * width + x;
    if (visited[pos]) continue;
    const idx = pos * 4;
    if (!colorsMatch(data, idx, target, tolerance)) continue;

    visited[pos] = 1;
    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

/** Runs `fn` with the context clipped to `bounds` (if given), always restoring afterwards. */
export function withClip(ctx: CanvasRenderingContext2D, bounds: SelectionRect | null | undefined, fn: () => void) {
  if (!bounds) {
    fn();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.clip();
  fn();
  ctx.restore();
}

export function eraseStroke(
  canvas: HTMLCanvasElement,
  points: { x: number; y: number }[],
  size: number
) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = size;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

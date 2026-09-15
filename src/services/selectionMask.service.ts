import { RGBA, SelectionRect } from '@/types';
import { createCanvas, cloneCanvas } from '@/utils/canvasUtils';
import { gaussianBlur } from '@/services/filter.service';

/**
 * Precise (non-rectangular) selections, represented as a white-on-transparent alpha mask
 * canvas the same size as the layer — alpha 255 = selected, 0 = not. The existing
 * `selection: SelectionRect` stays around as the mask's bounding box, since most of the app
 * (paint bucket bounds, comic tools, palette extraction, etc.) already reasons about
 * selections that way; only paint bucket and "delete selection contents" are updated to
 * respect the exact mask shape in this round — everything else still clips to the bounding
 * box only. Making every selection-consuming feature mask-aware would be a much larger,
 * separate pass than this one.
 */

export function maskToBoundingBox(mask: HTMLCanvasElement): SelectionRect | null {
  const ctx = mask.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, mask.width, mask.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Rasterizes a closed polygon (screen/canvas-space points) into a selection mask. */
export function polygonToMask(points: { x: number; y: number }[], width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  if (points.length < 3) return canvas;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

function colorsMatch(data: Uint8ClampedArray, idx: number, target: RGBA, tolerance: number): boolean {
  const dr = data[idx] - target.r;
  const dg = data[idx + 1] - target.g;
  const db = data[idx + 2] - target.b;
  const da = data[idx + 3] - target.a * 255;
  return dr * dr + dg * dg + db * db + da * da <= tolerance * tolerance * 4;
}

/** Magic wand: contiguous flood-fill by color similarity from one clicked pixel, producing a
 * mask instead of filling color (reuses the same traversal shape as canvas.service's
 * floodFill). */
export function magicWandMask(source: HTMLCanvasElement, startX: number, startY: number, tolerance: number): HTMLCanvasElement {
  const { width, height } = source;
  const mask = createCanvas(width, height);
  const srcCtx = source.getContext('2d')!;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const x0 = Math.round(startX);
  const y0 = Math.round(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return mask;

  const startIdx = (y0 * width + x0) * 4;
  const target: RGBA = { r: data[startIdx], g: data[startIdx + 1], b: data[startIdx + 2], a: data[startIdx + 3] / 255 };

  const maskCtx = mask.getContext('2d')!;
  const maskImageData = maskCtx.createImageData(width, height);
  const maskData = maskImageData.data;

  const stack: [number, number][] = [[x0, y0]];
  const visited = new Uint8Array(width * height);

  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pos = y * width + x;
    if (visited[pos]) continue;
    const idx = pos * 4;
    if (!colorsMatch(data, idx, target, tolerance)) continue;

    visited[pos] = 1;
    maskData[idx] = 255;
    maskData[idx + 1] = 255;
    maskData[idx + 2] = 255;
    maskData[idx + 3] = 255;

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  maskCtx.putImageData(maskImageData, 0, 0);
  return mask;
}

/** Color range: every pixel matching the target color within tolerance, anywhere on the
 * layer — unlike magic wand, not limited to one contiguous region. */
export function colorRangeMask(source: HTMLCanvasElement, target: RGBA, tolerance: number): HTMLCanvasElement {
  const { width, height } = source;
  const mask = createCanvas(width, height);
  const srcData = source.getContext('2d')!.getImageData(0, 0, width, height).data;

  const maskCtx = mask.getContext('2d')!;
  const maskImageData = maskCtx.createImageData(width, height);
  const maskData = maskImageData.data;

  for (let i = 0; i < srcData.length; i += 4) {
    if (colorsMatch(srcData, i, target, tolerance)) {
      maskData[i] = 255;
      maskData[i + 1] = 255;
      maskData[i + 2] = 255;
      maskData[i + 3] = 255;
    }
  }

  maskCtx.putImageData(maskImageData, 0, 0);
  return mask;
}

export function invertMask(mask: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(mask);
  const ctx = out.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255 - data[i];
  }
  ctx.putImageData(imageData, 0, 0);
  return out;
}

/** Soft edges via the same gaussian blur the Filters panel already uses — a mask is just a
 * grayscale/alpha image, so blurring its alpha channel is exactly what "feather" means. */
export function featherMask(mask: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const out = cloneCanvas(mask);
  if (radius > 0) gaussianBlur(out, radius);
  return out;
}

function morphology(mask: HTMLCanvasElement, amount: number, mode: 'dilate' | 'erode'): HTMLCanvasElement {
  const out = cloneCanvas(mask);
  const ctx = out.getContext('2d')!;
  const { width, height } = out;
  let current = ctx.getImageData(0, 0, width, height).data;

  for (let step = 0; step < amount; step++) {
    const next = new Uint8ClampedArray(current.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let value = current[(y * width + x) * 4 + 3];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = current[(ny * width + nx) * 4 + 3];
          value = mode === 'dilate' ? Math.max(value, neighbor) : Math.min(value, neighbor);
        }
        const idx = (y * width + x) * 4;
        next[idx] = next[idx + 1] = next[idx + 2] = 255;
        next[idx + 3] = value;
      }
    }
    current = next;
  }

  ctx.putImageData(new ImageData(current, width, height), 0, 0);
  return out;
}

export function expandMask(mask: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  return morphology(mask, amount, 'dilate');
}

export function contractMask(mask: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  return morphology(mask, amount, 'erode');
}

/** Synthesizes a mask from the current rectangular selection, so modifiers (invert/feather/
 * expand/contract) work the same way whether the selection came from a drag-rectangle or from
 * lasso/wand/color-range. */
export function rectToMask(rect: SelectionRect, width: number, height: number): HTMLCanvasElement {
  const mask = createCanvas(width, height);
  const ctx = mask.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  return mask;
}

/** Runs `operation` (any canvas-mutating function) then keeps only the part of the change that
 * falls within `mask`, restoring everything else to how it was before — this is what lets a
 * one-shot action like the paint bucket respect an exact lasso/wand shape instead of just its
 * rectangular bounding box, without that action needing to know about masks at all. */
export function applyMaskedOperation(canvas: HTMLCanvasElement, mask: HTMLCanvasElement, operation: () => void) {
  const ctx = canvas.getContext('2d')!;
  const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
  operation();
  const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maskData = mask.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;

  const beforeData = before.data;
  const afterData = after.data;
  for (let i = 0; i < afterData.length; i += 4) {
    const m = maskData[i + 3] / 255;
    if (m >= 1) continue;
    afterData[i] = Math.round(afterData[i] * m + beforeData[i] * (1 - m));
    afterData[i + 1] = Math.round(afterData[i + 1] * m + beforeData[i + 1] * (1 - m));
    afterData[i + 2] = Math.round(afterData[i + 2] * m + beforeData[i + 2] * (1 - m));
    afterData[i + 3] = Math.round(afterData[i + 3] * m + beforeData[i + 3] * (1 - m));
  }
  ctx.putImageData(after, 0, 0);
}

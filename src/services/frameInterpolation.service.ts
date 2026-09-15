import { TweenEasing } from '@/types/animation';
import { createCanvas } from '@/utils/canvasUtils';

function applyEasing(t: number, easing: TweenEasing): number {
  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

/** Crossfades two flattened frame canvases at `progress` (0-1) — a straight per-pixel blend,
 * not shape-aware morphing (true edge-correspondence warping is a much bigger algorithm than
 * a tween aid needs). This is the same kind of "ghost" inbetween traditional 2D animation
 * software offers as a rough guide, not a replacement for hand-drawn inbetweens. */
export function blendCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement, progress: number, easing: TweenEasing = 'linear'): HTMLCanvasElement {
  const t = applyEasing(Math.max(0, Math.min(1, progress)), easing);
  const width = a.width;
  const height = a.height;

  const dataA = a.getContext('2d')!.getImageData(0, 0, width, height).data;
  const dataB = b.getContext('2d')!.getImageData(0, 0, width, height).data;
  const out = new Uint8ClampedArray(dataA.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(dataA[i] * (1 - t) + dataB[i] * t);
  }

  const canvas = createCanvas(width, height);
  canvas.getContext('2d')!.putImageData(new ImageData(out, width, height), 0, 0);
  return canvas;
}

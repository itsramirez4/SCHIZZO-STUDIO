import { v4 as uuid } from 'uuid';
import { LibraryGradient, GradientStop } from '@/types/assetLibrary';
import { SelectionRect } from '@/types';

export function createGradient(name: string, stops: GradientStop[], kind: 'linear' | 'radial' = 'linear'): LibraryGradient {
  return {
    id: uuid(),
    name,
    tags: [],
    favorite: false,
    kind,
    stops: [...stops].sort((a, b) => a.position - b.position),
    builtIn: false,
    created: Date.now(),
  };
}

function builtIn(name: string, stops: GradientStop[], kind: 'linear' | 'radial' = 'linear'): LibraryGradient {
  return { ...createGradient(name, stops, kind), builtIn: true };
}

export const BUILT_IN_GRADIENTS: LibraryGradient[] = [
  builtIn('Arcoíris', [
    { position: 0, color: '#ff0000' },
    { position: 0.2, color: '#ff7f00' },
    { position: 0.4, color: '#ffff00' },
    { position: 0.6, color: '#00ff00' },
    { position: 0.8, color: '#0000ff' },
    { position: 1, color: '#8b00ff' },
  ]),
  builtIn('Atardecer', [
    { position: 0, color: '#ff0000' },
    { position: 0.5, color: '#ffaa00' },
    { position: 1, color: '#ffff00' },
  ]),
  builtIn('Océano', [
    { position: 0, color: '#0047ab' },
    { position: 0.5, color: '#00a0e8' },
    { position: 1, color: '#87ceeb' },
  ]),
  builtIn('Monocromo', [
    { position: 0, color: '#000000' },
    { position: 1, color: '#ffffff' },
  ]),
];

/** Renders a gradient into an arbitrary rect of a 2D context — shared by preview swatches and real fills. */
function paintGradient(ctx: CanvasRenderingContext2D, gradient: LibraryGradient, x: number, y: number, w: number, h: number) {
  const canvasGradient =
    gradient.kind === 'linear'
      ? ctx.createLinearGradient(x, y, x + w, y)
      : ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 2);
  gradient.stops.forEach((s) => canvasGradient.addColorStop(s.position, s.color));
  ctx.save();
  ctx.fillStyle = canvasGradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function generatePreview(gradient: LibraryGradient, width = 96, height = 40): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  paintGradient(ctx, gradient, 0, 0, width, height);
  return canvas.toDataURL();
}

/** Fills `canvas` (or just `bounds` within it) with the gradient — the raster-fill path used by
 * PatternFill.tsx for presets, reused here so gradients are actually paintable rather than a
 * disconnected gallery. */
export function applyGradientFill(canvas: HTMLCanvasElement, gradient: LibraryGradient, bounds?: SelectionRect) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  if (bounds) {
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip();
  }
  const x = bounds?.x ?? 0;
  const y = bounds?.y ?? 0;
  const w = bounds?.w ?? canvas.width;
  const h = bounds?.h ?? canvas.height;
  paintGradient(ctx, gradient, x, y, w, h);
  ctx.restore();
}

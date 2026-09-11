import { createCanvas } from '@/utils/canvasUtils';
import { SelectionRect } from '@/types';

export interface PatternPreset {
  id: string;
  name: string;
  tileSize: number;
  draw: (ctx: CanvasRenderingContext2D, size: number, color: string) => void;
}

export const PATTERN_PRESETS: PatternPreset[] = [
  {
    id: 'lines-horizontal',
    name: 'Líneas horizontales',
    tileSize: 8,
    draw: (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, 2);
    },
  },
  {
    id: 'lines-vertical',
    name: 'Líneas verticales',
    tileSize: 8,
    draw: (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 2, size);
    },
  },
  {
    id: 'lines-diagonal',
    name: 'Líneas diagonales',
    tileSize: 12,
    draw: (ctx, size, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(-size / 2, size / 2);
      ctx.lineTo(size / 2, -size / 2);
      ctx.moveTo(size / 2, size * 1.5);
      ctx.lineTo(size * 1.5, size / 2);
      ctx.stroke();
    },
  },
  {
    id: 'grid',
    name: 'Cuadrícula',
    tileSize: 10,
    draw: (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, 1);
      ctx.fillRect(0, 0, 1, size);
    },
  },
  {
    id: 'dots',
    name: 'Puntos',
    tileSize: 16,
    draw: (ctx, size, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 8, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'checkers',
    name: 'Cuadros',
    tileSize: 16,
    draw: (ctx, size, color) => {
      const half = size / 2;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
    },
  },
];

const tileCache = new Map<string, HTMLCanvasElement>();

/** Builds (and caches) a small opaque-white tile canvas with the preset drawn in `color`. */
export function getPatternTile(presetId: string, color: string): HTMLCanvasElement {
  const cacheKey = `${presetId}:${color}`;
  const cached = tileCache.get(cacheKey);
  if (cached) return cached;

  const preset = PATTERN_PRESETS.find((p) => p.id === presetId) ?? PATTERN_PRESETS[0];
  const tile = createCanvas(preset.tileSize, preset.tileSize);
  const ctx = tile.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, preset.tileSize, preset.tileSize);
  preset.draw(ctx, preset.tileSize, color);

  tileCache.set(cacheKey, tile);
  return tile;
}

/** Fills `canvas` (or just `bounds` within it, if given) with a repeating pattern tile. */
export function fillWithPattern(canvas: HTMLCanvasElement, presetId: string, color: string, bounds?: SelectionRect) {
  const ctx = canvas.getContext('2d')!;
  const tile = getPatternTile(presetId, color);
  const cssPattern = ctx.createPattern(tile, 'repeat');
  if (!cssPattern) return;

  ctx.save();
  if (bounds) {
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.clip();
  }
  ctx.fillStyle = cssPattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

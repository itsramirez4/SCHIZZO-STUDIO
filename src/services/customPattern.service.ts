import { v4 as uuid } from 'uuid';
import { LibraryPattern } from '@/types/assetLibrary';
import { SelectionRect } from '@/types';
import { createCanvas } from '@/utils/canvasUtils';

const MAX_TILE_SIZE = 512;

/** Custom patterns come from a user image (unlike the built-in procedural PATTERN_PRESETS in
 * pattern.service.ts, which stay untouched and keep being drawn/recolored on the fly) — downscale
 * oversized source images so the tile stays a reasonable size to store and to tile from. */
export function createPatternFromImage(img: HTMLImageElement, name: string): LibraryPattern {
  const scale = Math.min(1, MAX_TILE_SIZE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = createCanvas(width, height);
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

  return {
    id: uuid(),
    name,
    tags: [],
    favorite: false,
    tileDataUrl: canvas.toDataURL('image/png'),
    tileWidth: width,
    tileHeight: height,
    created: Date.now(),
  };
}

/** Fills `canvas` (or just `bounds`) by tiling the pattern's image — mirrors
 * pattern.service.ts's fillWithPattern, just sourced from a stored image instead of a preset. */
export function applyCustomPatternFill(canvas: HTMLCanvasElement, pattern: LibraryPattern, tileImg: HTMLImageElement, bounds?: SelectionRect) {
  const ctx = canvas.getContext('2d')!;
  const cssPattern = ctx.createPattern(tileImg, 'repeat');
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

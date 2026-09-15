import { v4 as uuid } from 'uuid';
import { LibraryTexture } from '@/types/assetLibrary';
import { SelectionRect } from '@/types';
import { createCanvas } from '@/utils/canvasUtils';

const MAX_TEXTURE_SIZE = 1024;

export function createTextureFromImage(img: HTMLImageElement, name: string): LibraryTexture {
  const scale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = createCanvas(width, height);
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

  return {
    id: uuid(),
    name,
    tags: [],
    favorite: false,
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
    created: Date.now(),
  };
}

/** Applies a texture to `canvas` (or just `bounds`), either tiled (repeated at native size) or
 * stretched to cover the target area. */
export function applyTextureFill(
  canvas: HTMLCanvasElement,
  textureImg: HTMLImageElement,
  mode: 'tile' | 'stretch',
  bounds?: SelectionRect
) {
  const ctx = canvas.getContext('2d')!;
  const x = bounds?.x ?? 0;
  const y = bounds?.y ?? 0;
  const w = bounds?.w ?? canvas.width;
  const h = bounds?.h ?? canvas.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (mode === 'stretch') {
    ctx.drawImage(textureImg, x, y, w, h);
  } else {
    const cssPattern = ctx.createPattern(textureImg, 'repeat');
    if (cssPattern) {
      ctx.fillStyle = cssPattern;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.restore();
}

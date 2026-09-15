import { BatchFilterConfig, BatchOutputFormat, BatchResizeConfig } from '@/types/batchOperations';
import { createCanvas, dataUrlToImage, canvasToDataUrl } from '@/utils/canvasUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';
import * as filterService from '@/services/filter.service';
import { encodeBmp } from '@/services/bmp.service';
import { encodeTiff } from '@/services/tiff.service';

/** Draws `img` onto a `width`x`height` canvas per `mode` — 'exact' stretches to fill,
 * 'fit' letterboxes to preserve aspect ratio, 'fill' crops to cover it without distortion. */
export function resizeToCanvas(img: HTMLImageElement | HTMLCanvasElement, width: number, height: number, mode: BatchResizeMode): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  if (mode === 'exact') {
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  }

  const scale = mode === 'fit' ? Math.min(width / img.width, height / img.height) : Math.max(width / img.width, height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;

  // 'fit': drawW/drawH <= canvas size, so this letterboxes inside it.
  // 'fill': drawW/drawH >= canvas size, so this overflows and the canvas clips it — a crop.
  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas;
}

type BatchResizeMode = BatchResizeConfig['mode'];

/** Applies the configured filters in sequence — every one of these already exists and is
 * used by the real Filters panel; batch processing just calls them in a row on each image. */
export function applyBatchFilters(canvas: HTMLCanvasElement, config: BatchFilterConfig) {
  if (config.brightness !== 0 || config.contrast !== 0) {
    filterService.brightnessContrast(canvas, config.brightness, config.contrast);
  }
  if (config.saturation !== 0) {
    filterService.saturation(canvas, config.saturation);
  }
  if (config.sepia > 0) {
    filterService.sepia(canvas, config.sepia / 100);
  }
  if (config.grayscale) {
    filterService.desaturate(canvas);
  }
  if (config.invert) {
    filterService.invert(canvas);
  }
}

/** Encodes a canvas to the chosen format, reusing the app's real encoders (bmp/tiff are
 * from-scratch binary encoders already used by the single-image export menu; png/jpg/webp/avif
 * are native canvas.toDataURL, same as export.service.ts does). */
export function encodeCanvas(canvas: HTMLCanvasElement, format: BatchOutputFormat, quality: number): string {
  switch (format) {
    case 'bmp':
      return `data:image/bmp;base64,${uint8ToBase64(encodeBmp(canvas))}`;
    case 'tiff':
      return `data:image/tiff;base64,${uint8ToBase64(encodeTiff(canvas))}`;
    case 'jpg': {
      // JPEG has no alpha — flatten onto white first, same as export.service.ts's exportJPG.
      const flat = createCanvas(canvas.width, canvas.height);
      const ctx = flat.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      return canvasToDataUrl(flat, 'image/jpeg', quality);
    }
    case 'webp':
      return canvasToDataUrl(canvas, 'image/webp', quality);
    case 'avif':
      return canvasToDataUrl(canvas, 'image/avif', quality);
    default:
      return canvasToDataUrl(canvas, 'image/png');
  }
}

/** Full pipeline for one image: decode -> optional resize -> filters -> encode. */
export async function processBatchImage(
  sourceDataUrl: string,
  resize: BatchResizeConfig,
  filters: BatchFilterConfig,
  format: BatchOutputFormat,
  quality: number
): Promise<string> {
  const img = await dataUrlToImage(sourceDataUrl);
  const canvas = resize.enabled ? resizeToCanvas(img, resize.width, resize.height, resize.mode) : createCanvas(img.width, img.height);
  if (!resize.enabled) {
    canvas.getContext('2d')!.drawImage(img, 0, 0);
  }
  applyBatchFilters(canvas, filters);
  return encodeCanvas(canvas, format, quality);
}

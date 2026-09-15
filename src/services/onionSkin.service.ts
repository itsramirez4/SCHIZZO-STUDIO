import { createCanvas } from '@/utils/canvasUtils';

/** Tints a flattened frame a solid color while preserving its original alpha shape — the
 * classic red-behind/blue-ahead onion-skin convention. 'multiply' over the whole canvas would
 * also paint previously-transparent pixels opaque, so a 'destination-in' pass re-masks the
 * result back to the source's real alpha afterward. */
export function tintFrame(source: HTMLCanvasElement, color: string): string {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(source, 0, 0);

  return canvas.toDataURL();
}

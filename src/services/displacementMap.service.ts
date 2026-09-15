import { createCanvas } from '@/utils/canvasUtils';

export type DisplacementChannel = 'luminance' | 'red' | 'green' | 'blue' | 'rgb';

function channelValue(data: Uint8ClampedArray, idx: number, channel: DisplacementChannel, axis: 'x' | 'y'): number {
  if (channel === 'luminance') return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  if (channel === 'red') return data[idx];
  if (channel === 'green') return data[idx + 1];
  if (channel === 'blue') return data[idx + 2];
  // 'rgb' mode: matches Photoshop's displacement map convention — the map's red channel drives
  // X offset, green drives Y offset, independently.
  return axis === 'x' ? data[idx] : data[idx + 1];
}

function sampleBilinear(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): [number, number, number, number] {
  const cx = Math.max(0, Math.min(width - 1.001, x));
  const cy = Math.max(0, Math.min(height - 1.001, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = cx - x0;
  const fy = cy - y0;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const p00 = data[(y0 * width + x0) * 4 + c];
    const p10 = data[(y0 * width + x1) * 4 + c];
    const p01 = data[(y1 * width + x0) * 4 + c];
    const p11 = data[(y1 * width + x1) * 4 + c];
    out[c] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
  }
  return out;
}

/** Displaces each pixel of `canvas` by an offset read from `mapCanvas` (resized to match if
 * needed) — value 128 means no displacement, above/below pushes the sample point in the
 * positive/negative direction, scaled by `scaleX`/`scaleY`. */
export function applyDisplacementMap(canvas: HTMLCanvasElement, mapCanvas: HTMLCanvasElement, scaleX: number, scaleY: number, channel: DisplacementChannel) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;

  let map = mapCanvas;
  if (mapCanvas.width !== width || mapCanvas.height !== height) {
    map = createCanvas(width, height);
    map.getContext('2d')!.drawImage(mapCanvas, 0, 0, width, height);
  }
  const mapData = map.getContext('2d')!.getImageData(0, 0, width, height).data;

  const src = ctx.getImageData(0, 0, width, height);
  const sd = src.data;
  const out = ctx.createImageData(width, height);
  const dd = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mapIdx = (y * width + x) * 4;
      const vx = (channelValue(mapData, mapIdx, channel, 'x') - 128) / 128;
      const vy = (channelValue(mapData, mapIdx, channel, 'y') - 128) / 128;
      const srcX = x + vx * scaleX;
      const srcY = y + vy * scaleY;
      const [r, g, b, a] = sampleBilinear(sd, width, height, srcX, srcY);
      const idx = (y * width + x) * 4;
      dd[idx] = r;
      dd[idx + 1] = g;
      dd[idx + 2] = b;
      dd[idx + 3] = a;
    }
  }
  ctx.putImageData(out, 0, 0);
}

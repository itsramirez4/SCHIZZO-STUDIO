/**
 * Liquify-style brush: each call is one "dab" applied to a local region around the cursor,
 * reading the CURRENT canvas state and writing back — repeated dabs during a drag accumulate
 * into a continuous deformation, the same way a real liquify/warp tool works. Every dab only
 * touches its own local bounding box (2*radius square) for performance, since a stroke can fire
 * many dabs per second.
 */

export type LiquifyMode = 'push' | 'twirl' | 'pinch' | 'expand' | 'turbulence' | 'smooth';

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function sampleBilinearLocal(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): [number, number, number, number] {
  const cx = Math.max(0, Math.min(w - 1.001, x));
  const cy = Math.max(0, Math.min(h - 1.001, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = cx - x0;
  const fy = cy - y0;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const p00 = data[(y0 * w + x0) * 4 + c];
    const p10 = data[(y0 * w + x1) * 4 + c];
    const p01 = data[(y1 * w + x0) * 4 + c];
    const p11 = data[(y1 * w + x1) * 4 + c];
    out[c] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
  }
  return out;
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function applyLiquifyDab(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  strength: number,
  mode: LiquifyMode,
  dragDx = 0,
  dragDy = 0
) {
  const ctx = canvas.getContext('2d')!;
  const left = Math.max(0, Math.floor(x - radius));
  const top = Math.max(0, Math.floor(y - radius));
  const right = Math.min(canvas.width, Math.ceil(x + radius));
  const bottom = Math.min(canvas.height, Math.ceil(y + radius));
  const w = right - left;
  const h = bottom - top;
  if (w <= 1 || h <= 1) return;

  const src = ctx.getImageData(left, top, w, h);
  const sd = src.data;
  const out = ctx.createImageData(w, h);
  const dd = out.data;

  const cx = x - left;
  const cy = y - top;
  const s = Math.max(0, Math.min(1, strength));
  const smoothWindow = Math.max(1, Math.round(radius * 0.15));

  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      const idx = (ly * w + lx) * 4;
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.hypot(dx, dy);

      if (dist >= radius) {
        dd[idx] = sd[idx];
        dd[idx + 1] = sd[idx + 1];
        dd[idx + 2] = sd[idx + 2];
        dd[idx + 3] = sd[idx + 3];
        continue;
      }

      const falloff = smoothstep(1 - dist / radius) * s;
      let px: [number, number, number, number];

      if (mode === 'smooth') {
        let r_ = 0, g_ = 0, b_ = 0, a_ = 0, count = 0;
        const win = Math.max(1, Math.round(smoothWindow * falloff) || 1);
        for (let oy = -win; oy <= win; oy++) {
          for (let ox = -win; ox <= win; ox++) {
            const nx = Math.max(0, Math.min(w - 1, lx + ox));
            const ny = Math.max(0, Math.min(h - 1, ly + oy));
            const nIdx = (ny * w + nx) * 4;
            r_ += sd[nIdx]; g_ += sd[nIdx + 1]; b_ += sd[nIdx + 2]; a_ += sd[nIdx + 3];
            count++;
          }
        }
        const avgR = r_ / count, avgG = g_ / count, avgB = b_ / count, avgA = a_ / count;
        px = [
          sd[idx] + (avgR - sd[idx]) * falloff,
          sd[idx + 1] + (avgG - sd[idx + 1]) * falloff,
          sd[idx + 2] + (avgB - sd[idx + 2]) * falloff,
          sd[idx + 3] + (avgA - sd[idx + 3]) * falloff,
        ];
      } else {
        let srcX = lx;
        let srcY = ly;
        if (mode === 'push') {
          srcX = lx - dragDx * falloff;
          srcY = ly - dragDy * falloff;
        } else if (mode === 'twirl') {
          const angle = Math.atan2(dy, dx) - falloff * (Math.PI / 2);
          srcX = cx + dist * Math.cos(angle);
          srcY = cy + dist * Math.sin(angle);
        } else if (mode === 'pinch') {
          const newDist = dist * (1 - falloff * 0.6);
          const angle = Math.atan2(dy, dx);
          srcX = cx + newDist * Math.cos(angle);
          srcY = cy + newDist * Math.sin(angle);
        } else if (mode === 'expand') {
          const newDist = dist * (1 + falloff * 0.6);
          const angle = Math.atan2(dy, dx);
          srcX = cx + newDist * Math.cos(angle);
          srcY = cy + newDist * Math.sin(angle);
        } else if (mode === 'turbulence') {
          srcX = lx + (hash2(left + lx, top + ly) - 0.5) * radius * 0.4 * falloff;
          srcY = ly + (hash2(top + ly, left + lx) - 0.5) * radius * 0.4 * falloff;
        }
        px = sampleBilinearLocal(sd, w, h, srcX, srcY);
      }

      dd[idx] = px[0];
      dd[idx + 1] = px[1];
      dd[idx + 2] = px[2];
      dd[idx + 3] = px[3];
    }
  }

  ctx.putImageData(out, left, top);
}

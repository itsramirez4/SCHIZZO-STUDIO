/**
 * Lighting variations for studying light and shadow. The picture's brightness is read as a relief (bright
 * = high), normals are derived from it and a light from another direction is applied — so a shaded
 * drawing or a photo can be seen lit from the left, from above, from behind, warm or cold, hard or soft.
 * It is a study aid for judging where light and shadow could go, not a physically exact relighting.
 */

export interface LightVariant {
  id: string;
  label: string;
  canvas: HTMLCanvasElement;
}

interface LightSpec {
  id: string;
  label: string;
  /** direction the light comes FROM, in image space (x right, y down, z toward the viewer) */
  dir: [number, number, number];
  ambient: number;
  diffuse: number;
  tint: [number, number, number];
  /** rim (edge) light from behind */
  rim?: number;
  blur?: number;
  /** how strongly bumps cast shadows onto what lies behind them (0 = none) */
  shadows?: number;
}

const SPECS: LightSpec[] = [
  { id: 'left', label: 'Luz desde la izquierda', dir: [-0.85, -0.15, 0.5], ambient: 0.45, diffuse: 0.9, tint: [1, 1, 1], shadows: 0.8 },
  { id: 'right', label: 'Luz desde la derecha', dir: [0.85, -0.15, 0.5], ambient: 0.45, diffuse: 0.9, tint: [1, 1, 1], shadows: 0.8 },
  { id: 'top', label: 'Luz cenital (desde arriba)', dir: [0, -0.9, 0.45], ambient: 0.45, diffuse: 0.9, tint: [1, 1, 1], shadows: 0.7 },
  { id: 'bottom', label: 'Luz desde abajo (dramática)', dir: [0, 0.9, 0.45], ambient: 0.35, diffuse: 1, tint: [1, 0.96, 0.9], shadows: 0.7 },
  { id: 'back', label: 'Contraluz', dir: [0, -0.3, -0.9], ambient: 0.35, diffuse: 0.4, tint: [1, 1, 1], rim: 1.1 },
  { id: 'soft', label: 'Luz suave (nublado)', dir: [-0.3, -0.5, 0.8], ambient: 0.8, diffuse: 0.35, tint: [0.97, 0.99, 1.03], blur: 2 },
  { id: 'hard', label: 'Luz dura (mediodía)', dir: [-0.6, -0.7, 0.4], ambient: 0.2, diffuse: 1.3, tint: [1.02, 1, 0.97], shadows: 1 },
  { id: 'warm', label: 'Cálida (atardecer)', dir: [-0.8, -0.1, 0.55], ambient: 0.45, diffuse: 0.9, tint: [1.12, 0.98, 0.8], shadows: 0.85 },
  { id: 'cold', label: 'Fría (luna / sombra)', dir: [0.7, -0.4, 0.55], ambient: 0.45, diffuse: 0.85, tint: [0.82, 0.96, 1.16], shadows: 0.7 },
];

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** How much brightness variation the picture has: near 0 for flat colour or bare line art (nothing to light). */
export function reliefAmount(canvas: HTMLCanvasElement): number {
  const w = Math.min(64, canvas.width);
  const h = Math.min(64, canvas.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  const d = c.getContext('2d')!.getImageData(0, 0, w, h).data;
  const vals: number[] = [];
  for (let i = 0; i < d.length; i += 4) vals.push((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
}

function shade(src: HTMLCanvasElement, spec: LightSpec, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(src.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) luma[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  const height = boxBlur(luma, w, h, Math.max(1, Math.round(Math.max(w, h) * 0.006) + (spec.blur ?? 0)));
  const relief = 6;
  const [lx, ly, lz] = spec.dir;
  const ln = Math.hypot(lx, ly, lz);
  const L: [number, number, number] = [lx / ln, ly / ln, lz / ln];
  const shading = new Float32Array(w * h);
  // Cast shadows: walk from each pixel toward the light over the brightness-as-height surface; if something along the
  // way rises above the ray, the pixel is in shadow. Soft-edged, and only where the light comes from the front.
  const castShadow = new Float32Array(w * h);
  if (spec.shadows && L[2] > 0.05 && Math.hypot(L[0], L[1]) > 0.05) {
    const planar = Math.hypot(L[0], L[1]);
    const ux = L[0] / planar;
    const uy = L[1] / planar;
    const slope = L[2] / planar; // ray height gained per pixel travelled toward the light
    const heightScale = 0.09 * Math.max(w, h);
    const reach = 0.22 * Math.max(w, h);
    const STEPS = 40;
    const stepLen = reach / STEPS;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const h0 = height[y * w + x] * heightScale;
        let worst = 0;
        for (let k = 1; k <= STEPS; k++) {
          const sx = Math.round(x + ux * stepLen * k);
          const sy = Math.round(y + uy * stepLen * k);
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
          const over = height[sy * w + sx] * heightScale - (h0 + slope * stepLen * k);
          if (over > worst) worst = over;
        }
        castShadow[y * w + x] = Math.min(1, worst / 2.5);
      }
    }
  }
  let sum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = height[y * w + Math.min(w - 1, x + 1)] - height[y * w + Math.max(0, x - 1)];
      const gy = height[Math.min(h - 1, y + 1) * w + x] - height[Math.max(0, y - 1) * w + x];
      // brighter = closer to the viewer: the surface normal leans away from rising brightness
      let nx = -gx * relief * (w / 128);
      let ny = -gy * relief * (w / 128);
      const nl = Math.hypot(nx, ny, 1);
      nx /= nl;
      ny /= nl;
      const nz = 1 / nl;
      const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) * (1 - (spec.shadows ?? 0) * 0.9 * castShadow[i]);
      let v = spec.ambient + spec.diffuse * lam;
      if (spec.rim) v += spec.rim * Math.pow(1 - nz, 1.5) * 3;
      shading[i] = v;
      sum += v;
    }
  }
  const mean = sum / (w * h) || 1;
  for (let i = 0; i < w * h; i++) {
    const k = shading[i] / mean;
    d[i * 4] = Math.max(0, Math.min(255, d[i * 4] * k * spec.tint[0]));
    d[i * 4 + 1] = Math.max(0, Math.min(255, d[i * 4 + 1] * k * spec.tint[1]));
    d[i * 4 + 2] = Math.max(0, Math.min(255, d[i * 4 + 2] * k * spec.tint[2]));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function relightVariants(src: HTMLCanvasElement, maxSide = 420): LightVariant[] {
  return SPECS.map((s) => ({ id: s.id, label: s.label, canvas: shade(src, s, maxSide) }));
}

export function relightFull(src: HTMLCanvasElement, id: string): HTMLCanvasElement {
  const spec = SPECS.find((s) => s.id === id) ?? SPECS[0];
  return shade(src, spec, Math.max(src.width, src.height));
}

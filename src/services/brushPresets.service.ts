import { Brush } from '@/types';

/**
 * Art-media brush presets. Their stamp textures are generated procedurally (seeded, so every
 * launch produces the identical grain) instead of shipping image files: the stamp pipeline in
 * brush.service.ts already accepts any data-URL texture and treats brightness as opacity, so
 * "charcoal", "pastel", "oil bristles"... are just different grain masks plus size/spacing/
 * pressure defaults. These approximate the look of each medium — they are not physical
 * simulations (no pigment diffusion or wet-blending).
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bilinearly-upsampled value noise in [0,1] — a cheap low-frequency blotch field. */
function valueNoise(size: number, cell: number, rand: () => number): Float32Array {
  const g = Math.ceil(size / cell) + 2;
  const lattice = Float32Array.from({ length: g * g }, () => rand());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / cell;
      const fy = y / cell;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const a = lattice[y0 * g + x0];
      const b = lattice[y0 * g + x0 + 1];
      const c = lattice[(y0 + 1) * g + x0];
      const d = lattice[(y0 + 1) * g + x0 + 1];
      out[y * size + x] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    }
  }
  return out;
}

interface Noise {
  fine: Float32Array;
  coarse: Float32Array;
}
type Grain = (nx: number, ny: number, i: number, noise: Noise) => number;

/** Renders a size×size grayscale stamp; `mask` is the radial footprint, `grain` modulates it. */
function makeTexture(seed: number, mask: (r: number) => number, grain: Grain, size = 96): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const rand = mulberry32(seed);
  const noise: Noise = { fine: valueNoise(size, 2, rand), coarse: valueNoise(size, 12, rand) };
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const i = y * size + x;
      const v = Math.max(0, Math.min(1, mask(r) * grain(nx, ny, i, noise)));
      const o = i * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(v * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const soft = (edge: number) => (r: number) => (r >= 1 ? 0 : r < edge ? 1 : 1 - (r - edge) / (1 - edge));
const hard = (r: number) => (r < 1 ? 1 : 0);
const threshold = (v: number, t: number, w = 0.12) => Math.max(0, Math.min(1, (v - t) / w + 0.5));

interface Def extends Omit<Brush, 'id' | 'type' | 'texture'> {
  slug: string;
  tex?: () => string;
}

function defs(): Def[] {
  const base = { hardness: 0.8, opacity: 1, spacing: 0.08, scatter: 0, angleJitter: 0, sizeJitter: 0 };
  const press = { sizeToPressure: true, opacityToPressure: true, angleToDirection: false };
  const sizeOnly = { sizeToPressure: true, opacityToPressure: false, angleToDirection: false };
  const dir = { sizeToPressure: true, opacityToPressure: true, angleToDirection: true };

  return [
    // --- Dibujo ---
    { slug: 'pencil-hb', name: 'Lápiz HB', category: 'Dibujo', ...base, size: 6, hardness: 0.9, opacity: 0.75, spacing: 0.05, smoothing: 0.15, dynamics: press,
      tex: () => makeTexture(11, soft(0.75), (_x, _y, i, n) => 0.55 + 0.45 * threshold(n.fine[i], 0.35, 0.5)) },
    { slug: 'pencil-6b', name: 'Lápiz 6B (blando)', category: 'Dibujo', ...base, size: 12, hardness: 0.7, opacity: 0.6, spacing: 0.06, smoothing: 0.1, dynamics: press,
      tex: () => makeTexture(12, soft(0.5), (_x, _y, i, n) => 0.35 + 0.65 * threshold(n.fine[i], 0.3, 0.6)) },
    { slug: 'charcoal', name: 'Carboncillo', category: 'Dibujo', ...base, size: 34, hardness: 0.5, opacity: 0.6, spacing: 0.28, scatter: 0.08, angleJitter: 360, dynamics: dir,
      tex: () => makeTexture(21, soft(0.35), (_x, _y, i, n) => threshold(n.fine[i] * 0.6 + n.coarse[i] * 0.4, 0.42, 0.28)) },
    { slug: 'graphite-stick', name: 'Barra de grafito', category: 'Dibujo', ...base, size: 40, hardness: 0.6, opacity: 0.5, spacing: 0.3, angleJitter: 360, dynamics: dir,
      tex: () => makeTexture(22, hard, (nx, ny, i, n) => (Math.abs(nx) < 0.95 && Math.abs(ny) < 0.95 ? threshold(n.fine[i], 0.4, 0.4) : 0)) },
    { slug: 'conte', name: 'Barra Conté', category: 'Dibujo', ...base, size: 30, hardness: 0.6, opacity: 0.65, spacing: 0.28, angleJitter: 360, dynamics: dir,
      tex: () => makeTexture(23, soft(0.5), (_x, _y, i, n) => threshold(n.fine[i] * 0.5 + n.coarse[i] * 0.5, 0.4, 0.35)) },

    // --- Tinta ---
    { slug: 'ink-pen', name: 'Pluma de tinta', category: 'Tinta', ...base, size: 9, hardness: 1, opacity: 1, spacing: 0.03, smoothing: 0.45, dynamics: sizeOnly },
    { slug: 'ink-brush', name: 'Pincel de tinta (sumi)', category: 'Tinta', ...base, size: 28, hardness: 0.85, opacity: 0.95, spacing: 0.04, smoothing: 0.5, dynamics: sizeOnly,
      tex: () => makeTexture(31, soft(0.8), (_x, ny, i, n) => 0.8 + 0.2 * n.coarse[i] - 0.15 * Math.abs(Math.sin(ny * 9 + n.coarse[i] * 6)) * n.fine[i]) },
    { slug: 'fineliner', name: 'Rotulador fino (lineart)', category: 'Tinta', ...base, size: 4, hardness: 1, opacity: 1, spacing: 0.03, smoothing: 0.6 },
    { slug: 'gpen', name: 'G-Pen (manga)', category: 'Tinta', ...base, size: 12, hardness: 1, opacity: 1, spacing: 0.025, smoothing: 0.5, dynamics: sizeOnly },

    // --- Pintura ---
    { slug: 'watercolor-wash', name: 'Acuarela (lavado)', category: 'Pintura', ...base, size: 60, hardness: 0.15, opacity: 0.22, spacing: 0.12, scatter: 0.05, dynamics: press,
      tex: () => makeTexture(41, soft(0.15), (_x, _y, i, n) => 0.45 + 0.55 * n.coarse[i]) },
    { slug: 'watercolor-wet', name: 'Acuarela (húmeda)', category: 'Pintura', ...base, size: 44, hardness: 0.3, opacity: 0.3, spacing: 0.1, scatter: 0.12, sizeJitter: 12, dynamics: press,
      tex: () => makeTexture(42, soft(0.3), (_x, _y, i, n) => 0.3 + 0.7 * threshold(n.coarse[i], 0.4, 0.5)) },
    { slug: 'oil-bristle', name: 'Óleo (cerdas)', category: 'Pintura', ...base, size: 42, hardness: 0.9, opacity: 0.9, spacing: 0.07, dynamics: dir,
      tex: () => makeTexture(51, soft(0.85), (nx, _y, i, n) => 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(nx * 22 + n.coarse[i] * 5)) * (0.7 + 0.3 * n.fine[i])) },
    { slug: 'oil-flat', name: 'Óleo (plano)', category: 'Pintura', ...base, size: 50, hardness: 0.95, opacity: 0.95, spacing: 0.06, dynamics: dir,
      tex: () => makeTexture(52, hard, (nx, ny, i, n) => (Math.abs(ny) < 0.55 ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(nx * 18 + n.coarse[i] * 4)) : 0)) },
    { slug: 'gouache', name: 'Gouache', category: 'Pintura', ...base, size: 36, hardness: 0.95, opacity: 1, spacing: 0.05, dynamics: sizeOnly,
      tex: () => makeTexture(61, soft(0.9), (_x, _y, i, n) => 0.9 + 0.1 * n.fine[i]) },
    { slug: 'acrylic-dry', name: 'Acrílico (pincel seco)', category: 'Pintura', ...base, size: 38, hardness: 0.9, opacity: 0.85, spacing: 0.09, dynamics: dir,
      tex: () => makeTexture(62, soft(0.85), (nx, _y, i, n) => threshold((0.5 + 0.5 * Math.sin(nx * 30 + n.coarse[i] * 6)) * 0.6 + n.fine[i] * 0.4, 0.4, 0.25)) },

    // --- Medios secos ---
    { slug: 'pastel', name: 'Pastel', category: 'Medios secos', ...base, size: 38, hardness: 0.6, opacity: 0.75, spacing: 0.24, scatter: 0.05, angleJitter: 360, dynamics: dir,
      tex: () => makeTexture(71, soft(0.5), (_x, _y, i, n) => threshold(n.fine[i] * 0.7 + n.coarse[i] * 0.3, 0.38, 0.22)) },
    { slug: 'chalk-dry', name: 'Tiza seca', category: 'Medios secos', ...base, size: 32, hardness: 0.5, opacity: 0.8, spacing: 0.26, dynamics: dir,
      tex: () => makeTexture(72, soft(0.6), (_x, _y, i, n) => threshold(n.fine[i], 0.5, 0.2)) },
    { slug: 'crayon', name: 'Crayón de cera', category: 'Medios secos', ...base, size: 22, hardness: 0.85, opacity: 0.85, spacing: 0.16, dynamics: press,
      tex: () => makeTexture(73, soft(0.8), (_x, _y, i, n) => 0.4 + 0.6 * threshold(n.fine[i], 0.45, 0.3)) },

    // --- Digital ---
    { slug: 'airbrush', name: 'Aerógrafo', category: 'Digital', ...base, size: 70, hardness: 0, opacity: 0.18, spacing: 0.06, dynamics: press },
    { slug: 'airbrush-splatter', name: 'Aerógrafo (salpicado)', category: 'Digital', ...base, size: 60, hardness: 0.1, opacity: 0.6, spacing: 0.2, scatter: 0.9, sizeJitter: 60, dynamics: press },
    { slug: 'marker-chisel', name: 'Marcador (punta biselada)', category: 'Digital', ...base, size: 26, hardness: 1, opacity: 0.55, spacing: 0.04,
      tex: () => makeTexture(81, hard, (nx, ny) => (Math.abs(nx * 0.7 + ny * 0.7) < 0.35 ? 1 : 0)) },
    { slug: 'marker-round', name: 'Marcador (punta redonda)', category: 'Digital', ...base, size: 16, hardness: 1, opacity: 0.6, spacing: 0.04, smoothing: 0.3 },

    // --- Textura ---
    { slug: 'sponge', name: 'Esponja', category: 'Textura', ...base, size: 46, hardness: 0.5, opacity: 0.6, spacing: 0.3, scatter: 0.3, angleJitter: 360, sizeJitter: 25,
      tex: () => makeTexture(91, soft(0.6), (_x, _y, i, n) => threshold(n.coarse[i], 0.5, 0.2)) },
    { slug: 'stipple', name: 'Punteado', category: 'Textura', ...base, size: 30, hardness: 0.9, opacity: 0.9, spacing: 0.35, scatter: 0.7, sizeJitter: 70,
      tex: () => makeTexture(92, (r) => (r < 0.35 ? 1 : 0), () => 1, 48) },
    { slug: 'hatching', name: 'Sombreado en líneas', category: 'Textura', ...base, size: 34, hardness: 1, opacity: 0.85, spacing: 0.18, dynamics: press,
      tex: () => makeTexture(93, hard, (nx, ny) => (Math.abs(Math.sin((nx * 0.7 + ny * 0.7) * 14)) > 0.7 ? 1 : 0)) },
    { slug: 'grass', name: 'Hierba / follaje', category: 'Textura', ...base, size: 52, hardness: 0.9, opacity: 0.9, spacing: 0.22, scatter: 0.4, angleJitter: 40, sizeJitter: 40,
      tex: () => makeTexture(94, soft(0.95), (nx, ny) => (Math.abs(Math.sin(nx * 9)) > 0.55 && ny < 0.9 - Math.abs(nx) * 0.4 ? 1 : 0)) },
  ];
}

/** Built lazily and memoised: canvas generation is cheap (~96² px each) but pointless to redo. */
let cache: Brush[] | null = null;

export function buildArtPresets(): Brush[] {
  if (!cache) {
    cache = defs().map(({ slug, tex, ...rest }) => ({
      ...rest,
      id: `brush-art-${slug}`,
      type: 'preset' as const,
      texture: tex?.() || undefined,
      tags: [rest.category ?? 'Arte'],
    }));
  }
  return cache.map((b) => ({ ...b, dynamics: b.dynamics && { ...b.dynamics } }));
}

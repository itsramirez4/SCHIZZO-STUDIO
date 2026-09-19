/**
 * Pigment-style colour mixing in RYB space (red–yellow–blue, the painter's primaries) using
 * Gosset & Chen's RGB↔RYB conversion. Mixing sRGB linearly gives blue + yellow = grey; mixing
 * in RYB gives green, red + yellow = orange, red + blue = violet, the way paint behaves.
 *
 * This is an approximation of pigment behaviour, not a spectral (Kubelka–Munk) simulation, so
 * it won't reproduce specific paint brands' quirks (e.g. a granulating pigment or a
 * transparent-vs-opaque difference).
 */

type Vec3 = [number, number, number];

// Corner colours of the RYB cube (each 0..1 sRGB), indexed [r][y][b].
const CUBE: Record<string, Vec3> = {
  '000': [1, 1, 1], // white
  '100': [1, 0, 0], // red
  '010': [1, 1, 0], // yellow
  '001': [0.163, 0.373, 0.6], // blue
  '101': [0.5, 0, 0.5], // violet
  '011': [0, 0.66, 0.2], // green
  '110': [1, 0.5, 0], // orange
  '111': [0.2, 0.094, 0], // black (dark brown)
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export function rybToRgb(r: number, y: number, b: number): Vec3 {
  const tr = smooth(r), ty = smooth(y), tb = smooth(b);
  const out: Vec3 = [0, 0, 0];
  for (const key of Object.keys(CUBE)) {
    const wr = key[0] === '1' ? tr : 1 - tr;
    const wy = key[1] === '1' ? ty : 1 - ty;
    const wb = key[2] === '1' ? tb : 1 - tb;
    const w = wr * wy * wb;
    for (let c = 0; c < 3; c++) out[c] += CUBE[key][c] * w;
  }
  return out;
}

/**
 * RYB coordinates are pigment amounts: (0,0,0) = bare white paper, (1,1,1) = everything mixed
 * (a dark brown). The cube can't reach every sRGB colour (no pure digital green, say), so the
 * closest reachable RYB point is found by search and its residual is kept — see `mixPigments`.
 */
export function rgbToRyb(r: number, g: number, b: number): Vec3 {
  const target: Vec3 = [r, g, b];
  const err = (p: Vec3) => {
    const c = rybToRgb(p[0], p[1], p[2]);
    return (c[0] - target[0]) ** 2 + (c[1] - target[1]) ** 2 + (c[2] - target[2]) ** 2;
  };
  let best: Vec3 = [0, 0, 0];
  let bestErr = Infinity;
  const N = 12;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let k = 0; k <= N; k++) {
    const p: Vec3 = [i / N, j / N, k / N];
    const e = err(p);
    if (e < bestErr) { bestErr = e; best = p; }
  }
  for (let step = 0.04; step > 0.001; step *= 0.6) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let axis = 0; axis < 3; axis++) for (const dir of [-1, 1]) {
        const p: Vec3 = [...best];
        p[axis] = Math.max(0, Math.min(1, p[axis] + dir * step));
        const e = err(p);
        if (e < bestErr - 1e-12) { bestErr = e; best = p; improved = true; }
      }
    }
  }
  return best;
}

export function hexToUnit(hex: string): Vec3 {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function unitToHex(c: Vec3): string {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}

function rgbToHsv(c: Vec3): { h: number; s: number; v: number } {
  const [r, g, b] = c;
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}

function hsvToRgb(h: number, s: number, v: number): Vec3 {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** RYB mix of fully-saturated colours, keeping each input's cube residual so a colour mixed
 * with itself comes back unchanged. */
function mixChromatic(colors: { rgb: Vec3; weight: number }[]): Vec3 {
  const total = colors.reduce((s, c) => s + c.weight, 0);
  const acc: Vec3 = [0, 0, 0];
  const residual: Vec3 = [0, 0, 0];
  for (const { rgb, weight } of colors) {
    const ryb = rgbToRyb(...rgb);
    const back = rybToRgb(...ryb);
    const w = weight / total;
    for (let i = 0; i < 3; i++) {
      acc[i] += ryb[i] * w;
      residual[i] += (rgb[i] - back[i]) * w;
    }
  }
  const mixed = rybToRgb(...acc);
  return mixed.map((v, i) => v + residual[i]) as Vec3;
}

/**
 * Mixes weighted colours as pigments. Weights need not sum to 1.
 *
 * Every colour is split (HSV geometry: c = v·[(1−s)·white + s·hue]) into a saturated part and a
 * neutral part. The saturated parts are mixed in RYB — which is what makes blue + yellow green —
 * while the neutral parts (white, black, grey, and the greyness of muted colours) are averaged
 * arithmetically, so black + white is a true grey and tints/shades behave as expected. The RYB
 * cube has no neutral axis, which is why mixing everything there turns greys brown.
 */
export function mixPigments(colors: { hex: string; weight: number }[]): string {
  const total = colors.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return colors[0]?.hex ?? '#000000';
  const chromatic: { rgb: Vec3; weight: number }[] = [];
  const neutral: Vec3 = [0, 0, 0];
  let wChromatic = 0;
  let wNeutral = 0;
  for (const { hex, weight } of colors) {
    const { h, s, v } = rgbToHsv(hexToUnit(hex));
    const w = weight / total;
    if (s > 0.001) {
      chromatic.push({ rgb: hsvToRgb(h, 1, v), weight: w * s });
      wChromatic += w * s;
    }
    const wn = w * (1 - s);
    wNeutral += wn;
    for (let i = 0; i < 3; i++) neutral[i] += v * wn;
  }
  const out: Vec3 = [0, 0, 0];
  const pure = chromatic.length > 0 ? mixChromatic(chromatic) : ([0, 0, 0] as Vec3);
  for (let i = 0; i < 3; i++) out[i] = pure[i] * wChromatic + neutral[i];
  // wChromatic + wNeutral == 1 by construction (s + (1 − s) per colour).
  void wNeutral;
  return unitToHex(out);
}

/** Plain sRGB linear blend, for comparison with the pigment result. */
export function mixLight(a: string, b: string, t: number): string {
  const ca = hexToUnit(a), cb = hexToUnit(b);
  return unitToHex(ca.map((v, i) => v * (1 - t) + cb[i] * t) as Vec3);
}

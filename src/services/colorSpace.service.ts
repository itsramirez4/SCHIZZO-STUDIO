import { RGBA, HSLColor, HSVColor, LABColor, CMYKColor } from '@/types/colorTools';

// --- RGB <-> HSL ---

export function rgbToHsl({ r, g, b }: RGBA): HSLColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: HSLColor): RGBA {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  let r: number;
  let g: number;
  let b: number;

  if (sn === 0) {
    r = g = b = ln;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    r = hue2rgb(p, q, hn + 1 / 3);
    g = hue2rgb(p, q, hn);
    b = hue2rgb(p, q, hn - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: 255 };
}

// --- RGB <-> HSV ---

export function rgbToHsv({ r, g, b }: RGBA): HSVColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function hsvToRgb({ h, s, v }: HSVColor): RGBA {
  const hn = h / 360;
  const sn = s / 100;
  const vn = v / 100;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0:
      [r, g, b] = [vn, t, p];
      break;
    case 1:
      [r, g, b] = [q, vn, p];
      break;
    case 2:
      [r, g, b] = [p, vn, t];
      break;
    case 3:
      [r, g, b] = [p, q, vn];
      break;
    case 4:
      [r, g, b] = [t, p, vn];
      break;
    case 5:
      [r, g, b] = [vn, p, q];
      break;
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: 255 };
}

// --- RGB -> LAB (perceptual, D65 illuminant) ---

export function rgbToLab({ r, g, b }: RGBA): LABColor {
  const linearize = (c: number) => (c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92);
  const rl = linearize(r / 255);
  const gl = linearize(g / 255);
  const bl = linearize(b / 255);

  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return {
    l: Math.round((116 * y - 16) * 100) / 100,
    a: Math.round(500 * (x - y) * 100) / 100,
    b: Math.round(200 * (y - z) * 100) / 100,
  };
}

// --- RGB <-> CMYK (naive, not a real ICC print profile) ---

export function rgbToCmyk({ r, g, b }: RGBA): CMYKColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  const denom = 1 - k || 1;
  const c = (1 - rn - k) / denom;
  const m = (1 - gn - k) / denom;
  const y = (1 - bn - k) / denom;
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}

export function cmykToRgb({ c, m, y, k }: CMYKColor): RGBA {
  const cn = c / 100;
  const mn = m / 100;
  const yn = y / 100;
  const kn = k / 100;
  return {
    r: Math.round(255 * (1 - Math.min(1, cn * (1 - kn) + kn))),
    g: Math.round(255 * (1 - Math.min(1, mn * (1 - kn) + kn))),
    b: Math.round(255 * (1 - Math.min(1, yn * (1 - kn) + kn))),
    a: 255,
  };
}

// --- hex helpers (RGBA-shaped, unlike colorUtils.ts's RGBA which normalizes alpha 0-1) ---

export function hexToRgbaColor(hex: string): RGBA {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const value = parseInt(full, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255, a: 255 };
}

export function rgbaColorToHex({ r, g, b }: RGBA): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

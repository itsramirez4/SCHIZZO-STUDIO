/** Color/tone "look" filters — same shape as filter.service.ts's sepia/posterize (plain
 * function, getImageData/mutate/putImageData), kept in their own file since they're a distinct
 * category (finished photographic looks) from that file's per-channel adjustments. */

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Maps grayscale luminance to a gradient between `shadowColor` (dark) and `highlightColor`
 * (light) — the classic 2-color duotone look. */
export function duotone(canvas: HTMLCanvasElement, shadowColor: string, highlightColor: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const [sr, sg, sb] = hexToRgb(shadowColor);
  const [hr, hg, hb] = hexToRgb(highlightColor);

  for (let i = 0; i < data.length; i += 4) {
    const t = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    data[i] = clamp(sr + (hr - sr) * t);
    data[i + 1] = clamp(sg + (hg - sg) * t);
    data[i + 2] = clamp(sb + (hb - sb) * t);
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Three-color version of duotone — shadows/midtones/highlights each map to their own color,
 * lerping between adjacent pairs across the luminance range. */
export function tritone(canvas: HTMLCanvasElement, shadowColor: string, midColor: string, highlightColor: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const [sr, sg, sb] = hexToRgb(shadowColor);
  const [mr, mg, mb] = hexToRgb(midColor);
  const [hr, hg, hb] = hexToRgb(highlightColor);

  for (let i = 0; i < data.length; i += 4) {
    const t = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const localT = t / 0.5;
      r = sr + (mr - sr) * localT;
      g = sg + (mg - sg) * localT;
      b = sb + (mb - sb) * localT;
    } else {
      const localT = (t - 0.5) / 0.5;
      r = mr + (hr - mr) * localT;
      g = mg + (hg - mg) * localT;
      b = mb + (hb - mb) * localT;
    }
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Vintage look: a specific, curated recipe (mild desaturation + a warm highlight/cool shadow
 * split-tone + a soft vignette) — not a generic LUT engine, a concrete real "look" like the
 * existing sepia filter, just a different formula.
 */
export function vintage(canvas: HTMLCanvasElement, strength: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const t = Math.max(0, Math.min(1, strength / 100));
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const gray = luminance(r, g, b);

      // Desaturate partway, then split-tone: warm push in the highlights, cool push in shadows.
      let nr = r + (gray - r) * (0.35 * t);
      let ng = g + (gray - g) * (0.35 * t);
      let nb = b + (gray - b) * (0.35 * t);
      const warmth = (gray / 255 - 0.5) * 30 * t;
      nr += warmth;
      ng += warmth * 0.5;
      nb -= warmth;

      const vignetteDist = Math.hypot(x - cx, y - cy) / maxDist;
      const darken = 1 - 0.25 * t * Math.pow(vignetteDist, 2);

      data[idx] = clamp(nr * darken);
      data[idx + 1] = clamp(ng * darken);
      data[idx + 2] = clamp(nb * darken);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Noir: heavy-contrast, deep-black desaturated look — a specific curve, not just plain
 * desaturate (which this project already has as its own separate, gentler filter). */
export function noir(canvas: HTMLCanvasElement, contrast: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const c = Math.max(0, contrast / 100);

  for (let i = 0; i < data.length; i += 4) {
    const gray = luminance(data[i], data[i + 1], data[i + 2]) / 255;
    // S-curve contrast boost around 0.5, then push toward black/white harder than a plain
    // linear contrast filter would, for that deep-blacks noir feel.
    const curved = 0.5 + (gray - 0.5) * (1 + c * 2.5);
    const v = clamp(curved * 255);
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Classic solarization: channels above `threshold` get inverted, the rest stay as-is — the
 * partial-exposure darkroom effect. */
export function solarize(canvas: HTMLCanvasElement, threshold: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const t = (threshold / 100) * 255;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] > t ? 255 - data[i] : data[i];
    data[i + 1] = data[i + 1] > t ? 255 - data[i + 1] : data[i + 1];
    data[i + 2] = data[i + 2] > t ? 255 - data[i + 2] : data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
}

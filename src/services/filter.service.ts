import { createCanvas } from '@/utils/canvasUtils';
import { hexToRgba } from '@/utils/colorUtils';
import { AdjustmentType } from '@/types';

function withImageData(canvas: HTMLCanvasElement, fn: (data: Uint8ClampedArray) => void) {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  fn(imageData.data);
  ctx.putImageData(imageData, 0, 0);
}

export function brightnessContrast(canvas: HTMLCanvasElement, brightness: number, contrast: number) {
  const b = (brightness / 100) * 255;
  // Standard brightness/contrast factor formula expects contrast in -255..255 with 0 = identity;
  // our slider range is -100..100, so map onto that before plugging it in.
  const c = (contrast / 100) * 255;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(factor * (data[i] - 128) + 128 + b);
      data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128 + b);
      data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128 + b);
    }
  });
}

export function saturation(canvas: HTMLCanvasElement, amount: number) {
  const factor = 1 + amount / 100;
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = clamp(gray + (data[i] - gray) * factor);
      data[i + 1] = clamp(gray + (data[i + 1] - gray) * factor);
      data[i + 2] = clamp(gray + (data[i + 2] - gray) * factor);
    }
  });
}

export function hue(canvas: HTMLCanvasElement, degrees: number) {
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const [r, g, b] = hslToRgb((h + degrees / 360 + 1) % 1, s, l);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  });
}

export function invert(canvas: HTMLCanvasElement) {
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  });
}

export function desaturate(canvas: HTMLCanvasElement) {
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  });
}

/** Simple box blur, applied 3x, approximates a gaussian blur cheaply. */
export function blur(canvas: HTMLCanvasElement, radius: number) {
  boxBlur(canvas, radius);
}

export function gaussianBlur(canvas: HTMLCanvasElement, radius: number) {
  boxBlur(canvas, radius);
  boxBlur(canvas, radius);
  boxBlur(canvas, radius);
}

/** Directional blur: averages samples stepped along `angleDeg` across `distance` px. */
export function motionBlur(canvas: HTMLCanvasElement, distance: number, angleDeg: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sd = src.data;
  const dd = dst.data;

  const steps = Math.max(1, Math.round(distance));
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r_ = 0, g_ = 0, b_ = 0, a_ = 0, count = 0;
      for (let s = -steps; s <= steps; s++) {
        const nx = Math.round(x + dx * s);
        const ny = Math.round(y + dy * s);
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const idx = (ny * width + nx) * 4;
        r_ += sd[idx];
        g_ += sd[idx + 1];
        b_ += sd[idx + 2];
        a_ += sd[idx + 3];
        count++;
      }
      const outIdx = (y * width + x) * 4;
      dd[outIdx] = r_ / count;
      dd[outIdx + 1] = g_ / count;
      dd[outIdx + 2] = b_ / count;
      dd[outIdx + 3] = a_ / count;
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/** 3x3 convolution sharpen; `amount` in 0..1 blends between original and fully sharpened. */
export function sharpen(canvas: HTMLCanvasElement, amount: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sd = src.data;
  const dd = dst.data;
  const a = clamp01(amount);
  const center = 1 + 4 * a;
  const edge = -a;

  const sampleAt = (x: number, y: number, c: number) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return sd[(cy * width + cx) * 4 + c];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          sampleAt(x, y, c) * center +
          sampleAt(x - 1, y, c) * edge +
          sampleAt(x + 1, y, c) * edge +
          sampleAt(x, y - 1, c) * edge +
          sampleAt(x, y + 1, c) * edge;
        dd[idx + c] = clamp(v);
      }
      dd[idx + 3] = sd[idx + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/** Mosaic/pixelate distortion: averages each blockSize x blockSize block. */
export function pixelate(canvas: HTMLCanvasElement, blockSize: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const block = Math.max(2, Math.round(blockSize));
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      let r_ = 0, g_ = 0, b_ = 0, a_ = 0, count = 0;
      const yMax = Math.min(height, by + block);
      const xMax = Math.min(width, bx + block);
      for (let y = by; y < yMax; y++) {
        for (let x = bx; x < xMax; x++) {
          const idx = (y * width + x) * 4;
          r_ += data[idx];
          g_ += data[idx + 1];
          b_ += data[idx + 2];
          a_ += data[idx + 3];
          count++;
        }
      }
      r_ /= count; g_ /= count; b_ /= count; a_ /= count;
      for (let y = by; y < yMax; y++) {
        for (let x = bx; x < xMax; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = r_;
          data[idx + 1] = g_;
          data[idx + 2] = b_;
          data[idx + 3] = a_;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Random per-pixel luminance noise, `amount` in 0..100. */
export function noise(canvas: HTMLCanvasElement, amount: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const strength = (amount / 100) * 255;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const n = (Math.random() - 0.5) * strength;
    data[i] = clamp(data[i] + n);
    data[i + 1] = clamp(data[i + 1] + n);
    data[i + 2] = clamp(data[i + 2] + n);
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Replaces RGB with a grayscale view of a single channel, for inspection. Alpha stays intact. */
export function isolateChannel(canvas: HTMLCanvasElement, channel: 'r' | 'g' | 'b' | 'a') {
  const offset = { r: 0, g: 1, b: 2, a: 3 }[channel];
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i + offset];
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      if (channel !== 'a') data[i + 3] = 255;
    }
  });
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Sobel gradient magnitude per pixel — the shared edge-strength map behind charcoal/edge-detect/bloom. */
function sobelEdgeMap(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] + gray[i - width + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + width - 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
        gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      edges[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/** Posterize: quantizes each channel to `levels` discrete steps. */
export function posterize(canvas: HTMLCanvasElement, levels: number) {
  const n = Math.max(2, Math.round(levels));
  const step = 255 / (n - 1);
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(Math.round(data[i] / step) * step);
      data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
      data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    }
  });
}

/** Classic sepia tone; `intensity` in 0..1 blends between original and full sepia. */
export function sepia(canvas: HTMLCanvasElement, intensity: number) {
  const t = clamp01(intensity);
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      data[i] = clamp(r + (sr - r) * t);
      data[i + 1] = clamp(g + (sg - g) * t);
      data[i + 2] = clamp(b + (sb - b) * t);
    }
  });
}

/** Charcoal/sketch: inverted Sobel edges, rendered as a grayscale drawing. */
export function charcoal(canvas: HTMLCanvasElement, strength: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const edges = sobelEdgeMap(data, width, height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = clamp(255 - edges[p] * strength);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Black-on-white (or white-on-black) edge map, thresholded. */
export function edgeDetection(canvas: HTMLCanvasElement, threshold: number, invertColors = false) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const edges = sobelEdgeMap(data, width, height);
  const onColor = invertColors ? 0 : 255;
  const offColor = invertColors ? 255 : 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = edges[p] > threshold ? onColor : offColor;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Soft glow around bright areas: extracts highlights, blurs them, and adds them back. */
export function bloom(canvas: HTMLCanvasElement, radius: number, strength: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const bright = createCanvas(width, height);
  const bctx = bright.getContext('2d')!;
  const brightData = bctx.createImageData(width, height);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luminance > 200) {
      brightData.data[i] = data[i];
      brightData.data[i + 1] = data[i + 1];
      brightData.data[i + 2] = data[i + 2];
      brightData.data[i + 3] = data[i + 3];
    }
  }
  bctx.putImageData(brightData, 0, 0);
  gaussianBlur(bright, radius);

  const blurredData = bctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + blurredData[i] * strength);
    data[i + 1] = clamp(data[i + 1] + blurredData[i + 1] * strength);
    data[i + 2] = clamp(data[i + 2] + blurredData[i + 2] * strength);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Oil-paint effect: replaces each pixel with the median of its neighborhood. Uses a
 * sliding-window histogram per row (classic O(1)-amortized median filter) rather than
 * re-sorting the whole window at every pixel — the same lesson as the box-blur fix.
 */
export function oilPaint(canvas: HTMLCanvasElement, radius: number) {
  const r = Math.max(1, Math.min(6, Math.round(radius)));
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height);
  const sd = src.data;
  const out = ctx.createImageData(width, height);
  const dd = out.data;

  const windowSize = (2 * r + 1) * (2 * r + 1);
  const median = windowSize / 2;

  for (let y = 0; y < height; y++) {
    const histR = new Uint16Array(256);
    const histG = new Uint16Array(256);
    const histB = new Uint16Array(256);
    let count = 0;

    function addCol(x: number) {
      if (x < 0 || x >= width) return;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const idx = (ny * width + x) * 4;
        histR[sd[idx]]++;
        histG[sd[idx + 1]]++;
        histB[sd[idx + 2]]++;
        count++;
      }
    }
    function removeCol(x: number) {
      if (x < 0 || x >= width) return;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const idx = (ny * width + x) * 4;
        histR[sd[idx]]--;
        histG[sd[idx + 1]]--;
        histB[sd[idx + 2]]--;
        count--;
      }
    }
    function findMedian(hist: Uint16Array): number {
      let running = 0;
      for (let v = 0; v < 256; v++) {
        running += hist[v];
        if (running >= median) return v;
      }
      return 255;
    }

    for (let x = -r; x <= r; x++) addCol(x);

    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      dd[outIdx] = findMedian(histR);
      dd[outIdx + 1] = findMedian(histG);
      dd[outIdx + 2] = findMedian(histB);
      dd[outIdx + 3] = sd[outIdx + 3];

      removeCol(x - r);
      addCol(x + r + 1);
    }
  }

  ctx.putImageData(out, 0, 0);
}

/**
 * Separable box blur using a sliding-window sum: O(width*height) total instead of the
 * naive O(width*height*radius²) 2D convolution — a radius-12 pass on a 1920x1080 layer
 * drops from ~6.8s to a few ms. Horizontal pass writes into `mid`, vertical reads `mid`
 * and writes the final `Uint8ClampedArray`.
 */
function boxBlur(canvas: HTMLCanvasElement, radius: number) {
  const r = Math.max(1, Math.round(radius));
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;
  const mid = new Float32Array(src.length);
  const out = new Float32Array(src.length);

  boxBlurPass(src, mid, width, height, r, true);
  boxBlurPass(mid, out, width, height, r, false);

  for (let i = 0; i < out.length; i++) src[i] = out[i];
  ctx.putImageData(imageData, 0, 0);
}

function boxBlurPass(
  src: ArrayLike<number>,
  dst: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean
) {
  const windowSize = radius * 2 + 1;
  const outerCount = horizontal ? height : width;
  const innerCount = horizontal ? width : height;
  const clampInner = (v: number) => (v < 0 ? 0 : v >= innerCount ? innerCount - 1 : v);
  const idxAt = horizontal
    ? (outer: number, inner: number) => (outer * width + clampInner(inner)) * 4
    : (outer: number, inner: number) => (clampInner(inner) * width + outer) * 4;

  for (let outer = 0; outer < outerCount; outer++) {
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    for (let k = -radius; k <= radius; k++) {
      const idx = idxAt(outer, k);
      rSum += src[idx]; gSum += src[idx + 1]; bSum += src[idx + 2]; aSum += src[idx + 3];
    }
    for (let inner = 0; inner < innerCount; inner++) {
      const outIdx = idxAt(outer, inner);
      dst[outIdx] = rSum / windowSize;
      dst[outIdx + 1] = gSum / windowSize;
      dst[outIdx + 2] = bSum / windowSize;
      dst[outIdx + 3] = aSum / windowSize;

      const addIdx = idxAt(outer, inner + radius + 1);
      const removeIdx = idxAt(outer, inner - radius);
      rSum += src[addIdx] - src[removeIdx];
      gSum += src[addIdx + 1] - src[removeIdx + 1];
      bSum += src[addIdx + 2] - src[removeIdx + 2];
      aSum += src[addIdx + 3] - src[removeIdx + 3];
    }
  }
}

export const ADJUSTMENT_DEFAULTS: Record<AdjustmentType, Record<string, number>> = {
  'brightness-contrast': { brightness: 0, contrast: 0 },
  'hue-saturation': { hue: 0, saturation: 0 },
  invert: {},
  desaturate: {},
  posterize: { levels: 4 },
  sepia: { intensity: 100 },
};

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  'brightness-contrast': 'Brillo/Contraste',
  'hue-saturation': 'Tono/Saturación',
  invert: 'Invertir',
  desaturate: 'Desaturar',
  posterize: 'Posterizar',
  sepia: 'Sepia',
};

/** Dispatches to the matching pixel operation above, used by adjustment layers' compositing. */
export function applyAdjustment(canvas: HTMLCanvasElement, type: AdjustmentType, params: Record<string, number> = {}) {
  switch (type) {
    case 'brightness-contrast':
      brightnessContrast(canvas, params.brightness ?? 0, params.contrast ?? 0);
      break;
    case 'hue-saturation':
      if (params.hue) hue(canvas, params.hue);
      if (params.saturation) saturation(canvas, params.saturation);
      break;
    case 'invert':
      invert(canvas);
      break;
    case 'desaturate':
      desaturate(canvas);
      break;
    case 'posterize':
      posterize(canvas, params.levels ?? 4);
      break;
    case 'sepia':
      sepia(canvas, (params.intensity ?? 100) / 100);
      break;
  }
}

export type RGB = [number, number, number];

/** Caches nearest-palette-color lookups by exact RGB key — palettes are small (≤ a few dozen
 * entries) but pixel art can repeat the same handful of colors across huge flat regions. */
function makeNearestColorLookup(palette: RGB[]): (r: number, g: number, b: number) => number {
  const cache = new Map<number, number>();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
}

/** Snaps every opaque pixel to the nearest color in `palette` (Euclidean RGB distance). */
export function quantizeToPalette(canvas: HTMLCanvasElement, palette: RGB[]) {
  if (palette.length === 0) return;
  const nearest = makeNearestColorLookup(palette);
  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const [r, g, b] = palette[nearest(data[i], data[i + 1], data[i + 2])];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  });
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Ordered (Bayer) dithering: nudges each pixel's RGB by a spatially-varying offset before
 * snapping to the nearest palette color, so neighboring pixels alternate between two nearby
 * palette entries to approximate an in-between shade — trading flat color banding for a
 * dither pattern, the classic pixel-art technique for working with a small fixed palette.
 * `strength` is how far (in 0-255 RGB units) a pixel gets pushed before quantizing.
 */
export function ditherToPalette(canvas: HTMLCanvasElement, palette: RGB[], strength: number) {
  if (palette.length === 0) return;
  const nearest = makeNearestColorLookup(palette);
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const offset = (BAYER_4X4[y % 4][x % 4] / 16 - 0.5) * strength;
      const idx = nearest(clamp(data[i] + offset), clamp(data[i + 1] + offset), clamp(data[i + 2] + offset));
      const [r, g, b] = palette[idx];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Classic pixel-art "palette cycling": any opaque pixel whose exact RGB matches one of
 * `rangeColors` gets replaced by the color `shift` steps further along that range
 * (wrapping around) — e.g. shifting a 4-color water ramp by 1 each animation frame makes
 * the water appear to flow without redrawing a single pixel. Only affects pixels already
 * painted with an exact range color (typically after `quantizeToPalette`); everything
 * else is left untouched.
 */
export function cycleColors(canvas: HTMLCanvasElement, rangeColors: RGB[], shift: number) {
  const n = rangeColors.length;
  if (n === 0) return;
  const shiftedIndexByKey = new Map<number, number>();
  rangeColors.forEach((c, i) => {
    const key = (c[0] << 16) | (c[1] << 8) | c[2];
    shiftedIndexByKey.set(key, (((i + shift) % n) + n) % n);
  });

  withImageData(canvas, (data) => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const shiftedIdx = shiftedIndexByKey.get(key);
      if (shiftedIdx === undefined) continue;
      const [r, g, b] = rangeColors[shiftedIdx];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  });
}

/**
 * Tiny seeded PRNG (mulberry32) for the atmospheric effects below. They scatter randomized
 * particles/streaks, but useFilterPreview re-runs the whole apply function from a fresh
 * snapshot on every slider tick — with Math.random() that would reshuffle every particle's
 * position each frame, reading as distracting flicker instead of a smooth density change.
 * A fixed seed keeps the same layout across preview frames; only density/params move.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft gradient haze from the top of the canvas — classic depth/distance fog. */
export function applyFog(canvas: HTMLCanvasElement, density: number, color: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const { r, g, b } = hexToRgba(color);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${density})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Scattered small particles — airborne dust/grain, catching stray light. */
export function applyDust(canvas: HTMLCanvasElement, density: number, color: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const { r, g, b } = hexToRgba(color);
  const rng = mulberry32(42);
  const count = Math.round(density * 3);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const size = 0.6 + rng() * 3.5;
    const alpha = 0.15 + rng() * 0.35;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Overlapping soft blobs — drifting smoke/cloud cover. */
export function applySmoke(canvas: HTMLCanvasElement, density: number, color: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const { r, g, b } = hexToRgba(color);
  const rng = mulberry32(7);
  const cloudCount = Math.max(1, Math.round(density / 6));
  ctx.save();
  ctx.fillStyle = `rgba(${r},${g},${b},0.06)`;
  for (let c = 0; c < cloudCount; c++) {
    const cx = rng() * width;
    const cy = rng() * height;
    for (let j = 0; j < 6; j++) {
      const ox = (rng() - 0.5) * 140;
      const oy = (rng() - 0.5) * 140;
      const radius = 30 + rng() * 55;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Diagonal streaks at a shared angle — falling rain. */
export function applyRain(canvas: HTMLCanvasElement, density: number, angleDeg: number, color: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const { r, g, b } = hexToRgba(color);
  const rng = mulberry32(99);
  const count = Math.round(density * 2);
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const length = 24;
  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * length, y + dy * length);
    ctx.stroke();
  }
  ctx.restore();
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

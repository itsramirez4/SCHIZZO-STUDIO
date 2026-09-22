import { sobelEdgeMap } from './filter.service';

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/** Bilinear-sampled pixel from `data` at floating-point (x, y); out-of-bounds clamps to the edge. */
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

/** Runs `srcOf(x, y)` for every destination pixel — the shared inverse-mapping loop every
 * distortion below uses: for each output pixel, decide where in the ORIGINAL image to sample
 * from, then bilinear-sample it. Pixels `srcOf` leaves untouched (returns null) keep their
 * original value, so a filter only needs to describe pixels it actually distorts. */
function remap(canvas: HTMLCanvasElement, srcOf: (x: number, y: number) => [number, number] | null) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height);
  const sd = src.data;
  const out = ctx.createImageData(width, height);
  const dd = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const mapped = srcOf(x, y);
      if (!mapped) {
        dd[idx] = sd[idx];
        dd[idx + 1] = sd[idx + 1];
        dd[idx + 2] = sd[idx + 2];
        dd[idx + 3] = sd[idx + 3];
        continue;
      }
      const [r, g, b, a] = sampleBilinear(sd, width, height, mapped[0], mapped[1]);
      dd[idx] = r;
      dd[idx + 1] = g;
      dd[idx + 2] = b;
      dd[idx + 3] = a;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/** Twirl: pixels near `centerX/Y` get rotated by an angle that fades to 0 at `radius`. */
export function twirl(canvas: HTMLCanvasElement, centerX: number, centerY: number, angleDeg: number, radius: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  remap(canvas, (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist >= radius) return null;
    const factor = (1 - dist / radius) * angleRad;
    const angle = Math.atan2(dy, dx) + factor;
    return [centerX + dist * Math.cos(angle), centerY + dist * Math.sin(angle)];
  });
}

/** Pinch/spherize: `strength` > 0 pinches inward (sucked toward center), < 0 bulges outward
 * (spherize) — the classic `pow` radius warp, applied within `radius` of the center. */
export function pinch(canvas: HTMLCanvasElement, centerX: number, centerY: number, strength: number, radius: number) {
  const s = Math.max(-1, Math.min(1, strength));
  remap(canvas, (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist >= radius || dist < 0.001) return null;
    const normalized = dist / radius;
    const warped = Math.pow(normalized, 1 + s);
    const newDist = warped * radius;
    const angle = Math.atan2(dy, dx);
    return [centerX + newDist * Math.cos(angle), centerY + newDist * Math.sin(angle)];
  });
}

export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square';

function waveValue(t: number, waveform: Waveform): number {
  const phase = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  switch (waveform) {
    case 'sine':
      return Math.sin(phase);
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case 'sawtooth':
      return phase / Math.PI - 1;
    case 'square':
      return phase < Math.PI ? 1 : -1;
  }
}

/** Wave: a 1D horizontal displacement whose size varies sinusoidally (or per `waveform`) with
 * vertical position — the classic "wave" filter look (distinct from the radial `ripple` below). */
export function wave(canvas: HTMLCanvasElement, amplitude: number, wavelength: number, waveform: Waveform = 'sine') {
  const w = Math.max(1, wavelength);
  remap(canvas, (x, y) => {
    const offset = waveValue((2 * Math.PI * y) / w, waveform) * amplitude;
    return [x + offset, y];
  });
}

/** Ripple: concentric radial waves emanating from a center point — genuinely different from
 * `wave` (which only ever displaces horizontally), since it displaces radially outward/inward. */
export function ripple(canvas: HTMLCanvasElement, centerX: number, centerY: number, amplitude: number, wavelength: number, waveform: Waveform = 'sine') {
  const w = Math.max(1, wavelength);
  remap(canvas, (x, y) => {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return null;
    const offset = waveValue((2 * Math.PI * dist) / w, waveform) * amplitude;
    const newDist = dist + offset;
    const angle = Math.atan2(dy, dx);
    return [centerX + newDist * Math.cos(angle), centerY + newDist * Math.sin(angle)];
  });
}

/** Real barrel (amount > 0) / pincushion (amount < 0) lens distortion — zero effect at the exact
 * center, growing toward the edges, which is how actual lens distortion looks (unlike a naive
 * radius-based scale that's strongest at the center and vanishes at the edge). */
export function lensDistortion(canvas: HTMLCanvasElement, amount: number, vignette: number) {
  const k = amount / 100;
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(cx, cy);

  remap(canvas, (x, y) => {
    const nx = (x - cx) / maxR;
    const ny = (y - cy) / maxR;
    const r2 = nx * nx + ny * ny;
    const factor = 1 + k * r2;
    return [cx + nx * factor * maxR, cy + ny * factor * maxR];
  });

  if (vignette > 0) {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const strength = vignette / 100;
    const maxDist = Math.hypot(cx, cy);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.hypot(x - cx, y - cy) / maxDist;
        const darken = 1 - strength * Math.pow(dist, 2.2);
        const idx = (y * width + x) * 4;
        data[idx] = clamp(data[idx] * darken);
        data[idx + 1] = clamp(data[idx + 1] * darken);
        data[idx + 2] = clamp(data[idx + 2] * darken);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

/** Rectangular <-> polar coordinate remap — the "twist the whole image around its center like
 * a clock face" effect (Photoshop's Polar Coordinates filter). */
export function polarCoordinates(canvas: HTMLCanvasElement, mode: 'toPolar' | 'toRectangular') {
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(cx, cy);

  if (mode === 'toPolar') {
    remap(canvas, (x, y) => {
      const angle = (x / width) * Math.PI * 2 - Math.PI;
      const radius = (y / height) * maxRadius;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
  } else {
    remap(canvas, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const srcX = ((angle + Math.PI) / (Math.PI * 2)) * width;
      const srcY = (radius / maxRadius) * height;
      return [srcX, srcY];
    });
  }
}

/** Mosaic: like flat pixelate, but each tile keeps a thin grout-colored border — visually a
 * tiled-mosaic look rather than a plain blocky one. */
export function mosaic(canvas: HTMLCanvasElement, tileSize: number, groutSize: number, groutColor: string) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const tile = Math.max(2, Math.round(tileSize));
  const grout = Math.max(0, Math.round(groutSize));
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const hex = groutColor.replace('#', '');
  const gr = parseInt(hex.slice(0, 2), 16);
  const gg = parseInt(hex.slice(2, 4), 16);
  const gb = parseInt(hex.slice(4, 6), 16);

  for (let by = 0; by < height; by += tile) {
    for (let bx = 0; bx < width; bx += tile) {
      let r_ = 0, g_ = 0, b_ = 0, a_ = 0, count = 0;
      const yMax = Math.min(height, by + tile);
      const xMax = Math.min(width, bx + tile);
      for (let y = by; y < yMax; y++) {
        for (let x = bx; x < xMax; x++) {
          const idx = (y * width + x) * 4;
          r_ += data[idx]; g_ += data[idx + 1]; b_ += data[idx + 2]; a_ += data[idx + 3];
          count++;
        }
      }
      r_ /= count; g_ /= count; b_ /= count; a_ /= count;
      for (let y = by; y < yMax; y++) {
        for (let x = bx; x < xMax; x++) {
          const onGrout = grout > 0 && (x - bx < grout || y - by < grout || xMax - x <= grout || yMax - y <= grout);
          const idx = (y * width + x) * 4;
          if (onGrout) {
            data[idx] = gr; data[idx + 1] = gg; data[idx + 2] = gb; data[idx + 3] = a_;
          } else {
            data[idx] = r_; data[idx + 1] = g_; data[idx + 2] = b_; data[idx + 3] = a_;
          }
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Crystallize: a Voronoi-cell mosaic. Seeds are jittered onto a grid (evenly spread but not
 * perfectly regular, which is what makes it read as "crystallized" rather than just pixelated),
 * and every pixel is flat-filled with the average color of whichever seed's cell it falls in.
 * Only checks the surrounding 3x3 grid cells of seeds — nearest-seed search doesn't need to be
 * exhaustive since seeds are laid out on a grid with known spacing. */
export function crystallize(canvas: HTMLCanvasElement, cellSize: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const spacing = Math.max(4, Math.round(cellSize));
  const cols = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;

  // Deterministic jitter (no Math.random) so live preview doesn't reshuffle cells every frame.
  function hash(i: number, j: number): number {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  const seeds: { x: number; y: number }[][] = [];
  for (let j = 0; j < rows; j++) {
    seeds[j] = [];
    for (let i = 0; i < cols; i++) {
      seeds[j][i] = {
        x: (i - 1) * spacing + hash(i, j) * spacing,
        y: (j - 1) * spacing + hash(j, i) * spacing,
      };
    }
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const out = ctx.createImageData(width, height);
  const od = out.data;

  // Assign every pixel to its nearest seed, accumulating per-seed color sums.
  const seedSum = new Map<string, { r: number; g: number; b: number; a: number; n: number }>();
  const assignment = new Int32Array(width * height * 2); // stores (i,j) of the winning seed per pixel

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gi = Math.floor(x / spacing) + 1;
      const gj = Math.floor(y / spacing) + 1;
      let bestDist = Infinity;
      let bestI = gi;
      let bestJ = gj;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = gi + di;
          const j = gj + dj;
          if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
          const seed = seeds[j][i];
          const dist = (seed.x - x) ** 2 + (seed.y - y) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            bestI = i;
            bestJ = j;
          }
        }
      }
      const key = `${bestI},${bestJ}`;
      const idx = (y * width + x) * 4;
      const entry = seedSum.get(key) ?? { r: 0, g: 0, b: 0, a: 0, n: 0 };
      entry.r += data[idx]; entry.g += data[idx + 1]; entry.b += data[idx + 2]; entry.a += data[idx + 3];
      entry.n++;
      seedSum.set(key, entry);
      const pIdx = (y * width + x) * 2;
      assignment[pIdx] = bestI;
      assignment[pIdx + 1] = bestJ;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = (y * width + x) * 2;
      const key = `${assignment[pIdx]},${assignment[pIdx + 1]}`;
      const entry = seedSum.get(key)!;
      const idx = (y * width + x) * 4;
      od[idx] = entry.r / entry.n;
      od[idx + 1] = entry.g / entry.n;
      od[idx + 2] = entry.b / entry.n;
      od[idx + 3] = entry.a / entry.n;
    }
  }

  ctx.putImageData(out, 0, 0);
}

/**
 * Pencil sketch via the classic "color dodge" technique: grayscale the image, make an inverted
 * + blurred copy, then color-dodge blend it against the grayscale original. Genuinely different
 * from `charcoal` (a pure thresholded Sobel edge map) — this produces soft graphite-like shading,
 * not just line edges.
 */
export function pencilSketch(canvas: HTMLCanvasElement, blurRadius: number, darkness: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Blur the inverted grayscale via a simple separable box blur (radius clamped small — this
  // effect wants a soft, not heavily smoothed, halo).
  const r = Math.max(1, Math.round(blurRadius));
  const inverted = new Float32Array(width * height);
  for (let p = 0; p < gray.length; p++) inverted[p] = 255 - gray[p];
  const blurred = boxBlur1D(boxBlur1D(inverted, width, height, r, true), width, height, r, false);

  const strength = Math.max(0.01, darkness / 100);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    // Classic color dodge (base / (1 - blend)) with the UNSCALED blurred-inverted value: this is
    // what makes any flat region — light or dark — cancel out to paper white, leaving only edges
    // and gradients as graphite strokes. Scaling `blend` by `darkness` before the divide (as this
    // used to do) broke that cancellation for dark flat fills, turning them into muddy grey blobs
    // instead of white with an outline. `darkness` now only deepens the strokes afterwards, so it
    // can fade them toward white (<100%) or deepen them (>100%) without ever un-cancelling a fill.
    const blend = blurred[p];
    const trueV = blend >= 255 ? 255 : Math.min(255, (gray[p] * 255) / (255 - blend));
    const v = Math.max(0, Math.min(255, 255 - (255 - trueV) * strength));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

function boxBlur1D(src: Float32Array, width: number, height: number, radius: number, horizontal: boolean): Float32Array {
  const dst = new Float32Array(src.length);
  const outerCount = horizontal ? height : width;
  const innerCount = horizontal ? width : height;
  const clampInner = (v: number) => (v < 0 ? 0 : v >= innerCount ? innerCount - 1 : v);
  const idxAt = horizontal ? (outer: number, inner: number) => outer * width + clampInner(inner) : (outer: number, inner: number) => clampInner(inner) * width + outer;
  const windowSize = radius * 2 + 1;

  for (let outer = 0; outer < outerCount; outer++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[idxAt(outer, k)];
    for (let inner = 0; inner < innerCount; inner++) {
      dst[idxAt(outer, inner)] = sum / windowSize;
      sum += src[idxAt(outer, inner + radius + 1)] - src[idxAt(outer, inner - radius)];
    }
  }
  return dst;
}

/** Toon/cel shading: flattens color into `colorLevels` bands (posterize) and overlays dark
 * outlines wherever the Sobel edge strength passes `edgeThreshold` — a real comic/cel look,
 * distinct from the existing plain posterize (no outlines) and charcoal (grayscale-only) filters. */
export function toonShading(canvas: HTMLCanvasElement, colorLevels: number, edgeThreshold: number) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const edges = sobelEdgeMap(data, width, height);

  const n = Math.max(2, Math.round(colorLevels));
  const step = 255 / (n - 1);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (edges[p] > edgeThreshold) {
      data[i] = data[i + 1] = data[i + 2] = 0;
      continue;
    }
    data[i] = Math.round(Math.round(data[i] / step) * step);
    data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
    data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
  }
  ctx.putImageData(imageData, 0, 0);
}

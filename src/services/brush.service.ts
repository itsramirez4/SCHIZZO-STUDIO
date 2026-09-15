import { v4 as uuid } from 'uuid';
import { Brush } from '@/types';
import presetsJson from '@/assets/brushes/presets.json';

export function loadPresets(): Brush[] {
  return (presetsJson.presets as Brush[]).map((b) => ({ ...b }));
}

export function createBrush(overrides: Partial<Brush> = {}): Brush {
  return {
    id: uuid(),
    name: overrides.name ?? 'Pincel nuevo',
    type: 'custom',
    size: 20,
    hardness: 0.8,
    opacity: 1,
    spacing: 0.1,
    scatter: 0,
    angleJitter: 0,
    sizeJitter: 0,
    ...overrides,
  };
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

// --- Brush texture (a custom stamp image, e.g. paper/chalk/leaf) ---
// `brush.texture` is a data URL; decoding it into a drawable canvas is async (Image.onload),
// but stamping has to stay synchronous — so decoded (and tinted) results are cached here,
// keyed by the data URL itself. A stamp drawn before its texture has finished decoding falls
// back to the plain circle for just that one instant; every stamp after the load completes
// (a handful of milliseconds into the very first stroke using it, in practice) uses it.
const textureAlphaCache = new Map<string, HTMLCanvasElement>();
const texturePendingLoads = new Set<string>();
const coloredTextureCache = new Map<string, HTMLCanvasElement>();

/** Decodes a texture image into a white-RGB / luminance-as-alpha canvas — brighter areas of
 * the source image paint more opaquely, darker areas less, matching how a real chalk/paper
 * texture would deposit color unevenly. Cached per data URL; kicks off the decode once and
 * returns undefined until it's ready. */
function getTextureAlphaCanvas(dataUrl: string): HTMLCanvasElement | undefined {
  const cached = textureAlphaCache.get(dataUrl);
  if (cached) return cached;
  if (!texturePendingLoads.has(dataUrl)) {
    texturePendingLoads.add(dataUrl);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const luminance = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round((luminance / 255) * d[i + 3]);
      }
      ctx.putImageData(imageData, 0, 0);
      textureAlphaCache.set(dataUrl, canvas);
      texturePendingLoads.delete(dataUrl);
    };
    img.src = dataUrl;
  }
  return undefined;
}

/** Recolors the (cached, shape-only) texture alpha mask with the brush's current color —
 * built on its OWN offscreen canvas via `source-in` rather than directly on the layer, so
 * painting a textured stamp can never erase whatever was already under it (a plain
 * `drawImage` of the mask followed by `source-in` on the real layer would do exactly that
 * for the split second between the two calls). Cached per (texture, color) pair since the
 * same combination repeats constantly within one stroke. */
function getColoredTextureStamp(dataUrl: string, color: string): HTMLCanvasElement | undefined {
  const alphaCanvas = getTextureAlphaCanvas(dataUrl);
  if (!alphaCanvas) return undefined;
  const cacheKey = `${dataUrl}|${color}`;
  let colored = coloredTextureCache.get(cacheKey);
  if (!colored) {
    colored = document.createElement('canvas');
    colored.width = alphaCanvas.width;
    colored.height = alphaCanvas.height;
    const cctx = colored.getContext('2d')!;
    cctx.drawImage(alphaCanvas, 0, 0);
    cctx.globalCompositeOperation = 'source-in';
    cctx.fillStyle = color;
    cctx.fillRect(0, 0, colored.width, colored.height);
    coloredTextureCache.set(cacheKey, colored);
  }
  return colored;
}

/**
 * Draws a single stamp of the brush at (x, y) — a soft-edged circle normally, or (when
 * `square` is set, for pixel-art projects) a hard-edged axis-aligned square with
 * pixel-snapped coordinates. Hardness/falloff don't apply to the square shape: a "soft
 * square" isn't a thing pixel art brushes have, and any gradient would fight the crisp,
 * discrete-pixel look that's the entire point of a square stamp.
 *
 * `pressure` (0-1, from the pointer event — 1 for a mouse or a non-pressure-sensing pen)
 * only affects anything when the brush's own `dynamics` opt into it: `sizeToPressure` scales
 * the radius, `opacityToPressure` scales `globalAlpha`, same as every other stylus-aware app.
 */
export function applyBrushStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brush: Brush,
  color: string,
  square = false,
  pressure = 1
) {
  const jitterScale = 1 + ((Math.random() * 2 - 1) * brush.sizeJitter) / 100;
  const sizePressureScale = brush.dynamics?.sizeToPressure ? Math.max(0.05, pressure) : 1;
  const radius = Math.max(0.5, (brush.size / 2) * jitterScale * sizePressureScale);
  const scatterOffset = brush.scatter * brush.size * (Math.random() - 0.5);
  const angle = Math.random() * Math.PI * 2;
  const sx = x + Math.cos(angle) * scatterOffset;
  const sy = y + Math.sin(angle) * scatterOffset;
  const opacityPressureScale = brush.dynamics?.opacityToPressure ? Math.max(0.05, pressure) : 1;

  ctx.save();
  ctx.globalAlpha = brush.opacity * opacityPressureScale;

  if (brush.texture) {
    const stamp = getColoredTextureStamp(brush.texture, color);
    if (stamp) {
      ctx.drawImage(stamp, sx - radius, sy - radius, radius * 2, radius * 2);
      ctx.restore();
      return;
    }
    // Texture still decoding (first stamp of the very first stroke that uses it) — fall
    // through to the plain circle/square just this once rather than painting nothing.
  }

  if (square) {
    const side = Math.max(1, Math.round(radius * 2));
    // Snap to whole pixels — a fillRect at a fractional coordinate still gets
    // anti-aliased by the canvas, which would blur exactly the crisp edge this is for.
    const left = Math.round(sx - side / 2);
    const top = Math.round(sy - side / 2);
    ctx.fillStyle = color;
    ctx.fillRect(left, top, side, side);
  } else if (brush.hardness >= 0.98) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    const hardStop = Math.max(0, Math.min(1, brush.hardness));
    gradient.addColorStop(0, color);
    gradient.addColorStop(hardStop, color);
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const bigint = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/** Draws a smooth stroke by stamping the brush along the point path, spaced by brush.spacing.
 * Pressure is linearly interpolated between each pair of points' own `pressure` (defaulting
 * to 1, i.e. no effect, for points that don't carry one) so it varies smoothly along the
 * stroke instead of jumping at each recorded pointer-move sample. */
export function strokeBrush(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  brush: Brush,
  color: string,
  square = false
) {
  if (points.length === 0) return;
  if (points.length === 1) {
    applyBrushStamp(ctx, points[0].x, points[0].y, brush, color, square, points[0].pressure ?? 1);
    return;
  }

  const step = Math.max(1, brush.size * Math.max(0.02, brush.spacing));
  let prev = points[0];
  applyBrushStamp(ctx, prev.x, prev.y, brush, color, square, prev.pressure ?? 1);

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / step));
    const prevPressure = prev.pressure ?? 1;
    const currPressure = curr.pressure ?? 1;

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const pressure = prevPressure + (currPressure - prevPressure) * t;
      applyBrushStamp(ctx, prev.x + dx * t, prev.y + dy * t, brush, color, square, pressure);
    }
    prev = curr;
  }
}

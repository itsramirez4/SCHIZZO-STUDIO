import { createCanvas, cloneCanvas } from '@/utils/canvasUtils';
import { gaussianBlur } from './filter.service';
import { expandMask, contractMask } from './selectionMask.service';
import { BevelSettings, ColorOverlaySettings, DropShadowSettings, GlowSettings, GradientOverlaySettings, LayerEffects, StrokeSettings } from '@/types/layerEffects';

/** A solid-color cutout of `source`'s alpha channel: RGB = `color` wherever `source` had any
 * alpha, transparent elsewhere. The base primitive every effect below builds on. */
function silhouette(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = cloneCanvas(source);
  const ctx = out.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

function clipToAlpha(canvas: HTMLCanvasElement, alphaSource: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(canvas);
  const ctx = out.getContext('2d')!;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(alphaSource, 0, 0);
  return out;
}

/** Everywhere `source` is transparent, filled with `color` — the inverse of `silhouette`. */
function inverseSilhouette(source: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(source, 0, 0);
  return out;
}

function offsetCanvas(source: HTMLCanvasElement, dx: number, dy: number): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  out.getContext('2d')!.drawImage(source, dx, dy);
  return out;
}

function withOpacity(source: HTMLCanvasElement, opacity: number): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  const ctx = out.getContext('2d')!;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(source, 0, 0);
  return out;
}

function angleToOffset(angleDeg: number, distance: number): { dx: number; dy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { dx: Math.cos(rad) * distance, dy: Math.sin(rad) * distance };
}

export function renderDropShadow(source: HTMLCanvasElement, s: DropShadowSettings): HTMLCanvasElement {
  let sil = silhouette(source, s.color);
  // expandMask/contractMask (morphology) always resets RGB to white regardless of input color —
  // re-tint from the new alpha shape afterward, or "spread" would silently turn shadows white.
  if (s.spread > 0) sil = silhouette(expandMask(sil, Math.round((s.spread / 100) * s.size)), s.color);
  if (s.size > 0) gaussianBlur(sil, s.size);
  const { dx, dy } = angleToOffset(s.angle, s.distance);
  return withOpacity(offsetCanvas(sil, dx, dy), s.opacity);
}

/** Same silhouette/offset/blur math as drop shadow, but the result is clipped back to the
 * layer's own alpha and drawn from the inverse silhouette — the shadow "falls" just inside the
 * shape's edge instead of extending outward. */
export function renderInnerShadow(source: HTMLCanvasElement, s: DropShadowSettings): HTMLCanvasElement {
  let inv = inverseSilhouette(source, s.color);
  if (s.spread > 0) inv = silhouette(contractMask(inv, Math.round((s.spread / 100) * s.size)), s.color);
  if (s.size > 0) gaussianBlur(inv, s.size);
  // Inner shadows read as cast FROM the light direction, so offset opposite to a drop shadow's.
  const { dx, dy } = angleToOffset(s.angle + 180, s.distance);
  const offset = offsetCanvas(inv, dx, dy);
  return withOpacity(clipToAlpha(offset, source), s.opacity);
}

export function renderGlow(source: HTMLCanvasElement, s: GlowSettings, kind: 'outer' | 'inner'): HTMLCanvasElement {
  if (kind === 'outer') {
    let sil = silhouette(source, s.color);
    if (s.spread > 0) sil = silhouette(expandMask(sil, Math.round((s.spread / 100) * s.size)), s.color);
    if (s.size > 0) gaussianBlur(sil, s.size);
    // The glow should surround the shape, not sit under its opaque interior too.
    const ring = cloneCanvas(sil);
    const rctx = ring.getContext('2d')!;
    rctx.globalCompositeOperation = 'destination-out';
    rctx.drawImage(source, 0, 0);
    return withOpacity(ring, s.opacity);
  }
  let inv = inverseSilhouette(source, s.color);
  if (s.spread > 0) inv = silhouette(contractMask(inv, Math.round((s.spread / 100) * s.size)), s.color);
  if (s.size > 0) gaussianBlur(inv, s.size);
  return withOpacity(clipToAlpha(inv, source), s.opacity);
}

export function renderColorOverlay(source: HTMLCanvasElement, s: ColorOverlaySettings): HTMLCanvasElement {
  const out = cloneCanvas(source);
  const ctx = out.getContext('2d')!;
  const data = ctx.getImageData(0, 0, out.width, out.height);
  const d = data.data;
  const hex = s.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const t = Math.max(0, Math.min(1, s.opacity));
  // Alpha (d[i+3]) is left untouched, so pixels that were already transparent stay invisible
  // regardless of the RGB blend below — no need to special-case them.
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * (1 - t) + r * t;
    d[i + 1] = d[i + 1] * (1 - t) + g * t;
    d[i + 2] = d[i + 2] * (1 - t) + b * t;
  }
  ctx.putImageData(data, 0, 0);
  return out;
}

export function renderGradientOverlay(source: HTMLCanvasElement, s: GradientOverlaySettings): HTMLCanvasElement {
  const { width, height } = source;
  const grad = createCanvas(width, height);
  const gctx = grad.getContext('2d')!;
  const rad = (s.angle * Math.PI) / 180;
  const dx = (Math.cos(rad) * width) / 2;
  const dy = (Math.sin(rad) * height) / 2;
  const linear = gctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
  linear.addColorStop(0, s.color1);
  linear.addColorStop(1, s.color2);
  gctx.fillStyle = linear;
  gctx.fillRect(0, 0, width, height);
  return withOpacity(clipToAlpha(grad, source), s.opacity);
}

/** Dilates/erodes the layer's own alpha silhouette to build a ring (outside/inside/center of
 * the edge), filled with the stroke color — the same morphology technique already used for
 * selection expand/contract, applied to a layer's silhouette instead of a selection mask. */
export function renderStroke(source: HTMLCanvasElement, s: StrokeSettings): HTMLCanvasElement {
  const sil = silhouette(source, s.color);
  let ring: HTMLCanvasElement;
  if (s.position === 'outside') {
    ring = expandMask(sil, s.size);
    const rctx = ring.getContext('2d')!;
    rctx.globalCompositeOperation = 'destination-out';
    rctx.drawImage(sil, 0, 0);
  } else if (s.position === 'inside') {
    const eroded = contractMask(sil, s.size);
    ring = cloneCanvas(sil);
    const rctx = ring.getContext('2d')!;
    rctx.globalCompositeOperation = 'destination-out';
    rctx.drawImage(eroded, 0, 0);
  } else {
    const half = Math.max(1, Math.round(s.size / 2));
    const outer = expandMask(sil, half);
    const inner = contractMask(sil, half);
    ring = cloneCanvas(outer);
    const rctx = ring.getContext('2d')!;
    rctx.globalCompositeOperation = 'destination-out';
    rctx.drawImage(inner, 0, 0);
  }
  // Re-tint the ring (morphology output inherits the silhouette's color already, but re-fill
  // defensively in case that ever changes) and apply opacity.
  const tinted = silhouette(ring, s.color);
  return withOpacity(tinted, s.opacity);
}

/**
 * Real (if simplified) bevel/emboss: builds a height-map from the blurred alpha edge, estimates
 * a surface normal via a finite-difference gradient, and lights it from `angle`/`altitude` — the
 * classic emboss technique, not a placeholder. The edge "band" the lighting is confined to comes
 * from a dilate/erode difference against the silhouette, matching each `style`.
 */
export function renderBevel(source: HTMLCanvasElement, s: BevelSettings): HTMLCanvasElement {
  const { width, height } = source;
  const sil = silhouette(source, '#ffffff');
  if (s.softness > 0) gaussianBlur(sil, s.softness);
  const heightData = sil.getContext('2d')!.getImageData(0, 0, width, height).data;

  const band = edgeBand(source, s.style, s.size);
  const bandData = band.getContext('2d')!.getImageData(0, 0, width, height).data;

  const rad = (s.angle * Math.PI) / 180;
  const alt = (s.altitude * Math.PI) / 180;
  const lightX = Math.cos(rad) * Math.cos(alt);
  const lightY = Math.sin(rad) * Math.cos(alt);
  const lightZ = Math.sin(alt);

  const highlight = hexToRgb(s.highlightColor);
  const shadow = hexToRgb(s.shadowColor);
  const depthMul = s.depth / 100;

  const out = createCanvas(width, height);
  const octx = out.getContext('2d')!;
  const outImg = octx.createImageData(width, height);
  const od = outImg.data;

  const at = (x: number, y: number) => heightData[(y * width + x) * 4 + 3]; // alpha channel = height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const bandAlpha = bandData[idx + 3];
      if (bandAlpha === 0) continue;

      const xL = Math.max(0, x - 1);
      const xR = Math.min(width - 1, x + 1);
      const yU = Math.max(0, y - 1);
      const yD = Math.min(height - 1, y + 1);
      const dx = (at(xR, y) - at(xL, y)) / 255;
      const dy = (at(x, yD) - at(x, yU)) / 255;

      let intensity = (dx * lightX + dy * lightY + lightZ) * depthMul;
      intensity = Math.max(-1, Math.min(1, intensity));

      const bandT = bandAlpha / 255;
      if (intensity > 0) {
        od[idx] = highlight.r;
        od[idx + 1] = highlight.g;
        od[idx + 2] = highlight.b;
        od[idx + 3] = 255 * intensity * s.highlightOpacity * bandT;
      } else {
        od[idx] = shadow.r;
        od[idx + 1] = shadow.g;
        od[idx + 2] = shadow.b;
        od[idx + 3] = 255 * -intensity * s.shadowOpacity * bandT;
      }
    }
  }

  octx.putImageData(outImg, 0, 0);
  return out;
}

function edgeBand(source: HTMLCanvasElement, style: BevelSettings['style'], size: number): HTMLCanvasElement {
  const sil = silhouette(source, '#fff');
  // 'pillow' and 'stroke' aren't given fully distinct algorithms here — they're aliased to the
  // closest real equivalent (inner / outer) rather than faked with a separate implementation.
  const effectiveStyle = style === 'pillow' ? 'inner' : style === 'stroke' ? 'outer' : style;

  if (effectiveStyle === 'outer') {
    const dilated = expandMask(sil, size);
    const band = cloneCanvas(dilated);
    const ctx = band.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(sil, 0, 0);
    return band;
  }
  if (effectiveStyle === 'inner') {
    const eroded = contractMask(sil, size);
    const band = cloneCanvas(sil);
    const ctx = band.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(eroded, 0, 0);
    return band;
  }
  // emboss: union of both bands
  const outer = edgeBand(source, 'outer', size);
  const inner = edgeBand(source, 'inner', size);
  const band = cloneCanvas(outer);
  band.getContext('2d')!.drawImage(inner, 0, 0);
  return band;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

export interface BakedEffects {
  behind: HTMLCanvasElement | null;
  front: HTMLCanvasElement | null;
}

/** Composites every enabled effect into two layers: `behind` (drop shadow, outer glow — sits
 * beneath the layer's own content) and `front` (inner shadow, inner glow, bevel, color/gradient
 * overlay, stroke — sits above it), in roughly Photoshop's real stacking order. */
export function bakeLayerEffects(source: HTMLCanvasElement, effects: LayerEffects | undefined): BakedEffects {
  if (!effects) return { behind: null, front: null };
  const { width, height } = source;
  let behind: HTMLCanvasElement | null = null;
  let front: HTMLCanvasElement | null = null;

  function drawOnto(target: HTMLCanvasElement | null, piece: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = target ?? createCanvas(width, height);
    canvas.getContext('2d')!.drawImage(piece, 0, 0);
    return canvas;
  }

  if (effects.dropShadow?.enabled) behind = drawOnto(behind, renderDropShadow(source, effects.dropShadow));
  if (effects.outerGlow?.enabled) behind = drawOnto(behind, renderGlow(source, effects.outerGlow, 'outer'));

  if (effects.innerShadow?.enabled) front = drawOnto(front, renderInnerShadow(source, effects.innerShadow));
  if (effects.innerGlow?.enabled) front = drawOnto(front, renderGlow(source, effects.innerGlow, 'inner'));
  if (effects.bevel?.enabled) front = drawOnto(front, renderBevel(source, effects.bevel));
  if (effects.colorOverlay?.enabled) front = drawOnto(front, renderColorOverlay(source, effects.colorOverlay));
  if (effects.gradientOverlay?.enabled) front = drawOnto(front, renderGradientOverlay(source, effects.gradientOverlay));
  if (effects.stroke?.enabled) front = drawOnto(front, renderStroke(source, effects.stroke));

  return { behind, front };
}

export function hasAnyEnabledEffect(effects: LayerEffects | undefined): boolean {
  if (!effects) return false;
  return Object.values(effects).some((e) => e?.enabled);
}

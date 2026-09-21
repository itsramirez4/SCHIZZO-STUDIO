import { v4 as uuid } from 'uuid';
import { Layer, AdjustmentType, FillType, GradientFill } from '@/types';
import { createCanvas, cloneCanvas, canvasToDataUrl, dataUrlToCanvas } from '@/utils/canvasUtils';
import { applyAdjustment, ADJUSTMENT_DEFAULTS, gaussianBlur } from './filter.service';
import { fillWithPattern } from './pattern.service';
import { bakeLayerEffects, hasAnyEnabledEffect } from './layerEffects.service';

/**
 * Layer pixel data lives here, keyed by layer id, instead of in React/Zustand state —
 * canvases are mutable and re-rendering on every stroke would be prohibitively expensive.
 * The store only tracks serializable Layer metadata; this registry is the pixel source of truth.
 */
const canvasRegistry = new Map<string, HTMLCanvasElement>();
/** Grayscale paint masks, keyed by the layer id they belong to. White = fully revealed. */
const maskRegistry = new Map<string, HTMLCanvasElement>();

export function getLayerCanvas(id: string): HTMLCanvasElement | undefined {
  return canvasRegistry.get(id);
}

export function registerLayerCanvas(id: string, canvas: HTMLCanvasElement) {
  canvasRegistry.set(id, canvas);
}

export function createLayer(
  name: string,
  width: number,
  height: number,
  type: Layer['type'] = 'raster'
): Layer {
  const id = uuid();
  canvasRegistry.set(id, createCanvas(width, height));
  return {
    id,
    name,
    type,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    x: 0,
    y: 0,
    width,
    height,
    locked: false,
  };
}

/** Group layers are a pure organizational node: no pixel canvas of their own. */
export function createGroupLayer(name: string, width: number, height: number): Layer {
  return {
    id: uuid(),
    name,
    type: 'group',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    x: 0,
    y: 0,
    width,
    height,
    locked: false,
  };
}

/** Adjustment layers own no pixel canvas — they transform whatever is composited below them. */
export function createAdjustmentLayer(name: string, adjustmentType: AdjustmentType, width: number, height: number): Layer {
  return {
    id: uuid(),
    name,
    type: 'adjustment',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    x: 0,
    y: 0,
    width,
    height,
    locked: false,
    adjustmentType,
    adjustmentParams: { ...ADJUSTMENT_DEFAULTS[adjustmentType] },
  };
}

export function createFillLayer(name: string, fillType: FillType, width: number, height: number): Layer {
  return {
    id: uuid(),
    name,
    type: 'fill',
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    x: 0,
    y: 0,
    width,
    height,
    locked: false,
    fillType,
    fillColor: '#808080',
    gradient: fillType === 'gradient' ? { kind: 'linear', color1: '#000000', color2: '#ffffff', angle: 0 } : undefined,
    patternId: fillType === 'pattern' ? 'lines-diagonal' : undefined,
    patternColor: '#000000',
  };
}

export function deleteLayer(id: string) {
  canvasRegistry.delete(id);
  maskRegistry.delete(id);
}

export function duplicateLayer(layer: Layer): Layer {
  const newId = uuid();
  if (layer.type === 'group' || layer.type === 'adjustment' || layer.type === 'fill') {
    const mask = maskRegistry.get(layer.id);
    if (mask) maskRegistry.set(newId, cloneCanvas(mask));
    return { ...layer, id: newId, name: `${layer.name} copia` };
  }
  const source = canvasRegistry.get(layer.id);
  canvasRegistry.set(newId, source ? cloneCanvas(source) : createCanvas(layer.width, layer.height));
  const mask = maskRegistry.get(layer.id);
  if (mask) maskRegistry.set(newId, cloneCanvas(mask));
  return { ...layer, id: newId, name: `${layer.name} copia` };
}

/**
 * A "linked instance" of a raster layer. Every layer gets its own mounted DOM `<canvas>`
 * (required so each can be composited independently via CSS opacity/blend/mask), which rules
 * out true same-object canvas aliasing — the mount-sync effect in Canvas2D would immediately
 * overwrite it with the layer's own element anyway. Instead, `linkedSourceId` marks membership
 * in a link group, and `syncLinkedInstances` (called after every committed stroke) copies the
 * edited member's pixels into every other member's canvas — so it behaves like shared content
 * even though each instance has its own opacity/blendMode/effects/mask.
 */
export function createLinkedInstance(source: Layer): Layer {
  const newId = uuid();
  const canvas = canvasRegistry.get(source.id);
  canvasRegistry.set(newId, canvas ? cloneCanvas(canvas) : createCanvas(source.width, source.height));
  return {
    ...source,
    id: newId,
    name: `${source.name} (vinculada)`,
    linkedSourceId: source.linkedSourceId ?? source.id,
    hasMask: false,
    effects: undefined,
    clipTo: false,
  };
}

/** Copies `editedLayerId`'s current pixels onto every other layer in its link group (the source
 * plus every instance sharing the same `linkedSourceId`) — called after a stroke commits so
 * linked instances behave like shared content. No-op for a layer with no linked siblings. */
export function syncLinkedInstances(layers: Layer[], editedLayerId: string) {
  const edited = layers.find((l) => l.id === editedLayerId);
  if (!edited) return;
  const groupSourceId = edited.linkedSourceId ?? edited.id;
  const members = layers.filter((l) => l.id === groupSourceId || l.linkedSourceId === groupSourceId);
  if (members.length < 2) return;

  const editedCanvas = canvasRegistry.get(editedLayerId);
  if (!editedCanvas) return;

  for (const member of members) {
    if (member.id === editedLayerId) continue;
    const target = canvasRegistry.get(member.id);
    if (!target) continue;
    const tctx = target.getContext('2d')!;
    tctx.clearRect(0, 0, target.width, target.height);
    tctx.drawImage(editedCanvas, 0, 0);
  }
}

export function mergeDown(top: Layer, base: Layer) {
  const topCanvas = canvasRegistry.get(top.id);
  const baseCanvas = canvasRegistry.get(base.id);
  if (!topCanvas || !baseCanvas) return;
  const ctx = baseCanvas.getContext('2d')!;
  compositeLayerOnto(ctx, top, topCanvas);
}

/** Crops a layer's registered canvas (and paint mask, if any) down to `bbox` — used by
 * "trim to content". Non-raster layers (group/adjustment/fill) have no registry canvas and
 * are silently skipped; the caller still updates their `width`/`height` fields to match. */
export function trimLayerToBounds(id: string, bbox: { x: number; y: number; w: number; h: number }) {
  const canvas = canvasRegistry.get(id);
  if (canvas) {
    const trimmed = createCanvas(bbox.w, bbox.h);
    trimmed.getContext('2d')!.drawImage(canvas, -bbox.x, -bbox.y);
    canvasRegistry.set(id, trimmed);
  }
  const mask = maskRegistry.get(id);
  if (mask) {
    const trimmedMask = createCanvas(bbox.w, bbox.h);
    trimmedMask.getContext('2d')!.drawImage(mask, -bbox.x, -bbox.y);
    maskRegistry.set(id, trimmedMask);
  }
}

// --- Masks ---

export function addMask(layerId: string, width: number, height: number) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  maskRegistry.set(layerId, canvas);
}

export function removeMask(layerId: string) {
  maskRegistry.delete(layerId);
}

/** Seeds a mask from an existing alpha-channel source (a selection mask) instead of blank
 * white — reuses `alphaToLuminanceMask` (defined below) since a paint mask and a selection are
 * different representations (luminance+opaque-alpha vs. alpha-channel) of the same idea. */
export function addMaskFromAlpha(layerId: string, alphaSource: HTMLCanvasElement, width: number, height: number) {
  const canvas = createCanvas(width, height);
  canvas.getContext('2d')!.drawImage(alphaToLuminanceMask(alphaSource), 0, 0);
  maskRegistry.set(layerId, canvas);
}

/** Softens the mask's edge by blurring it in place. Deliberately NOT `selectionMask.service`'s
 * `featherMask` — that operates on an alpha-channel mask, while a paint mask here is grayscale
 * luminance with opaque alpha, so blurring needs to target the RGB channels (which `gaussianBlur`
 * does correctly since it blurs every channel uniformly and this mask's alpha is constant 255
 * everywhere, so it stays 255 after blurring too — no edge artifacts from that channel). */
export function featherLayerMask(layerId: string, radius: number) {
  const mask = maskRegistry.get(layerId);
  if (!mask || radius <= 0) return;
  gaussianBlur(mask, radius);
}

/** Inverts the mask's grayscale value (255 - v) in place — for THIS luminance representation,
 * that's the correct inversion; `selectionMask.service`'s `invertMask` inverts an alpha channel
 * instead and would be a no-op here (this mask's alpha is always fully opaque). */
export function invertLayerMask(layerId: string) {
  const mask = maskRegistry.get(layerId);
  if (!mask) return;
  const ctx = mask.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, mask.width, mask.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
}

export function getMaskCanvas(id: string): HTMLCanvasElement | undefined {
  return maskRegistry.get(id);
}

export function registerMaskCanvas(id: string, canvas: HTMLCanvasElement) {
  maskRegistry.set(id, canvas);
}

export function maskToDataUrl(id: string): string | undefined {
  const canvas = maskRegistry.get(id);
  return canvas ? canvasToDataUrl(canvas) : undefined;
}

export async function loadMaskFromDataUrl(id: string, dataUrl: string, width: number, height: number) {
  maskRegistry.set(id, await dataUrlToCanvas(dataUrl, width, height));
}

// --- Compositing ---

/** Pixel sources a flatten reads from: the live registries, unless a frozen copy is being flattened. */
export interface PixelSources {
  canvases: Record<string, HTMLCanvasElement>;
  masks: Record<string, HTMLCanvasElement>;
}
let sourceOverride: PixelSources | null = null;
const compCanvas = (id: string) => (sourceOverride ? sourceOverride.canvases[id] : canvasRegistry.get(id));
const compMask = (id: string) => (sourceOverride ? sourceOverride.masks[id] : maskRegistry.get(id));

/** Flattens `layers` from a frozen copy of the pixels (see `snapshotLayerCanvas`), not the live canvases. */
export function flattenLayersFrom(sources: PixelSources, layers: Layer[], width: number, height: number): HTMLCanvasElement {
  sourceOverride = sources;
  try {
    return flattenSubtree(layers, undefined, width, height);
  } finally {
    sourceOverride = null;
  }
}


/**
 * `destination-in` clips by the SOURCE's alpha channel, but a painted mask is always fully
 * opaque — painting black vs. white only changes RGB, never alpha. So a paint mask has to be
 * converted from grayscale luminance into an alpha channel before it can clip anything,
 * matching how the CSS `mask-mode: luminance` live preview reads the same mask canvas.
 */
function luminanceMaskToAlpha(mask: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(mask.width, mask.height);
  const octx = out.getContext('2d')!;
  const src = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height);
  const dst = octx.createImageData(mask.width, mask.height);
  const sd = src.data;
  const dd = dst.data;
  for (let i = 0; i < sd.length; i += 4) {
    const luminance = 0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2];
    dd[i + 3] = (luminance * sd[i + 3]) / 255;
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

/** The inverse of `luminanceMaskToAlpha`: a live-view CSS mask (opaque grayscale, RGB =
 * source's alpha) built FROM a rendered layer's alpha channel — this is what lets "clip to layer
 * below" reuse the exact same `WebkitMaskImage`/`mask-mode: luminance` mechanism the paint-mask
 * preview already uses, just fed from a different source (a sibling's alpha instead of a
 * hand-painted mask). */
export function alphaToLuminanceMask(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  const octx = out.getContext('2d')!;
  const src = source.getContext('2d')!.getImageData(0, 0, source.width, source.height);
  const dst = octx.createImageData(source.width, source.height);
  const sd = src.data;
  const dd = dst.data;
  for (let i = 0; i < sd.length; i += 4) {
    dd[i] = dd[i + 1] = dd[i + 2] = sd[i + 3];
    dd[i + 3] = 255;
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

/** Draws `canvas` onto `ctx` honoring the layer's opacity, blend mode and mask (if any), plus
 * an optional clip against `clipAlpha` (the alpha of this layer's clip base) and its own
 * non-destructive effects (drop shadow, glow, bevel, overlays, stroke). */
function compositeLayerOnto(ctx: CanvasRenderingContext2D, layer: Layer, canvas: HTMLCanvasElement, clipAlpha?: HTMLCanvasElement) {
  let content = canvas;
  if (clipAlpha) {
    const clipped = createCanvas(canvas.width, canvas.height);
    const cctx = clipped.getContext('2d')!;
    cctx.drawImage(canvas, 0, 0);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(clipAlpha, 0, 0);
    content = clipped;
  }

  const mask = layer.hasMask ? compMask(layer.id) : undefined;
  if (mask) {
    const masked = createCanvas(content.width, content.height);
    const mctx = masked.getContext('2d')!;
    mctx.drawImage(content, 0, 0);
    mctx.globalCompositeOperation = 'destination-in';
    mctx.drawImage(luminanceMaskToAlpha(mask), 0, 0);
    content = masked;
  }

  if (hasAnyEnabledEffect(layer.effects)) {
    const { behind, front } = bakeLayerEffects(content, layer.effects);
    if (behind) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(behind, layer.x, layer.y);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode;
    ctx.drawImage(content, layer.x, layer.y);
    ctx.restore();
    if (front) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(front, layer.x, layer.y);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = layer.blendMode;
  ctx.drawImage(content, layer.x, layer.y);
  ctx.restore();
}

/** Renders a fill layer's own pixels (solid color / gradient / pattern) at project size. */
export function renderFillLayer(layer: Layer, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  if (layer.fillType === 'gradient' && layer.gradient) {
    const g: GradientFill = layer.gradient;
    let grad: CanvasGradient;
    if (g.kind === 'radial') {
      grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
    } else {
      const rad = (g.angle * Math.PI) / 180;
      const dx = (Math.cos(rad) * width) / 2;
      const dy = (Math.sin(rad) * height) / 2;
      grad = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
    }
    grad.addColorStop(0, g.color1);
    grad.addColorStop(1, g.color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (layer.fillType === 'pattern' && layer.patternId) {
    fillWithPattern(canvas, layer.patternId, layer.patternColor ?? '#000000');
  } else {
    ctx.fillStyle = layer.fillColor ?? '#808080';
    ctx.fillRect(0, 0, width, height);
  }

  return canvas;
}

/**
 * Applies an adjustment layer's effect directly onto the accumulator canvas built so far
 * (i.e. everything stacked below it in its group) — an adjustment layer has no pixels of
 * its own, it transforms what's beneath it. Blends by opacity and, if present, by the
 * layer's paint mask (same luminance-to-alpha conversion raster masks use), lerping each
 * pixel between its pre- and post-adjustment color while preserving the original alpha
 * (fully transparent pixels stay invisible regardless of the color operation).
 */
function applyAdjustmentToAccumulator(out: HTMLCanvasElement, layer: Layer) {
  const octx = out.getContext('2d')!;
  const before = octx.getImageData(0, 0, out.width, out.height);

  const temp = createCanvas(out.width, out.height);
  temp.getContext('2d')!.putImageData(before, 0, 0);
  applyAdjustment(temp, (layer.adjustmentType ?? 'brightness-contrast') as AdjustmentType, layer.adjustmentParams ?? {});
  const after = temp.getContext('2d')!.getImageData(0, 0, out.width, out.height);

  const mask = layer.hasMask ? compMask(layer.id) : undefined;
  const maskAlpha = mask
    ? luminanceMaskToAlpha(mask).getContext('2d')!.getImageData(0, 0, out.width, out.height).data
    : undefined;

  const bd = before.data;
  const ad = after.data;
  const result = octx.createImageData(out.width, out.height);
  const rd = result.data;
  const baseT = layer.opacity;

  for (let i = 0; i < bd.length; i += 4) {
    const t = maskAlpha ? baseT * (maskAlpha[i + 3] / 255) : baseT;
    rd[i] = bd[i] + (ad[i] - bd[i]) * t;
    rd[i + 1] = bd[i + 1] + (ad[i + 1] - bd[i + 1]) * t;
    rd[i + 2] = bd[i + 2] + (ad[i + 2] - bd[i + 2]) * t;
    rd[i + 3] = bd[i + 3];
  }
  octx.putImageData(result, 0, 0);
}

/** The layer's own pre-mask, pre-effect content canvas — used both to actually paint it and (for
 * whichever layer sits just below in the same group) as the alpha source for a clipping layer
 * above it. Adjustment/reference layers have no such canvas and can't serve as a clip base. */
function getOwnContentCanvas(allLayers: Layer[], layer: Layer, width: number, height: number): HTMLCanvasElement | undefined {
  if (layer.type === 'group') return flattenSubtree(allLayers, layer.id, width, height);
  if (layer.type === 'fill') return renderFillLayer(layer, width, height);
  if (layer.type === 'raster' || layer.type === 'text' || layer.type === 'reference' || layer.type === 'vector') return compCanvas(layer.id);
  return undefined;
}

/** Paints one non-group layer of any type (raster/fill/adjustment) onto the accumulator.
 * `clipAlpha`, when given, clips this layer's content to that alpha shape first (Photoshop's
 * "clip to layer below"). */
function paintLayerOnto(ctx: CanvasRenderingContext2D, allLayers: Layer[], layer: Layer, width: number, height: number, clipAlpha?: HTMLCanvasElement) {
  if (layer.type === 'reference') {
    // Reference layers are a drawing aid only — visible live in the editor (Canvas2D
    // renders them like any raster layer) but deliberately excluded from every flatten
    // path (export, thumbnails, GIF frames), so they never end up in the finished art.
    return;
  }
  if (layer.type === 'group') {
    const groupCanvas = flattenSubtree(allLayers, layer.id, width, height);
    compositeLayerOnto(ctx, layer, groupCanvas, clipAlpha);
  } else if (layer.type === 'fill') {
    compositeLayerOnto(ctx, layer, renderFillLayer(layer, width, height), clipAlpha);
  } else if (layer.type === 'adjustment') {
    applyAdjustmentToAccumulator(ctx.canvas as HTMLCanvasElement, layer);
  } else {
    const canvas = compCanvas(layer.id);
    if (canvas) compositeLayerOnto(ctx, layer, canvas, clipAlpha);
  }
}

/**
 * Flattens `allLayers` (a flat list where nested layers reference their parent group
 * via `layer.parent`) into a single canvas, compositing group contents in isolation
 * before applying the group's own opacity/blend mode — mirroring how the live CSS
 * preview uses `isolation: isolate` for the same effect.
 */
export function flattenLayers(allLayers: Layer[], width: number, height: number): HTMLCanvasElement {
  return flattenSubtree(allLayers, undefined, width, height);
}

/**
 * Bakes "everything below `layer` within its own group, plus `layer` itself" into one
 * canvas. Used for the live DOM preview of adjustment layers: unlike a raster/fill layer,
 * an adjustment layer's visible contribution depends on everything stacked beneath it, so
 * it can't be represented as an independent canvas the way other layer types can.
 */
export function renderLayerPreview(allLayers: Layer[], layer: Layer, width: number, height: number): HTMLCanvasElement {
  const out = flattenSubtree(allLayers, layer.parent, width, height, layer.id);
  if (layer.visible) paintLayerOnto(out.getContext('2d')!, allLayers, layer, width, height);
  return out;
}

function flattenSubtree(
  allLayers: Layer[],
  parentId: string | undefined,
  width: number,
  height: number,
  stopAtId?: string
): HTMLCanvasElement {
  const out = createCanvas(width, height);
  const ctx = out.getContext('2d')!;
  // `allLayers` is stored topmost-first (matching the layer panel); painting must go
  // bottom-first so later (higher) layers end up drawn on top, like the live view.
  const children = allLayers.filter((l) => l.parent === parentId).reverse();

  // Tracks the nearest preceding non-clipped sibling's content, so every consecutive `clipTo`
  // layer above it clips to that SAME base (Photoshop's clipping-group semantics), not to
  // whatever clipped layer happened to render immediately before it.
  let clipBase: HTMLCanvasElement | undefined;
  for (const layer of children) {
    if (stopAtId && layer.id === stopAtId) break;
    if (!layer.visible) continue;
    if (!layer.clipTo) clipBase = getOwnContentCanvas(allLayers, layer, width, height);
    paintLayerOnto(ctx, allLayers, layer, width, height, layer.clipTo ? clipBase : undefined);
  }

  return out;
}

/** Copy of a layer's (or mask's) pixels right now, for encoding later without blocking the UI. */
export function snapshotLayerCanvas(id: string): HTMLCanvasElement | undefined {
  const canvas = canvasRegistry.get(id);
  return canvas ? cloneCanvas(canvas) : undefined;
}

export function snapshotMaskCanvas(id: string): HTMLCanvasElement | undefined {
  const canvas = maskRegistry.get(id);
  return canvas ? cloneCanvas(canvas) : undefined;
}

export function layerToDataUrl(id: string): string | undefined {
  const canvas = canvasRegistry.get(id);
  return canvas ? canvasToDataUrl(canvas) : undefined;
}

export async function loadLayerCanvasFromDataUrl(id: string, dataUrl: string, width: number, height: number) {
  const canvas = await dataUrlToCanvas(dataUrl, width, height);
  canvasRegistry.set(id, canvas);
}

export function clearRegistry() {
  canvasRegistry.clear();
  maskRegistry.clear();
}

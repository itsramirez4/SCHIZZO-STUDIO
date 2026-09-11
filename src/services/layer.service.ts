import { v4 as uuid } from 'uuid';
import { Layer, AdjustmentType, FillType, GradientFill } from '@/types';
import { createCanvas, cloneCanvas, canvasToDataUrl, dataUrlToCanvas } from '@/utils/canvasUtils';
import { applyAdjustment, ADJUSTMENT_DEFAULTS } from './filter.service';
import { fillWithPattern } from './pattern.service';

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

export function mergeDown(top: Layer, base: Layer) {
  const topCanvas = canvasRegistry.get(top.id);
  const baseCanvas = canvasRegistry.get(base.id);
  if (!topCanvas || !baseCanvas) return;
  const ctx = baseCanvas.getContext('2d')!;
  compositeLayerOnto(ctx, top, topCanvas);
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

/** Draws `canvas` onto `ctx` honoring the layer's opacity, blend mode and mask (if any). */
function compositeLayerOnto(ctx: CanvasRenderingContext2D, layer: Layer, canvas: HTMLCanvasElement) {
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = layer.blendMode;

  const mask = layer.hasMask ? maskRegistry.get(layer.id) : undefined;
  if (mask) {
    const masked = createCanvas(canvas.width, canvas.height);
    const mctx = masked.getContext('2d')!;
    mctx.drawImage(canvas, 0, 0);
    mctx.globalCompositeOperation = 'destination-in';
    mctx.drawImage(luminanceMaskToAlpha(mask), 0, 0);
    ctx.drawImage(masked, layer.x, layer.y);
  } else {
    ctx.drawImage(canvas, layer.x, layer.y);
  }
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

  const mask = layer.hasMask ? maskRegistry.get(layer.id) : undefined;
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

/** Paints one non-group layer of any type (raster/fill/adjustment) onto the accumulator. */
function paintLayerOnto(ctx: CanvasRenderingContext2D, allLayers: Layer[], layer: Layer, width: number, height: number) {
  if (layer.type === 'reference') {
    // Reference layers are a drawing aid only — visible live in the editor (Canvas2D
    // renders them like any raster layer) but deliberately excluded from every flatten
    // path (export, thumbnails, GIF frames), so they never end up in the finished art.
    return;
  }
  if (layer.type === 'group') {
    const groupCanvas = flattenSubtree(allLayers, layer.id, width, height);
    compositeLayerOnto(ctx, layer, groupCanvas);
  } else if (layer.type === 'fill') {
    compositeLayerOnto(ctx, layer, renderFillLayer(layer, width, height));
  } else if (layer.type === 'adjustment') {
    applyAdjustmentToAccumulator(ctx.canvas as HTMLCanvasElement, layer);
  } else {
    const canvas = canvasRegistry.get(layer.id);
    if (canvas) compositeLayerOnto(ctx, layer, canvas);
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

  for (const layer of children) {
    if (stopAtId && layer.id === stopAtId) break;
    if (!layer.visible) continue;
    paintLayerOnto(ctx, allLayers, layer, width, height);
  }

  return out;
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

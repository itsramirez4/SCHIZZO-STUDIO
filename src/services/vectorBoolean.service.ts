import { BooleanOp, VectorStrokeStyle, VectorFillStyle } from '@/types/vectorShapes';
import { createCanvas } from '@/utils/canvasUtils';
import { expandMask, contractMask, applyMaskedOperation } from '@/services/selectionMask.service';
import { maskToPolygons } from '@/services/traceBitmap.service';

/**
 * Boolean ops between two shapes are done as alpha-mask compositing, not polygon-clipping
 * geometry: each shape is rasterized to a full-canvas white-on-transparent mask, then combined
 * via the matching `globalCompositeOperation` (the standard technique for boolean regions on a
 * raster surface). This sidesteps needing a real polygon-clipping algorithm (Weiler-Atherton or
 * similar), which is a serious undertaking on its own — appropriate here since the app is
 * raster-first and the result gets baked to a pixel layer regardless. The trade-off, made
 * explicit: the combined result is a mask, not a further-editable vector path, so its stroke is
 * only an approximation (an expand-minus-contract band) rather than a real stroked outline with
 * caps/joins/dashes — same "commit and it's raster now" trade-off the pen and text tools already
 * make.
 */
export function combineMasks(maskA: HTMLCanvasElement, maskB: HTMLCanvasElement, op: BooleanOp): HTMLCanvasElement {
  const canvas = createCanvas(maskA.width, maskA.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(maskA, 0, 0);

  switch (op) {
    case 'union':
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'subtract':
      ctx.globalCompositeOperation = 'destination-out';
      break;
    case 'intersect':
      ctx.globalCompositeOperation = 'source-in';
      break;
    case 'exclude':
      ctx.globalCompositeOperation = 'xor';
      break;
  }
  ctx.drawImage(maskB, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function canvasMaskToArray(mask: HTMLCanvasElement): Uint8Array {
  const { width, height } = mask;
  const data = mask.getContext('2d')!.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) out[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  return out;
}

/**
 * "Divide" splits two overlapping shapes into their separate non-overlapping pieces — A-only,
 * B-only, and their intersection — rather than merging them into one region like the other four
 * ops. It doesn't need real polygon-clipping algebra either: each of the three sub-masks is
 * computed with the exact same mask compositing as `combineMasks`, then traced into a real
 * polygon with the Moore-neighbor tracer already built for bitmap tracing (a sub-mask can be
 * disconnected — e.g. two separate intersection blobs — so this can return more than 3 polygons).
 */
export function divideMasks(maskA: HTMLCanvasElement, maskB: HTMLCanvasElement, simplifyTolerance = 1): { x: number; y: number }[][] {
  const aOnly = combineMasks(maskA, maskB, 'subtract');
  const bOnly = combineMasks(maskB, maskA, 'subtract');
  const intersection = combineMasks(maskA, maskB, 'intersect');

  const { width, height } = maskA;
  const polygons: { x: number; y: number }[][] = [];
  for (const piece of [aOnly, bOnly, intersection]) {
    polygons.push(...maskToPolygons(canvasMaskToArray(piece), width, height, simplifyTolerance, 4));
  }
  return polygons;
}

/** Fills `mask`'s shape onto the real layer canvas with the given fill style. */
export function paintMaskFill(canvasEl: HTMLCanvasElement, mask: HTMLCanvasElement, fill: VectorFillStyle) {
  if (!fill.enabled) return;
  const ctx = canvasEl.getContext('2d')!;
  applyMaskedOperation(canvasEl, mask, () => {
    ctx.save();
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();
  });
}

/** Strokes `mask`'s boundary onto the real layer canvas — approximated as the band between an
 * expanded and a contracted copy of the mask (solid color only, no dash/cap/join fidelity). */
export function paintMaskStroke(canvasEl: HTMLCanvasElement, mask: HTMLCanvasElement, stroke: VectorStrokeStyle) {
  if (!stroke.enabled || stroke.width <= 0) return;
  const half = stroke.width / 2;
  const outer = expandMask(mask, Math.max(1, Math.ceil(half)));
  const inner = contractMask(mask, Math.max(0, Math.floor(half)));

  const band = createCanvas(mask.width, mask.height);
  const bandCtx = band.getContext('2d')!;
  bandCtx.drawImage(outer, 0, 0);
  bandCtx.globalCompositeOperation = 'destination-out';
  bandCtx.drawImage(inner, 0, 0);

  const ctx = canvasEl.getContext('2d')!;
  applyMaskedOperation(canvasEl, band, () => {
    ctx.save();
    ctx.globalAlpha = stroke.opacity;
    ctx.fillStyle = stroke.color;
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();
  });
}

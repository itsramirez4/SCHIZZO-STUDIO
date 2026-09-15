import { ShapeDraft, VectorStrokeStyle, VectorFillStyle } from '@/types/vectorShapes';
import { createCanvas } from '@/utils/canvasUtils';

/** Builds the shape's outline in its own local space (0,0 = top-left of its bounding box). */
function buildLocalPath(draft: ShapeDraft): Path2D {
  const path = new Path2D();
  const cx = draft.w / 2;
  const cy = draft.h / 2;

  switch (draft.kind) {
    case 'rectangle': {
      const r = Math.max(0, Math.min(draft.cornerRadius, Math.min(draft.w, draft.h) / 2));
      if (r <= 0.01) {
        path.rect(0, 0, draft.w, draft.h);
      } else {
        path.moveTo(r, 0);
        path.lineTo(draft.w - r, 0);
        path.arcTo(draft.w, 0, draft.w, r, r);
        path.lineTo(draft.w, draft.h - r);
        path.arcTo(draft.w, draft.h, draft.w - r, draft.h, r);
        path.lineTo(r, draft.h);
        path.arcTo(0, draft.h, 0, draft.h - r, r);
        path.lineTo(0, r);
        path.arcTo(0, 0, r, 0, r);
        path.closePath();
      }
      break;
    }
    case 'ellipse': {
      path.ellipse(cx, cy, Math.max(0.01, draft.w / 2), Math.max(0.01, draft.h / 2), 0, 0, Math.PI * 2);
      break;
    }
    case 'polygon': {
      const sides = Math.max(3, Math.round(draft.sides));
      const radius = Math.min(draft.w, draft.h) / 2;
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      break;
    }
    case 'star': {
      const spikes = Math.max(3, Math.round(draft.sides));
      const outerR = Math.min(draft.w, draft.h) / 2;
      const innerR = outerR * Math.max(0.05, Math.min(0.95, draft.innerRadiusRatio));
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const radius = i % 2 === 0 ? outerR : innerR;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      path.closePath();
      break;
    }
  }

  return path;
}

/** Builds the shape's Path2D in absolute (layer-pixel) coordinates, rotated about its own center. */
export function buildShapePath2D(draft: ShapeDraft): Path2D {
  const local = buildLocalPath(draft);
  const cx = draft.w / 2;
  const cy = draft.h / 2;
  const matrix = new DOMMatrix()
    .translate(draft.x + cx, draft.y + cy)
    .rotate((draft.angle * 180) / Math.PI)
    .translate(-cx, -cy);
  const world = new Path2D();
  world.addPath(local, matrix);
  return world;
}

/** Rasterizes just the shape's filled silhouette (ignoring current stroke/fill styling) — used
 * as a boolean-op mask input, where only "is this pixel inside the shape" matters. */
export function rasterizeShapeMask(draft: ShapeDraft, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fill(buildShapePath2D(draft), 'nonzero');
  return canvas;
}

/** Draws a single shape's live fill + stroke onto a context — full-fidelity Path2D rendering
 * (exact edges, real dash/cap/join), used for both the live preview and single-shape commits. */
export function paintShape(ctx: CanvasRenderingContext2D, draft: ShapeDraft, stroke: VectorStrokeStyle, fill: VectorFillStyle) {
  const path = buildShapePath2D(draft);
  ctx.save();
  if (fill.enabled) {
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    ctx.fill(path, 'nonzero');
  }
  if (stroke.enabled && stroke.width > 0) {
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.cap;
    ctx.lineJoin = stroke.join;
    ctx.setLineDash(stroke.dashed ? [stroke.width * 2, stroke.width * 1.5] : []);
    ctx.stroke(path);
  }
  ctx.restore();
}

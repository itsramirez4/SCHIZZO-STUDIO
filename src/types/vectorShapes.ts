/**
 * Vector shape drafts: a shape is edited as a live, uncommitted bounding-box + params object
 * (same shape as Canvas2D/TransformBox's TransformState: x,y,w,h,angle) until the user commits
 * it, at which point it's rasterized (fill + stroke) onto the active raster layer — there is no
 * persistent vector layer type in this app, so this mirrors the existing "draft then bake"
 * pattern already used by the text and pen tools.
 */

export type ShapeKind = 'rectangle' | 'ellipse' | 'polygon' | 'star';

export interface ShapeDraft {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number; // radians, rotation about the draft's own center
  kind: ShapeKind;
  cornerRadius: number; // rectangle only, px
  sides: number; // polygon/star, 3-16
  innerRadiusRatio: number; // star only, 0-1 (inner radius / outer radius)
}

export interface VectorStrokeStyle {
  enabled: boolean;
  color: string;
  width: number;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
  dashed: boolean;
  opacity: number;
}

export interface VectorFillStyle {
  enabled: boolean;
  color: string;
  opacity: number;
}

/** "divide" (split into multiple resulting pieces) is deliberately not offered — it needs real
 * path-splitting, not just mask combination, and is a separate undertaking from these four. */
export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

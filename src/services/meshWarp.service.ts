import { createCanvas } from '@/utils/canvasUtils';

export interface Point {
  x: number;
  y: number;
}

/** Solves the 2x3 affine matrix [a c e; b d f] mapping `src[i] -> dst[i]` for i=0,1,2 — the
 * standard 3-point affine transform (a real closed-form solve, not an approximation). */
function computeAffine(src: [Point, Point, Point], dst: [Point, Point, Point]): [number, number, number, number, number, number] {
  const [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }] = src;
  const [{ x: X0, y: Y0 }, { x: X1, y: Y1 }, { x: X2, y: Y2 }] = dst;
  const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(denom) < 1e-8) return [1, 0, 0, 1, 0, 0]; // degenerate (collinear) triangle — identity fallback

  const a = (X0 * (y1 - y2) + X1 * (y2 - y0) + X2 * (y0 - y1)) / denom;
  const c = (X0 * (x2 - x1) + X1 * (x0 - x2) + X2 * (x1 - x0)) / denom;
  const e = (X0 * (x1 * y2 - x2 * y1) + X1 * (x2 * y0 - x0 * y2) + X2 * (x0 * y1 - x1 * y0)) / denom;
  const b = (Y0 * (y1 - y2) + Y1 * (y2 - y0) + Y2 * (y0 - y1)) / denom;
  const d = (Y0 * (x2 - x1) + Y1 * (x0 - x2) + Y2 * (x1 - x0)) / denom;
  const f = (Y0 * (x1 * y2 - x2 * y1) + Y1 * (x2 * y0 - x0 * y2) + Y2 * (x0 * y1 - x1 * y0)) / denom;
  return [a, b, c, d, e, f];
}

/** Evenly-spaced original grid position for control point (col, row) over a `width`x`height`
 * image — the shape every cell warps FROM. */
export function originalGridPoint(col: number, row: number, cols: number, rows: number, width: number, height: number): Point {
  return { x: (col / (cols - 1)) * width, y: (row / (rows - 1)) * height };
}

/**
 * Warps `source` so each grid cell's rectangle maps onto its (possibly dragged) current
 * quadrilateral — splits every cell into 2 triangles and uses Canvas 2D's own per-triangle
 * affine drawImage(clip + setTransform) technique, the standard way to do arbitrary mesh/puppet
 * warping with nothing but the 2D canvas API (no WebGL). Real, well-defined math; the one known
 * trade-off is a possible hairline seam between triangles from anti-aliasing at the clip edge.
 */
export function applyMeshWarp(source: HTMLCanvasElement, cols: number, rows: number, currentPoints: Point[][]): HTMLCanvasElement {
  const { width, height } = source;
  const out = createCanvas(width, height);
  const ctx = out.getContext('2d')!;

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const srcTL = originalGridPoint(col, row, cols, rows, width, height);
      const srcTR = originalGridPoint(col + 1, row, cols, rows, width, height);
      const srcBL = originalGridPoint(col, row + 1, cols, rows, width, height);
      const srcBR = originalGridPoint(col + 1, row + 1, cols, rows, width, height);
      const dstTL = currentPoints[row][col];
      const dstTR = currentPoints[row][col + 1];
      const dstBL = currentPoints[row + 1][col];
      const dstBR = currentPoints[row + 1][col + 1];

      drawTriangle(ctx, source, [srcTL, srcTR, srcBL], [dstTL, dstTR, dstBL]);
      drawTriangle(ctx, source, [srcTR, srcBR, srcBL], [dstTR, dstBR, dstBL]);
    }
  }
  return out;
}

function drawTriangle(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, src: [Point, Point, Point], dst: [Point, Point, Point]) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dst[0].x, dst[0].y);
  ctx.lineTo(dst[1].x, dst[1].y);
  ctx.lineTo(dst[2].x, dst[2].y);
  ctx.closePath();
  ctx.clip();
  const [a, b, c, d, e, f] = computeAffine(src, dst);
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

/** A fresh grid of control points, all at their original (undeformed) positions. */
export function createGridPoints(cols: number, rows: number, width: number, height: number): Point[][] {
  const points: Point[][] = [];
  for (let row = 0; row < rows; row++) {
    points[row] = [];
    for (let col = 0; col < cols; col++) {
      points[row][col] = originalGridPoint(col, row, cols, rows, width, height);
    }
  }
  return points;
}

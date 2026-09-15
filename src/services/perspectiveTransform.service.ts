/**
 * Real projective (homography) warp — given a rectangular source image and 4 arbitrary
 * destination corners, computes the 3x3 projective matrix via direct linear transform (solving
 * the 8x8 linear system from the 4 point correspondences) and resamples per output pixel using
 * the INVERSE matrix (dest -> source), with bilinear interpolation. This is the standard
 * "getPerspectiveTransform + warpPerspective" approach — the pasted spec for this feature never
 * actually provided this math, just the type/file name, so this is a from-scratch implementation.
 */

export interface Point {
  x: number;
  y: number;
}

/** Row-major 3x3 matrix as a flat length-9 array: [a b c; d e f; g h i]. */
type Mat3 = number[];

function solveLinearSystem(rows: number[][], rhs: number[]): number[] {
  const n = rows.length;
  const M = rows.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue; // degenerate (collinear corners) — best-effort
    for (let c = col; c <= n; c++) M[col][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/** Solves for the homography mapping each `src[i]` to `dst[i]` (4 correspondences, h33 fixed to 1). */
export function computeHomography(src: [Point, Point, Point, Point], dst: [Point, Point, Point, Point]): Mat3 {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = solveLinearSystem(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function applyMat3(m: Mat3, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

function invertMat3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  const invDet = Math.abs(det) < 1e-10 ? 0 : 1 / det;
  return [A * invDet, D * invDet, G * invDet, B * invDet, E * invDet, H * invDet, C * invDet, F * invDet, I * invDet];
}

function bilinearSample(data: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height } = data;
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;

  const px = (px_: number, py_: number, ch: number) => data.data[(py_ * width + px_) * 4 + ch];
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let ch = 0; ch < 4; ch++) {
    const top = px(x0, y0, ch) * (1 - fx) + px(x1, y0, ch) * fx;
    const bottom = px(x0, y1, ch) * (1 - fx) + px(x1, y1, ch) * fx;
    out[ch] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

/**
 * Warps `source` (a rectangular w×h canvas) so its 4 corners land on `dstCorners` (in the same
 * coordinate space the caller wants the result placed into, e.g. project/layer pixels).
 * Returns a new canvas sized to `dstCorners`'s bounding box plus that box's top-left offset —
 * the caller draws the returned canvas at `(x, y)`.
 */
export function warpImagePerspective(
  source: HTMLCanvasElement,
  dstCorners: [Point, Point, Point, Point]
): { canvas: HTMLCanvasElement; x: number; y: number } {
  const w = source.width;
  const h = source.height;
  const srcCorners: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];

  const forward = computeHomography(srcCorners, dstCorners);
  const inverse = invertMat3(forward);

  const minX = Math.floor(Math.min(...dstCorners.map((p) => p.x)));
  const minY = Math.floor(Math.min(...dstCorners.map((p) => p.y)));
  const maxX = Math.ceil(Math.max(...dstCorners.map((p) => p.x)));
  const maxY = Math.ceil(Math.max(...dstCorners.map((p) => p.y)));
  const outW = Math.max(1, maxX - minX);
  const outH = Math.max(1, maxY - minY);

  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(outW, outH);

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const dst = { x: ox + minX, y: oy + minY };
      const srcPt = applyMat3(inverse, dst.x, dst.y);
      const [r, g, b, a] = bilinearSample(srcData, srcPt.x, srcPt.y);
      const idx = (oy * outW + ox) * 4;
      outData.data[idx] = r;
      outData.data[idx + 1] = g;
      outData.data[idx + 2] = b;
      outData.data[idx + 3] = a;
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return { canvas: outCanvas, x: minX, y: minY };
}

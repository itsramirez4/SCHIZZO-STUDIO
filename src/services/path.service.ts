export interface PathPoint {
  x: number;
  y: number;
}

export interface BezierPoint {
  anchor: PathPoint;
  controlIn: PathPoint;
  controlOut: PathPoint;
}

export interface PenPath {
  points: BezierPoint[];
  closed: boolean;
}

/** Builds an SVG path `d` string (M + cubic C segments) for live preview or rasterizing via Path2D. */
export function pathToSvgD(path: PenPath, previewPoint?: PathPoint | null): string {
  if (path.points.length === 0) return '';
  const [first, ...rest] = path.points;
  let d = `M ${first.anchor.x} ${first.anchor.y}`;

  let prev = first;
  for (const point of rest) {
    d += ` C ${prev.controlOut.x} ${prev.controlOut.y}, ${point.controlIn.x} ${point.controlIn.y}, ${point.anchor.x} ${point.anchor.y}`;
    prev = point;
  }

  if (path.closed && path.points.length > 1) {
    d += ` C ${prev.controlOut.x} ${prev.controlOut.y}, ${first.controlIn.x} ${first.controlIn.y}, ${first.anchor.x} ${first.anchor.y} Z`;
  } else if (previewPoint) {
    d += ` L ${previewPoint.x} ${previewPoint.y}`;
  }

  return d;
}

/** Rasterizes the finished path onto a canvas: stroke (always) and fill (if `fillColor` given, closed paths only). */
export function drawPathToCanvas(
  canvas: HTMLCanvasElement,
  path: PenPath,
  options: { strokeColor?: string; strokeWidth: number; fillColor?: string }
) {
  if (path.points.length < 2) return;
  const ctx = canvas.getContext('2d')!;
  const d = pathToSvgD({ ...path, closed: path.closed });
  const path2d = new Path2D(d);

  ctx.save();
  if (options.fillColor && path.closed) {
    ctx.fillStyle = options.fillColor;
    ctx.fill(path2d);
  }
  if (options.strokeColor && options.strokeWidth > 0) {
    ctx.strokeStyle = options.strokeColor;
    ctx.lineWidth = options.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(path2d);
  }
  ctx.restore();
}

export function distance(a: PathPoint, b: PathPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cubicBezierPoint(p0: PathPoint, p1: PathPoint, p2: PathPoint, p3: PathPoint, t: number): PathPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Approximates the path's cubic bezier segments as a dense polyline — used for anything
 * that needs to walk the curve by arc length (text-along-path placement) rather than by
 * the bezier's own parametric `t`, which doesn't correspond to a constant speed along it.
 */
export function flattenToPolyline(path: PenPath, samplesPerSegment = 20): PathPoint[] {
  if (path.points.length === 0) return [];
  const pts: PathPoint[] = [path.points[0].anchor];

  for (let i = 0; i < path.points.length - 1; i++) {
    const p0 = path.points[i].anchor;
    const p1 = path.points[i].controlOut;
    const p2 = path.points[i + 1].controlIn;
    const p3 = path.points[i + 1].anchor;
    for (let s = 1; s <= samplesPerSegment; s++) {
      pts.push(cubicBezierPoint(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }

  if (path.closed && path.points.length > 1) {
    const last = path.points[path.points.length - 1];
    const first = path.points[0];
    for (let s = 1; s <= samplesPerSegment; s++) {
      pts.push(cubicBezierPoint(last.anchor, last.controlOut, first.controlIn, first.anchor, s / samplesPerSegment));
    }
  }

  return pts;
}

/** Walks `polyline` by arc length, returning the point and tangent angle at that distance. */
export function pointAndTangentAtDistance(polyline: PathPoint[], targetDistance: number): { point: PathPoint; angle: number } {
  if (polyline.length === 0) return { point: { x: 0, y: 0 }, angle: 0 };
  if (polyline.length === 1) return { point: polyline[0], angle: 0 };

  let traveled = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = distance(a, b);
    const isLastSegment = i === polyline.length - 2;
    if (traveled + segLen >= targetDistance || isLastSegment) {
      const ratio = segLen === 0 ? 0 : Math.max(0, Math.min(1, (targetDistance - traveled) / segLen));
      return {
        point: { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    traveled += segLen;
  }

  const last = polyline[polyline.length - 1];
  return { point: last, angle: 0 };
}

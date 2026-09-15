import { cloneCanvas } from '@/utils/canvasUtils';
import { rgbaToHex } from '@/utils/colorUtils';
import { posterize } from '@/services/filter.service';

export interface TraceSettings {
  colorMode: 'bw' | 'colors';
  threshold: number; // 0-255, bw mode: pixels darker than this become the traced shape
  maxColors: number; // colors mode: roughly how many flat color regions to extract, 2-16
  simplifyTolerance: number; // px, 0 = no simplification (raw pixel-boundary staircase)
  minBlobArea: number; // px^2, ignore specks smaller than this
}

export interface TracedRegion {
  polygon: { x: number; y: number }[];
  color: string;
}

export interface CenterlineSettings {
  threshold: number; // 0-255, same meaning as TraceSettings.threshold
  simplifyTolerance: number;
  minLength: number; // px, ignore skeleton fragments shorter than this
  strokeColor: string;
  strokeWidth: number;
}

export interface TracedStroke {
  polyline: { x: number; y: number }[];
  color: string;
  width: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Turns a raster layer into a small set of flat-colored polygons — real contour tracing
 * (connected-component labeling + Moore-neighbor boundary walking + Douglas-Peucker
 * simplification), not a placeholder. Deliberately scoped to outer silhouettes only: a shape
 * with a hole (e.g. the letter "O") traces as a solid blob, since detecting nested/inner
 * contours needs a second tracing pass this round doesn't do. "Centerline" tracing (skeletonizing
 * line art into open strokes, see `traceCenterline` below) is a separate function using a
 * different algorithm entirely — it doesn't go through this one.
 */
export function traceBitmap(source: HTMLCanvasElement, settings: TraceSettings): TracedRegion[] {
  const { width, height } = source;
  const regions: TracedRegion[] = [];

  if (settings.colorMode === 'bw') {
    const mask = thresholdMask(source, settings.threshold);
    regions.push(...traceMaskToRegions(mask, width, height, settings, '#000000'));
  } else {
    for (const bucket of quantizeToBuckets(source, settings.maxColors)) {
      regions.push(...traceMaskToRegions(bucket.mask, width, height, settings, bucket.color));
    }
  }
  return regions;
}

/** Serializes traced regions as a real SVG document — one `<path>` per region, same polygon
 * data `paintTracedRegions` fills onto a canvas, just written out as path syntax instead. */
export function exportRegionsAsSvg(regions: TracedRegion[], width: number, height: number): string {
  const paths = regions
    .filter((r) => r.polygon.length >= 3)
    .map((r) => `  <path d="M ${r.polygon.map((p) => `${p.x},${p.y}`).join(' L ')} Z" fill="${r.color}" />`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${paths}\n</svg>\n`;
}

export function paintTracedRegions(ctx: CanvasRenderingContext2D, regions: TracedRegion[]) {
  for (const region of regions) {
    if (region.polygon.length < 3) continue;
    const path = new Path2D();
    path.moveTo(region.polygon[0].x, region.polygon[0].y);
    for (let i = 1; i < region.polygon.length; i++) path.lineTo(region.polygon[i].x, region.polygon[i].y);
    path.closePath();
    ctx.fillStyle = region.color;
    ctx.fill(path, 'nonzero');
  }
}

/** 1 = counts as "ink" (dark enough and opaque enough), 0 = background. */
function thresholdMask(source: HTMLCanvasElement, threshold: number): Uint8Array {
  const { width, height } = source;
  const data = source.getContext('2d')!.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 128) continue;
    const luminance = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    if (luminance < threshold) mask[i] = 1;
  }
  return mask;
}

/** Reduces the layer to a small palette via the existing posterize filter (levels chosen so
 * levels^3 is in the neighborhood of `maxColors`), then groups pixels by their resulting exact
 * color into one mask per color — a simple, honest quantization, not a perceptual/k-means one. */
function quantizeToBuckets(source: HTMLCanvasElement, maxColors: number): { mask: Uint8Array; color: string }[] {
  const levels = Math.max(2, Math.min(8, Math.round(Math.cbrt(Math.max(2, maxColors)))));
  const copy = cloneCanvas(source);
  posterize(copy, levels);
  const { width, height } = copy;
  const data = copy.getContext('2d')!.getImageData(0, 0, width, height).data;

  const buckets = new Map<string, Uint8Array>();
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (data[idx + 3] < 128) continue;
    const key = `${data[idx]},${data[idx + 1]},${data[idx + 2]}`;
    let mask = buckets.get(key);
    if (!mask) {
      mask = new Uint8Array(width * height);
      buckets.set(key, mask);
    }
    mask[i] = 1;
  }

  return Array.from(buckets.entries()).map(([key, mask]) => {
    const [r, g, b] = key.split(',').map(Number);
    return { mask, color: rgbaToHex({ r, g, b, a: 1 }) };
  });
}

function floodFillArea(mask: Uint8Array, visited: Uint8Array, width: number, height: number, startX: number, startY: number): number {
  let area = 0;
  const stack: [number, number][] = [[startX, startY]];
  visited[startY * width + startX] = 1;
  while (stack.length) {
    const [x, y] = stack.pop()!;
    area++;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (mask[ni] === 1 && !visited[ni]) {
        visited[ni] = 1;
        stack.push([nx, ny]);
      }
    }
  }
  return area;
}

// 8-connected neighbor offsets in clockwise order, starting East.
const MOORE_NEIGHBORS: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function isForeground(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return mask[y * width + x] === 1;
}

/**
 * Moore-neighbor boundary tracing: walks the outer edge of the connected blob containing
 * (startX, startY) — the first foreground pixel found in raster-scan order, whose immediate west
 * neighbor is therefore guaranteed background (or off-canvas), giving a known starting
 * "backtrack" direction to search clockwise from.
 */
function traceBoundaryMoore(mask: Uint8Array, width: number, height: number, startX: number, startY: number): Point[] {
  const boundary: Point[] = [{ x: startX, y: startY }];
  let current = { x: startX, y: startY };
  let backtrackDir = 4; // West — see doc comment above for why this is safe as the initial value
  const maxSteps = width * height * 4;

  for (let step = 0; step < maxSteps; step++) {
    let foundDir = -1;
    for (let k = 1; k <= 8; k++) {
      const dir = (backtrackDir + k) % 8;
      const [dx, dy] = MOORE_NEIGHBORS[dir];
      if (isForeground(mask, width, height, current.x + dx, current.y + dy)) {
        foundDir = dir;
        break;
      }
    }
    if (foundDir === -1) break; // isolated single pixel, no foreground neighbor

    const [dx, dy] = MOORE_NEIGHBORS[foundDir];
    const next = { x: current.x + dx, y: current.y + dy };
    backtrackDir = (foundDir + 4) % 8; // direction pointing back from `next` to `current`

    if (next.x === startX && next.y === startY) break; // closed the loop
    boundary.push(next);
    current = next;
  }

  return boundary;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Standard Douglas-Peucker polyline simplification. */
export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length < 3 || tolerance <= 0) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > tolerance) {
    const left = simplifyPolyline(points.slice(0, index + 1), tolerance);
    const right = simplifyPolyline(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

/** Connected-component + boundary-trace + simplify, without any color concept — the shared core
 * that both bitmap tracing and boolean "divide" (splitting overlap regions into separate traced
 * pieces) build on. */
export function maskToPolygons(mask: Uint8Array, width: number, height: number, simplifyTolerance: number, minArea: number): Point[][] {
  const visited = new Uint8Array(width * height);
  const polygons: Point[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] !== 1 || visited[i]) continue;

      const area = floodFillArea(mask, visited, width, height, x, y);
      if (area < minArea) continue;

      let polygon = traceBoundaryMoore(mask, width, height, x, y);
      if (polygon.length < 3) continue;
      if (simplifyTolerance > 0) polygon = simplifyPolyline(polygon, simplifyTolerance);
      polygons.push(polygon);
    }
  }
  return polygons;
}

function traceMaskToRegions(mask: Uint8Array, width: number, height: number, settings: TraceSettings, color: string): TracedRegion[] {
  return maskToPolygons(mask, width, height, settings.simplifyTolerance, settings.minBlobArea).map((polygon) => ({ polygon, color }));
}

// ===================== Centerline tracing (skeletonization) =====================

/**
 * Zhang-Suen thinning: the standard iterative algorithm for reducing a binary blob to a
 * 1-pixel-wide skeleton. Each pass removes boundary pixels that satisfy all four conditions
 * below (in two sub-iterations with slightly different corner conditions, so thinning erodes
 * symmetrically instead of eating one side first) without breaking connectivity or shortening
 * endpoints; repeats until a full pass removes nothing.
 */
function thinZhangSuen(mask: Uint8Array, width: number, height: number): Uint8Array {
  let current = new Uint8Array(mask);
  const get = (arr: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : arr[y * width + x]);

  const maxPasses = 200; // safety cap — real images converge in a handful of passes
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (const subIteration of [0, 1] as const) {
      const toRemove: number[] = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!current[idx]) continue;

          const p2 = get(current, x, y - 1);
          const p3 = get(current, x + 1, y - 1);
          const p4 = get(current, x + 1, y);
          const p5 = get(current, x + 1, y + 1);
          const p6 = get(current, x, y + 1);
          const p7 = get(current, x - 1, y + 1);
          const p8 = get(current, x - 1, y);
          const p9 = get(current, x - 1, y - 1);
          const ring = [p2, p3, p4, p5, p6, p7, p8, p9];

          const B = ring.reduce((sum, v) => sum + v, 0);
          if (B < 2 || B > 6) continue;

          let A = 0;
          for (let i = 0; i < 8; i++) if (ring[i] === 0 && ring[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;

          if (subIteration === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }

          toRemove.push(idx);
        }
      }
      if (toRemove.length > 0) {
        changed = true;
        for (const idx of toRemove) current[idx] = 0;
      }
    }

    if (!changed) break;
  }

  return current;
}

const SKELETON_NEIGHBOR_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function skeletonNeighbors(skel: Uint8Array, width: number, height: number, x: number, y: number): Point[] {
  const result: Point[] = [];
  for (const [dx, dy] of SKELETON_NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && skel[ny * width + nx]) result.push({ x: nx, y: ny });
  }
  return result;
}

function edgeKey(a: Point, b: Point, width: number): string {
  const ia = a.y * width + a.x;
  const ib = b.y * width + b.x;
  return ia < ib ? `${ia}-${ib}` : `${ib}-${ia}`;
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Walks a chain of degree-2 pixels starting at `start -> next`, stopping once it reaches a
 * pixel that isn't degree-2 (an endpoint or junction) — that's the natural end of one segment. */
function walkChain(start: Point, next: Point, skel: Uint8Array, width: number, height: number, visited: Set<string>): Point[] {
  const polyline: Point[] = [start];
  let prev = start;
  let current = next;
  visited.add(edgeKey(prev, current, width));

  while (true) {
    polyline.push(current);
    const nbrs = skeletonNeighbors(skel, width, height, current.x, current.y);
    if (nbrs.length !== 2) break;
    const nextStep = nbrs.find((n) => !pointsEqual(n, prev));
    if (!nextStep) break;
    const key = edgeKey(current, nextStep, width);
    if (visited.has(key)) break;
    visited.add(key);
    prev = current;
    current = nextStep;
  }
  return polyline;
}

/**
 * Converts a thinned skeleton into open polylines by walking its implicit graph: pixels with
 * exactly 2 skeleton neighbors are "regular" (part of a chain), 1 neighbor is an endpoint, 3+ is
 * a junction. Every chain between two endpoints/junctions becomes one polyline; a pure closed
 * loop with no endpoints or junctions at all (e.g. a ring) is walked separately back to its own
 * start. Each pixel-to-pixel edge is only walked once, so junctions shared by several polylines
 * don't get their branches duplicated.
 */
function skeletonToPolylines(skel: Uint8Array, width: number, height: number): Point[][] {
  const visited = new Set<string>();
  const polylines: Point[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!skel[y * width + x]) continue;
      const nbrs = skeletonNeighbors(skel, width, height, x, y);
      if (nbrs.length === 2) continue; // regular pixel — reached as part of a chain from its ends
      for (const n of nbrs) {
        const key = edgeKey({ x, y }, n, width);
        if (visited.has(key)) continue;
        const polyline = walkChain({ x, y }, n, skel, width, height, visited);
        if (polyline.length >= 2) polylines.push(polyline);
      }
    }
  }

  // Anything left unvisited at this point is a pure closed loop (every pixel degree-2).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!skel[y * width + x]) continue;
      const nbrs = skeletonNeighbors(skel, width, height, x, y);
      if (nbrs.length !== 2) continue;
      const unvisited = nbrs.filter((n) => !visited.has(edgeKey({ x, y }, n, width)));
      if (unvisited.length === 0) continue;

      const start = { x, y };
      const polyline = walkChain(start, unvisited[0], skel, width, height, visited);
      polyline.push(start); // close the loop
      polylines.push(polyline);
    }
  }

  return polylines;
}

function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}

/**
 * Skeletonizes line art into open centerline strokes instead of filled regions — a genuinely
 * different algorithm from `traceBitmap`'s contour tracing, appropriate for something like a pen
 * sketch where the meaningful content is the stroke's path, not the ink's outline.
 */
export function traceCenterline(source: HTMLCanvasElement, settings: CenterlineSettings): TracedStroke[] {
  const { width, height } = source;
  const mask = thresholdMask(source, settings.threshold);
  const skeleton = thinZhangSuen(mask, width, height);
  const polylines = skeletonToPolylines(skeleton, width, height);

  const strokes: TracedStroke[] = [];
  for (let polyline of polylines) {
    if (polylineLength(polyline) < settings.minLength) continue;
    if (settings.simplifyTolerance > 0) polyline = simplifyPolyline(polyline, settings.simplifyTolerance);
    strokes.push({ polyline, color: settings.strokeColor, width: settings.strokeWidth });
  }
  return strokes;
}

export function paintTracedStrokes(ctx: CanvasRenderingContext2D, strokes: TracedStroke[]) {
  for (const stroke of strokes) {
    if (stroke.polyline.length < 2) continue;
    const path = new Path2D();
    path.moveTo(stroke.polyline[0].x, stroke.polyline[0].y);
    for (let i = 1; i < stroke.polyline.length; i++) path.lineTo(stroke.polyline[i].x, stroke.polyline[i].y);
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();
  }
}

export function exportStrokesAsSvg(strokes: TracedStroke[], width: number, height: number): string {
  const paths = strokes
    .filter((s) => s.polyline.length >= 2)
    .map(
      (s) =>
        `  <path d="M ${s.polyline.map((p) => `${p.x},${p.y}`).join(' L ')}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${paths}\n</svg>\n`;
}

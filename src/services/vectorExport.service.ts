/**
 * Raster → real vector SVG. Per layer: colour quantisation (median cut) → one binary mask per
 * colour → boundary loops of every mask, outer contours AND holes (pixel-edge tracing) →
 * Douglas–Peucker simplification (optionally smoothed into Béziers) → one <path fill-rule="evenodd">
 * per colour. Layers become <g> groups with their opacity/visibility/blend mode, so the file
 * opens as editable shapes in Inkscape / Illustrator / Figma.
 *
 * This is automatic tracing: gradients become bands of flat colour and fine texture is lost —
 * it approximates the artwork, it does not recover the artist's original strokes.
 */

export interface VectorizeOptions {
  /** Flat colours per layer, 2–32. */
  colors: number;
  /** Douglas–Peucker tolerance in px: higher = fewer nodes, blockier shapes. */
  tolerance: number;
  /** Ignore specks smaller than this many px². */
  minArea: number;
  /** Round the outlines with Bézier curves instead of straight segments. */
  smooth: boolean;
}

interface Pt {
  x: number;
  y: number;
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------- colour quantisation

interface Box {
  px: number[]; // packed rgb ints
  count: number;
}

/** Median-cut palette from the opaque pixels of `data`. */
export function medianCut(data: Uint8ClampedArray, k: number): [number, number, number][] {
  const hist = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    // 5 bits per channel keeps the histogram small without visible banding after mapping
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  if (hist.size === 0) return [];
  const chan = (key: number, c: number) => (c === 0 ? (key >> 10) & 31 : c === 1 ? (key >> 5) & 31 : key & 31);
  let boxes: Box[] = [{ px: [...hist.keys()], count: [...hist.values()].reduce((a, b) => a + b, 0) }];
  while (boxes.length < k) {
    // split the box with the largest population that still spans more than one colour
    let bi = -1;
    for (let i = 0; i < boxes.length; i++) if (boxes[i].px.length > 1 && (bi < 0 || boxes[i].count > boxes[bi].count)) bi = i;
    if (bi < 0) break;
    const box = boxes[bi];
    let bestC = 0;
    let bestRange = -1;
    for (let c = 0; c < 3; c++) {
      let lo = 31;
      let hi = 0;
      for (const p of box.px) {
        const v = chan(p, c);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > bestRange) {
        bestRange = hi - lo;
        bestC = c;
      }
    }
    box.px.sort((a, b) => chan(a, bestC) - chan(b, bestC));
    let acc = 0;
    let cut = 0;
    for (; cut < box.px.length - 1; cut++) {
      acc += hist.get(box.px[cut])!;
      if (acc >= box.count / 2) break;
    }
    const left = box.px.slice(0, cut + 1);
    const right = box.px.slice(cut + 1);
    const sum = (a: number[]) => a.reduce((s, p) => s + hist.get(p)!, 0);
    boxes.splice(bi, 1, { px: left, count: sum(left) }, { px: right, count: sum(right) });
  }
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const p of b.px) {
      const n = hist.get(p)!;
      r += chan(p, 0) * n;
      g += chan(p, 1) * n;
      bl += chan(p, 2) * n;
    }
    const n = Math.max(1, b.count);
    // back from 5-bit to 8-bit, centred in the bucket
    return [Math.min(255, Math.round((r / n) * 8 + 4)), Math.min(255, Math.round((g / n) * 8 + 4)), Math.min(255, Math.round((bl / n) * 8 + 4))] as [number, number, number];
  });
}

/** Palette index per pixel (−1 = transparent). */
export function assignPalette(data: Uint8ClampedArray, palette: [number, number, number][]): Int16Array {
  const out = new Int16Array(data.length / 4).fill(-1);
  const cache = new Map<number, number>();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let idx = cache.get(key);
    if (idx === undefined) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < palette.length; c++) {
        const dr = data[i] - palette[c][0];
        const dg = data[i + 1] - palette[c][1];
        const db = data[i + 2] - palette[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      idx = best;
      cache.set(key, idx);
    }
    out[p] = idx;
  }
  return out;
}

// ---------------------------------------------------------------- contour tracing

/** All boundary loops of a binary mask (outer contours clockwise, holes counter-clockwise). */
export function traceLoops(mask: Uint8Array, w: number, h: number): Pt[][] {
  const W = w + 1;
  // Directed pixel-edges keyed by start vertex. Inside is always on the right-hand side.
  const next = new Map<number, number[]>(); // start vertex → list of end vertices
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = y1 * W + x1;
    const arr = next.get(k);
    const e = y2 * W + x2;
    if (arr) arr.push(e);
    else next.set(k, [e]);
  };
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!on(x, y - 1)) add(x, y, x + 1, y);
      if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: Pt[][] = [];
  const dir = (a: number, b: number) => {
    const ax = a % W, ay = (a - ax) / W, bx = b % W, by = (b - bx) / W;
    return [bx - ax, by - ay];
  };
  for (const [start] of next) {
    while (next.get(start)?.length) {
      const loop: Pt[] = [];
      let cur = start;
      let prevDir: number[] | null = null;
      for (;;) {
        const outs = next.get(cur);
        if (!outs || outs.length === 0) break;
        let pick = 0;
        if (outs.length > 1 && prevDir) {
          // Saddle vertex: take the right turn so diagonally-touching pixels stay separate shapes.
          const turn = (e: number) => {
            const [dx, dy] = dir(cur, e);
            return prevDir![0] * dy - prevDir![1] * dx; // >0 = clockwise turn in image coordinates
          };
          pick = turn(outs[0]) >= turn(outs[1]) ? 0 : 1;
        }
        const e = outs.splice(pick, 1)[0];
        const x = cur % W;
        loop.push({ x, y: (cur - x) / W });
        prevDir = dir(cur, e);
        cur = e;
        if (cur === start) break;
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

function area(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
}

function dropCollinear(p: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length];
    const b = p[i];
    const c = p[(i + 1) % p.length];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) !== 0) out.push(b);
  }
  return out;
}

function dp(points: Pt[], tol: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const a = points[s];
    const b = points[e];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((points[i].x - a.x) * dy - (points[i].y - a.y) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplifies a closed loop: split at its two farthest points so the seam isn't a forced node. */
export function simplifyLoop(loop: Pt[], tol: number): Pt[] {
  const p = dropCollinear(loop);
  if (tol <= 0 || p.length < 6) return p;
  let a = 0;
  for (let i = 1; i < p.length; i++) if (p[i].x + p[i].y < p[a].x + p[a].y) a = i;
  let b = 0;
  let far = -1;
  for (let i = 0; i < p.length; i++) {
    const d = (p[i].x - p[a].x) ** 2 + (p[i].y - p[a].y) ** 2;
    if (d > far) {
      far = d;
      b = i;
    }
  }
  const rot = [...p.slice(a), ...p.slice(0, a)];
  const bi = (b - a + p.length) % p.length;
  const first = dp(rot.slice(0, bi + 1), tol);
  const second = dp([...rot.slice(bi), rot[0]], tol);
  const res = [...first.slice(0, -1), ...second.slice(0, -1)];
  return res.length >= 3 ? res : p;
}

const f = (n: number) => String(Math.round(n * 100) / 100);

function loopToPath(p: Pt[], smooth: boolean): string {
  if (!smooth || p.length < 4) return 'M' + p.map((q) => `${f(q.x)} ${f(q.y)}`).join('L') + 'Z';
  // Catmull-Rom → cubic Bézier through the simplified nodes (closed).
  let d = `M${f(p[0].x)} ${f(p[0].y)}`;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i + n - 1) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const t = 1 / 6;
    d += `C${f(p1.x + (p2.x - p0.x) * t)} ${f(p1.y + (p2.y - p0.y) * t)} ${f(p2.x - (p3.x - p1.x) * t)} ${f(p2.y - (p3.y - p1.y) * t)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}

// ---------------------------------------------------------------- public API

export interface VectorShape {
  color: string;
  d: string;
  area: number;
}

/** Traces RGBA pixel data into flat-colour shapes (largest first, so they stack correctly). */
export function vectorizePixels(data: Uint8ClampedArray, w: number, h: number, o: VectorizeOptions): VectorShape[] {
  const palette = medianCut(data, Math.max(2, Math.min(32, o.colors)));
  if (palette.length === 0) return [];
  const idx = assignPalette(data, palette);
  const shapes: VectorShape[] = [];
  palette.forEach((rgb, c) => {
    const mask = new Uint8Array(w * h);
    let count = 0;
    for (let i = 0; i < idx.length; i++)
      if (idx[i] === c) {
        mask[i] = 1;
        count++;
      }
    if (count === 0) return;
    const paths: string[] = [];
    for (const loop of traceLoops(mask, w, h)) {
      if (Math.abs(area(loop)) < o.minArea) continue;
      const s = simplifyLoop(loop, o.tolerance);
      if (s.length >= 3) paths.push(loopToPath(s, o.smooth));
    }
    if (paths.length) shapes.push({ color: hex(rgb[0], rgb[1], rgb[2]), d: paths.join(''), area: count });
  });
  return shapes.sort((a, b) => b.area - a.area);
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

const CSS_BLEND: Record<string, string> = {
  multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge',
  'color-burn': 'color-burn', 'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference', exclusion: 'exclusion',
  hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
};

export interface SvgLayerInput {
  name: string;
  canvas: HTMLCanvasElement;
  opacity: number;
  visible: boolean;
  blendMode: string;
  x: number;
  y: number;
}

function layerGroup(l: SvgLayerInput, o: VectorizeOptions): string {
  const ctx = l.canvas.getContext('2d', { willReadFrequently: true })!;
  const shapes = vectorizePixels(ctx.getImageData(0, 0, l.canvas.width, l.canvas.height).data, l.canvas.width, l.canvas.height, o);
  // A hairline stroke in the fill colour hides the seams between neighbouring flat shapes.
  const paths = shapes.map((s) => `    <path d="${s.d}" fill="${s.color}" stroke="${s.color}" stroke-width="0.6" stroke-linejoin="round" fill-rule="evenodd"/>`).join('\n');
  const attrs = [
    `id="${esc(l.name.replace(/\s+/g, '_'))}"`,
    `data-name="${esc(l.name)}"`,
    l.opacity < 1 ? `opacity="${f(l.opacity)}"` : '',
    l.visible ? '' : 'display="none"',
    CSS_BLEND[l.blendMode] ? `style="mix-blend-mode:${CSS_BLEND[l.blendMode]}"` : '',
    l.x || l.y ? `transform="translate(${l.x} ${l.y})"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `  <g ${attrs}>\n${paths}\n  </g>`;
}

/** SVG with one group per layer (bottom first), plus an optional solid background rect. */
export function layersToSvg(width: number, height: number, layers: SvgLayerInput[], o: VectorizeOptions, background?: string): string {
  const groups = layers.map((l) => layerGroup(l, o)).join('\n');
  const bg = background ? `  <rect width="${width}" height="${height}" fill="${background}"/>\n` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${bg}${groups}\n</svg>\n`;
}

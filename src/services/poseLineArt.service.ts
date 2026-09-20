/**
 * MoveNet is trained on photographs, so a line drawing on white paper gives it nothing to latch onto.
 * These helpers turn a drawing into several photo-like versions of the same figure — cropped to the
 * figure so it fills the frame, its outline filled in and shaded, thin lines thickened — that the
 * detector can try one after another. Everything works on small (≤ 384 px) copies.
 */

export interface PoseCandidate {
  name: string;
  canvas: HTMLCanvasElement;
  /** Square region of the source this picture shows, in source pixels (its side maps to `side`). */
  crop: { x: number; y: number; size: number };
  side: number;
}

const N = 384;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Colour of the paper: the most common colour along the border. */
function paperColor(d: Uint8ClampedArray, w: number, h: number): Rgb {
  const votes = new Map<number, { n: number; c: Rgb }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const v = votes.get(key);
    if (v) v.n++;
    else votes.set(key, { n: 1, c: { r: d[i], g: d[i + 1], b: d[i + 2] } });
  };
  for (let x = 0; x < w; x += 2) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += 2) { add(0, y); add(w - 1, y); }
  let best: { n: number; c: Rgb } | null = null;
  for (const v of votes.values()) if (!best || v.n > best.n) best = v;
  return best!.c;
}

function inkMask(d: Uint8ClampedArray, w: number, h: number, paper: Rgb, threshold: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const dist = Math.max(Math.abs(d[i * 4] - paper.r), Math.abs(d[i * 4 + 1] - paper.g), Math.abs(d[i * 4 + 2] - paper.b));
    m[i] = dist > threshold ? 1 : 0;
  }
  return m;
}

/** Square dilation by `r` pixels (separable). */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    // forward pass: distance to the previous set pixel
    const dist = new Int32Array(w);
    for (let x = 0; x < w; x++) { if (mask[y * w + x]) last = x; dist[x] = x - last; }
    let next = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (mask[y * w + x]) next = x; if (Math.min(dist[x], next - x) <= r) tmp[y * w + x] = 1; }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    const dist = new Int32Array(h);
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) last = y; dist[y] = y - last; }
    let next = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) next = y; if (Math.min(dist[y], next - y) <= r) out[y * w + x] = 1; }
  }
  return out;
}

/** Everything the paper touches from the outside is background; what remains is the figure. */
function fillFigure(ink: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (!ink[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  const fig = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fig[i] = outside[i] ? 0 : 1;
  return fig;
}

/** Chamfer distance (in pixels) from every figure pixel to the nearest background pixel. */
function distanceInside(fig: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = fig[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - w] + 1); if (x > 0) v = Math.min(v, d[i - w - 1] + 1.414); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 1.414); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 1.414); if (x > 0) v = Math.min(v, d[i + w - 1] + 1.414); }
    d[i] = v;
  }
  return d;
}

function toCanvas(gray: (i: number) => number, w: number, h: number, blurPx: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const g = gray(i);
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g * 0.93;
    img.data[i * 4 + 2] = g * 0.86;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (blurPx <= 0) return c;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.filter = `blur(${blurPx}px)`;
  octx.drawImage(c, 0, 0);
  return out;
}

/**
 * Returns the figure-centred crop plus photo-like renderings of it, or null when the drawing is
 * empty. `flat` must already be opaque (flattened over the paper colour).
 */
export function buildLineArtCandidates(flat: HTMLCanvasElement): PoseCandidate[] | null {
  // 1. Find the drawing on a reduced copy.
  const scale = Math.min(1, 512 / Math.max(flat.width, flat.height));
  const aw = Math.max(8, Math.round(flat.width * scale));
  const ah = Math.max(8, Math.round(flat.height * scale));
  const a = document.createElement('canvas');
  a.width = aw;
  a.height = ah;
  a.getContext('2d')!.drawImage(flat, 0, 0, aw, ah);
  const ad = a.getContext('2d')!.getImageData(0, 0, aw, ah).data;
  const paper = paperColor(ad, aw, ah);
  const am = inkMask(ad, aw, ah, paper, 28);
  let x0 = aw, y0 = ah, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (am[y * aw + x]) { count++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (count < 30 || x1 < 0) return null;

  const bw = (x1 - x0 + 1) / scale;
  const bh = (y1 - y0 + 1) / scale;
  const cx = ((x0 + x1) / 2 + 0.5) / scale;
  const cy = ((y0 + y1) / 2 + 0.5) / scale;
  const all: PoseCandidate[] = [];
  // 2. The detector likes the person to fill ~2/3 of the frame: try a tight and a looser crop.
  for (const margin of [1.15, 1.55, 2.1, 3.2]) {
    const size = Math.max(bw, bh) * margin;
    const tag = margin === 1.15 ? '' : margin === 1.55 ? ' (más aire)' : margin === 2.1 ? ' (mucho aire)' : ' (muy lejos)';
    // A close-up (a face filling the page) reads best as a small figure on plenty of paper: only the plain crop.
    const list = candidatesForCrop(flat, paper, { x: cx - size / 2, y: cy - size / 2, size }, tag);
    all.push(...(margin > 2.5 ? list.slice(0, 1) : list));
  }
  return all;
}

function candidatesForCrop(flat: HTMLCanvasElement, paper: Rgb, crop: { x: number; y: number; size: number }, tag: string): PoseCandidate[] {
  const size = crop.size;

  // 3. Crop to N×N, paper-coloured where it leaves the page.
  const base = document.createElement('canvas');
  base.width = N;
  base.height = N;
  const bctx = base.getContext('2d')!;
  bctx.fillStyle = `rgb(${paper.r},${paper.g},${paper.b})`;
  bctx.fillRect(0, 0, N, N);
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(flat, crop.x, crop.y, size, size, 0, 0, N, N);
  const bd = bctx.getImageData(0, 0, N, N).data;
  const ink = inkMask(bd, N, N, paper, 22);

  const mk = (name: string, canvas: HTMLCanvasElement): PoseCandidate => ({ name: name + tag, canvas, crop, side: N });
  const candidates: PoseCandidate[] = [mk('recorte', base)];

  // 4. Silhouettes. Closed outlines fill in; open (stick) figures need their lines thickened first.
  const shade = (fig: Uint8Array, blur: number, tone: 'shaded' | 'solid') => {
    const dist = distanceInside(fig, N, N);
    let max = 1;
    for (let i = 0; i < dist.length; i++) if (dist[i] > max && dist[i] < 1e5) max = dist[i];
    const soft = Math.max(3, Math.min(max, N * 0.045));
    return toCanvas((i) => (!fig[i] ? 236 : tone === 'solid' ? 70 : 60 + 100 * Math.min(1, dist[i] / soft)), N, N, blur);
  };
  const closed = dilate(ink, N, N, 2);
  candidates.push(mk('silueta sombreada', shade(fillFigure(closed, N, N), 1.2, 'shaded')));
  candidates.push(mk('silueta oscura', shade(fillFigure(closed, N, N), 1.2, 'solid')));
  candidates.push(mk('líneas gruesas', shade(fillFigure(dilate(ink, N, N, Math.round(N * 0.018)), N, N), 1.5, 'shaded')));
  candidates.push(mk('líneas muy gruesas', shade(fillFigure(dilate(ink, N, N, Math.round(N * 0.032)), N, N), 2.2, 'solid')));
  return candidates;
}

import { extractKMeans } from '../paletteExtraction.service';
import { findNearestColorName } from '../colorNaming.service';
import { rgbaToHex } from '@/utils/colorUtils';
import { inkMask } from './cleanup.service';

/**
 * Splits a finished drawing into layers: line art from colour, the subject from its background, or one
 * layer per main colour. Each layer keeps the original pixels (nothing is redrawn), and the caller adds
 * them as new layers, so the original stays exactly as it was.
 */

export interface SeparatedLayer {
  name: string;
  canvas: HTMLCanvasElement;
}

const blank = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function paperOf(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  return inkMask(d, w, h).paper;
}

/** Fills the pixels flagged in `hole` with the nearest colour that is not in it (so colour continues under the lines). */
function fillHoles(d: Uint8ClampedArray, w: number, h: number, hole: Uint8Array) {
  const known = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) known[i] = hole[i] ? 0 : 1;
  for (let pass = 0; pass < 24; pass++) {
    const next = known.slice();
    let any = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (known[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (known[j]) { r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
          }
        }
        if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; d[i * 4 + 3] = 255; next[i] = 1; any = true; }
      }
    }
    known.set(next);
    if (!any) break;
  }
}

/** Line art (dark strokes, with the softness they had) on one layer and the colour underneath on another. */
export function separateLineArt(source: HTMLCanvasElement): SeparatedLayer[] {
  const w = source.width;
  const h = source.height;
  const ctx = source.getContext('2d')!;
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const paper = paperOf(d, w, h);
  const paperLuma = 0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2];

  const line = blank(w, h);
  const li = line.getContext('2d')!.createImageData(w, h);
  const colour = blank(w, h);
  const ci = colour.getContext('2d')!.createImageData(w, h);
  const hole = new Uint8Array(w * h);
  const T1 = paperLuma * 0.62; // fully ink below this
  const T2 = paperLuma * 0.86; // paper above this
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    // a dark stroke is dark AND not strongly coloured (a dark red fill is not a line)
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const dark = sat < 0.22 ? Math.max(0, Math.min(1, (T2 - luma) / (T2 - T1))) : 0;
    if (dark > 0.05) {
      // the stroke keeps its own darkness as colour: near-black ink stays near-black
      const k = Math.min(1, luma / Math.max(1, T2));
      li.data[i * 4] = r * k * 0.5;
      li.data[i * 4 + 1] = g * k * 0.5;
      li.data[i * 4 + 2] = b * k * 0.5;
      li.data[i * 4 + 3] = Math.round(255 * dark);
    }
    ci.data[i * 4] = r; ci.data[i * 4 + 1] = g; ci.data[i * 4 + 2] = b; ci.data[i * 4 + 3] = 255;
    if (dark > 0.02) hole[i] = 1;
  }
  // one more ring around the ink: its anti-aliased edge must not survive on the colour layer as a faint outline
  const ring = hole.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!hole[i] && (hole[i - 1] || hole[i + 1] || hole[i - w] || hole[i + w])) ring[i] = 1;
    }
  }
  fillHoles(ci.data, w, h, ring);
  line.getContext('2d')!.putImageData(li, 0, 0);
  colour.getContext('2d')!.putImageData(ci, 0, 0);
  return [{ name: 'Línea', canvas: line }, { name: 'Color', canvas: colour }];
}

/** The subject (everything not connected to the border colour) and the background. */
export function separateBackground(source: HTMLCanvasElement, tolerance = 40): SeparatedLayer[] {
  const w = source.width;
  const h = source.height;
  const d = source.getContext('2d')!.getImageData(0, 0, w, h).data;
  const paper = paperOf(d, w, h);
  const isPaper = (i: number) => Math.max(Math.abs(d[i * 4] - paper[0]), Math.abs(d[i * 4 + 1] - paper[1]), Math.abs(d[i * 4 + 2] - paper[2])) <= tolerance || d[i * 4 + 3] < 20;
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (!bg[i] && isPaper(i)) { bg[i] = 1; stack.push(i); }
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
  const subject = blank(w, h);
  const si = subject.getContext('2d')!.createImageData(w, h);
  const back = blank(w, h);
  const bi = back.getContext('2d')!.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const t = i * 4;
    const target = bg[i] ? bi : si;
    target.data[t] = d[t]; target.data[t + 1] = d[t + 1]; target.data[t + 2] = d[t + 2]; target.data[t + 3] = d[t + 3];
  }
  subject.getContext('2d')!.putImageData(si, 0, 0);
  back.getContext('2d')!.putImageData(bi, 0, 0);
  return [{ name: 'Sujeto', canvas: subject }, { name: 'Fondo', canvas: back }];
}

/** One layer per dominant colour (each pixel goes to its nearest of `k` colours). */
export function separateByColors(source: HTMLCanvasElement, k = 4): SeparatedLayer[] {
  const w = source.width;
  const h = source.height;
  const sctx = source.getContext('2d')!;
  const small = blank(Math.min(200, w), Math.max(1, Math.round((h * Math.min(200, w)) / w)));
  small.getContext('2d')!.drawImage(source, 0, 0, small.width, small.height);
  const centroids = extractKMeans(small.getContext('2d')!.getImageData(0, 0, small.width, small.height), Math.max(2, Math.min(8, k)));
  const d = sctx.getImageData(0, 0, w, h).data;
  const outs = centroids.map(() => {
    const c = blank(w, h);
    return { c, id: c.getContext('2d')!.createImageData(w, h) };
  });
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < 8) continue;
    let bi = 0;
    let bd = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const dr = d[i * 4] - centroids[c].r;
      const dg = d[i * 4 + 1] - centroids[c].g;
      const db = d[i * 4 + 2] - centroids[c].b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bd) { bd = dist; bi = c; }
    }
    const t = outs[bi].id.data;
    t[i * 4] = d[i * 4]; t[i * 4 + 1] = d[i * 4 + 1]; t[i * 4 + 2] = d[i * 4 + 2]; t[i * 4 + 3] = d[i * 4 + 3];
  }
  return outs
    .map((o, i) => {
      o.c.getContext('2d')!.putImageData(o.id, 0, 0);
      const hex = rgbaToHex(centroids[i]);
      let name = hex;
      try { name = findNearestColorName(hex).name; } catch { /* keep the hex */ }
      return { name: `${name} (${hex})`, canvas: o.c };
    })
    .filter((l) => {
      const px = l.canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 8) return true;
      return false;
    });
}

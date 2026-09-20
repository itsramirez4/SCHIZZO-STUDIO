/**
 * Small-error cleanup for linework: removes stray specks and closes tiny gaps in the lines. It works on a
 * COPY (the caller puts the result on a new layer), so the original is never touched, and it reports
 * exactly how much it changed.
 */

export interface CleanOptions {
  /** Ink blobs smaller than this many pixels are treated as dust and removed (0 = off). */
  minSpeckArea: number;
  /** Line ends closer than this many pixels are joined (0 = off). */
  closeGapRadius: number;
}

export interface CleanResult {
  canvas: HTMLCanvasElement;
  specksRemoved: number;
  gapPixelsAdded: number;
  /** The changes in red (removed) and green (added) over transparent — to preview before accepting. */
  preview: HTMLCanvasElement;
}

function paper(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const votes = new Map<number, { n: number; c: [number, number, number] }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const v = votes.get(k);
    if (v) v.n++;
    else votes.set(k, { n: 1, c: [d[i], d[i + 1], d[i + 2]] });
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  let best: { n: number; c: [number, number, number] } | null = null;
  for (const v of votes.values()) if (!best || v.n > best.n) best = v;
  return best!.c;
}

/** Ink mask: opaque strokes on a transparent layer, or pixels clearly different from the paper. */
export function inkMask(d: Uint8ClampedArray, w: number, h: number): { mask: Uint8Array; transparent: boolean; paper: [number, number, number] } {
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 20) clear++;
  const transparent = clear > (w * h) * 0.2;
  const p = transparent ? ([255, 255, 255] as [number, number, number]) : paper(d, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (transparent) mask[i] = d[i * 4 + 3] > 60 ? 1 : 0;
    else mask[i] = Math.max(Math.abs(d[i * 4] - p[0]), Math.abs(d[i * 4 + 1] - p[1]), Math.abs(d[i * 4 + 2] - p[2])) > 70 ? 1 : 0;
  }
  return { mask, transparent, paper: p };
}

export function cleanDrawing(source: HTMLCanvasElement, opts: CleanOptions): CleanResult {
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const { mask, transparent, paper: p } = inkMask(d, w, h);
  const removed = new Uint8Array(w * h);
  const added = new Uint8Array(w * h);
  let specksRemoved = 0;

  // ---- specks: 8-connected components of ink smaller than the limit
  if (opts.minSpeckArea > 0) {
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let s = 0; s < w * h; s++) {
      if (!mask[s] || seen[s]) continue;
      const comp: number[] = [];
      stack.push(s);
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop()!;
        comp.push(i);
        const x = i % w;
        const y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (mask[j] && !seen[j]) {
              seen[j] = 1;
              stack.push(j);
            }
          }
        }
      }
      if (comp.length < opts.minSpeckArea) {
        specksRemoved++;
        for (const i of comp) {
          removed[i] = 1;
          mask[i] = 0;
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (!removed[i]) continue;
      if (transparent) d[i * 4 + 3] = 0;
      else { d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; }
    }
  }

  // ---- gaps: pixels that lie between two ink pixels within the radius (morphological closing), coloured like their neighbours
  let gapPixelsAdded = 0;
  const r = Math.min(8, Math.max(0, Math.round(opts.closeGapRadius)));
  if (r > 0) {
    const dil = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && dx * dx + dy * dy <= r * r) dil[ny * w + nx] = 1;
          }
        }
      }
    }
    // erosion of the dilated mask: a pixel stays only if EVERY neighbour within r is dilated
    for (let y = r; y < h - r; y++) {
      for (let x = r; x < w - r; x++) {
        const i = y * w + x;
        if (mask[i] || !dil[i]) continue;
        let all = true;
        for (let dy = -r; dy <= r && all; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && !dil[(y + dy) * w + x + dx]) { all = false; break; }
        if (all) added[i] = 1;
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (!added[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      let best = -1;
      let bd = 1e9;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mask[j] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = j; }
        }
      }
      if (best >= 0) {
        d[i * 4] = d[best * 4];
        d[i * 4 + 1] = d[best * 4 + 1];
        d[i * 4 + 2] = d[best * 4 + 2];
        d[i * 4 + 3] = transparent ? d[best * 4 + 3] : 255;
        gapPixelsAdded++;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const preview = document.createElement('canvas');
  preview.width = w;
  preview.height = h;
  const pctx = preview.getContext('2d')!;
  const pi = pctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (removed[i]) { pi.data[i * 4] = 230; pi.data[i * 4 + 1] = 40; pi.data[i * 4 + 2] = 40; pi.data[i * 4 + 3] = 255; }
    else if (added[i]) { pi.data[i * 4] = 40; pi.data[i * 4 + 1] = 200; pi.data[i * 4 + 2] = 80; pi.data[i * 4 + 3] = 255; }
  }
  pctx.putImageData(pi, 0, 0);
  return { canvas: out, specksRemoved, gapPixelsAdded, preview };
}

/** Shared by the brush importers: fold a second tip (dual brush) and/or a paper texture into a brush tip. */

export interface AlphaImage {
  alpha: Uint8Array;
  w: number;
  h: number;
}

export interface BakeOptions {
  /** Main tip diameter in brush px (relates the dual tip and the paper scale to the tip). */
  size: number;
  dual?: AlphaImage & { size: number };
  pattern?: { data: Uint8Array | Uint8ClampedArray; w: number; h: number; scale: number; depth: number; invert: boolean; contrast: number; brightness: number };
}

/**
 * Multiplies the main tip by the dual-brush tip (scaled by the ratio of their sizes, centred) and
 * by the paper-texture pattern (tiled at its scale, mixed in at its depth). Pure array maths.
 */
export function bakeTipAlpha(main: AlphaImage, o: BakeOptions): AlphaImage {
  const out = new Uint8Array(main.w * main.h);
  const maxSide = Math.max(main.w, main.h);
  const docPerPx = o.size / maxSide; // document px covered by one tip pixel
  for (let y = 0; y < main.h; y++) {
    for (let x = 0; x < main.w; x++) {
      let a = main.alpha[y * main.w + x] / 255;
      if (a > 0 && o.dual) {
        const d = o.dual;
        const ratio = Math.max(0.05, d.size / o.size);
        const dx = Math.floor(((x - main.w / 2) / ratio) * (d.w / main.w) + d.w / 2);
        const dy = Math.floor(((y - main.h / 2) / ratio) * (d.h / main.h) + d.h / 2);
        a *= dx < 0 || dy < 0 || dx >= d.w || dy >= d.h ? 0 : d.alpha[dy * d.w + dx] / 255;
      }
      if (a > 0 && o.pattern) {
        const p = o.pattern;
        const px = Math.floor((x * docPerPx) / Math.max(0.05, p.scale)) % p.w;
        const py = Math.floor((y * docPerPx) / Math.max(0.05, p.scale)) % p.h;
        let l = p.data[py * p.w + px] / 255;
        if (p.invert) l = 1 - l;
        l = Math.max(0, Math.min(1, (l - 0.5) * (1 + p.contrast / 100) + 0.5 + p.brightness / 200));
        a *= 1 - p.depth * (1 - l);
      }
      out[y * main.w + x] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  return { alpha: out, w: main.w, h: main.h };
}

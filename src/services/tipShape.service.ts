import type { AlphaImage } from './tipBake.service';

/**
 * Geometry of a brush tip as Photoshop describes it: how round it is (an ellipse when < 1), how it is
 * turned, and whether its soft edge is broken up by noise. Pure array maths (no canvas), so it runs
 * anywhere and is easy to test. Angles are degrees, counter-clockwise as seen on screen.
 */

const SOFT_SIDE = 192;

/** Deterministic pseudo-random numbers in [0, 1): the same brush always gets the same grain. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** A round brush tip (soft-edged by `hardness`), squashed to `roundness` and turned by `angleDeg`. */
export function generateSoftTip(hardness: number, roundness: number, angleDeg: number): AlphaImage {
  const S = SOFT_SIDE;
  const c = (S - 1) / 2;
  const a = (-angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const round = Math.max(0.05, Math.min(1, roundness));
  const h = Math.max(0, Math.min(0.99, hardness));
  const alpha = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x - c) / c;
      const v = (y - c) / c;
      const uu = u * cos + v * sin;
      const vv = (-u * sin + v * cos) / round;
      const r = Math.hypot(uu, vv);
      const t = r >= 1 ? 0 : r <= h ? 1 : 1 - (r - h) / (1 - h);
      alpha[y * S + x] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  return { alpha, w: S, h: S };
}

/** Squashes a sampled tip to `roundness` (height) and turns it, growing the canvas to fit. */
export function reshapeTip(tip: AlphaImage, roundness: number, angleDeg: number): AlphaImage {
  const round = Math.max(0.05, Math.min(1, roundness));
  if (round >= 0.999 && Math.abs(angleDeg) < 0.01) return tip;
  const a = (-angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const { w, h } = tip;
  const ow = Math.max(1, Math.ceil(Math.abs(w * cos) + Math.abs(h * round * sin)));
  const oh = Math.max(1, Math.ceil(Math.abs(w * sin) + Math.abs(h * round * cos)));
  const out = new Uint8Array(ow * oh);
  const ocx = (ow - 1) / 2;
  const ocy = (oh - 1) / 2;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const px = x - ocx;
      const py = y - ocy;
      // Back through the rotation, then undo the squash.
      const qx = px * cos + py * sin;
      const qy = (-px * sin + py * cos) / round;
      const sx = qx + (w - 1) / 2;
      const sy = qy + (h - 1) / 2;
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const top = tip.alpha[y0 * w + x0] * (1 - fx) + tip.alpha[y0 * w + x1] * fx;
      const bot = tip.alpha[y1 * w + x0] * (1 - fx) + tip.alpha[y1 * w + x1] * fx;
      out[y * ow + x] = Math.round(top * (1 - fy) + bot * fy);
    }
  }
  return { alpha: out, w: ow, h: oh };
}

/** Photoshop's "Noise": the soft part of the edge turns grainy. Solid and empty pixels are untouched. */
export function addEdgeNoise(tip: AlphaImage, seed = 7): AlphaImage {
  const rand = rng(seed);
  const out = new Uint8Array(tip.alpha.length);
  for (let i = 0; i < out.length; i++) {
    const a = tip.alpha[i];
    if (a <= 3 || a >= 252) {
      out[i] = a;
      continue;
    }
    const softness = 1 - Math.abs(a / 127.5 - 1); // 0 at the extremes, 1 half-way
    out[i] = Math.max(0, Math.min(255, Math.round(a + (rand() - 0.5) * 300 * softness)));
  }
  return { alpha: out, w: tip.w, h: tip.h };
}

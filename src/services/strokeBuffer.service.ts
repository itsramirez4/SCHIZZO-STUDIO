import type { Brush } from '@/types';
import type { SelectionRect } from '@/types';

/**
 * Photoshop-style opacity / flow. Without a buffer every stamp is composited straight onto the
 * layer at the brush opacity, so overlapping stamps darken each other and a stroke can never be
 * "at most 40 % opaque". A stroke session paints the stamps into a separate transparent buffer
 * (where they accumulate at the FLOW), and after every move puts the buffer on top of an untouched
 * snapshot of the layer at the OPACITY, through the brush's blend mode — so the opacity is a real
 * ceiling for the whole stroke and blend modes act once per stroke instead of once per stamp.
 *
 * Brushes without `flow` and without a blend mode keep the classic per-stamp behaviour.
 */
export function needsStrokeBuffer(brush: Brush): boolean {
  return brush.flow !== undefined || !!brush.wetEdges || (!!brush.blendMode && brush.blendMode !== 'source-over');
}

/** The brush as it must be stamped into the buffer: flow accumulates, opacity/blend come later. */
export function bufferBrush(brush: Brush): Brush {
  return { ...brush, opacity: brush.flow ?? 1, blendMode: undefined };
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let pooledBuffer: HTMLCanvasElement | null = null;
let pooledBase: HTMLCanvasElement | null = null;
let pooledWet: HTMLCanvasElement | null = null;
let pooledBlur: HTMLCanvasElement | null = null;

function takeCanvas(pool: HTMLCanvasElement | null, w: number, h: number): HTMLCanvasElement {
  const c = pool ?? document.createElement('canvas');
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  } else {
    c.getContext('2d')!.clearRect(0, 0, w, h);
  }
  return c;
}

export class StrokeSession {
  private base: HTMLCanvasElement;
  private buf: HTMLCanvasElement;
  private pad: number;
  private dirty: Rect | null = null;
  readonly ctx: CanvasRenderingContext2D;
  readonly stampBrush: Brush;

  constructor(private layer: HTMLCanvasElement, private brush: Brush) {
    pooledBase = this.base = takeCanvas(pooledBase, layer.width, layer.height);
    pooledBuffer = this.buf = takeCanvas(pooledBuffer, layer.width, layer.height);
    this.base.getContext('2d')!.drawImage(layer, 0, 0);
    this.ctx = this.buf.getContext('2d')!;
    this.stampBrush = bufferBrush(brush);
    // Stamps reach `size / 2` from the point (a bit more with jitter and scatter).
    this.pad = Math.ceil(brush.size * (1 + brush.scatter * 2 + brush.sizeJitter) + 6);
  }

  /** Records that a stamp run touched these points, so only that area is recomposited. */
  touch(points: { x: number; y: number }[]) {
    for (const p of points) {
      const r = { x0: p.x - this.pad, y0: p.y - this.pad, x1: p.x + this.pad, y1: p.y + this.pad };
      this.dirty = this.dirty
        ? { x0: Math.min(this.dirty.x0, r.x0), y0: Math.min(this.dirty.y0, r.y0), x1: Math.max(this.dirty.x1, r.x1), y1: Math.max(this.dirty.y1, r.y1) }
        : r;
    }
  }

  /** Puts base + buffer back on the layer inside the area touched since the last flush. */
  flush(selection: SelectionRect | null | undefined, lockAlpha: boolean | undefined) {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const x = Math.max(0, Math.floor(d.x0));
    const y = Math.max(0, Math.floor(d.y0));
    const w = Math.min(this.layer.width, Math.ceil(d.x1)) - x;
    const h = Math.min(this.layer.height, Math.ceil(d.y1)) - y;
    if (w <= 0 || h <= 0) return;

    const ctx = this.layer.getContext('2d')!;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // (not 'copy': it would also wipe everything outside the drawn rectangle)
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(this.base, x, y, w, h, x, y, w, h);
    ctx.restore();

    ctx.save();
    if (selection) {
      ctx.beginPath();
      ctx.rect(selection.x, selection.y, selection.w, selection.h);
      ctx.clip();
    }
    const source = this.brush.wetEdges ? this.wetEdgeLayer(x, y, w, h) : this.buf;
    const sx = this.brush.wetEdges ? 0 : x;
    const sy = this.brush.wetEdges ? 0 : y;
    ctx.globalAlpha = this.brush.opacity;
    const blend = this.brush.blendMode;
    ctx.globalCompositeOperation = lockAlpha ? 'source-atop' : blend === 'erase' ? 'destination-out' : blend ?? 'source-over';
    ctx.drawImage(source, sx, sy, w, h, x, y, w, h);
    ctx.restore();
  }

  /**
   * Watercolour "wet edges": the paint in the middle of the stroke gets thinner and the rim keeps
   * its full density. The rim is found by comparing the stroke's alpha with a blurred copy of itself
   * (equal in the middle, lower along the edge); the blur reads a margin around the area so the
   * result matches what earlier updates painted next to it.
   */
  private wetEdgeLayer(x: number, y: number, w: number, h: number): HTMLCanvasElement {
    const radius = Math.max(1.5, this.brush.size * 0.07);
    const m = Math.ceil(radius * 3);
    const ex = Math.max(0, x - m);
    const ey = Math.max(0, y - m);
    const ew = Math.min(this.layer.width, x + w + m) - ex;
    const eh = Math.min(this.layer.height, y + h + m) - ey;
    pooledBlur = takeCanvas(pooledBlur, ew, eh);
    const bctx = pooledBlur.getContext('2d')!;
    bctx.filter = `blur(${radius}px)`;
    bctx.drawImage(this.buf, ex, ey, ew, eh, 0, 0, ew, eh);
    bctx.filter = 'none';
    const blurred = bctx.getImageData(x - ex, y - ey, w, h).data;
    const src = this.ctx.getImageData(x, y, w, h);
    const d = src.data;
    const wet = Math.min(1, this.brush.wetEdges ?? 0);
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (!a) continue;
      const edge = Math.max(0, Math.min(1, ((a - blurred[i]) / 255) * 3));
      d[i] = Math.round(a * (1 - wet * 0.6 * (1 - edge)));
    }
    pooledWet = takeCanvas(pooledWet, w, h);
    pooledWet.getContext('2d')!.putImageData(src, 0, 0);
    return pooledWet;
  }
}

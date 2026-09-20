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
  return brush.flow !== undefined || (!!brush.blendMode && brush.blendMode !== 'source-over');
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
    ctx.globalAlpha = this.brush.opacity;
    const blend = this.brush.blendMode;
    ctx.globalCompositeOperation = lockAlpha ? 'source-atop' : blend === 'erase' ? 'destination-out' : blend ?? 'source-over';
    ctx.drawImage(this.buf, x, y, w, h, x, y, w, h);
    ctx.restore();
  }
}

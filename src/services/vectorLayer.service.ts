import { v4 as uuid } from 'uuid';
import type { VectorObject } from '@/types/layer.types';
import type { VectorFillStyle, VectorStrokeStyle } from '@/types/vectorShapes';
import { paintShape } from './shapeGeometry.service';
import { pathToSvgD } from './path.service';

export const newVectorId = () => uuid();

function applyStyle(ctx: CanvasRenderingContext2D, path: Path2D, stroke: VectorStrokeStyle, fill: VectorFillStyle) {
  if (fill.enabled) {
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    ctx.fill(path, 'nonzero');
  }
  if (stroke.enabled && stroke.width > 0) {
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.cap;
    ctx.lineJoin = stroke.join;
    ctx.setLineDash(stroke.dashed ? [stroke.width * 2, stroke.width * 1.5] : []);
    ctx.stroke(path);
  }
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textMetrics(o: Extract<VectorObject, { kind: 'text' }>) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = `${o.weight} ${o.fontSize}px ${o.font}`;
  const lines = o.text.split('\n');
  const width = Math.max(1, ...lines.map((l) => measureCtx!.measureText(l).width));
  return { lines, width, height: Math.max(1, lines.length * o.fontSize * 1.2) };
}

function drawText(ctx: CanvasRenderingContext2D, o: Extract<VectorObject, { kind: 'text' }>) {
  const { lines, width, height } = textMetrics(o);
  ctx.save();
  ctx.translate(o.x + (width * o.scale) / 2, o.y + (height * o.scale) / 2);
  ctx.rotate(o.angle);
  ctx.scale(o.scale, o.scale);
  ctx.translate(-width / 2, -height / 2);
  ctx.font = `${o.weight} ${o.fontSize}px ${o.font}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    const y = i * o.fontSize * 1.2;
    if (o.fill.enabled) {
      ctx.globalAlpha = o.fill.opacity;
      ctx.fillStyle = o.fill.color;
      ctx.fillText(line, 0, y);
    }
    if (o.stroke.enabled && o.stroke.width > 0) {
      ctx.globalAlpha = o.stroke.opacity;
      ctx.strokeStyle = o.stroke.color;
      ctx.lineWidth = o.stroke.width / o.scale;
      ctx.lineJoin = o.stroke.join;
      ctx.strokeText(line, 0, y);
    }
  });
  ctx.restore();
}

/** Clears `canvas` and draws every object of a vector layer onto it. */
export function renderVectorLayer(canvas: HTMLCanvasElement, objects: VectorObject[]) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const o of objects) {
    ctx.save();
    if (o.kind === 'shape') paintShape(ctx, o.draft, o.stroke, o.fill);
    else if (o.kind === 'text') drawText(ctx, o);
    else if (o.path.points.length >= 2) applyStyle(ctx, new Path2D(pathToSvgD(o.path)), o.stroke, o.fill.enabled && o.path.closed ? o.fill : { ...o.fill, enabled: false });
    ctx.restore();
  }
  ctx.restore();
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned box around the object as drawn (rotation included). */
export function objectBounds(o: VectorObject): Bounds {
  let pts: { x: number; y: number }[];
  if (o.kind === 'shape') {
    const { x, y, w, h, angle } = o.draft;
    pts = rotatedCorners(x, y, w, h, angle);
  } else if (o.kind === 'text') {
    const m = textMetrics(o);
    pts = rotatedCorners(o.x, o.y, m.width * o.scale, m.height * o.scale, o.angle);
  } else {
    pts = o.path.points.flatMap((p) => [p.anchor, p.controlIn, p.controlOut]);
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const pad = o.kind === 'text' ? 0 : ('stroke' in o && o.stroke.enabled ? o.stroke.width / 2 : 0);
  return { x: x - pad, y: y - pad, w: Math.max(...xs) - x + pad * 2, h: Math.max(...ys) - y + pad * 2 };
}

function rotatedCorners(x: number, y: number, w: number, h: number, angle: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([dx, dy]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }));
}

/** Topmost object under the point, if any. */
export function hitTestVector(objects: VectorObject[], x: number, y: number): VectorObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const b = objectBounds(objects[i]);
    const slop = 3;
    if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return objects[i];
  }
  return null;
}

export function translateObject(o: VectorObject, dx: number, dy: number): VectorObject {
  if (o.kind === 'shape') return { ...o, draft: { ...o.draft, x: o.draft.x + dx, y: o.draft.y + dy } };
  if (o.kind === 'text') return { ...o, x: o.x + dx, y: o.y + dy };
  const mv = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  return { ...o, path: { ...o.path, points: o.path.points.map((p) => ({ anchor: mv(p.anchor), controlIn: mv(p.controlIn), controlOut: mv(p.controlOut) })) } };
}

export function objectLabel(o: VectorObject): string {
  if (o.kind === 'text') return `Texto: ${o.text.split('\n')[0].slice(0, 18) || '(vacío)'}`;
  if (o.kind === 'path') return o.path.closed ? 'Trazado cerrado' : 'Trazado abierto';
  return { rectangle: 'Rectángulo', ellipse: 'Elipse', polygon: 'Polígono', star: 'Estrella' }[o.draft.kind];
}

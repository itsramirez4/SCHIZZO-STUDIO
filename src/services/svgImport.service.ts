import { createCanvas } from '@/utils/canvasUtils';

export interface ParsedSvgShape {
  path2d: Path2D;
  fill: string | null; // raw CSS color string (hex, named, rgb()...) — null means "don't fill"
  fillOpacity: number;
  stroke: string | null;
  strokeWidth: number;
  strokeOpacity: number;
}

export interface ParsedSvg {
  shapes: ParsedSvgShape[];
  width: number;
  height: number;
}

interface StyleContext {
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  strokeWidth: number;
  strokeOpacity: number;
  opacityMultiplier: number; // cumulative product of ancestor `opacity` attrs — real SVG turns
  // group opacity into an offscreen-composite, which we approximate by applying it per-shape
}

const SKIP_TAGS = new Set(['defs', 'symbol', 'clippath', 'mask', 'style', 'title', 'desc', 'metadata', 'text', 'image', 'use']);
const CONTAINER_TAGS = new Set(['g', 'svg', 'a']);

function readAttrOrStyle(el: Element, name: string): string | null {
  const style = el.getAttribute('style');
  if (style) {
    const match = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i'));
    if (match) return match[1].trim();
  }
  return el.getAttribute(name);
}

function resolveStyle(el: Element, parent: StyleContext): StyleContext {
  const fillAttr = readAttrOrStyle(el, 'fill');
  const strokeAttr = readAttrOrStyle(el, 'stroke');
  const fillOpacityAttr = readAttrOrStyle(el, 'fill-opacity');
  const strokeOpacityAttr = readAttrOrStyle(el, 'stroke-opacity');
  const strokeWidthAttr = readAttrOrStyle(el, 'stroke-width');
  const opacityAttr = readAttrOrStyle(el, 'opacity');
  const ownOpacity = opacityAttr !== null ? parseFloat(opacityAttr) : 1;

  return {
    fill: fillAttr === 'none' ? null : (fillAttr ?? parent.fill),
    fillOpacity: fillOpacityAttr !== null ? parseFloat(fillOpacityAttr) : parent.fillOpacity,
    stroke: strokeAttr === 'none' ? null : (strokeAttr ?? parent.stroke),
    strokeWidth: strokeWidthAttr !== null ? parseFloat(strokeWidthAttr) : parent.strokeWidth,
    strokeOpacity: strokeOpacityAttr !== null ? parseFloat(strokeOpacityAttr) : parent.strokeOpacity,
    opacityMultiplier: parent.opacityMultiplier * (Number.isFinite(ownOpacity) ? ownOpacity : 1),
  };
}

/** Parses `translate()`, `scale()`, `rotate()` (with optional center), `skewX/Y()` and `matrix()`
 * — chained in sequence, exactly like the browser's own SVG transform grammar. */
function parseTransformAttr(value: string): DOMMatrix {
  let matrix = new DOMMatrix();
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const args = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (m[1]) {
      case 'translate':
        matrix = matrix.translate(args[0] ?? 0, args[1] ?? 0);
        break;
      case 'scale':
        matrix = matrix.scale(args[0] ?? 1, args[1] ?? args[0] ?? 1);
        break;
      case 'rotate':
        if (args.length >= 3) matrix = matrix.translate(args[1], args[2]).rotate(args[0]).translate(-args[1], -args[2]);
        else matrix = matrix.rotate(args[0] ?? 0);
        break;
      case 'skewX':
        matrix = matrix.skewX(args[0] ?? 0);
        break;
      case 'skewY':
        matrix = matrix.skewY(args[0] ?? 0);
        break;
      case 'matrix':
        if (args.length === 6) matrix = matrix.multiply(new DOMMatrix([args[0], args[1], args[2], args[3], args[4], args[5]]));
        break;
    }
  }
  return matrix;
}

/** Builds one element's own path in its local coordinate system — `null` for anything not a
 * drawable shape (containers, unsupported tags). Leverages the browser's native SVG path-data
 * parser (`new Path2D(d)`, which already understands arcs) instead of hand-rolling one. */
function buildLocalPath(el: Element): Path2D | null {
  const tag = el.tagName.toLowerCase();
  const num = (name: string, def = 0) => {
    const v = parseFloat(el.getAttribute(name) ?? '');
    return Number.isFinite(v) ? v : def;
  };

  switch (tag) {
    case 'path': {
      const d = el.getAttribute('d');
      if (!d) return null;
      try {
        return new Path2D(d);
      } catch {
        return null;
      }
    }
    case 'rect': {
      const x = num('x');
      const y = num('y');
      const w = num('width');
      const h = num('height');
      if (w <= 0 || h <= 0) return null;
      const hasRx = el.hasAttribute('rx');
      const hasRy = el.hasAttribute('ry');
      let rx = hasRx ? num('rx') : hasRy ? num('ry') : 0;
      let ry = hasRy ? num('ry') : rx;
      const path = new Path2D();
      if (rx <= 0 && ry <= 0) {
        path.rect(x, y, w, h);
      } else {
        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, h / 2);
        path.moveTo(x + rx, y);
        path.lineTo(x + w - rx, y);
        path.arcTo(x + w, y, x + w, y + ry, rx);
        path.lineTo(x + w, y + h - ry);
        path.arcTo(x + w, y + h, x + w - rx, y + h, rx);
        path.lineTo(x + rx, y + h);
        path.arcTo(x, y + h, x, y + h - ry, rx);
        path.lineTo(x, y + ry);
        path.arcTo(x, y, x + rx, y, rx);
        path.closePath();
      }
      return path;
    }
    case 'circle': {
      const r = num('r');
      if (r <= 0) return null;
      const path = new Path2D();
      path.ellipse(num('cx'), num('cy'), r, r, 0, 0, Math.PI * 2);
      return path;
    }
    case 'ellipse': {
      const rx = num('rx');
      const ry = num('ry');
      if (rx <= 0 || ry <= 0) return null;
      const path = new Path2D();
      path.ellipse(num('cx'), num('cy'), rx, ry, 0, 0, Math.PI * 2);
      return path;
    }
    case 'line': {
      const path = new Path2D();
      path.moveTo(num('x1'), num('y1'));
      path.lineTo(num('x2'), num('y2'));
      return path;
    }
    case 'polyline':
    case 'polygon': {
      const nums = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (nums.length < 4) return null;
      const path = new Path2D();
      path.moveTo(nums[0], nums[1]);
      for (let i = 2; i + 1 < nums.length; i += 2) path.lineTo(nums[i], nums[i + 1]);
      if (tag === 'polygon') path.closePath();
      return path;
    }
    default:
      return null;
  }
}

function walk(el: Element, parentMatrix: DOMMatrix, parentStyle: StyleContext, shapes: ParsedSvgShape[]) {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return;

  const transformAttr = el.getAttribute('transform');
  const localMatrix = transformAttr ? parseTransformAttr(transformAttr) : new DOMMatrix();
  const matrix = parentMatrix.multiply(localMatrix);
  const style = resolveStyle(el, parentStyle);

  if (CONTAINER_TAGS.has(tag)) {
    for (const child of Array.from(el.children)) walk(child, matrix, style, shapes);
    return;
  }

  const localPath = buildLocalPath(el);
  if (!localPath) return;

  const worldPath = new Path2D();
  worldPath.addPath(localPath, matrix);

  shapes.push({
    path2d: worldPath,
    fill: style.fill,
    fillOpacity: Math.max(0, Math.min(1, style.fillOpacity * style.opacityMultiplier)),
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeOpacity: Math.max(0, Math.min(1, style.strokeOpacity * style.opacityMultiplier)),
  });
}

/**
 * Parses real SVG markup into fillable/strokeable Path2D shapes, in document (paint) order.
 * Deliberately scoped: `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`,
 * `<polygon>`, grouped/transformed via `<g>` and `transform=`, with fill/stroke/opacity from
 * attributes or an inline `style=`. NOT supported (silently skipped, not faked): `<text>`
 * (would need font-matching), `<image>`, `<use>`/`<defs>` references, gradients/patterns as
 * paint (a gradient `fill="url(#...)"` just won't paint — the shape's `fill` comes back as that
 * literal string, which `ctx.fillStyle` will ignore), `clipPath`/`mask`, and external
 * stylesheets (`<style>` blocks) — only inline attributes/`style=` are read. `preserveAspectRatio`
 * is not honored — a non-square viewBox vs width/height mismatch stretches non-uniformly rather
 * than letterboxing.
 */
export function parseSvg(svgText: string): ParsedSvg {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return { shapes: [], width: 0, height: 0 };
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') return { shapes: [], width: 0, height: 0 };

  let vbX = 0;
  let vbY = 0;
  let vbW = 0;
  let vbH = 0;
  const viewBoxAttr = svg.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) [vbX, vbY, vbW, vbH] = parts;
  }

  const parseLength = (attr: string | null): number | null => {
    if (!attr) return null;
    const n = parseFloat(attr);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const width = parseLength(svg.getAttribute('width')) ?? (vbW > 0 ? vbW : 300);
  const height = parseLength(svg.getAttribute('height')) ?? (vbH > 0 ? vbH : 150);

  let baseMatrix = new DOMMatrix();
  if (vbW > 0 && vbH > 0) {
    baseMatrix = baseMatrix.scale(width / vbW, height / vbH).translate(-vbX, -vbY);
  }

  const rootStyle: StyleContext = { fill: '#000000', fillOpacity: 1, stroke: null, strokeWidth: 1, strokeOpacity: 1, opacityMultiplier: 1 };
  const shapes: ParsedSvgShape[] = [];
  for (const child of Array.from(svg.children)) walk(child, baseMatrix, rootStyle, shapes);

  return { shapes, width: Math.round(width), height: Math.round(height) };
}

/** Canvas silently keeps the *previous* fillStyle/strokeStyle when you assign an unparseable
 * value (e.g. a `url(#gradient)` reference this parser doesn't resolve) — it does not throw and
 * does not reset to a default. Left unchecked, one shape's unsupported paint would silently
 * inherit whatever color the shape before it happened to use. A detached element's `style.color`
 * normalizes an invalid assignment to an empty string instead, which is a safe, unambiguous way
 * to validate the color string before ever handing it to the canvas context. */
const colorProbe = document.createElement('span');
function isPaintable(color: string): boolean {
  colorProbe.style.color = '';
  colorProbe.style.color = color;
  return colorProbe.style.color !== '';
}

export function rasterizeSvg(parsed: ParsedSvg): HTMLCanvasElement {
  const canvas = createCanvas(parsed.width, parsed.height);
  const ctx = canvas.getContext('2d')!;
  for (const shape of parsed.shapes) {
    ctx.save();
    if (shape.fill && isPaintable(shape.fill)) {
      ctx.globalAlpha = shape.fillOpacity;
      ctx.fillStyle = shape.fill;
      ctx.fill(shape.path2d, 'nonzero');
    }
    if (shape.stroke && shape.strokeWidth > 0 && isPaintable(shape.stroke)) {
      ctx.globalAlpha = shape.strokeOpacity;
      ctx.strokeStyle = shape.stroke;
      ctx.lineWidth = shape.strokeWidth;
      ctx.stroke(shape.path2d);
    }
    ctx.restore();
  }
  return canvas;
}

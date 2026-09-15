import * as opentype from 'opentype.js';
import { VectorStrokeStyle, VectorFillStyle } from '@/types/vectorShapes';

let fontPromise: Promise<opentype.Font> | null = null;

/** Lazily fetches and parses the bundled Inter font (OFL-licensed, src/assets/fonts) once per
 * session — this is the only font vector text supports right now; picking a system font would
 * need per-platform font-file access, which isn't available from a browser-sandboxed renderer. */
function loadFont(): Promise<opentype.Font> {
  if (!fontPromise) {
    const url = new URL('../assets/fonts/Inter-Regular.woff', import.meta.url).href;
    fontPromise = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => opentype.parse(buf));
  }
  return fontPromise;
}

export interface TextDraft {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number; // radians
  text: string;
  fontSize: number;
  naturalWidth: number;
  naturalHeight: number;
  path2d: Path2D; // built once at natural size, local origin (0,0) = top-left of its bbox
}

/**
 * Builds a real vector outline for `text` by walking glyph-by-glyph via `font.charToGlyph` and
 * concatenating each glyph's own bezier path — this deliberately bypasses `font.getPath(text,…)`,
 * which applies GSUB shaping/ligature substitution: the bundled Inter font's GSUB table uses a
 * contextual-substitution format opentype.js's simplified reader doesn't support, so calling
 * `getPath` on a whole string throws. Per-glyph paths skip shaping entirely (no ligatures, which
 * is a fine trade-off for a basic vector text tool) and work with any text.
 */
export async function textToPath2D(text: string, fontSize: number): Promise<TextDraft> {
  const font = await loadFont();
  const scale = fontSize / font.unitsPerEm;
  const ascender = font.ascender * scale;
  const descender = font.descender * scale; // negative

  let x = 0;
  const pathData: string[] = [];
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue; // multi-line layout isn't supported this round
    const glyph = font.charToGlyph(ch);
    const glyphPath = glyph.getPath(x, ascender, fontSize);
    const d = glyphPath.toPathData(2);
    if (d) pathData.push(d);
    x += (glyph.advanceWidth ?? 0) * scale;
  }

  const width = Math.max(1, x);
  const height = Math.max(1, ascender - descender);
  const path2d = new Path2D(pathData.join(' '));

  return { x: 0, y: 0, w: width, h: height, angle: 0, text, fontSize, naturalWidth: width, naturalHeight: height, path2d };
}

/** Draws a text draft's fill + stroke onto a context, scaling/rotating from its natural size to
 * its current (possibly resized via drag handles) bounding box — same matrix convention as
 * shapeGeometry.service's `buildShapePath2D` (rotate about center, then translate), with an
 * extra innermost scale step since the path was built at natural size. */
export function paintTextDraft(ctx: CanvasRenderingContext2D, draft: TextDraft, stroke: VectorStrokeStyle, fill: VectorFillStyle) {
  const sx = draft.w / draft.naturalWidth;
  const sy = draft.h / draft.naturalHeight;
  const cx = draft.w / 2;
  const cy = draft.h / 2;
  const matrix = new DOMMatrix()
    .translate(draft.x + cx, draft.y + cy)
    .rotate((draft.angle * 180) / Math.PI)
    .translate(-cx, -cy)
    .scale(sx, sy);
  const world = new Path2D();
  world.addPath(draft.path2d, matrix);

  ctx.save();
  if (fill.enabled) {
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    ctx.fill(world, 'nonzero');
  }
  if (stroke.enabled && stroke.width > 0) {
    ctx.globalAlpha = stroke.opacity;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.cap;
    ctx.lineJoin = stroke.join;
    ctx.setLineDash(stroke.dashed ? [stroke.width * 2, stroke.width * 1.5] : []);
    ctx.stroke(world);
  }
  ctx.restore();
}

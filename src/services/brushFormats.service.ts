import type { Brush } from '@/types';
import { createBrush, preloadBrushTexture } from './brush.service';
import { bakeTipAlpha } from './tipBake.service';

/**
 * Importers for brush formats other than modern .abr:
 *   - legacy Photoshop .abr v1/v2 (Photoshop ≤ 6/7)
 *   - Procreate .brush (a zip with Shape.png / Grain.png / Brush.archive)
 *   - Krita .kpp (a PNG carrying the preset XML in a text chunk)
 *
 * Status: Procreate .brush and Krita .bundle were verified against real files (12 Procreate
 * brushes, one 64-preset Krita bundle). Legacy .abr v1/v2 and standalone Krita .kpp were tested only
 * against synthetic files built from the format descriptions. Every reader validates what it reads
 * and fails with a clear message instead of guessing.
 */

export interface ImportedBrush {
  brush: Brush;
  notes: string[];
}

// ------------------------------------------------------------------ shared helpers

/** Grey tip PNG where brightness = paint. Old formats disagree on polarity, so the polarity is
 * inferred: a brush tip is transparent at its border, so a bright border means "inverted". */
export function alphaToTipDataUrl(values: Uint8Array | Uint8ClampedArray, w: number, h: number, forceInverted?: boolean): { url: string; inverted: boolean } {
  let border = 0;
  let n = 0;
  const at = (x: number, y: number) => values[y * w + x];
  for (let x = 0; x < w; x++) {
    border += at(x, 0) + at(x, h - 1);
    n += 2;
  }
  for (let y = 1; y < h - 1; y++) {
    border += at(0, y) + at(w - 1, y);
    n += 2;
  }
  const inverted = forceInverted ?? border / Math.max(1, n) > 127;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = inverted ? 255 - values[i] : values[i];
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Keep stored tips ≤ 512 px on the long side (they are never painted larger than ~300 px).
  const scale = Math.min(1, 512 / Math.max(w, h));
  if (scale < 1) {
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(w * scale));
    small.height = Math.max(1, Math.round(h * scale));
    const sctx = small.getContext('2d')!;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(c, 0, 0, small.width, small.height);
    return { url: small.toDataURL('image/png'), inverted };
  }
  return { url: c.toDataURL('image/png'), inverted };
}

function makeBrush(name: string, tipUrl: string | undefined, o: Partial<Brush>, category: string): Brush {
  const b = createBrush({ name, texture: tipUrl, category, tags: [category], size: 40, hardness: 1, spacing: 0.15, ...o });
  // A plain round tip stamped at wide spacing leaves a chain of beads at partial opacity.
  if (!tipUrl) b.spacing = Math.min(b.spacing, 0.06);
  preloadBrushTexture(b.texture, b.textures);
  return b;
}

// ------------------------------------------------------------------ legacy Photoshop .abr (v1 / v2)

export interface LegacySampled {
  name: string;
  /** spacing as a fraction (0.25 = 25 %) */
  spacing: number;
  w: number;
  h: number;
  /** one byte per pixel */
  data: Uint8Array;
}

function unpackBits(src: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  let i = 0;
  let o = 0;
  while (i < src.length && o < expected) {
    const n = (src[i++] << 24) >> 24; // signed byte
    if (n >= 0) {
      for (let k = 0; k <= n && o < expected; k++) out[o++] = src[i++];
    } else if (n !== -128) {
      const v = src[i++];
      for (let k = 0; k < 1 - n && o < expected; k++) out[o++] = v;
    }
  }
  return out;
}

/** Parses the sampled brushes of an ABR v1/v2 file; computed (parametric) brushes are counted and skipped. */
export function readLegacyAbr(bytes: Uint8Array): { brushes: LegacySampled[]; skippedComputed: number; unreadable: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const version = v.getUint16(p); p += 2;
  if (version !== 1 && version !== 2) throw new Error(`Versión de ABR no soportada por este lector (${version})`);
  const count = v.getUint16(p); p += 2;
  const brushes: LegacySampled[] = [];
  let skippedComputed = 0;
  let unreadable = 0;
  for (let i = 0; i < count && p + 6 <= bytes.length; i++) {
    const type = v.getUint16(p);
    const size = v.getUint32(p + 2);
    p += 6;
    const end = p + size;
    if (end > bytes.length) {
      unreadable++;
      break;
    }
    if (type !== 2) {
      skippedComputed++;
      p = end;
      continue;
    }
    try {
      let q = p + 4; // misc
      const spacing = v.getUint16(q) / 100; q += 2;
      let name = `Pincel ABR ${i + 1}`;
      if (version === 2) {
        const chars = v.getUint32(q); q += 4;
        let s = '';
        for (let c = 0; c < chars; c++) s += String.fromCharCode(v.getUint16(q + c * 2));
        q += chars * 2;
        name = s.replace(/\0+$/, '') || name;
      }
      q += 1; // anti-aliasing flag
      q += 8; // short bounds
      const top = v.getUint32(q), left = v.getUint32(q + 4), bottom = v.getUint32(q + 8), right = v.getUint32(q + 12); q += 16;
      const depth = v.getUint16(q); q += 2;
      const compression = v.getUint8(q); q += 1;
      const w = right - left;
      const h = bottom - top;
      // Same sanity limits as GIMP's reader (1..10000 px), which reads real files of this format.
      if (w <= 0 || h <= 0 || w > 10000 || h > 10000 || (depth !== 8 && depth !== 16)) throw new Error('bounds');
      const bpp = depth / 8;
      let raw: Uint8Array;
      if (compression === 0) {
        raw = bytes.slice(q, q + w * h * bpp);
      } else if (compression === 1) {
        const lens: number[] = [];
        for (let y = 0; y < h; y++) {
          const len = v.getUint16(q);
          q += 2;
          if (len === 0 || len > w * bpp * 2 + 2) throw new Error('rle'); // corrupt row length
          lens.push(len);
        }
        raw = new Uint8Array(w * h * bpp);
        for (let y = 0; y < h; y++) {
          raw.set(unpackBits(bytes.subarray(q, q + lens[y]), w * bpp), y * w * bpp);
          q += lens[y];
        }
      } else throw new Error('compression');
      if (raw.length < w * h * bpp) throw new Error('short data');
      const data = new Uint8Array(w * h);
      for (let k = 0; k < w * h; k++) data[k] = bpp === 2 ? raw[k * 2] : raw[k];
      brushes.push({ name, spacing, w, h, data });
    } catch {
      unreadable++;
    }
    p = end;
  }
  return { brushes, skippedComputed, unreadable };
}

export function legacyAbrToBrushes(bytes: Uint8Array): { brushes: Brush[]; notes: string[] } {
  const { brushes, skippedComputed, unreadable } = readLegacyAbr(bytes);
  const notes: string[] = [];
  if (skippedComputed) notes.push(`${skippedComputed} pincel(es) redondo(s) paramétrico(s) no se importan (solo las puntas de imagen)`);
  if (unreadable) notes.push(`${unreadable} pincel(es) con datos ilegibles se omitieron`);
  return {
    notes,
    brushes: brushes.map((b) => {
      const tip = alphaToTipDataUrl(b.data, b.w, b.h);
      return makeBrush(b.name, tip.url, { size: Math.min(300, Math.max(b.w, b.h)), spacing: Math.min(1, Math.max(0.02, b.spacing || 0.25)) }, 'Importados (ABR antiguo)');
    }),
  };
}

// ------------------------------------------------------------------ binary property lists (bplist00)

/** Minimal bplist00 reader: ints, reals, bool, strings (ASCII/UTF-16), data, arrays, dicts, UIDs. */
export function parseBplist(bytes: Uint8Array): unknown {
  const magic = String.fromCharCode(...bytes.subarray(0, 8));
  if (!magic.startsWith('bplist00')) throw new Error('No es un bplist binario');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = bytes.length - 32;
  const offSize = v.getUint8(t + 6);
  const refSize = v.getUint8(t + 7);
  const numObjects = Number(v.getBigUint64(t + 8));
  const top = Number(v.getBigUint64(t + 16));
  const tableOff = Number(v.getBigUint64(t + 24));
  const readN = (o: number, n: number) => {
    let x = 0;
    for (let i = 0; i < n; i++) x = x * 256 + bytes[o + i];
    return x;
  };
  const offsetOf = (i: number) => readN(tableOff + i * offSize, offSize);
  const cache = new Map<number, unknown>();
  const build = (idx: number, depth = 0): unknown => {
    if (depth > 64 || idx >= numObjects) return null;
    if (cache.has(idx)) return cache.get(idx);
    const o = offsetOf(idx);
    const marker = bytes[o];
    const hi = marker >> 4;
    const lo = marker & 15;
    const lenAt = () => {
      if (lo !== 15) return { len: lo, start: o + 1 };
      const intHi = bytes[o + 1] & 15;
      const n = 1 << intHi;
      return { len: readN(o + 2, n), start: o + 2 + n };
    };
    let out: unknown = null;
    switch (hi) {
      case 0: out = lo === 8 ? false : lo === 9 ? true : null; break;
      case 1: { const n = 1 << lo; out = n === 8 ? Number(v.getBigInt64(o + 1)) : readN(o + 1, n); break; } // 8-byte ints are signed
      case 2: out = lo === 2 ? v.getFloat32(o + 1) : v.getFloat64(o + 1); break;
      case 4: { const { len, start } = lenAt(); out = bytes.slice(start, start + len); break; }
      case 5: { const { len, start } = lenAt(); out = String.fromCharCode(...bytes.subarray(start, start + len)); break; }
      case 6: { const { len, start } = lenAt(); let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint16(start + i * 2)); out = s; break; }
      case 8: out = { UID: readN(o + 1, lo + 1) }; break;
      case 10: { const { len, start } = lenAt(); const a: unknown[] = []; cache.set(idx, a); for (let i = 0; i < len; i++) a.push(build(readN(start + i * refSize, refSize), depth + 1)); return a; }
      case 13: {
        const { len, start } = lenAt();
        const d: Record<string, unknown> = {};
        cache.set(idx, d);
        for (let i = 0; i < len; i++) {
          const k = build(readN(start + i * refSize, refSize), depth + 1);
          d[String(k)] = build(readN(start + (len + i) * refSize, refSize), depth + 1);
        }
        return d;
      }
      default: out = null;
    }
    cache.set(idx, out);
    return out;
  };
  return build(top);
}

/** Every [key, value] pair of every dictionary reachable in a parsed plist (NSKeyedArchiver-agnostic). */
function collectPairs(node: unknown, out: [string, unknown][] = [], seen = new Set<unknown>()): [string, unknown][] {
  if (!node || typeof node !== 'object' || node instanceof Uint8Array || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) node.forEach((n) => collectPairs(n, out, seen));
  else for (const [k, val] of Object.entries(node)) { out.push([k, val]); collectPairs(val, out, seen); }
  return out;
}

const num = (pairs: [string, unknown][], re: RegExp): number | undefined => {
  const hit = pairs.find(([k, v]) => re.test(k) && typeof v === 'number');
  return hit ? (hit[1] as number) : undefined;
};

// ------------------------------------------------------------------ Procreate .brush

async function imageToGray(blob: Blob): Promise<{ values: Uint8ClampedArray; w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const values = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0; i < values.length; i++) {
    // alpha-aware luminance: a transparent pixel paints nothing
    values[i] = Math.round(((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * d[i * 4 + 3]) / 255);
  }
  return { values, w: c.width, h: c.height };
}

/** Follows NSKeyedArchiver {UID: n} references into $objects so plain values can be read by key. */
export function resolveArchive(root: unknown): Record<string, unknown> | null {
  const top = root as { $objects?: unknown[] } | null;
  const objs = top?.$objects;
  if (!Array.isArray(objs)) return null;
  const isUid = (v: unknown): v is { UID: number } => !!v && typeof v === 'object' && 'UID' in (v as object);
  const deref = (v: unknown, depth = 0): unknown => (isUid(v) && depth < 6 ? deref(objs[v.UID], depth + 1) : v);
  // The brush object is the (large) dictionary holding plotSpacing.
  const brush = objs.find((o) => o && typeof o === 'object' && !Array.isArray(o) && 'plotSpacing' in (o as object)) as Record<string, unknown> | undefined;
  if (!brush) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(brush)) out[k] = deref(v);
  return out;
}

const n0 = (v: unknown) => (typeof v === 'number' ? v : 0);

/** Grey grain map (0–255) from Grain.png, capped at 512 px, or null if it is essentially flat. */
async function grainData(blob: Blob): Promise<{ data: Uint8Array | Uint8ClampedArray; w: number; h: number } | null> {
  const g = await imageToGray(blob);
  const scale = Math.min(1, 512 / Math.max(g.w, g.h));
  let data: Uint8Array | Uint8ClampedArray = g.values;
  let w = g.w;
  let h = g.h;
  if (scale < 1) {
    const src = document.createElement('canvas');
    src.width = g.w;
    src.height = g.h;
    const sx = src.getContext('2d')!;
    const im = sx.createImageData(g.w, g.h);
    for (let i = 0; i < g.values.length; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = g.values[i]; im.data[i * 4 + 3] = 255; }
    sx.putImageData(im, 0, 0);
    w = Math.max(1, Math.round(g.w * scale));
    h = Math.max(1, Math.round(g.h * scale));
    const dst = document.createElement('canvas');
    dst.width = w;
    dst.height = h;
    const dx = dst.getContext('2d', { willReadFrequently: true })!;
    dx.imageSmoothingQuality = 'high';
    dx.drawImage(src, 0, 0, w, h);
    const px = dx.getImageData(0, 0, w, h).data;
    data = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) data[i] = px[i * 4];
  }
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length;
  let variance = 0;
  for (let i = 0; i < data.length; i++) variance += (data[i] - mean) ** 2;
  return Math.sqrt(variance / data.length) < 6 ? null : { data, w, h };
}

export async function importProcreateBrush(buffer: ArrayBuffer, fallbackName: string): Promise<ImportedBrush> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const find = (re: RegExp) => Object.values(zip.files).find((f) => !f.dir && re.test(f.name));
  const shape = find(/(^|\/)Shape\.png$/i);
  const grain = find(/(^|\/)Grain\.png$/i);
  const archive = find(/(^|\/)Brush\.archive$/i);
  if (!shape && !archive) throw new Error('No parece un pincel de Procreate (falta Shape.png / Brush.archive)');
  const notes: string[] = [];
  let name = fallbackName;
  let opts: Partial<Brush> = {};
  let textureScale = 1;
  if (archive) {
    try {
      const b = resolveArchive(parseBplist(await archive.async('uint8array')));
      if (!b) throw new Error('sin objeto de pincel');
      if (typeof b.name === 'string' && b.name.trim()) name = b.name.trim();
      textureScale = n0(b.textureScale) || 1;
      const scatter = Math.min(1, Math.abs(n0(b.shapeScatter)) + Math.abs(n0(b.plotJitter)));
      // Procreate composites a whole stroke, so a soft continuous brush looks smooth at any spacing;
      // stamping it here at wide spacing would leave a chain of beads. Real stamps (`stamp`, scatter,
      // random rotation) keep their spacing.
      const rawSpacing = Math.min(1, Math.max(0.02, n0(b.plotSpacing) || 0.1));
      const continuous = !b.stamp && !b.shapeRandomise && scatter === 0;
      opts = {
        spacing: continuous ? Math.min(rawSpacing, 0.08) : rawSpacing,
        scatter,
        angleJitter: b.shapeRandomise ? 360 : 0,
        dynamics: {
          sizeToPressure: n0(b.dynamicsPressureSize) > 0.05,
          opacityToPressure: n0(b.dynamicsPressureOpacity) > 0.05,
          angleToDirection: !!b.oriented,
          tiltToSize: false,
        },
      };
      if (n0(b.taperStartLength) > 0 || n0(b.taperEndLength) > 0) notes.push('el afilado (taper) de inicio/fin no se importa');
    } catch {
      notes.push('no se pudieron leer los ajustes de Brush.archive: se importa solo la punta');
    }
  }
  let tipUrl: string | undefined;
  if (shape) {
    const g = await imageToGray(await shape.async('blob'));
    // Bake the grain into the tip (Procreate's grain is fixed to the canvas; here it travels with the
    // stamp — an approximation). One grain tile spans the tip at textureScale 1.
    const gd = grain ? await grainData(await grain.async('blob')).catch(() => null) : null;
    if (gd) {
      const tipRaw = alphaToTipDataUrl(g.values, g.w, g.h);
      const tipVals = new Uint8Array(g.w * g.h);
      for (let i = 0; i < tipVals.length; i++) tipVals[i] = tipRaw.inverted ? 255 - g.values[i] : g.values[i];
      const baked = bakeTipAlpha({ alpha: tipVals, w: g.w, h: g.h }, {
        size: 60,
        pattern: { data: gd.data, w: gd.w, h: gd.h, scale: Math.max(0.05, (60 / gd.w) / textureScale), depth: 0.7, invert: false, contrast: 0, brightness: 0 },
      });
      tipUrl = alphaToTipDataUrl(baked.alpha, g.w, g.h).url;
      notes.push('el grano se integra en la punta (en Procreate va fijo al lienzo; aquí viaja con el sello)');
    } else {
      tipUrl = alphaToTipDataUrl(g.values, g.w, g.h).url;
    }
  }
  notes.push('los ajustes de velocidad, mezcla, humedad y tamaño mínimo de Procreate no se importan');
  return { brush: makeBrush(name, tipUrl, opts, 'Importados (Procreate)'), notes };
}

// ------------------------------------------------------------------ Krita (.kpp presets and .bundle packs)

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Text chunks (tEXt / zTXt / iTXt) of a PNG file, as keyword → text. */
export async function readPngText(bytes: Uint8Array): Promise<Record<string, string>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => bytes[i] === b)) throw new Error('No es un archivo PNG (.kpp)');
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = v.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const d = bytes.subarray(p + 8, p + 8 + len);
    const nul = d.indexOf(0);
    if (type === 'tEXt' && nul > 0) out[dec.decode(d.subarray(0, nul))] = dec.decode(d.subarray(nul + 1));
    else if (type === 'zTXt' && nul > 0) out[dec.decode(d.subarray(0, nul))] = dec.decode(await inflate(d.subarray(nul + 2)));
    else if (type === 'iTXt' && nul > 0) {
      const flag = d[nul + 1];
      let q = nul + 3;
      while (d[q] !== 0) q++; // language tag
      q++;
      while (d[q] !== 0) q++; // translated keyword
      q++;
      const body = d.subarray(q);
      out[dec.decode(d.subarray(0, nul))] = dec.decode(flag ? await inflate(body) : body);
    }
    p += 12 + len;
  }
  return out;
}

/** GIMP brush (.gbr v1/v2) — the first one found; for .gih (animated brush) that is the first frame. */
export function readGimpBrush(bytes: Uint8Array): { w: number; h: number; values: Uint8Array; spacing?: number } {
  // .gih starts with a text header (name line, "N ncells:…" line) before the first .gbr
  let start = 0;
  if (bytes[0] !== 0) {
    let nl = 0;
    while (start < bytes.length && nl < 2) if (bytes[start++] === 10) nl++;
  }
  const v = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.byteLength - start);
  const headerSize = v.getUint32(0);
  const version = v.getUint32(4);
  const w = v.getUint32(8);
  const h = v.getUint32(12);
  const bpp = v.getUint32(16);
  let spacing: number | undefined;
  if (version === 2) {
    const magic = String.fromCharCode(v.getUint8(20), v.getUint8(21), v.getUint8(22), v.getUint8(23));
    if (magic !== 'GIMP') throw new Error('cabecera de brocha GIMP inválida');
    spacing = v.getUint32(24) / 100;
  } else if (version !== 1) throw new Error(`versión de brocha GIMP no soportada (${version})`);
  if (w <= 0 || h <= 0 || w > 8192 || h > 8192 || (bpp !== 1 && bpp !== 2 && bpp !== 4)) throw new Error('dimensiones de brocha GIMP inválidas');
  const data = new Uint8Array(v.buffer, v.byteOffset + headerSize, w * h * bpp);
  if (data.length < w * h * bpp) throw new Error('datos de brocha GIMP incompletos');
  const values = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (bpp === 1) values[i] = data[i];
    else if (bpp === 2) values[i] = Math.round((data[i * 2] * data[i * 2 + 1]) / 255); // grey × alpha
    else values[i] = Math.round(((0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * data[i * 4 + 3]) / 255);
  }
  return { w, h, values, spacing };
}

/** Every .gbr frame of a .gih animated brush (or the single frame of a .gbr), plus how frames are picked. */
export function readGimpBrushSeries(bytes: Uint8Array): { frames: { w: number; h: number; values: Uint8Array }[]; spacing?: number; selection: 'random' | 'incremental' } {
  let start = 0;
  let selection: 'random' | 'incremental' = 'random';
  let cells = 1;
  if (bytes[0] !== 0) {
    // .gih: line 1 = name, line 2 = "<n> ncells:<n> … sel0:<mode>", then n concatenated .gbr
    let nl = 0;
    while (start < bytes.length && nl < 2) if (bytes[start++] === 10) nl++;
    const header = new TextDecoder().decode(bytes.subarray(0, start));
    const n = header.match(/ncells:(\d+)/);
    cells = Math.max(1, Math.min(64, n ? Number(n[1]) : Number(header.split('\n')[1]?.trim().split(/\s+/)[0]) || 1));
    if (/sel0:incremental/.test(header)) selection = 'incremental';
  }
  const frames: { w: number; h: number; values: Uint8Array }[] = [];
  let spacing: number | undefined;
  let p = start;
  for (let i = 0; i < cells && p + 20 <= bytes.length; i++) {
    const v = new DataView(bytes.buffer, bytes.byteOffset + p, bytes.byteLength - p);
    const headerSize = v.getUint32(0);
    const w = v.getUint32(8), h = v.getUint32(12), bpp = v.getUint32(16);
    const one = readGimpBrush(bytes.subarray(p));
    frames.push({ w: one.w, h: one.h, values: one.values });
    spacing ??= one.spacing;
    p += headerSize + w * h * bpp;
  }
  if (frames.length === 0) throw new Error('la brocha GIMP no contiene fotogramas');
  return { frames, spacing, selection };
}

interface KritaTip {
  tip?: { values: Uint8Array | Uint8ClampedArray; w: number; h: number };
  /** further frames of an animated tip (excluding the first, which is `tip`) */
  frames?: { values: Uint8Array | Uint8ClampedArray; w: number; h: number }[];
  selection?: 'random' | 'incremental';
  spacing?: number;
}

/** Builds a tip loader over any source of files: `get` returns the bytes for a lower-cased file name. */
function buildTipLoader(get: (lowerName: string) => Promise<Uint8Array | null>): KritaTipLoader {
  const cache = new Map<string, KritaTip | null>();
  return async (filename) => {
    const key = filename.toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    let out: KritaTip | null = null;
    try {
      const bytes = await get(key);
      if (bytes) {
        if (key.endsWith('.png')) {
          const g = await imageToGray(new Blob([bytes as BlobPart], { type: 'image/png' }));
          out = { tip: { values: g.values, w: g.w, h: g.h } };
        } else {
          const series = readGimpBrushSeries(bytes);
          const [first, ...rest] = series.frames;
          out = { tip: { values: first.values, w: first.w, h: first.h }, frames: rest.length ? rest : undefined, selection: series.selection, spacing: series.spacing };
        }
      }
    } catch {
      out = null;
    }
    cache.set(key, out);
    return out;
  };
}

/** Resolves the tip image a preset points at (only possible when the pack ships the tip files). */
export type KritaTipLoader = (filename: string) => Promise<KritaTip | null>;

const sensorId = (xml: string | undefined) => xml?.match(/<params[^>]*\bid="([^"]+)"/)?.[1];

/** Pressure curve of a sensor XML (`<params id="pressure">` or a `<ChildSensor id="pressure">` in a sensor list) as flat points. */
export function pressureCurveOf(sensorXml: string | undefined): number[] | undefined {
  if (!sensorXml) return undefined;
  const doc = new DOMParser().parseFromString(sensorXml.replace(/<!DOCTYPE[^>]*>/, ''), 'text/xml');
  const root = doc.documentElement;
  if (!root || root.querySelector('parsererror')) return undefined;
  const sensors = [root, ...Array.from(root.querySelectorAll('ChildSensor'))].filter((e) => e.getAttribute('id') === 'pressure');
  const el = sensors[0];
  if (!el) return undefined;
  // A ChildSensor written as <ChildSensor id="pressure"/> shares its parent list's curve.
  const curve = el.querySelector(':scope > curve')?.textContent ?? (el !== root ? root.querySelector(':scope > curve')?.textContent : undefined);
  if (!curve) return undefined;
  const pts = curve.split(';').map((p) => p.trim()).filter(Boolean).flatMap((p) => p.split(',').map(Number));
  if (pts.length < 4 || pts.length % 2 || pts.some((n) => !Number.isFinite(n))) return undefined;
  const isLinear = pts.length === 4 && pts[0] === 0 && pts[1] === 0 && pts[2] === 1 && pts[3] === 1;
  return isLinear ? undefined : pts;
};

const KRITA_BLEND: Record<string, GlobalCompositeOperation | 'erase'> = {
  normal: 'source-over', erase: 'erase', multiply: 'multiply', overlay: 'overlay', screen: 'screen', darken: 'darken', lighten: 'lighten',
  dodge: 'color-dodge', burn: 'color-burn', hardlight: 'hard-light', soft_light_svg: 'soft-light', soft_light: 'soft-light', difference: 'difference',
  hue: 'hue', saturation: 'saturation', color: 'color', luminize: 'luminosity',
};

/** Turns one Krita preset (the XML from its 'preset' PNG text chunk) into a brush. Returns null for
 * preset engines that have no equivalent here (smudge, deform, experiment…) or for erasers. */
async function kritaPresetToBrush(xml: string, fallbackName: string, loadTip?: KritaTipLoader): Promise<{ brush: Brush | null; skipped?: string; notes: string[] }> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const preset = doc.querySelector('Preset');
  const name = preset?.getAttribute('name')?.replace(/_/g, ' ').trim() || fallbackName;
  const engine = preset?.getAttribute('paintopid') ?? '';
  const param = (n: string) => doc.querySelector(`param[name="${n}"]`)?.textContent?.trim();
  const bool = (n: string) => param(n) === 'true';
  const numP = (n: string) => {
    const t = param(n);
    return t !== undefined && t !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined;
  };
  if (engine && engine !== 'paintbrush') return { brush: null, skipped: `motor «${engine}»`, notes: [] };
  // Erasers are flagged by the "erase" composite op (EraserMode is often absent); "adjust" brushes
  // (multiply, overlay, dodge, colour…) paint with a blend mode, which a brush here cannot carry.
  const comp = param('CompositeOp');
  const blend = bool('EraserMode') ? 'erase' : comp ? KRITA_BLEND[comp] : undefined;
  if (comp && comp !== 'normal' && !blend) return { brush: null, skipped: `modo de fusión «${comp}»`, notes: [] };

  const def = param('brush_definition');
  const brushXml = def ? new DOMParser().parseFromString(def, 'text/xml') : null;
  const brushEl = brushXml?.querySelector('Brush');
  const type = brushEl?.getAttribute('type') ?? '';
  const num2 = (s?: string | null) => (s !== undefined && s !== null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);
  let spacing = num2(brushEl?.getAttribute('spacing'));
  const notes: string[] = [];
  let size = 40;
  let hardness = 1;
  let tipUrl: string | undefined;
  let frameUrls: string[] | undefined;
  let loadedSelection: 'random' | 'incremental' | undefined;

  if (type === 'auto_brush') {
    const mask = brushXml?.querySelector('MaskGenerator');
    size = num2(mask?.getAttribute('diameter')) ?? 40;
    const fade = Math.max(num2(mask?.getAttribute('hfade')) ?? 0, num2(mask?.getAttribute('vfade')) ?? 0);
    hardness = mask?.getAttribute('id') === 'gauss' ? Math.max(0, 0.75 - fade) : Math.max(0, 1 - fade * 1.4);
    if (mask?.getAttribute('type') === 'rect') notes.push('punta cuadrada: se importa redonda');
  } else if (type === 'gbr_brush' || type === 'png_brush') {
    const file = brushEl?.getAttribute('filename') ?? '';
    const loaded = loadTip ? await loadTip(file) : null;
    loadedSelection = loaded?.selection;
    if (loaded?.tip) {
      const t = alphaToTipDataUrl(loaded.tip.values, loaded.tip.w, loaded.tip.h);
      tipUrl = t.url;
      // Animated tip: every further frame gets the same polarity as frame 0.
      if (loaded.frames?.length) {
        frameUrls = [t.url, ...loaded.frames.map((f) => alphaToTipDataUrl(f.values, f.w, f.h, t.inverted).url)];
      }
      size = Math.max(1, Math.round(Math.max(loaded.tip.w, loaded.tip.h) * (num2(brushEl?.getAttribute('scale')) ?? 1)));
      spacing ??= loaded.spacing;
    } else {
      notes.push(`la punta «${file}» no está en el archivo: se importa redonda`);
    }
    if (loaded?.frames?.length) notes.push(`pincel animado (.gih): ${loaded.frames.length + 1} fotogramas (${loaded.selection === 'incremental' ? 'en orden' : 'al azar'})`);
  } else {
    return { brush: null, skipped: 'tipo de punta no soportado', notes: [] };
  }

  // Dynamics: each preset lists which sensors drive size/opacity/rotation/scatter.
  const rotationByDirection = bool('PressureRotation') && /drawingangle|direction/i.test(sensorId(param('RotationSensor')) ?? '');
  const scatterOn = bool('PressureScatter') || (numP('Scattering/Amount') ?? 0) > 0 && bool('CustomScatter') && numP('ScatterValue') !== undefined && bool('PressureScatter');
  const scatter = scatterOn ? Math.min(1, (numP('ScatterValue') ?? 0) * (numP('Scattering/Amount') ?? 1) * 0.5) : 0;
  // Response curves and random ("fuzzy") variation of the sensors that drive size and opacity.
  const sizeCurve = bool('PressureSize') ? pressureCurveOf(param('SizeSensor')) : undefined;
  const opacityCurve = bool('PressureOpacity') ? pressureCurveOf(param('OpacitySensor')) : undefined;
  const fuzzySize = /id="fuzzy"/.test(param('SizeSensor') ?? '');
  const flow = numP('FlowValue') ?? 1;
  const opacity = numP('OpacityValue') ?? 1;
  const b = makeBrush(name, tipUrl, {
    size: Math.min(300, Math.max(1, Math.round(size))),
    spacing: spacing !== undefined ? Math.min(1, Math.max(0.02, spacing)) : undefined,
    hardness: Math.min(1, Math.max(0, hardness)),
    // Opacity caps the whole stroke and flow is what each stamp lays down (see strokeBuffer.service).
    opacity: Math.min(1, Math.max(0.05, opacity)),
    flow: flow < 0.999 ? Math.min(1, Math.max(0.02, flow)) : undefined,
    scatter,
    sizeJitter: fuzzySize ? 25 : 0,
    textures: frameUrls,
    tipSelection: frameUrls ? (loadedSelection ?? 'random') : undefined,
    blendMode: blend && blend !== 'source-over' ? blend : undefined,
    angleJitter: numP('ShapeDynamics/randomRotationWeight') ? 360 * Math.min(1, numP('ShapeDynamics/randomRotationWeight')!) : 0,
    dynamics: {
      sizeToPressure: bool('PressureSize') && !!(sizeCurve || /pressure|sensorslist/i.test(sensorId(param('SizeSensor')) ?? 'pressure')),
      opacityToPressure: bool('PressureOpacity'),
      sizeCurve,
      opacityCurve,
      angleToDirection: rotationByDirection,
      tiltToSize: /tilt/i.test(sensorId(param('SizeSensor')) ?? ''),
    },
  }, 'Importados (Krita)');
  return { brush: b, notes };
}

/** `tips` = companion tip files picked together with the preset (lower-cased name → bytes). */
export async function importKritaPreset(buffer: ArrayBuffer, fallbackName: string, tips?: Map<string, Uint8Array>): Promise<ImportedBrush> {
  const text = await readPngText(new Uint8Array(buffer));
  const xml = text['preset'];
  if (!xml) throw new Error('El archivo no contiene un preset de Krita (falta el bloque «preset»)');
  // A standalone .kpp can carry its tip as an embedded base64 PNG; otherwise the tip file is not with it.
  const png = xml.match(/iVBORw0KGgo[A-Za-z0-9+/=]+/)?.[0];
  const external = tips ? buildTipLoader(async (k) => tips.get(k) ?? null) : null;
  const loader: KritaTipLoader = async (file) => {
    const ext = external ? await external(file) : null;
    if (ext) return ext;
    if (!png) return null;
    const bin = atob(png);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const g = await imageToGray(new Blob([arr], { type: 'image/png' }));
    return { tip: { values: g.values, w: g.w, h: g.h } };
  };
  const r = await kritaPresetToBrush(xml, fallbackName, loader);
  if (!r.brush) throw new Error(`Este preset de Krita usa ${r.skipped}, que no tiene equivalente aquí`);
  if (r.notes.some((n) => n.startsWith('la punta «'))) r.notes.push('selecciona junto al .kpp los ficheros de punta (.gbr, .gih, .png) que usa para importarla con su forma');
  r.notes.push('las texturas y otros ajustes avanzados de Krita no se importan');
  return { brush: r.brush, notes: r.notes };
}

export interface BundleResult {
  brushes: Brush[];
  /** engine/type → number of presets skipped. */
  skipped: Record<string, number>;
  notes: string[];
}

/** Krita resource bundle (.bundle): a zip with paintoppresets/*.kpp and the tip files in brushes/. */
export async function importKritaBundle(buffer: ArrayBuffer): Promise<BundleResult> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const byLower = new Map<string, import('jszip').JSZipObject>();
  zip.forEach((path, f) => {
    if (!f.dir && path.startsWith('brushes/')) byLower.set(path.slice('brushes/'.length).toLowerCase(), f);
  });
  const loadTip = buildTipLoader(async (key) => (byLower.get(key) ? byLower.get(key)!.async('uint8array') : null));

  const brushes: Brush[] = [];
  const skipped: Record<string, number> = {};
  const noteSet = new Set<string>();
  const presets = Object.values(zip.files).filter((f) => !f.dir && /^paintoppresets\/.+\.kpp$/i.test(f.name));
  for (const f of presets) {
    try {
      const text = await readPngText(await f.async('uint8array'));
      if (!text['preset']) continue;
      const r = await kritaPresetToBrush(text['preset'], f.name.replace(/^.*\//, '').replace(/\.kpp$/i, ''), loadTip);
      if (r.brush) {
        brushes.push(r.brush);
        r.notes.filter((n) => !n.startsWith('la punta «')).forEach((n) => noteSet.add(n));
        r.notes.filter((n) => n.startsWith('la punta «')).forEach((n) => noteSet.add(n));
      } else if (r.skipped) skipped[r.skipped] = (skipped[r.skipped] ?? 0) + 1;
    } catch {
      skipped['ilegible'] = (skipped['ilegible'] ?? 0) + 1;
    }
    await new Promise((res) => setTimeout(res, 0)); // keep the UI responsive across dozens of presets
  }
  noteSet.add('las texturas y otros ajustes avanzados de los presets de Krita no se importan');
  return { brushes, skipped, notes: [...noteSet] };
}

/** A GIMP brush (.gbr) or animated brush (.gih) on its own. */
export function importGimpBrushFile(buffer: ArrayBuffer, fallbackName: string): ImportedBrush {
  const series = readGimpBrushSeries(new Uint8Array(buffer));
  const [first, ...rest] = series.frames;
  const t = alphaToTipDataUrl(first.values, first.w, first.h);
  const frames = rest.length ? [t.url, ...rest.map((f) => alphaToTipDataUrl(f.values, f.w, f.h, t.inverted).url)] : undefined;
  const b = makeBrush(fallbackName, t.url, {
    size: Math.min(300, Math.max(first.w, first.h)),
    spacing: series.spacing ? Math.min(1, Math.max(0.02, series.spacing)) : 0.25,
    textures: frames,
    tipSelection: frames ? series.selection : undefined,
  }, 'Importados (GIMP)');
  return { brush: b, notes: frames ? [`pincel animado: ${series.frames.length} fotogramas (${series.selection === 'incremental' ? 'en orden' : 'al azar'})`] : [] };
}

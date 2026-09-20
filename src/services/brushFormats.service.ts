import type { Brush } from '@/types';
import { createBrush, preloadBrushTexture } from './brush.service';

/**
 * Importers for brush formats other than modern .abr:
 *   - legacy Photoshop .abr v1/v2 (Photoshop ≤ 6/7)
 *   - Procreate .brush (a zip with Shape.png / Grain.png / Brush.archive)
 *   - Krita .kpp (a PNG carrying the preset XML in a text chunk)
 *
 * HONESTY NOTE: these were written from the published/community format descriptions and tested
 * only against synthetic files built to those descriptions (plus Python's real binary-plist
 * writer for the plist parser) — NOT against real files from those programs, which I did not
 * have. Every reader validates what it reads and fails with a clear message instead of guessing.
 */

export interface ImportedBrush {
  brush: Brush;
  notes: string[];
}

// ------------------------------------------------------------------ shared helpers

/** Grey tip PNG where brightness = paint. Old formats disagree on polarity, so the polarity is
 * inferred: a brush tip is transparent at its border, so a bright border means "inverted". */
export function alphaToTipDataUrl(values: Uint8Array | Uint8ClampedArray, w: number, h: number): { url: string; inverted: boolean } {
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
  const inverted = border / Math.max(1, n) > 127;
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
  return { url: c.toDataURL('image/png'), inverted };
}

function makeBrush(name: string, tipUrl: string | undefined, o: Partial<Brush>, category: string): Brush {
  const b = createBrush({ name, texture: tipUrl, category, tags: [category], size: 40, hardness: 1, spacing: 0.15, ...o });
  // A plain round tip stamped at wide spacing leaves a chain of beads at partial opacity.
  if (!tipUrl) b.spacing = Math.min(b.spacing, 0.06);
  preloadBrushTexture(b.texture);
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
      if (w <= 0 || h <= 0 || w > 4096 || h > 4096 || (depth !== 8 && depth !== 16)) throw new Error('bounds');
      const bpp = depth / 8;
      let raw: Uint8Array;
      if (compression === 0) {
        raw = bytes.slice(q, q + w * h * bpp);
      } else if (compression === 1) {
        const lens: number[] = [];
        for (let y = 0; y < h; y++) { lens.push(v.getUint16(q)); q += 2; }
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

export async function importProcreateBrush(buffer: ArrayBuffer, fallbackName: string): Promise<ImportedBrush> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const find = (re: RegExp) => Object.values(zip.files).find((f) => !f.dir && re.test(f.name));
  const shape = find(/(^|\/)Shape\.png$/i);
  const archive = find(/(^|\/)Brush\.archive$/i);
  if (!shape && !archive) throw new Error('No parece un pincel de Procreate (falta Shape.png / Brush.archive)');
  const notes: string[] = [];
  let name = fallbackName;
  let opts: Partial<Brush> = {};
  if (archive) {
    try {
      const pairs = collectPairs(parseBplist(await archive.async('uint8array')));
      const nm = pairs.find(([k, v]) => /^name$/i.test(k) && typeof v === 'string' && v && !v.startsWith('$'));
      if (nm) name = nm[1] as string;
      const spacing = num(pairs, /^plotSpacing$/i);
      const pSize = num(pairs, /pressure.*size/i);
      const pOp = num(pairs, /pressure.*opacity/i);
      const tSize = num(pairs, /tilt.*size/i);
      const jitter = num(pairs, /^plotJitter$|^shapeJitter$/i);
      opts = {
        spacing: spacing !== undefined ? Math.min(1, Math.max(0.02, spacing)) : undefined,
        dynamics: { sizeToPressure: !!pSize, opacityToPressure: !!pOp, angleToDirection: false, tiltToSize: !!tSize },
        scatter: jitter ? Math.min(1, Math.abs(jitter)) : 0,
      };
      if (spacing === undefined) notes.push('no se encontró el espaciado: se usa 15 %');
    } catch {
      notes.push('no se pudieron leer los ajustes de Brush.archive: se importa solo la punta');
    }
  }
  notes.push('la textura de grano (Grain.png) y los ajustes de mezcla/humedad de Procreate no se importan');
  let tip: string | undefined;
  if (shape) {
    const g = await imageToGray(await shape.async('blob'));
    tip = alphaToTipDataUrl(g.values, g.w, g.h).url;
  }
  return { brush: makeBrush(name, tip, opts, 'Importados (Procreate)'), notes };
}

// ------------------------------------------------------------------ Krita .kpp

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
    if (type === 'tEXt' && nul > 0) out[dec.decode(d.subarray(0, nul))] = new TextDecoder('latin1').decode(d.subarray(nul + 1));
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

export async function importKritaPreset(buffer: ArrayBuffer, fallbackName: string): Promise<ImportedBrush> {
  const text = await readPngText(new Uint8Array(buffer));
  const xml = text['preset'];
  if (!xml) throw new Error('El archivo no contiene un preset de Krita (falta el bloque «preset»)');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const notes: string[] = [];
  const preset = doc.querySelector('Preset');
  const name = preset?.getAttribute('name')?.replace(/_/g, ' ') || fallbackName;
  const param = (n: string) => doc.querySelector(`param[name="${n}"]`)?.textContent?.trim();
  // brush_definition is itself an XML document inside a CDATA section
  let brushXml: Document | null = null;
  const def = param('brush_definition');
  if (def) brushXml = new DOMParser().parseFromString(def, 'text/xml');
  const brushEl = brushXml?.querySelector('Brush');
  const mask = brushXml?.querySelector('MaskGenerator');
  const num2 = (s?: string | null) => (s !== undefined && s !== null && s !== '' ? Number(s) : undefined);
  const spacing = num2(brushEl?.getAttribute('spacing'));
  const diameter = num2(mask?.getAttribute('diameter')) ?? num2(brushEl?.getAttribute('brush_diameter'));
  const hardness = num2(mask?.getAttribute('hfade'));
  const size = num2(param('size')) ?? diameter ?? 40;
  const pressureSize = /PressureSize|SizeOption[^<]*pressure/i.test(xml);
  const pressureOpacity = /PressureOpacity|OpacityOption[^<]*pressure/i.test(xml);
  // A tip image embedded as base64 PNG, if the preset carries one.
  const png = xml.match(/iVBORw0KGgo[A-Za-z0-9+/=]+/)?.[0];
  let tip: string | undefined;
  if (png) {
    const bin = atob(png);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const g = await imageToGray(new Blob([arr], { type: 'image/png' }));
    tip = alphaToTipDataUrl(g.values, g.w, g.h).url;
  } else if (brushEl?.getAttribute('type') === 'auto_brush') {
    notes.push('pincel automático de Krita: se importa como punta redonda');
  } else {
    notes.push('la punta de imagen de este preset no está incrustada en el archivo: se importa con punta redonda');
  }
  notes.push('los ajustes de textura, mezcla y curvas de sensibilidad de Krita no se importan');
  return {
    brush: makeBrush(name, tip, {
      size: Math.min(300, Math.max(1, Math.round(size))),
      spacing: spacing !== undefined ? Math.min(1, Math.max(0.02, spacing)) : undefined,
      hardness: hardness !== undefined ? Math.min(1, Math.max(0, 1 - hardness * 0.8)) : 1,
      dynamics: { sizeToPressure: pressureSize, opacityToPressure: pressureOpacity, angleToDirection: false },
    }, 'Importados (Krita)'),
    notes,
  };
}

import { Brush } from '@/types';
import { createBrush, preloadBrushTexture } from './brush.service';

/**
 * Photoshop .abr import (brush libraries, v6+ 'samp' format, parsed with ag-psd).
 *
 * Mapped to this app's brush model:
 *   tip image (sampled) or hardness (computed) · size · spacing · angle · scatter ·
 *   size/opacity/flow jitter and pen-pressure / tilt / direction dynamics · flow+opacity · smoothing.
 * Reported as NOT imported (no equivalent here): paper-texture patterns, dual brush, wet edges,
 * noise, colour dynamics, roundness/flip, transfer curves beyond pressure on/off.
 */

interface DynamicsLike {
  control?: string;
  jitter?: number;
}

export interface AbrBrushFields {
  name: string;
  size: number;
  spacing: number;
  hardness: number;
  opacity: number;
  scatter: number;
  angleJitter: number;
  sizeJitter: number;
  smoothing: number;
  dynamics: { sizeToPressure: boolean; opacityToPressure: boolean; angleToDirection: boolean; tiltToSize: boolean };
  /** id of the sampled tip in the file, if the brush has one. */
  tipId?: string;
  lost: string[];
  /** Features folded into the tip image approximately. */
  baked: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isControl = (d: DynamicsLike | undefined, ...names: string[]) => !!d?.control && names.includes(d.control);

/** Pure mapping from one parsed ABR brush to our fields (testable without a canvas). */
export function mapAbrBrush(b: any): AbrBrushFields {
  const shape = b.shape ?? {};
  const sd = b.shapeDynamics;
  const tr = b.transfer;
  const tool = b.toolOptions ?? {};
  const lost: string[] = [];
  // Paper texture and dual brush are baked into the tip image by importAbr (approximation), so
  // they are only "lost" for computed (image-less) brushes.
  if (shape.type !== 'sampled') {
    if (b.texture) lost.push('textura de papel');
    if (b.dualBrush) lost.push('pincel dual');
  }
  if (b.wetEdges) lost.push('bordes húmedos');
  if (b.noise) lost.push('ruido');
  if (b.colorDynamics) lost.push('dinámica de color');
  if (shape.roundness !== undefined && shape.roundness < 0.98) lost.push('redondez de la punta');

  const flow = (tool.flow ?? 100) / 100;
  const opacity = (tool.opacity ?? 100) / 100;
  const sizeDyn: DynamicsLike | undefined = sd?.sizeDynamics;
  const opDyn: DynamicsLike | undefined = tr?.opacityDynamics ?? tool.opacityDynamics;
  const flowDyn: DynamicsLike | undefined = tr?.flowDynamics ?? tool.flowDynamics;
  const scatterCount = b.scatter?.count ?? 0;
  const scatterJitter = b.scatter?.scatterDynamics?.jitter ?? 0;

  return {
    name: String(b.name ?? 'Pincel ABR'),
    size: clamp(Math.round(shape.size ?? 20), 1, 300),
    // Round (computed) brushes stamp a soft gradient at 25% spacing in Photoshop, which leaves a
    // visible chain of beads here at partial opacity; tighten them. Sampled tips keep their own.
    spacing: shape.spacingOn === false ? 0.1 : clamp(shape.type === 'computed' ? Math.min(shape.spacing ?? 0.1, 0.06) : (shape.spacing ?? 0.1), 0.02, 1),
    hardness: shape.type === 'computed' ? clamp(shape.hardness ?? 1, 0, 1) : 1,
    opacity: clamp(flow * opacity, 0.05, 1),
    scatter: b.scatter ? clamp(scatterJitter > 0 ? scatterJitter : 0.15 + scatterCount * 0.05, 0, 1) : 0,
    angleJitter: clamp((sd?.angleDynamics?.jitter ?? 0) * 360, 0, 360),
    sizeJitter: clamp((sizeDyn?.jitter ?? 0) * 100, 0, 100),
    smoothing: clamp((tool.smoothing === false ? 0 : tool.smoothingValue ?? 0) / 100, 0, 1),
    dynamics: {
      sizeToPressure: isControl(sizeDyn, 'pen pressure'),
      opacityToPressure: isControl(opDyn, 'pen pressure') || isControl(flowDyn, 'pen pressure'),
      angleToDirection: isControl(sd?.angleDynamics, 'direction', 'initial direction'),
      tiltToSize: isControl(sizeDyn, 'pen tilt'),
    },
    tipId: shape.type === 'sampled' ? shape.sampledData : undefined,
    lost,
    baked: shape.type === 'sampled' ? ([b.texture && 'textura de papel', b.dualBrush?.shape?.sampledData && 'pincel dual'].filter(Boolean) as string[]) : [],
  };
}

export interface AlphaImage {
  alpha: Uint8Array;
  w: number;
  h: number;
}

export interface BakeOptions {
  /** Main tip diameter in brush px (relates the dual tip and the paper scale to the tip). */
  size: number;
  dual?: AlphaImage & { size: number };
  pattern?: { data: Uint8Array; w: number; h: number; scale: number; depth: number; invert: boolean; contrast: number; brightness: number };
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

/** Renders an ABR alpha tip as a grey PNG where brightness = paint amount (what the brush engine expects). */
function tipToDataUrl(alpha: Uint8Array, w: number, h: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = alpha[i];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

/**
 * ag-psd aborts the WHOLE file when it meets a pattern in a mode it doesn't implement (e.g.
 * indexed colour, common in real brush libraries). So: parse the file without its 'patt'
 * sections (brushes + tips), then parse each pattern on its own and skip only the ones that fail.
 */
export function readAbrRobust(readAbr: (b: Uint8Array) => any, bytes: Uint8Array): { abr: any; skippedPatterns: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = bytes.slice(0, 4);
  const kept: Uint8Array[] = [header];
  const pattSections: Uint8Array[] = [];
  let off = 4;
  while (off + 12 <= bytes.length) {
    const key = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const size = view.getUint32(off + 8);
    const end = off + 12 + size;
    if (String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]) !== '8BIM' || end > bytes.length) break;
    if (key === 'patt') pattSections.push(bytes.slice(off + 12, end));
    else kept.push(bytes.slice(off, end));
    off = end;
  }
  const total = kept.reduce((n, c) => n + c.length, 0);
  const main = new Uint8Array(total);
  let o = 0;
  for (const c of kept) {
    main.set(c, o);
    o += c.length;
  }
  const abr = readAbr(main);
  abr.patterns = abr.patterns ?? [];

  let skippedPatterns = 0;
  for (const data of pattSections) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let p = 0;
    while (p + 4 <= data.length) {
      const len = dv.getUint32(p);
      const item = data.slice(p, p + 4 + ((len + 3) & ~3));
      p += item.length;
      const mini = new Uint8Array(4 + 12 + item.length);
      mini.set(header, 0);
      mini.set([0x38, 0x42, 0x49, 0x4d, 0x70, 0x61, 0x74, 0x74], 4); // '8BIM' 'patt'
      new DataView(mini.buffer).setUint32(12, item.length);
      mini.set(item, 16);
      try {
        abr.patterns.push(...readAbr(mini).patterns);
      } catch {
        skippedPatterns++;
      }
    }
  }
  return { abr, skippedPatterns };
}

export interface AbrImportResult {
  brushes: Brush[];
  /** Feature name → number of brushes that used it but could not be imported. */
  lostFeatures: Record<string, number>;
  /** Feature name → number of brushes where it was folded into the tip approximately. */
  bakedFeatures: Record<string, number>;
  skipped: number;
  /** Paper-texture patterns that could not be decoded (their brushes import without the texture). */
  skippedPatterns: number;
}

export async function importAbr(buffer: ArrayBuffer): Promise<AbrImportResult> {
  const { readAbr } = await import('ag-psd');
  const { abr, skippedPatterns } = readAbrRobust(readAbr, new Uint8Array(buffer));
  const samples = new Map<string, AlphaImage>();
  for (const sm of abr.samples ?? []) {
    const w = sm.bounds.w;
    const h = sm.bounds.h;
    if (w > 0 && h > 0 && sm.alpha?.length >= w * h) samples.set(sm.id, { alpha: sm.alpha, w, h });
  }
  const patterns = new Map<string, { data: Uint8Array; w: number; h: number }>();
  for (const p of abr.patterns ?? []) {
    const data = p.data as Uint8Array | undefined;
    if (!data?.length) continue;
    const bw = p.bounds?.w ?? 0;
    const bh = p.bounds?.h ?? 0;
    const exact = bw * bh === data.length;
    const w = exact ? bw : Math.round(Math.sqrt(data.length));
    const h = exact ? bh : Math.round(data.length / w);
    if (w > 0 && h > 0 && w * h === data.length) patterns.set(p.id, { data, w, h });
  }

  const dataUrls = new Map<string, string>();
  const brushes: Brush[] = [];
  const lostFeatures: Record<string, number> = {};
  const bakedFeatures: Record<string, number> = {};
  let skipped = 0;
  for (const raw of abr.brushes ?? []) {
    const f = mapAbrBrush(raw);
    const tip = f.tipId ? samples.get(f.tipId) : undefined;
    if (f.tipId && !tip) {
      skipped++;
      continue;
    }
    let texture: string | undefined;
    if (tip) {
      const dualRef: any = (raw as any).dualBrush?.shape;
      const dual = dualRef?.sampledData ? samples.get(dualRef.sampledData) : undefined;
      const tex: any = (raw as any).texture;
      const pat = tex?.id ? patterns.get(tex.id) : undefined;
      const baked = f.baked.filter((x) => (x === 'pincel dual' ? !!dual : !!pat));
      const key = `${f.tipId}|${dual ? dualRef.sampledData + '@' + dualRef.size : ''}|${pat ? tex.id + '@' + tex.scale + '/' + tex.depth : ''}|${f.size}`;
      texture = dataUrls.get(key);
      if (!texture) {
        const img = baked.length
          ? bakeTipAlpha(tip, {
              size: f.size,
              dual: dual && { ...dual, size: dualRef.size ?? f.size },
              pattern: pat && { ...pat, scale: tex.scale ?? 1, depth: tex.depth ?? 1, invert: !!tex.invert, contrast: tex.contrast ?? 0, brightness: tex.brightness ?? 0 },
            })
          : tip;
        texture = tipToDataUrl(img.alpha, img.w, img.h);
        dataUrls.set(key, texture);
      }
      baked.forEach((x) => (bakedFeatures[x] = (bakedFeatures[x] ?? 0) + 1));
      // A feature present in the file whose data could not be resolved counts as lost.
      f.baked.filter((x) => !baked.includes(x)).forEach((x) => f.lost.push(x));
    }
    f.lost.forEach((l) => (lostFeatures[l] = (lostFeatures[l] ?? 0) + 1));
    preloadBrushTexture(texture);
    brushes.push(
      createBrush({
        name: f.name,
        size: f.size,
        spacing: f.spacing,
        hardness: f.hardness,
        opacity: f.opacity,
        scatter: f.scatter,
        angleJitter: f.angleJitter,
        sizeJitter: f.sizeJitter,
        smoothing: f.smoothing,
        texture,
        dynamics: f.dynamics,
        category: 'Importados (ABR)',
        tags: ['abr'],
      })
    );
  }
  return { brushes, lostFeatures, bakedFeatures, skipped, skippedPatterns };
}

/**
 * Minimal PSD (Photoshop) writer: 8-bit RGB, uncompressed, one PSD layer per raster/reference/
 * fill layer with its name, position, opacity, visibility and blend mode, plus the flattened
 * composite. Not exported: groups (layers appear flat), adjustment layers, masks, layer styles,
 * text as live text — those stay in the native project format.
 */

export interface PsdLayerInput {
  name: string;
  canvas: HTMLCanvasElement | { width: number; height: number; getImageData: () => Uint8ClampedArray };
  /** 0–1 */
  opacity: number;
  visible: boolean;
  /** CSS globalCompositeOperation name */
  blendMode: string;
  x: number;
  y: number;
}

const BLEND_KEYS: Record<string, string> = {
  'source-over': 'norm',
  multiply: 'mul ',
  screen: 'scrn',
  overlay: 'over',
  darken: 'dark',
  lighten: 'lite',
  'color-dodge': 'div ',
  'color-burn': 'idiv',
  'hard-light': 'hLit',
  'soft-light': 'sLit',
  difference: 'diff',
  exclusion: 'smud',
  hue: 'hue ',
  saturation: 'sat ',
  color: 'colr',
  luminosity: 'lum ',
};

class Writer {
  private chunks: Uint8Array[] = [];
  private size = 0;
  push(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.size += bytes.length;
  }
  u8(v: number) {
    this.push(Uint8Array.of(v & 255));
  }
  u16(v: number) {
    this.push(Uint8Array.of((v >> 8) & 255, v & 255));
  }
  i16(v: number) {
    this.u16(v < 0 ? v + 65536 : v);
  }
  u32(v: number) {
    this.push(Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255));
  }
  i32(v: number) {
    this.u32(v < 0 ? v + 4294967296 : v);
  }
  ascii(s: string) {
    this.push(Uint8Array.from(s, (c) => c.charCodeAt(0) & 255));
  }
  zeros(n: number) {
    this.push(new Uint8Array(n));
  }
  get length() {
    return this.size;
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

function pixelsOf(l: PsdLayerInput): { w: number; h: number; data: Uint8ClampedArray } {
  const c = l.canvas as HTMLCanvasElement & { getImageData?: () => Uint8ClampedArray };
  if (typeof (c as { getContext?: unknown }).getContext === 'function') {
    return { w: c.width, h: c.height, data: c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data };
  }
  return { w: c.width, h: c.height, data: (c as { getImageData: () => Uint8ClampedArray }).getImageData() };
}

/** Pascal string padded so that (length byte + text) is a multiple of 4. */
function pascalName(name: string): Uint8Array {
  // PSD legacy names are single-byte; replace anything outside Latin-1 so the file stays valid.
  const safe = Array.from(name.slice(0, 31), (ch) => (ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63));
  const total = Math.ceil((safe.length + 1) / 4) * 4;
  const out = new Uint8Array(total);
  out[0] = safe.length;
  out.set(safe, 1);
  return out;
}

export function encodePsd(width: number, height: number, layers: PsdLayerInput[], composite: { data: Uint8ClampedArray }): Uint8Array {
  const w = new Writer();
  // --- Header
  w.ascii('8BPS');
  w.u16(1);
  w.zeros(6);
  w.u16(3); // channels in the merged image (RGB)
  w.u32(height);
  w.u32(width);
  w.u16(8);
  w.u16(3); // RGB
  w.u32(0); // colour mode data
  w.u32(0); // image resources

  // --- Layer records + channel data. PSD stores layers bottom-to-top; the project stores them top-first.
  const ordered = [...layers].reverse();
  const records = new Writer();
  const channelData = new Writer();
  let count = 0;
  for (const l of ordered) {
    const { w: lw, h: lh, data } = pixelsOf(l);
    // Trim to the bounding box of non-transparent pixels to keep files small.
    let minX = lw, minY = lh, maxX = -1, maxY = -1;
    for (let y = 0; y < lh; y++) {
      for (let x = 0; x < lw; x++) {
        if (data[(y * lw + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      minX = minY = 0;
      maxX = maxY = 0; // an empty layer is still written, as a single transparent pixel
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const top = l.y + minY;
    const left = l.x + minX;

    records.i32(top);
    records.i32(left);
    records.i32(top + bh);
    records.i32(left + bw);
    records.u16(4);
    const planeLen = 2 + bw * bh; // 2-byte compression tag + raw plane
    for (const id of [0, 1, 2, -1]) {
      records.i16(id);
      records.u32(planeLen);
    }
    records.ascii('8BIM');
    records.ascii(BLEND_KEYS[l.blendMode] ?? 'norm');
    records.u8(Math.round(Math.max(0, Math.min(1, l.opacity)) * 255));
    records.u8(0); // clipping
    records.u8(l.visible ? 0 : 2); // flags: bit 1 = hidden
    records.u8(0);
    const name = pascalName(l.name);
    records.u32(4 + 4 + name.length); // extra data: mask len + blending ranges len + name
    records.u32(0);
    records.u32(0);
    records.push(name);

    for (const ch of [0, 1, 2, 3]) {
      channelData.u16(0); // raw
      const plane = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = ((minY + y) * lw + (minX + x)) * 4;
          plane[y * bw + x] = data[i + ch];
        }
      }
      channelData.push(plane);
    }
    count++;
  }

  const layerInfo = new Writer();
  layerInfo.i16(count);
  layerInfo.push(records.bytes());
  layerInfo.push(channelData.bytes());
  if (layerInfo.length % 2 === 1) layerInfo.u8(0);

  const lm = new Writer();
  lm.u32(layerInfo.length);
  lm.push(layerInfo.bytes());
  lm.u32(0); // global layer mask info
  w.u32(lm.length);
  w.push(lm.bytes());

  // --- Merged image data: raw, planar R, G, B
  w.u16(0);
  const n = width * height;
  for (let ch = 0; ch < 3; ch++) {
    const plane = new Uint8Array(n);
    for (let i = 0; i < n; i++) plane[i] = composite.data[i * 4 + ch];
    w.push(plane);
  }
  return w.bytes();
}

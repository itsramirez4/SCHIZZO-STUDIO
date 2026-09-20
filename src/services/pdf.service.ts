/**
 * Minimal single-page PDF writer. The artwork is embedded as ONE image (JPEG or lossless Flate
 * RGB) on a page whose physical size follows the project's DPI, so it prints at the intended
 * size. Transparent areas are flattened onto the background colour (PDF images here carry no alpha).
 */

export interface PdfOptions {
  /** Pixels per inch of the artwork (page size in points = px × 72 / dpi). */
  dpi: number;
  mode: 'jpeg' | 'lossless';
  /** 0–1, JPEG only. */
  quality?: number;
  title?: string;
  /** CSS colour placed behind transparent pixels. */
  background?: string;
}

const enc = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PDF text strings: ASCII in parentheses, anything else as UTF-16BE hex (with BOM). */
function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return '(' + s.replace(/([\\()])/g, '\\$1') + ')';
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${hex}>`;
}

export async function encodePdf(source: HTMLCanvasElement, o: PdfOptions): Promise<Uint8Array> {
  const w = source.width;
  const h = source.height;

  // Flatten onto the background.
  const flat = document.createElement('canvas');
  flat.width = w;
  flat.height = h;
  const fctx = flat.getContext('2d', { willReadFrequently: true })!;
  fctx.fillStyle = o.background ?? '#ffffff';
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(source, 0, 0);

  let imageBytes: Uint8Array;
  let filter: string;
  if (o.mode === 'jpeg') {
    imageBytes = base64ToBytes(flat.toDataURL('image/jpeg', o.quality ?? 0.92).split(',')[1]);
    filter = '/DCTDecode';
  } else {
    const rgba = fctx.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4) {
      rgb[j++] = rgba[i];
      rgb[j++] = rgba[i + 1];
      rgb[j++] = rgba[i + 2];
    }
    imageBytes = await deflate(rgb);
    filter = '/FlateDecode';
  }

  const scale = 72 / Math.max(1, o.dpi);
  const pageW = +(w * scale).toFixed(3);
  const pageH = +(h * scale).toFixed(3);
  const content = enc.encode(`q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`);

  const objects: Uint8Array[] = [];
  const text = (s: string) => enc.encode(s);
  objects.push(text('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(text('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  objects.push(text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`));
  objects.push(concat([text(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${imageBytes.length} >>\nstream\n`), imageBytes, text('\nendstream')]));
  objects.push(concat([text(`<< /Length ${content.length} >>\nstream\n`), content, text('\nendstream')]));
  objects.push(text(`<< /Title ${pdfString(o.title ?? 'SCHIZZO STUDIO')} /Producer (SCHIZZO STUDIO) >>`));

  const parts: Uint8Array[] = [text('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets: number[] = [];
  let pos = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(pos);
    const chunk = concat([text(`${i + 1} 0 obj\n`), body, text('\nendobj\n')]);
    parts.push(chunk);
    pos += chunk.length;
  });
  const xrefStart = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  parts.push(text(xref));
  return concat(parts);
}

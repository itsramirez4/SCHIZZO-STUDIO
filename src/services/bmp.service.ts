/**
 * From-scratch 32bpp BMP encoder (BITMAPV4HEADER + BI_BITFIELDS) — the extra header fields
 * over the classic BITMAPINFOHEADER are what let a BMP carry a real alpha channel; without
 * them a 32bpp BMP's 4th byte per pixel is just padding most viewers ignore. Bottom-up row
 * order (the classic/most compatible layout) rather than the shorter negative-height
 * top-down variant, since maximum "legacy" compatibility is the whole point of exporting BMP.
 */
export function encodeBmp(canvas: HTMLCanvasElement): Uint8Array {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, width, height).data;

  const pixelDataSize = width * height * 4;
  const headerSize = 14 + 108;
  const fileSize = headerSize + pixelDataSize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // BITMAPFILEHEADER
  out[0] = 0x42;
  out[1] = 0x4d; // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true); // reserved
  view.setUint32(10, headerSize, true); // pixel data offset

  // BITMAPV4HEADER
  let o = 14;
  view.setUint32(o, 108, true); o += 4; // header size
  view.setInt32(o, width, true); o += 4;
  view.setInt32(o, height, true); o += 4; // positive = bottom-up
  view.setUint16(o, 1, true); o += 2; // planes
  view.setUint16(o, 32, true); o += 2; // bits per pixel
  view.setUint32(o, 3, true); o += 4; // BI_BITFIELDS
  view.setUint32(o, pixelDataSize, true); o += 4;
  view.setInt32(o, 2835, true); o += 4; // ~72 DPI
  view.setInt32(o, 2835, true); o += 4;
  view.setUint32(o, 0, true); o += 4; // colors used
  view.setUint32(o, 0, true); o += 4; // colors important
  view.setUint32(o, 0x00ff0000, true); o += 4; // R mask
  view.setUint32(o, 0x0000ff00, true); o += 4; // G mask
  view.setUint32(o, 0x000000ff, true); o += 4; // B mask
  view.setUint32(o, 0xff000000, true); o += 4; // A mask
  // CSType = "sRGB", written as literal ASCII bytes (this field is defined as a byte
  // sequence read in file order, not a little-endian integer, despite living in a DWORD).
  out[o++] = 0x73;
  out[o++] = 0x52;
  out[o++] = 0x47;
  out[o++] = 0x42;
  o += 36; // CIEXYZTRIPLE endpoints, unused for sRGB
  o += 12; // gamma r/g/b, unused for sRGB

  // Pixel data: bottom-up rows, BGRA per pixel.
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      out[o++] = src[si + 2]; // B
      out[o++] = src[si + 1]; // G
      out[o++] = src[si]; // R
      out[o++] = src[si + 3]; // A
    }
  }

  return out;
}

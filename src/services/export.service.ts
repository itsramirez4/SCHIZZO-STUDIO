import { Project } from '@/types';
import { flattenLayers, getLayerCanvas, renderFillLayer } from './layer.service';
import { encodePsd, PsdLayerInput } from './psd.service';
import { encodePdf } from './pdf.service';
import { layersToSvg, SvgLayerInput, VectorizeOptions } from './vectorExport.service';
import { encodeBmp } from './bmp.service';
import { encodeTiff } from './tiff.service';
import { canvasToDataUrl } from '@/utils/canvasUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';
import { isElectron, downloadDataUrl, sanitizeFilename } from '@/utils/fileUtils';

export async function exportPNG(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const dataUrl = canvasToDataUrl(canvas, 'image/png');
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'png', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.png`);
  return { canceled: false };
}

export async function exportJPG(
  project: Project,
  quality = 0.92
): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  // JPG has no alpha channel — flatten onto white first.
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);

  const dataUrl = canvasToDataUrl(flat, 'image/jpeg', quality);
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'jpg', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.jpg`);
  return { canceled: false };
}

async function exportViaCanvasMime(
  project: Project,
  mime: string,
  extension: string,
  quality?: number
): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const dataUrl = canvasToDataUrl(canvas, mime, quality);
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, extension, filename);
  }
  downloadDataUrl(dataUrl, `${filename}.${extension}`);
  return { canceled: false };
}

export function exportWebP(project: Project, quality = 0.9) {
  return exportViaCanvasMime(project, 'image/webp', 'webp', quality);
}

/** Chromium's canvas can only encode PNG, JPEG and WebP: asking for AVIF silently returns a PNG. */
export function canEncodeAvif(): boolean {
  try {
    return document.createElement('canvas').toDataURL('image/avif').startsWith('data:image/avif');
  } catch {
    return false;
  }
}

export function exportAVIF(project: Project, quality = 0.7) {
  // Never write PNG bytes into a ".avif" file: refuse instead.
  if (!canEncodeAvif()) throw new Error('AVIF no está disponible en esta versión del motor: usa WebP (pesa parecido).');
  return exportViaCanvasMime(project, 'image/avif', 'avif', quality);
}

export async function exportBMP(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const bytes = encodeBmp(canvas);
  const dataUrl = `data:image/bmp;base64,${uint8ToBase64(bytes)}`;
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'bmp', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.bmp`);
  return { canceled: false };
}

export async function exportTIFF(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const bytes = encodeTiff(canvas);
  const dataUrl = `data:image/tiff;base64,${uint8ToBase64(bytes)}`;
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'tiff', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.tiff`);
  return { canceled: false };
}

export async function exportPDF(project: Project, opts: { lossless: boolean; quality: number }): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const bytes = await encodePdf(canvas, {
    dpi: project.dpi || 72,
    mode: opts.lossless ? 'lossless' : 'jpeg',
    quality: opts.quality,
    title: project.name,
    background: project.settings.transparentBg ? '#ffffff' : (project.settings.backgroundColor ?? '#ffffff'),
  });
  const dataUrl = `data:application/pdf;base64,${uint8ToBase64(bytes)}`;
  const filename = sanitizeFilename(project.name);
  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'pdf', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.pdf`);
  return { canceled: false };
}

/**
 * Layered PSD: raster, text and fill layers become PSD layers (name, position, opacity,
 * visibility, blend mode). Groups are flattened into the list — a layer hidden by its group is
 * exported hidden — while adjustment layers, masks and layer styles are not carried over.
 */
export async function exportPSD(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const byId = new Map(project.layers.map((l) => [l.id, l]));
  const visibleThroughParents = (l: (typeof project.layers)[number]): boolean => {
    let cur = l.parent ? byId.get(l.parent) : undefined;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return l.visible;
  };
  const layers: PsdLayerInput[] = [];
  for (const l of project.layers) {
    if (l.type === 'group' || l.type === 'adjustment' || l.type === 'reference') continue;
    const canvas = l.type === 'fill' ? renderFillLayer(l, project.width, project.height) : getLayerCanvas(l.linkedSourceId ?? l.id);
    if (!canvas) continue;
    layers.push({ name: l.name, canvas, opacity: l.opacity, visible: visibleThroughParents(l), blendMode: l.blendMode, x: l.x, y: l.y });
  }

  // Merged image: the flattened project over its background (white when the canvas is transparent).
  const flat = flattenLayers(project.layers, project.width, project.height);
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = project.width;
  bgCanvas.height = project.height;
  const bctx = bgCanvas.getContext('2d')!;
  bctx.fillStyle = project.settings.transparentBg ? '#ffffff' : (project.settings.backgroundColor ?? '#ffffff');
  bctx.fillRect(0, 0, project.width, project.height);
  bctx.drawImage(flat, 0, 0);
  const composite = bctx.getImageData(0, 0, project.width, project.height);

  const bytes = encodePsd(project.width, project.height, layers, composite);
  const dataUrl = `data:image/vnd.adobe.photoshop;base64,${uint8ToBase64(bytes)}`;
  const filename = sanitizeFilename(project.name);
  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'psd', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.psd`);
  return { canceled: false };
}

/**
 * True vector SVG: every raster/text/fill layer is traced into flat-colour shapes (holes
 * included) and written as its own <g>, keeping opacity, visibility and blend mode. It is an
 * automatic trace — gradients become colour bands and fine texture is lost.
 */
export async function exportVectorSVG(project: Project, options: VectorizeOptions): Promise<{ canceled: boolean; filePath?: string }> {
  const byId = new Map(project.layers.map((l) => [l.id, l]));
  const shown = (l: (typeof project.layers)[number]): boolean => {
    let cur = l.parent ? byId.get(l.parent) : undefined;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return l.visible;
  };
  const layers: SvgLayerInput[] = [];
  // project.layers is top-first; SVG paints in document order, so go bottom-up.
  for (const l of [...project.layers].reverse()) {
    if (l.type === 'group' || l.type === 'adjustment' || l.type === 'reference') continue;
    const canvas = l.type === 'fill' ? renderFillLayer(l, project.width, project.height) : getLayerCanvas(l.linkedSourceId ?? l.id);
    if (canvas) layers.push({ name: l.name, canvas, opacity: l.opacity, visible: shown(l), blendMode: l.blendMode, x: l.x, y: l.y });
  }
  const bg = project.settings.transparentBg ? undefined : (project.settings.backgroundColor ?? '#ffffff');
  const svg = layersToSvg(project.width, project.height, layers, options, bg);
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const filename = sanitizeFilename(project.name);
  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'svg', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.svg`);
  return { canceled: false };
}

/**
 * Embedded-image SVG: the flattened PNG wrapped in an <svg><image/></svg> — a valid SVG that
 * places anywhere SVGs are accepted, but NOT editable shapes (for those use `exportVectorSVG`).
 */
export async function exportSVG(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const canvas = flattenLayers(project.layers, project.width, project.height);
  const pngDataUrl = canvasToDataUrl(canvas, 'image/png');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${project.width}" height="${project.height}" ` +
    `viewBox="0 0 ${project.width} ${project.height}"><image width="${project.width}" height="${project.height}" href="${pngDataUrl}"/></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'svg', filename);
  }
  downloadDataUrl(dataUrl, `${filename}.svg`);
  return { canceled: false };
}

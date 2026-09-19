import { Project } from '@/types';
import { flattenLayers, getLayerCanvas, renderFillLayer } from './layer.service';
import { encodePsd, PsdLayerInput } from './psd.service';
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

/** Chromium supports AVIF encoding via canvas.toDataURL since v85 — no separate encoder needed. */
export function exportAVIF(project: Project, quality = 0.7) {
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
 * Not a real vector export — this app has no persistent shape/path data to export (the pen
 * tool rasterizes to pixels the moment you commit a stroke), so an honest "SVG export" here
 * is the flattened PNG embedded in an <svg><image/></svg> wrapper: a valid SVG file, openable
 * and placeable anywhere SVGs are accepted, but not shape-editable the way a true vector
 * export would be.
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

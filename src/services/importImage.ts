import toast from 'react-hot-toast';
import * as layerService from '@/services/layer.service';
import * as tiffService from '@/services/tiff.service';
import { decodeApng } from '@/services/apng.service';
import { useAppStore } from '@/store/appStore';
import { dataUrlToImage, createCanvas } from '@/utils/canvasUtils';
import { base64ToUint8 } from '@/utils/binaryUtils';
import { isElectron } from '@/utils/fileUtils';

interface ImportedFile {
  name: string;
  dataUrl: string;
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** TIFF can't be decoded via <img> (not a standard web image format) — everything else can. */
async function decodeRasterFile(file: ImportedFile): Promise<HTMLCanvasElement | null> {
  if (extensionOf(file.name) === 'tiff' || extensionOf(file.name) === 'tif') {
    const base64 = file.dataUrl.split(',')[1] ?? '';
    return tiffService.decodeTiff(base64ToUint8(base64));
  }
  try {
    const img = await dataUrlToImage(file.dataUrl);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Opens the native file picker, creates one new layer per selected image, and
 * draws each image onto its layer at natural size anchored to the top-left.
 * A .png that turns out to be an animated PNG is imported as real animation frames
 * instead of a single flat layer. Returns the id of the last created layer (or the
 * layer of the last imported frame), or null if nothing was imported.
 */
export async function importImagesAsLayers(addLayer: (name?: string) => string): Promise<string | null> {
  if (!isElectron()) {
    toast.error('Importar imágenes solo está disponible en la app de escritorio');
    return null;
  }

  const result = await window.electronAPI.importImages();
  if (result.canceled || result.files.length === 0) return null;

  let lastLayerId: string | null = null;
  for (const file of result.files) {
    const ext = extensionOf(file.name);
    if (ext === 'png' || ext === 'apng') {
      const base64 = file.dataUrl.split(',')[1] ?? '';
      const apng = await decodeApng(base64ToUint8(base64));
      if (apng && apng.frames.length > 1) {
        useAppStore.getState().importAnimationFrames(apng.frames);
        toast.success(`Se importaron ${apng.frames.length} frames de animación`);
        continue;
      }
    }

    const decoded = await decodeRasterFile(file);
    if (!decoded) {
      toast.error(`No se pudo leer ${file.name}`);
      continue;
    }
    const layerId = addLayer(file.name.replace(/\.[^.]+$/, ''));
    // Fetch the canvas AFTER decoding, not before: creating the layer triggers a React
    // re-render that swaps the registry's offscreen canvas for the mounted DOM one, and
    // that swap reliably finishes before an async decode resolves — so a reference grabbed
    // beforehand ends up pointing at an orphaned canvas nothing on screen draws from again.
    const canvas = layerService.getLayerCanvas(layerId);
    if (!canvas) continue;
    canvas.getContext('2d')!.drawImage(decoded, 0, 0);
    lastLayerId = layerId;
  }
  return lastLayerId;
}

/**
 * Same file picker as importImagesAsLayers, but creates locked, export-excluded reference
 * layers instead of ordinary raster ones, and scales each image to fit within the project
 * bounds (centered) since reference photos rarely match the canvas size exactly. An animated
 * PNG just contributes its first frame here — a reference layer is a single static image.
 */
export async function importReferenceImages(addReferenceLayer: (name?: string) => string): Promise<string | null> {
  if (!isElectron()) {
    toast.error('Importar referencias solo está disponible en la app de escritorio');
    return null;
  }

  const result = await window.electronAPI.importImages();
  if (result.canceled || result.files.length === 0) return null;

  let lastLayerId: string | null = null;
  for (const file of result.files) {
    const decoded = await decodeRasterFile(file);
    if (!decoded) {
      toast.error(`No se pudo leer ${file.name}`);
      continue;
    }
    const layerId = addReferenceLayer(file.name.replace(/\.[^.]+$/, ''));
    // See the identical comment in importImagesAsLayers — must re-fetch post-await.
    const canvas = layerService.getLayerCanvas(layerId);
    if (!canvas) continue;
    const scale = Math.min(canvas.width / decoded.width, canvas.height / decoded.height, 1);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    const dx = (canvas.width - drawW) / 2;
    const dy = (canvas.height - drawH) / 2;
    canvas.getContext('2d')!.drawImage(decoded, dx, dy, drawW, drawH);
    lastLayerId = layerId;
  }
  return lastLayerId;
}

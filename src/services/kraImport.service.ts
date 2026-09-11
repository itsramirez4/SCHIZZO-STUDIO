import JSZip from 'jszip';
import toast from 'react-hot-toast';
import * as layerService from '@/services/layer.service';
import { dataUrlToImage } from '@/utils/canvasUtils';
import { base64ToUint8 } from '@/utils/binaryUtils';
import { isElectron } from '@/utils/fileUtils';

/**
 * Krita's .kra IS a plain ZIP (unlike CLIP Studio's .clip, which is a proprietary SQLite
 * container despite looking similar on paper) — but its individual raster layers are stored
 * in a Krita-internal tiled pixel format, not as plain per-layer PNGs, and reverse-engineering
 * that reliably without a real reference file to test against isn't something I can verify
 * here. What KRA always contains, by documented spec, is `mergedimage.png` — the full
 * flattened artwork — so that's what this imports, as a single layer. Real per-layer
 * reconstruction would be a reasonable follow-up with an actual .kra file to test against.
 */
export async function importKraAsLayer(addLayer: (name?: string) => string): Promise<string | null> {
  if (!isElectron()) {
    toast.error('Importar Krita solo está disponible en la app de escritorio');
    return null;
  }

  const result = await window.electronAPI.importKra();
  if (result.canceled || !result.base64) return null;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(base64ToUint8(result.base64));
  } catch (err) {
    toast.error('No se pudo abrir el archivo .kra (¿está corrupto?)');
    console.error(err);
    return null;
  }

  const merged = zip.file('mergedimage.png') ?? zip.file('preview.png');
  if (!merged) {
    toast.error('El archivo .kra no tiene una imagen combinada legible');
    return null;
  }

  const pngBase64 = await merged.async('base64');
  const layerId = addLayer(result.name?.replace(/\.kra$/i, '') ?? 'Krita');
  const img = await dataUrlToImage(`data:image/png;base64,${pngBase64}`);
  // Fetch the canvas AFTER decoding, not before — same registry/DOM-swap race as the other
  // importers (see the comment in importImage.ts for the full explanation).
  const canvas = layerService.getLayerCanvas(layerId);
  if (!canvas) return null;
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (canvas.width - drawW) / 2;
  const dy = (canvas.height - drawH) / 2;
  canvas.getContext('2d')!.drawImage(img, dx, dy, drawW, drawH);

  toast.success('Imagen de Krita importada (aplanada — las capas de Krita no se reconstruyen)');
  return layerId;
}

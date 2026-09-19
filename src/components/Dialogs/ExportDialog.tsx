import { useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import * as exportService from '@/services/export.service';

type Format = 'png' | 'jpg' | 'webp' | 'avif' | 'bmp' | 'tiff' | 'svg' | 'psd';

const FORMAT_INFO: Record<Format, { label: string; lossy: boolean; note?: string }> = {
  png: { label: 'PNG', lossy: false },
  jpg: { label: 'JPG', lossy: true },
  webp: { label: 'WebP', lossy: true, note: 'Suele pesar ~30% menos que PNG con calidad similar.' },
  avif: { label: 'AVIF', lossy: true, note: 'Suele pesar ~50% menos que PNG. Formato más nuevo, menos compatible.' },
  bmp: { label: 'BMP', lossy: false, note: 'Sin compresión — pensado para compatibilidad con software legacy.' },
  tiff: { label: 'TIFF', lossy: false, note: 'Sin compresión, con canal alfa — para impresión profesional.' },
  psd: { label: 'PSD', lossy: false, note: 'Con capas (nombre, opacidad, visibilidad y modo de fusión) para abrir en Photoshop, Krita o Clip Studio. No incluye máscaras, ajustes ni estilos de capa.' },
  svg: { label: 'SVG', lossy: false, note: 'La imagen aplanada envuelta en un SVG — no es vectorial editable, esta app trabaja en píxeles.' },
};

export default function ExportDialog() {
  const show = useUIStore((s) => s.showExportDialog);
  const close = useUIStore((s) => s.closeExportDialog);
  const project = useAppStore((s) => s.project);
  const [format, setFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(92);
  const [exporting, setExporting] = useState(false);

  if (!show || !project) return null;

  async function handleExport() {
    setExporting(true);
    try {
      let result: { canceled: boolean };
      switch (format) {
        case 'png':
          result = await exportService.exportPNG(project!);
          break;
        case 'jpg':
          result = await exportService.exportJPG(project!, quality / 100);
          break;
        case 'webp':
          result = await exportService.exportWebP(project!, quality / 100);
          break;
        case 'avif':
          result = await exportService.exportAVIF(project!, quality / 100);
          break;
        case 'bmp':
          result = await exportService.exportBMP(project!);
          break;
        case 'tiff':
          result = await exportService.exportTIFF(project!);
          break;
        case 'svg':
          result = await exportService.exportSVG(project!);
          break;
        case 'psd':
          result = await exportService.exportPSD(project!);
          break;
      }
      if (!result.canceled) {
        toast.success('Imagen exportada');
        close();
      }
    } catch (err) {
      toast.error('No se pudo exportar la imagen');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const info = FORMAT_INFO[format];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-96 p-5">
        <h2 className="text-lg font-semibold mb-4">Exportar imagen</h2>

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(Object.keys(FORMAT_INFO) as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`py-1.5 rounded text-xs uppercase ${format === f ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
            >
              {FORMAT_INFO[f].label}
            </button>
          ))}
        </div>

        {info.note && <p className="text-[11px] text-textDim mb-3">{info.note}</p>}

        {info.lossy && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>Calidad</span>
              <span>{quality}%</span>
            </div>
            <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </div>
        )}

        <p className="text-xs text-textDim mb-4">
          {project.width} × {project.height}px
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={close} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
            Cancelar
          </button>
          <button onClick={handleExport} disabled={exporting} className="px-3 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-50">
            {exporting ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}

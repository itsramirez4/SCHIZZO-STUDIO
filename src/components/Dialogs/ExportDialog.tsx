import { useState } from 'react';
import toast from 'react-hot-toast';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import * as exportService from '@/services/export.service';

type Format = 'png' | 'jpg' | 'webp' | 'avif' | 'bmp' | 'tiff' | 'svg' | 'psd' | 'pdf';

const FORMAT_INFO: Record<Format, { label: string; lossy: boolean; note?: string }> = {
  png: { label: 'PNG', lossy: false },
  jpg: { label: 'JPG', lossy: true },
  webp: { label: 'WebP', lossy: true, note: 'Suele pesar ~30% menos que PNG con calidad similar.' },
  avif: { label: 'AVIF', lossy: true, note: 'Suele pesar ~50% menos que PNG. Formato más nuevo, menos compatible.' },
  bmp: { label: 'BMP', lossy: false, note: 'Sin compresión — pensado para compatibilidad con software legacy.' },
  tiff: { label: 'TIFF', lossy: false, note: 'Sin compresión, con canal alfa — para impresión profesional.' },
  psd: { label: 'PSD', lossy: false, note: 'Con capas (nombre, opacidad, visibilidad y modo de fusión) para abrir en Photoshop, Krita o Clip Studio. No incluye máscaras, ajustes ni estilos de capa.' },
  pdf: { label: 'PDF', lossy: true, note: 'Una página con el tamaño físico según los DPI del proyecto (para imprimir o enviar). Con «sin pérdida» el archivo pesa más.' },
  svg: { label: 'SVG', lossy: false },
};

export default function ExportDialog() {
  const show = useUIStore((s) => s.showExportDialog);
  const close = useUIStore((s) => s.closeExportDialog);
  const project = useAppStore((s) => s.project);
  const [format, setFormat] = useState<Format>('png');
  const [quality, setQuality] = useState(92);
  const [exporting, setExporting] = useState(false);
  const [pdfLossless, setPdfLossless] = useState(false);
  const [svgVector, setSvgVector] = useState(true);
  const [svgColors, setSvgColors] = useState(12);
  const [svgDetail, setSvgDetail] = useState(1);
  const [svgSmooth, setSvgSmooth] = useState(true);

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
          result = svgVector
            ? await exportService.exportVectorSVG(project!, { colors: svgColors, tolerance: svgDetail, minArea: 6, smooth: svgSmooth })
            : await exportService.exportSVG(project!);
          break;
        case 'psd':
          result = await exportService.exportPSD(project!);
          break;
        case 'pdf':
          result = await exportService.exportPDF(project!, { lossless: pdfLossless, quality: quality / 100 });
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

        {format === 'svg' && (
          <div className="space-y-2 mb-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={svgVector} onChange={(e) => setSvgVector(e.target.checked)} />
              Vectorizar (formas editables, una capa SVG por capa)
            </label>
            {svgVector ? (
              <>
                <label className="block text-[11px] text-textDim">Colores por capa: {svgColors}
                  <input type="range" min={2} max={32} value={svgColors} onChange={(e) => setSvgColors(Number(e.target.value))} className="w-full" />
                </label>
                <label className="block text-[11px] text-textDim">Detalle: {svgDetail <= 0.6 ? 'alto' : svgDetail <= 1.6 ? 'medio' : 'bajo (menos nodos)'}
                  <input type="range" min={0.3} max={3} step={0.1} value={svgDetail} onChange={(e) => setSvgDetail(Number(e.target.value))} className="w-full" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-textDim">
                  <input type="checkbox" checked={svgSmooth} onChange={(e) => setSvgSmooth(e.target.checked)} /> Suavizar contornos con curvas
                </label>
                <p className="text-[10px] text-textDim">Es un trazado automático: los degradados pasan a bandas de color plano, las transparencias parciales se vuelven opacas (la opacidad de cada capa sí se conserva) y la textura fina se pierde.</p>
              </>
            ) : (
              <p className="text-[10px] text-textDim">La imagen aplanada dentro de un SVG: válido en cualquier sitio, pero no son formas editables.</p>
            )}
          </div>
        )}

        {format === 'pdf' && (
          <label className="flex items-center gap-2 text-xs mb-3">
            <input type="checkbox" checked={pdfLossless} onChange={(e) => setPdfLossless(e.target.checked)} />
            Sin pérdida (más pesado)
          </label>
        )}

        {info.lossy && !(format === 'pdf' && pdfLossless) && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>Calidad</span>
              <span>{quality}%</span>
            </div>
            <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </div>
        )}

        <p className="text-xs text-textDim mb-4">
          {project.width} × {project.height}px{format === 'pdf' ? ` · página de ${((project.width / (project.dpi || 72)) * 2.54).toFixed(1)} × ${((project.height / (project.dpi || 72)) * 2.54).toFixed(1)} cm a ${project.dpi || 72} DPI` : ''}
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

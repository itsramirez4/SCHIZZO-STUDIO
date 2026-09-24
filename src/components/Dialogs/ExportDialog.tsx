import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import * as exportService from '@/services/export.service';

type Format = 'png' | 'jpg' | 'webp' | 'avif' | 'bmp' | 'tiff' | 'svg' | 'psd' | 'pdf';

// label/lossy are format facts, not translatable text; `noteKey` (when present) looks up
// dialogs.json's newProject.export.formats.<noteKey> for the explanatory note.
const FORMAT_INFO: Record<Format, { label: string; lossy: boolean; noteKey?: string }> = {
  png: { label: 'PNG', lossy: false },
  jpg: { label: 'JPG', lossy: true },
  webp: { label: 'WebP', lossy: true, noteKey: 'webpNote' },
  avif: { label: 'AVIF', lossy: true, noteKey: 'avifNote' },
  bmp: { label: 'BMP', lossy: false, noteKey: 'bmpNote' },
  tiff: { label: 'TIFF', lossy: false, noteKey: 'tiffNote' },
  psd: { label: 'PSD', lossy: false, noteKey: 'psdNote' },
  pdf: { label: 'PDF', lossy: true, noteKey: 'pdfNote' },
  svg: { label: 'SVG', lossy: false },
};

export default function ExportDialog() {
  const { t } = useTranslation('dialogs');
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
        toast.success(t('export.successToast'));
        close();
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t('export.errorToast'));
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const info = FORMAT_INFO[format];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-96 p-5">
        <h2 className="text-lg font-semibold mb-4">{t('export.title')}</h2>

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(Object.keys(FORMAT_INFO) as Format[]).filter((f) => f !== 'avif' || exportService.canEncodeAvif()).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`py-1.5 rounded text-xs uppercase ${format === f ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
            >
              {FORMAT_INFO[f].label}
            </button>
          ))}
        </div>

        {info.noteKey && <p className="text-[11px] text-textDim mb-3">{t(`export.formats.${info.noteKey}`)}</p>}

        {format === 'svg' && (
          <div className="space-y-2 mb-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={svgVector} onChange={(e) => setSvgVector(e.target.checked)} />
              {t('export.vectorize')}
            </label>
            {svgVector ? (
              <>
                <label className="block text-[11px] text-textDim">{t('export.colorsPerLayer', { count: svgColors })}
                  <input type="range" min={2} max={32} value={svgColors} onChange={(e) => setSvgColors(Number(e.target.value))} className="w-full" />
                </label>
                <label className="block text-[11px] text-textDim">
                  {t('export.detail', { level: svgDetail <= 0.6 ? t('export.detailHigh') : svgDetail <= 1.6 ? t('export.detailMedium') : t('export.detailLow') })}
                  <input type="range" min={0.3} max={3} step={0.1} value={svgDetail} onChange={(e) => setSvgDetail(Number(e.target.value))} className="w-full" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-textDim">
                  <input type="checkbox" checked={svgSmooth} onChange={(e) => setSvgSmooth(e.target.checked)} /> {t('export.smoothOutlines')}
                </label>
                <p className="text-[10px] text-textDim">{t('export.vectorHint')}</p>
              </>
            ) : (
              <p className="text-[10px] text-textDim">{t('export.flatSvgHint')}</p>
            )}
          </div>
        )}

        {format === 'pdf' && (
          <label className="flex items-center gap-2 text-xs mb-3">
            <input type="checkbox" checked={pdfLossless} onChange={(e) => setPdfLossless(e.target.checked)} />
            {t('export.losslessPdf')}
          </label>
        )}

        {info.lossy && !(format === 'pdf' && pdfLossless) && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-textDim mb-1">
              <span>{t('export.quality')}</span>
              <span>{quality}%</span>
            </div>
            <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </div>
        )}

        <p className="text-xs text-textDim mb-4">
          {t('export.dimensions', { width: project.width, height: project.height })}
          {format === 'pdf'
            ? t('export.pdfPageInfo', {
                widthCm: ((project.width / (project.dpi || 72)) * 2.54).toFixed(1),
                heightCm: ((project.height / (project.dpi || 72)) * 2.54).toFixed(1),
                dpi: project.dpi || 72,
              })
            : ''}
        </p>

        <div className="flex justify-end gap-2">
          <button onClick={close} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
            {t('common:cancel')}
          </button>
          <button onClick={handleExport} disabled={exporting} className="px-3 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-50">
            {exporting ? t('export.exporting') : t('export.export')}
          </button>
        </div>
      </div>
    </div>
  );
}

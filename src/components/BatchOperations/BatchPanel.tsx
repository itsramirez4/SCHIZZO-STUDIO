import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { canEncodeAvif } from '@/services/export.service';
import { BatchFilterConfig, BatchItem, BatchOutputFormat, BatchResizeConfig, BATCH_FORMAT_LABELS } from '@/types/batchOperations';
import { processBatchImage, resizeToCanvas, encodeCanvas } from '@/services/batchImage.service';
import { isElectron, sanitizeFilename, downloadDataUrl } from '@/utils/fileUtils';
import { SIZE_PRESETS, SIZE_PRESET_CATEGORY_LABELS, SizePreset } from '@/data/sizePresets';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import * as layerService from '@/services/layer.service';

const DEFAULT_RESIZE: BatchResizeConfig = { enabled: false, width: 1024, height: 1024, mode: 'fit' };
const DEFAULT_FILTERS: BatchFilterConfig = { brightness: 0, contrast: 0, saturation: 0, sepia: 0, grayscale: false, invert: false };
const SIZE_CATEGORY_ORDER: SizePreset['category'][] = ['web', 'print', 'social', 'ui'];

export default function BatchPanel() {
  const { t } = useTranslation('panelsProduction');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [resize, setResize] = useState<BatchResizeConfig>(DEFAULT_RESIZE);
  const [filters, setFilters] = useState<BatchFilterConfig>(DEFAULT_FILTERS);
  const [format, setFormat] = useState<BatchOutputFormat>('png');
  const [quality, setQuality] = useState(0.9);
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const project = useAppStore((s) => s.project);
  const { layers } = useLayers();
  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<string>>(new Set());
  const [sizesFormat, setSizesFormat] = useState<BatchOutputFormat>('png');
  const [exportingSizes, setExportingSizes] = useState(false);

  function toggleSize(id: string) {
    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function exportAtSizes() {
    if (!project || selectedSizeIds.size === 0) return;
    setExportingSizes(true);
    try {
      const flattened = layerService.flattenLayers(layers, project.width, project.height);
      const targets = SIZE_PRESETS.filter((p) => selectedSizeIds.has(p.id));
      const files = targets.map((p) => {
        const resized = resizeToCanvas(flattened, p.width, p.height, 'fit');
        return { name: `${sanitizeFilename(project.name)}-${p.id}.${sizesFormat}`, dataUrl: encodeCanvas(resized, sizesFormat, quality) };
      });

      if (isElectron()) {
        const result = await window.electronAPI.exportBatch(files, sanitizeFilename(project.name));
        if (!result.canceled) toast.success(t('batch.sizesSection.exportedToast', { count: files.length }));
      } else {
        files.forEach((f) => downloadDataUrl(f.dataUrl, f.name));
      }
    } finally {
      setExportingSizes(false);
    }
  }

  const doneCount = items.filter((i) => i.status === 'done').length;
  const supportsQuality = format === 'jpg' || format === 'webp' || format === 'avif';

  async function handleImport() {
    if (!isElectron()) {
      toast.error(t('batch.importDesktopOnlyToast'));
      return;
    }
    const result = await window.electronAPI.importImages();
    if (result.canceled || result.files.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...result.files.map((f) => ({ id: uuid(), name: f.name, sourceDataUrl: f.dataUrl, status: 'pending' as const })),
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearAll() {
    setItems([]);
  }

  async function processAll() {
    if (items.length === 0) return;
    setProcessing(true);
    try {
      // Sequential: canvas filter/encode work is single-threaded main-thread work regardless —
      // "concurrency" here wouldn't provide real parallelism without workers, so this stays
      // honest about what it actually does instead of exposing a fake concurrency knob.
      for (const item of items) {
        if (item.status === 'done') continue;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'processing' } : i)));
        try {
          const resultDataUrl = await processBatchImage(item.sourceDataUrl, resize, filters, format, quality);
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'done', resultDataUrl } : i)));
        } catch (err) {
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: (err as Error).message } : i)));
        }
      }
    } finally {
      setProcessing(false);
    }
  }

  async function exportAll() {
    const done = items.filter((i) => i.status === 'done' && i.resultDataUrl);
    if (done.length === 0) return;
    setExporting(true);
    try {
      const files = done.map((i) => ({
        name: `${sanitizeFilename(i.name.replace(/\.[^.]+$/, ''))}.${format}`,
        dataUrl: i.resultDataUrl!,
      }));

      if (isElectron()) {
        const result = await window.electronAPI.exportBatch(files, t('batch.exportZipName'));
        if (!result.canceled) toast.success(t('batch.exportedToast', { count: done.length }));
      } else {
        files.forEach((f) => downloadDataUrl(f.dataUrl, f.name));
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">{t('batch.sizesSection.title')}</div>
        <p className="text-[9px] text-textDim">{t('batch.sizesSection.hint')}</p>
        <div className="max-h-32 overflow-y-auto space-y-1.5">
          {SIZE_CATEGORY_ORDER.map((category) => (
            <div key={category}>
              <div className="text-[9px] text-textDim uppercase tracking-wide mb-0.5">{SIZE_PRESET_CATEGORY_LABELS[category]}</div>
              {SIZE_PRESETS.filter((p) => p.category === category).map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-[10px] text-textDim">
                  <input type="checkbox" checked={selectedSizeIds.has(p.id)} onChange={() => toggleSize(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={sizesFormat}
            onChange={(e) => setSizesFormat(e.target.value as BatchOutputFormat)}
            className="flex-1 bg-panel border border-border rounded text-[10px] px-1.5 py-1"
          >
            {(Object.keys(BATCH_FORMAT_LABELS) as BatchOutputFormat[]).filter((f) => f !== 'avif' || canEncodeAvif()).map((f) => (
              <option key={f} value={f}>{BATCH_FORMAT_LABELS[f]}</option>
            ))}
          </select>
          <button
            onClick={exportAtSizes}
            disabled={!project || selectedSizeIds.size === 0 || exportingSizes}
            className="bg-accent text-white text-xs rounded px-3 py-1.5 disabled:opacity-40"
          >
            {exportingSizes ? t('batch.sizesSection.exporting') : t('batch.sizesSection.exportButton', { count: selectedSizeIds.size })}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button onClick={handleImport} className="flex-1 bg-panelLight text-xs rounded py-1.5">
          {t('batch.importButton')}
        </button>
        <button onClick={clearAll} disabled={items.length === 0} className="bg-panelLight text-xs rounded px-2 disabled:opacity-40">
          {t('batch.clear')}
        </button>
      </div>

      <div className="border border-border rounded p-2 space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10px] text-textDim">
          <input type="checkbox" checked={resize.enabled} onChange={(e) => setResize((r) => ({ ...r, enabled: e.target.checked }))} />
          {t('batch.resize')}
        </label>
        {resize.enabled && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={resize.width}
              onChange={(e) => setResize((r) => ({ ...r, width: Math.max(1, Number(e.target.value)) }))}
              className="w-16 bg-panel border border-border rounded px-1 py-0.5 text-[10px]"
            />
            <span className="text-textDim text-[10px]">×</span>
            <input
              type="number"
              min={1}
              value={resize.height}
              onChange={(e) => setResize((r) => ({ ...r, height: Math.max(1, Number(e.target.value)) }))}
              className="w-16 bg-panel border border-border rounded px-1 py-0.5 text-[10px]"
            />
            <select
              value={resize.mode}
              onChange={(e) => setResize((r) => ({ ...r, mode: e.target.value as BatchResizeConfig['mode'] }))}
              className="flex-1 bg-panel border border-border rounded text-[10px] px-1 py-0.5"
            >
              <option value="fit">{t('batch.resizeModeFit')}</option>
              <option value="fill">{t('batch.resizeModeFill')}</option>
              <option value="exact">{t('batch.resizeModeExact')}</option>
            </select>
          </div>
        )}
      </div>

      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">{t('batch.filters.title')}</div>
        {(['brightness', 'contrast', 'saturation'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">{key === 'brightness' ? t('batch.filters.brightness') : key === 'contrast' ? t('batch.filters.contrast') : t('batch.filters.saturation')}</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={filters[key]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: Number(e.target.value) }))}
              className="flex-1"
            />
            <span className="w-8 text-right">{filters[key]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[10px] text-textDim">
          <span className="w-16 shrink-0">{t('batch.filters.sepia')}</span>
          <input type="range" min={0} max={100} value={filters.sepia} onChange={(e) => setFilters((f) => ({ ...f, sepia: Number(e.target.value) }))} className="flex-1" />
          <span className="w-8 text-right">{filters.sepia}</span>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={filters.grayscale} onChange={(e) => setFilters((f) => ({ ...f, grayscale: e.target.checked }))} />
            {t('batch.filters.grayscale')}
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={filters.invert} onChange={(e) => setFilters((f) => ({ ...f, invert: e.target.checked }))} />
            {t('batch.filters.invert')}
          </label>
        </div>
      </div>

      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-textDim uppercase tracking-wide">{t('batch.outputFormat')}</div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as BatchOutputFormat)}
          className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
        >
          {(Object.keys(BATCH_FORMAT_LABELS) as BatchOutputFormat[]).filter((f) => f !== 'avif' || canEncodeAvif()).map((f) => (
            <option key={f} value={f}>
              {BATCH_FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
        {supportsQuality && (
          <div className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">{t('batch.quality')}</span>
            <input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right">{Math.round(quality * 100)}%</span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={processAll}
          disabled={items.length === 0 || processing}
          className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40"
        >
          {processing ? t('batch.processing') : `${t('batch.process')}${items.length ? ` (${items.length})` : ''}`}
        </button>
        <button
          onClick={exportAll}
          disabled={doneCount === 0 || exporting}
          className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
        >
          {exporting ? t('batch.exporting') : t('batch.exportButton', { count: doneCount })}
        </button>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <div key={item.id} className="border border-border rounded overflow-hidden relative">
              <img src={item.resultDataUrl ?? item.sourceDataUrl} className="w-full h-14 object-cover bg-panel" />
              <button onClick={() => removeItem(item.id)} className="absolute top-0.5 right-0.5 bg-black/50 text-white text-[9px] rounded px-1">
                ✕
              </button>
              <div className="px-1 py-0.5">
                <div className="text-[9px] text-textDim truncate">{item.name}</div>
                <div
                  className={`text-[9px] ${
                    item.status === 'done'
                      ? 'text-green-400'
                      : item.status === 'error'
                        ? 'text-red-400'
                        : item.status === 'processing'
                          ? 'text-accent'
                          : 'text-textDim'
                  }`}
                >
                  {item.status === 'pending' && t('batch.status.pending')}
                  {item.status === 'processing' && t('batch.status.processing')}
                  {item.status === 'done' && t('batch.status.done')}
                  {item.status === 'error' && (item.error ?? t('batch.status.error'))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

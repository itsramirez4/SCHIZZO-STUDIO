import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { useLayers } from '@/hooks/useLayers';
import { useTools } from '@/hooks/useTools';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { PATTERN_PRESETS, getPatternTile, fillWithPattern } from '@/services/pattern.service';
import { createPatternFromImage, applyCustomPatternFill } from '@/services/customPattern.service';
import { filterAssets } from '@/services/assetSearch.service';
import { dataUrlToImage } from '@/utils/canvasUtils';
import { isElectron } from '@/utils/fileUtils';
import AssetGrid from './AssetGrid';

type Selection = { type: 'preset'; id: string } | { type: 'custom'; id: string } | null;

export default function PatternLibraryTab() {
  const { t } = useTranslation('panelsColor');
  const { patterns, addPattern, removePattern, togglePatternFavorite } = useAssetLibraryStore();
  const { currentLayer } = useLayers();
  const { primaryColor } = useTools();
  const selectionRect = useAppStore((s) => s.selection);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Selection>({ type: 'preset', id: PATTERN_PRESETS[0].id });
  const [busy, setBusy] = useState(false);

  const filteredCustom = filterAssets(patterns, { text: search });

  async function importPattern() {
    if (!isElectron()) {
      toast.error(t('patternLibraryTab.errorElectronOnly'));
      return;
    }
    const result = await window.electronAPI.importImages();
    if (result.canceled || result.files.length === 0) return;
    setBusy(true);
    try {
      const img = await dataUrlToImage(result.files[0].dataUrl);
      const pattern = createPatternFromImage(img, result.files[0].name.replace(/\.[^.]+$/, ''));
      addPattern(pattern);
      setSelected({ type: 'custom', id: pattern.id });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!currentLayer || !selected) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;

    if (selected.type === 'preset') {
      fillWithPattern(canvas, selected.id, primaryColor, selectionRect ?? undefined);
      pushHistory(t('patternLibraryTab.fillHistory'));
    } else {
      const pattern = patterns.find((p) => p.id === selected.id);
      if (!pattern) return;
      const img = await dataUrlToImage(pattern.tileDataUrl);
      applyCustomPatternFill(canvas, pattern, img, selectionRect ?? undefined);
      pushHistory(t('patternLibraryTab.fillHistoryNamed', { name: pattern.name }));
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] text-textDim mb-1">{t('patternLibraryTab.presets')}</div>
        <div className="grid grid-cols-6 gap-1">
          {PATTERN_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected({ type: 'preset', id: p.id })}
              title={p.name}
              className={`aspect-square rounded border overflow-hidden ${
                selected?.type === 'preset' && selected.id === p.id ? 'border-accent' : 'border-border'
              }`}
              style={{
                backgroundImage: `url(${getPatternTile(p.id, primaryColor).toDataURL()})`,
                backgroundSize: '10px 10px',
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-textDim">{t('patternLibraryTab.custom')}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('patternLibraryTab.searchPlaceholder')}
            className="bg-panel border border-border rounded px-1.5 py-0.5 text-[10px] w-24"
          />
        </div>
        <AssetGrid
          items={filteredCustom}
          getId={(p) => p.id}
          getName={(p) => p.name}
          getFavorite={(p) => p.favorite}
          renderPreview={(p) => <img src={p.tileDataUrl} className="w-full h-full object-cover" />}
          onSelect={(p) => setSelected({ type: 'custom', id: p.id })}
          onToggleFavorite={(p) => togglePatternFavorite(p.id)}
          onDelete={(p) => removePattern(p.id)}
          emptyMessage={t('patternLibraryTab.emptyMessage')}
        />
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={apply}
          disabled={!currentLayer || !selected}
          className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40"
        >
          {t('patternLibraryTab.fillWithPattern', { target: selectionRect ? t('patternLibraryTab.targetSelection') : t('patternLibraryTab.targetLayer') })}
        </button>
        <button onClick={importPattern} disabled={busy} className="bg-panelLight text-xs rounded px-2 disabled:opacity-40">
          {busy ? t('patternLibraryTab.loading') : t('patternLibraryTab.import')}
        </button>
      </div>
    </div>
  );
}

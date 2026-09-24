import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { createGradient, generatePreview, applyGradientFill } from '@/services/gradientLibrary.service';
import { filterAssets } from '@/services/assetSearch.service';
import { GradientStop } from '@/types/assetLibrary';
import AssetGrid from './AssetGrid';

export default function GradientLibraryTab() {
  const { t } = useTranslation('panelsColor');
  const { gradients, addGradient, removeGradient, toggleGradientFavorite } = useAssetLibraryStore();
  const { currentLayer } = useLayers();
  const selection = useAppStore((s) => s.selection);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const [search, setSearch] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(gradients[0]?.id ?? null);
  const [showEditor, setShowEditor] = useState(false);
  const [name, setName] = useState(t('gradientLibraryTab.defaultName'));
  const [kind, setKind] = useState<'linear' | 'radial'>('linear');
  const [stops, setStops] = useState<GradientStop[]>([
    { position: 0, color: '#000000' },
    { position: 1, color: '#ffffff' },
  ]);

  const filtered = filterAssets(gradients, { text: search, favoriteOnly });
  const previews = useMemo(() => {
    const map = new Map<string, string>();
    gradients.forEach((g) => map.set(g.id, generatePreview(g)));
    return map;
  }, [gradients]);

  const selected = gradients.find((g) => g.id === selectedId) ?? null;

  function apply() {
    if (!currentLayer || !selected) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    applyGradientFill(canvas, selected, selection ?? undefined);
    pushHistory(t('gradientLibraryTab.fillHistory', { name: selected.name }));
  }

  function saveNew() {
    const gradient = createGradient(name.trim() || t('gradientLibraryTab.defaultName'), stops, kind);
    addGradient(gradient);
    setSelectedId(gradient.id);
    setShowEditor(false);
  }

  function updateStop(index: number, patch: Partial<GradientStop>) {
    setStops((s) => s.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('gradientLibraryTab.searchPlaceholder')}
          className="flex-1 bg-panel border border-border rounded px-2 py-1 text-[11px]"
        />
        <button
          onClick={() => setFavoriteOnly((v) => !v)}
          title={t('gradientLibraryTab.favoritesOnly')}
          className={`px-2 rounded border ${favoriteOnly ? 'bg-accent border-accent' : 'border-border'}`}
        >
          <Star size={12} className={favoriteOnly ? 'fill-white text-white' : 'text-textDim'} />
        </button>
      </div>

      <AssetGrid
        items={filtered}
        getId={(g) => g.id}
        getName={(g) => g.name}
        getFavorite={(g) => g.favorite}
        renderPreview={(g) => <img src={previews.get(g.id)} className="w-full h-full object-cover" />}
        onSelect={(g) => setSelectedId(g.id)}
        onToggleFavorite={(g) => toggleGradientFavorite(g.id)}
        canDelete={(g) => !g.builtIn}
        onDelete={(g) => removeGradient(g.id)}
        emptyMessage={t('gradientLibraryTab.emptyMessage')}
      />

      <div className="flex gap-1.5">
        <button
          onClick={apply}
          disabled={!currentLayer || !selected}
          className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40"
        >
          {t('gradientLibraryTab.fillWith', { target: selection ? t('gradientLibraryTab.targetSelection') : t('gradientLibraryTab.targetLayer'), name: selected?.name ?? '—' })}
        </button>
        <button onClick={() => setShowEditor((v) => !v)} className="bg-panelLight text-xs rounded px-2">
          {showEditor ? t('common:cancel') : t('gradientLibraryTab.new')}
        </button>
      </div>

      {showEditor && (
        <div className="border border-border rounded p-2 space-y-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('gradientLibraryTab.namePlaceholder')}
            className="w-full bg-panel border border-border rounded px-2 py-1 text-[11px]"
          />
          <div className="flex gap-1">
            {(['linear', 'radial'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 text-[10px] rounded py-1 border ${kind === k ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
              >
                {k === 'linear' ? t('gradientLibraryTab.linear') : t('gradientLibraryTab.radial')}
              </button>
            ))}
          </div>
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(i, { color: e.target.value })}
                className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(stop.position * 100)}
                onChange={(e) => updateStop(i, { position: Number(e.target.value) / 100 })}
                className="flex-1"
              />
              <span className="text-[9px] text-textDim w-8 text-right">{Math.round(stop.position * 100)}%</span>
              {stops.length > 2 && (
                <button onClick={() => setStops((s) => s.filter((_, idx) => idx !== i))} className="text-[10px] text-textDim hover:text-red-400">
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-1.5">
            <button
              onClick={() => setStops((s) => [...s, { position: 0.5, color: '#808080' }])}
              className="flex-1 bg-panelLight text-[10px] rounded py-1"
            >
              {t('gradientLibraryTab.addPoint')}
            </button>
            <button onClick={saveNew} className="flex-1 bg-accent text-white text-[10px] rounded py-1">
              {t('gradientLibraryTab.saveToLibrary')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

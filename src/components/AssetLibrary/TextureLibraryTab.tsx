import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { createTextureFromImage, applyTextureFill } from '@/services/textureLibrary.service';
import { filterAssets } from '@/services/assetSearch.service';
import { dataUrlToImage } from '@/utils/canvasUtils';
import { isElectron } from '@/utils/fileUtils';
import AssetGrid from './AssetGrid';

export default function TextureLibraryTab() {
  const { t } = useTranslation('panelsColor');
  const { textures, addTexture, removeTexture, toggleTextureFavorite } = useAssetLibraryStore();
  const { currentLayer } = useLayers();
  const selection = useAppStore((s) => s.selection);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'tile' | 'stretch'>('tile');
  const [busy, setBusy] = useState(false);

  const filtered = filterAssets(textures, { text: search });
  const selected = textures.find((t) => t.id === selectedId) ?? null;

  async function importTexture() {
    if (!isElectron()) {
      toast.error(t('textureLibraryTab.errorElectronOnly'));
      return;
    }
    const result = await window.electronAPI.importImages();
    if (result.canceled || result.files.length === 0) return;
    setBusy(true);
    try {
      const img = await dataUrlToImage(result.files[0].dataUrl);
      const texture = createTextureFromImage(img, result.files[0].name.replace(/\.[^.]+$/, ''));
      addTexture(texture);
      setSelectedId(texture.id);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!currentLayer || !selected) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    const img = await dataUrlToImage(selected.dataUrl);
    applyTextureFill(canvas, img, mode, selection ?? undefined);
    pushHistory(t('textureLibraryTab.fillHistory', { name: selected.name }));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('textureLibraryTab.searchPlaceholder')}
          className="flex-1 bg-panel border border-border rounded px-2 py-1 text-[11px]"
        />
        <button onClick={importTexture} disabled={busy} className="bg-panelLight text-[11px] rounded px-2 disabled:opacity-40">
          {busy ? t('textureLibraryTab.loading') : t('textureLibraryTab.import')}
        </button>
      </div>

      <AssetGrid
        items={filtered}
        getId={(tex) => tex.id}
        getName={(tex) => tex.name}
        getFavorite={(tex) => tex.favorite}
        renderPreview={(tex) => <img src={tex.dataUrl} className="w-full h-full object-cover" />}
        onSelect={(tex) => setSelectedId(tex.id)}
        onToggleFavorite={(tex) => toggleTextureFavorite(tex.id)}
        onDelete={(tex) => removeTexture(tex.id)}
        emptyMessage={t('textureLibraryTab.emptyMessage')}
      />

      <div className="flex gap-1">
        {(['tile', 'stretch'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-[10px] rounded py-1 border ${mode === m ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
          >
            {m === 'tile' ? t('textureLibraryTab.tile') : t('textureLibraryTab.stretch')}
          </button>
        ))}
      </div>

      <button
        onClick={apply}
        disabled={!currentLayer || !selected}
        className="w-full bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40"
      >
        {t('textureLibraryTab.fillWith', { target: selection ? t('textureLibraryTab.targetSelection') : t('textureLibraryTab.targetLayer'), name: selected?.name ?? '—' })}
      </button>
    </div>
  );
}

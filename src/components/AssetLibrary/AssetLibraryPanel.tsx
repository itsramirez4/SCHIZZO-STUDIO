import { useEffect, useState } from 'react';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import BrushLibraryTab from './BrushLibraryTab';
import PatternLibraryTab from './PatternLibraryTab';
import GradientLibraryTab from './GradientLibraryTab';
import TextureLibraryTab from './TextureLibraryTab';

type Tab = 'brush' | 'pattern' | 'gradient' | 'texture';

const TABS: { id: Tab; label: string }[] = [
  { id: 'brush', label: 'Pinceles' },
  { id: 'pattern', label: 'Patrones' },
  { id: 'gradient', label: 'Degradados' },
  { id: 'texture', label: 'Texturas' },
];

/** Local component state for the active tab, same convention as every other tool panel this
 * session (ColorToolsPanel, ComicPanel, ...) — the actual asset data lives in
 * assetLibraryStore/appStore, not here. */
export default function AssetLibraryPanel() {
  const [tab, setTab] = useState<Tab>('brush');
  const loadLibrary = useAssetLibraryStore((s) => s.loadLibrary);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-2 text-[11px] whitespace-nowrap border-b-2 ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'brush' && <BrushLibraryTab />}
        {tab === 'pattern' && <PatternLibraryTab />}
        {tab === 'gradient' && <GradientLibraryTab />}
        {tab === 'texture' && <TextureLibraryTab />}
      </div>
    </div>
  );
}

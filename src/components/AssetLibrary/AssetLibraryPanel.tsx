import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';
import BrushLibraryTab from './BrushLibraryTab';
import PatternLibraryTab from './PatternLibraryTab';
import GradientLibraryTab from './GradientLibraryTab';
import TextureLibraryTab from './TextureLibraryTab';

type Tab = 'brush' | 'pattern' | 'gradient' | 'texture';

const TAB_KEYS: { id: Tab; labelKey: string }[] = [
  { id: 'brush', labelKey: 'assetLibraryPanel.tabs.brush' },
  { id: 'pattern', labelKey: 'assetLibraryPanel.tabs.pattern' },
  { id: 'gradient', labelKey: 'assetLibraryPanel.tabs.gradient' },
  { id: 'texture', labelKey: 'assetLibraryPanel.tabs.texture' },
];

/** Local component state for the active tab, same convention as every other tool panel this
 * session (ColorToolsPanel, ComicPanel, ...) — the actual asset data lives in
 * assetLibraryStore/appStore, not here. */
export default function AssetLibraryPanel() {
  const { t } = useTranslation('panelsColor');
  const [tab, setTab] = useState<Tab>('brush');
  const loadLibrary = useAssetLibraryStore((s) => s.loadLibrary);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap border-b border-border shrink-0">
        {TAB_KEYS.map((tabInfo) => (
          <button
            key={tabInfo.id}
            onClick={() => setTab(tabInfo.id)}
            className={`px-2.5 py-2 text-[11px] whitespace-nowrap border-b-2 ${
              tab === tabInfo.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {t(tabInfo.labelKey)}
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

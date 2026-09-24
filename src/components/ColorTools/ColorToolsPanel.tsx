import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ColorBlindnessSimulator from './ColorBlindnessSimulator';
import HarmonyGenerator from './HarmonyGenerator';
import PaletteExtractor from './PaletteExtractor';
import ColorSpaceConverter from './ColorSpaceConverter';
import AccessibilityChecker from './AccessibilityChecker';
import PrintWorkspace from './PrintWorkspace';
import ColorNamePanel from './ColorNamePanel';
import MoodPaletteGenerator from './MoodPaletteGenerator';
import PaletteLibraryPanel from './PaletteLibraryPanel';
import PigmentMixer from './PigmentMixer';
import { useAssetLibraryStore } from '@/store/assetLibraryStore';

type Tab = 'blindness' | 'harmony' | 'extraction' | 'converter' | 'accessibility' | 'print' | 'naming' | 'mood' | 'library' | 'pigment';

const TAB_KEYS: { id: Tab; labelKey: string }[] = [
  { id: 'blindness', labelKey: 'colorToolsPanel.tabs.blindness' },
  { id: 'pigment', labelKey: 'colorToolsPanel.tabs.pigment' },
  { id: 'harmony', labelKey: 'colorToolsPanel.tabs.harmony' },
  { id: 'extraction', labelKey: 'colorToolsPanel.tabs.extraction' },
  { id: 'mood', labelKey: 'colorToolsPanel.tabs.mood' },
  { id: 'naming', labelKey: 'colorToolsPanel.tabs.naming' },
  { id: 'library', labelKey: 'colorToolsPanel.tabs.library' },
  { id: 'converter', labelKey: 'colorToolsPanel.tabs.converter' },
  { id: 'accessibility', labelKey: 'colorToolsPanel.tabs.accessibility' },
  { id: 'print', labelKey: 'colorToolsPanel.tabs.print' },
];

/**
 * Local component state throughout this panel and its sub-tabs, deliberately — not a
 * dedicated Zustand store. Every other "tool panel" added this session (PixelArtFilters,
 * AtmosphericFilters, ComicPanel) works the same way; a standalone colorToolsStore would be
 * the one inconsistent exception for no real benefit, since nothing here needs to be read
 * from outside this panel.
 */
export default function ColorToolsPanel() {
  const { t } = useTranslation('panelsColor');
  const [tab, setTab] = useState<Tab>('blindness');
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
        {tab === 'blindness' && <ColorBlindnessSimulator />}
        {tab === 'pigment' && <PigmentMixer />}
        {tab === 'harmony' && <HarmonyGenerator />}
        {tab === 'extraction' && <PaletteExtractor />}
        {tab === 'mood' && <MoodPaletteGenerator />}
        {tab === 'naming' && <ColorNamePanel />}
        {tab === 'library' && <PaletteLibraryPanel />}
        {tab === 'converter' && <ColorSpaceConverter />}
        {tab === 'accessibility' && <AccessibilityChecker />}
        {tab === 'print' && <PrintWorkspace />}
      </div>
    </div>
  );
}

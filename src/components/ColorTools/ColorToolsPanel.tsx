import { useState } from 'react';
import ColorBlindnessSimulator from './ColorBlindnessSimulator';
import HarmonyGenerator from './HarmonyGenerator';
import PaletteExtractor from './PaletteExtractor';
import ColorSpaceConverter from './ColorSpaceConverter';
import AccessibilityChecker from './AccessibilityChecker';

type Tab = 'blindness' | 'harmony' | 'extraction' | 'converter' | 'accessibility';

const TABS: { id: Tab; label: string }[] = [
  { id: 'blindness', label: 'Daltonismo' },
  { id: 'harmony', label: 'Armonía' },
  { id: 'extraction', label: 'Paleta' },
  { id: 'converter', label: 'Espacios' },
  { id: 'accessibility', label: 'Accesibilidad' },
];

/**
 * Local component state throughout this panel and its sub-tabs, deliberately — not a
 * dedicated Zustand store. Every other "tool panel" added this session (PixelArtFilters,
 * AtmosphericFilters, ComicPanel) works the same way; a standalone colorToolsStore would be
 * the one inconsistent exception for no real benefit, since nothing here needs to be read
 * from outside this panel.
 */
export default function ColorToolsPanel() {
  const [tab, setTab] = useState<Tab>('blindness');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border overflow-x-auto shrink-0">
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
        {tab === 'blindness' && <ColorBlindnessSimulator />}
        {tab === 'harmony' && <HarmonyGenerator />}
        {tab === 'extraction' && <PaletteExtractor />}
        {tab === 'converter' && <ColorSpaceConverter />}
        {tab === 'accessibility' && <AccessibilityChecker />}
      </div>
    </div>
  );
}

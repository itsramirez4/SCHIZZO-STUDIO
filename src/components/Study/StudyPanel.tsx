import { useState } from 'react';
import GuidesTab from './GuidesTab';
import AnalyzeTab from './AnalyzeTab';
import AcademyTab, { StudyTabId } from './AcademyTab';
import StylesTab from './StylesTab';
import ModesTab from './ModesTab';

const TABS: { id: StudyTabId; label: string }[] = [
  { id: 'guides', label: 'Guías' },
  { id: 'analyze', label: 'Analizar' },
  { id: 'academy', label: 'Academia' },
  { id: 'styles', label: 'Estilos' },
  { id: 'modes', label: 'Modos' },
];

/** The study hub: construction guides, the "why isn't it working?" tutor, the practice academy
 * and a library of visual traditions to learn from. */
export default function StudyPanel() {
  const [tab, setTab] = useState<StudyTabId>('guides');
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-1 py-2 text-[10px] border-b-2 ${tab === t.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'guides' && <GuidesTab />}
        {tab === 'analyze' && <AnalyzeTab />}
        {tab === 'academy' && <AcademyTab goTab={setTab} />}
        {tab === 'styles' && <StylesTab />}
        {tab === 'modes' && <ModesTab />}
      </div>
    </div>
  );
}

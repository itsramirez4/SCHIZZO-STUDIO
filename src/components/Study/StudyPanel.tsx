import { useState } from 'react';
import GuidesTab from './GuidesTab';
import AnalyzeTab from './AnalyzeTab';
import AcademyTab, { StudyTabId } from './AcademyTab';
import StylesTab from './StylesTab';
import ModesTab from './ModesTab';
import FigureTab from './FigureTab';
import { useAiStore } from '@/store/aiStore';

const TABS: { id: StudyTabId; label: string }[] = [
  { id: 'guides', label: 'Guías' },
  { id: 'analyze', label: 'Analizar' },
  { id: 'figure', label: 'Figura' },
  { id: 'academy', label: 'Academia' },
  { id: 'styles', label: 'Estilos' },
  { id: 'modes', label: 'Modos' },
];

/** The study hub: construction guides, the "why isn't it working?" tutor, the practice academy
 * and a library of visual traditions to learn from. */
export default function StudyPanel() {
  const [tab, setTab] = useState<StudyTabId>('guides');
  const aiEnabled = useAiStore((s) => s.enabled);
  // The automatic analysis is a machine opinion about the drawing: with the AI off it is not offered.
  const tabs = aiEnabled ? TABS : TABS.filter((t) => t.id !== 'analyze');
  const shown = !aiEnabled && tab === 'analyze' ? 'guides' : tab;
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-1 py-2 text-[10px] border-b-2 ${shown === t.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {shown === 'guides' && <GuidesTab />}
        {shown === 'analyze' && <AnalyzeTab />}
        {shown === 'figure' && <FigureTab />}
        {shown === 'academy' && <AcademyTab goTab={setTab} />}
        {shown === 'styles' && <StylesTab />}
        {shown === 'modes' && <ModesTab />}
      </div>
    </div>
  );
}

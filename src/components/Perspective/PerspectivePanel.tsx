import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PerspectiveGridPanel from './PerspectiveGridPanel';
import SymmetryPanel from './SymmetryPanel';
import GuidesPanel from './GuidesPanel';
import RulerPanel from './RulerPanel';

type SubTab = 'grid' | 'symmetry' | 'guides' | 'ruler';

const SUB_TABS: SubTab[] = ['grid', 'symmetry', 'guides', 'ruler'];

export default function PerspectivePanel() {
  const { t } = useTranslation('panelsProduction');
  const [tab, setTab] = useState<SubTab>('grid');

  return (
    <div className="p-3 space-y-3">
      <div className="flex border-b border-border">
        {SUB_TABS.map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 text-[10px] py-1.5 border-b-2 -mb-px ${
              tab === id ? 'border-accent text-text' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {t(`perspective.tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'grid' && <PerspectiveGridPanel />}
      {tab === 'symmetry' && <SymmetryPanel />}
      {tab === 'guides' && <GuidesPanel />}
      {tab === 'ruler' && <RulerPanel />}
    </div>
  );
}

import { useState } from 'react';
import PerspectiveGridPanel from './PerspectiveGridPanel';
import SymmetryPanel from './SymmetryPanel';
import GuidesPanel from './GuidesPanel';

type SubTab = 'grid' | 'symmetry' | 'guides';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'grid', label: 'Perspectiva' },
  { id: 'symmetry', label: 'Simetría' },
  { id: 'guides', label: 'Guías' },
];

export default function PerspectivePanel() {
  const [tab, setTab] = useState<SubTab>('grid');

  return (
    <div className="p-3 space-y-3">
      <div className="flex border-b border-border">
        {SUB_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 text-[10px] py-1.5 border-b-2 -mb-px ${
              tab === id ? 'border-accent text-text' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'grid' && <PerspectiveGridPanel />}
      {tab === 'symmetry' && <SymmetryPanel />}
      {tab === 'guides' && <GuidesPanel />}
    </div>
  );
}

import { useState } from 'react';
import ReferenceLibraryPanel from './ReferenceLibraryPanel';
import GridOverlayPanel from './GridOverlayPanel';
import MirrorViewPanel from './MirrorViewPanel';

type Tab = 'library' | 'grid' | 'mirror';

const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Referencias' },
  { id: 'grid', label: 'Grilla' },
  { id: 'mirror', label: 'Espejo' },
];

/** Local tab state only, same convention as every other tool panel this session. */
export default function ReferencesPanel() {
  const [tab, setTab] = useState<Tab>('library');

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
        {tab === 'library' && <ReferenceLibraryPanel />}
        {tab === 'grid' && <GridOverlayPanel />}
        {tab === 'mirror' && <MirrorViewPanel />}
      </div>
    </div>
  );
}

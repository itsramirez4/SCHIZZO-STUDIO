import { useEffect, useState } from 'react';
import { useCustomizationStore } from '@/store/customizationStore';
import ShortcutsTab from './ShortcutsTab';
import ProfilesTab from './ProfilesTab';
import MacrosTab from './MacrosTab';
import GesturesTab from './GesturesTab';

type SubTab = 'shortcuts' | 'profiles' | 'macros' | 'gestures';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'shortcuts', label: 'Atajos' },
  { id: 'profiles', label: 'Perfiles' },
  { id: 'macros', label: 'Macros' },
  { id: 'gestures', label: 'Gestos' },
];

export default function CustomizationPanel() {
  const loadAll = useCustomizationStore((s) => s.loadAll);
  const [tab, setTab] = useState<SubTab>('shortcuts');

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

      {tab === 'shortcuts' && <ShortcutsTab />}
      {tab === 'profiles' && <ProfilesTab />}
      {tab === 'macros' && <MacrosTab />}
      {tab === 'gestures' && <GesturesTab />}
    </div>
  );
}

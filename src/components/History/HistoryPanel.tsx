import { useTranslation } from 'react-i18next';
import { historyManager, useAppStore } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import { useUIStore } from '@/store/uiStore';
import { Film } from 'lucide-react';

export default function HistoryPanel() {
  const { t } = useTranslation('panelsProject');
  useHistory(); // subscribe so this panel re-renders when history changes
  const jumpToHistory = useAppStore((s) => s.jumpToHistory);
  const openReplayDialog = useUIStore((s) => s.openReplayDialog);
  const stack = historyManager.getStack();
  const pointer = historyManager.getPointer();

  return (
    <div className="p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">{t('history.title')}</h3>
      <button
        onClick={openReplayDialog}
        data-testid="open-replay"
        className="w-full flex items-center justify-center gap-1.5 text-[11px] bg-panelLight hover:bg-border rounded py-1.5 mb-2"
        title={t('history.replayTitle')}
      >
        <Film size={12} /> {t('history.replayButton')}
      </button>
      <ul className="space-y-0.5">
        {stack.map((snap, i) => (
          <li key={snap.id}>
            <button
              onClick={() => jumpToHistory(i)}
              className={`w-full text-left text-xs px-2 py-1 rounded ${i === pointer ? 'bg-accent text-white' : 'text-textDim hover:bg-panelLight'}`}
            >
              {snap.action}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

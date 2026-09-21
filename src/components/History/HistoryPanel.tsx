import { historyManager, useAppStore } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import { useUIStore } from '@/store/uiStore';
import { Film } from 'lucide-react';

export default function HistoryPanel() {
  useHistory(); // subscribe so this panel re-renders when history changes
  const jumpToHistory = useAppStore((s) => s.jumpToHistory);
  const openReplayDialog = useUIStore((s) => s.openReplayDialog);
  const stack = historyManager.getStack();
  const pointer = historyManager.getPointer();

  return (
    <div className="p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">Historial</h3>
      <button
        onClick={openReplayDialog}
        data-testid="open-replay"
        className="w-full flex items-center justify-center gap-1.5 text-[11px] bg-panelLight hover:bg-border rounded py-1.5 mb-2"
        title="Reproduce cómo se hizo el dibujo, paso a paso, y expórtalo como timelapse"
      >
        <Film size={12} /> Reproducir el proceso
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

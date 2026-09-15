import { X, RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAutoSaveStore } from '@/store/autoSaveStore';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export default function AutoSaveDialog() {
  const isOpen = useAutoSaveStore((s) => s.isDialogOpen);
  const close = useAutoSaveStore((s) => s.closeDialog);
  const enabled = useAutoSaveStore((s) => s.enabled);
  const setEnabled = useAutoSaveStore((s) => s.setEnabled);
  const intervalMinutes = useAutoSaveStore((s) => s.intervalMinutes);
  const setIntervalMinutes = useAutoSaveStore((s) => s.setIntervalMinutes);
  const entries = useAutoSaveStore((s) => s.entries);
  const restore = useAutoSaveStore((s) => s.restore);
  const remove = useAutoSaveStore((s) => s.remove);

  if (!isOpen) return null;

  async function handleRestore(id: string, projectName: string) {
    await restore(id);
    toast.success(`"${projectName}" restaurado — usa "Guardar como" para conservarlo`);
    close();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-[440px] max-h-[80vh] flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Copias de seguridad automáticas</h2>
          <button onClick={close} className="text-textDim hover:text-text">
            <X size={18} />
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Auto-guardar mientras trabajo
        </label>

        <label className="flex items-center gap-2 text-xs text-textDim mb-4">
          Cada
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            disabled={!enabled}
            className="bg-panelLight border border-border rounded px-1.5 py-1 disabled:opacity-40"
          >
            <option value={1}>1 minuto</option>
            <option value={3}>3 minutos</option>
            <option value={5}>5 minutos</option>
            <option value={10}>10 minutos</option>
          </select>
        </label>

        <p className="text-[10px] text-textDim mb-2">
          Estas copias se guardan aparte, sin sobrescribir tu archivo — al restaurar una tenés que usar
          "Guardar como" para conservarla.
        </p>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {entries.length === 0 && <p className="text-xs text-textDim py-4 text-center">Todavía no hay copias guardadas.</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 bg-panelLight rounded px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{entry.projectName}</p>
                <p className="text-[10px] text-textDim">
                  {formatRelative(entry.timestamp)} · {formatSize(entry.size)}
                </p>
              </div>
              <button
                onClick={() => handleRestore(entry.id, entry.projectName)}
                title="Restaurar"
                className="icon-btn"
              >
                <RotateCcw size={14} />
              </button>
              <button onClick={() => remove(entry.id)} title="Eliminar" className="icon-btn">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

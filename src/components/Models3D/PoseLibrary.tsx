import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Model3DViewerEngine } from '@/services/model3d.service';
import { SUBJECT_LABELS, normalizeRigState } from '@/services/mannequin.service';
import { SavedPose, usePoseLibraryStore } from '@/store/poseLibraryStore';
import { isElectron } from '@/utils/fileUtils';

interface Props {
  engine: Model3DViewerEngine;
  /** Called after the figure itself (species, body, clothes) was replaced. */
  onSceneChange: () => void;
  refresh: () => void;
}

/** Personal library of poses and whole figures: keeps what the artist built so it can be reused,
 * shared as a file, or used in another project. Poses are stored with a small thumbnail. */
export default function PoseLibrary({ engine, onSceneChange, refresh }: Props) {
  const poses = usePoseLibraryStore((s) => s.poses);
  const save = usePoseLibraryStore((s) => s.save);
  const remove = usePoseLibraryStore((s) => s.remove);
  const rename = usePoseLibraryStore((s) => s.rename);
  const exportJson = usePoseLibraryStore((s) => s.exportJson);
  const importJson = usePoseLibraryStore((s) => s.importJson);
  const [name, setName] = useState('');
  // Electron has no window.prompt: renaming happens in place.
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rig = engine.getRig();

  function saveCurrent() {
    if (!rig) return;
    const label = name.trim() || `Pose ${poses.length + 1}`;
    const ok = save(label, rig.state, engine.captureThumbnail() ?? undefined);
    if (ok) {
      setName('');
      toast.success(`«${label}» guardada en tu biblioteca`);
    } else {
      toast.error('No se pudo guardar: el almacenamiento local está lleno');
    }
  }

  /** Only the pose itself (joints, hands, feet, face): keeps the current body, clothes and colour. */
  function applyPose(p: SavedPose) {
    const cur = engine.getRig()?.state;
    if (!cur || cur.kind !== p.kind) return;
    const src = normalizeRigState(JSON.parse(JSON.stringify(p.state)));
    engine.setRigState({ ...cur, pose: src.pose, hands: src.hands, feet: src.feet, expression: src.expression });
    refresh();
  }

  /** The whole saved figure, including species, body type, clothes and colour. */
  function applyFigure(p: SavedPose) {
    engine.setRigState(normalizeRigState(JSON.parse(JSON.stringify(p.state))));
    onSceneChange();
    refresh();
  }

  async function exportAll() {
    const json = exportJson();
    if (isElectron()) {
      // export:image is a generic "write these bytes to a chosen file" channel, same trick the
      // palette exporter uses for plain-text files.
      const base64 = btoa(unescape(encodeURIComponent(json)));
      await window.electronAPI.exportImage(`data:application/json;base64,${base64}`, 'json', 'poses-schizzo');
    } else {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      link.download = 'poses-schizzo.json';
      link.click();
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const count = importJson(await file.text());
    if (count > 0) toast.success(`${count} ${count === 1 ? 'pose importada' : 'poses importadas'}`);
    else toast.error('Ese archivo no contiene poses de SCHIZZO STUDIO');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <details className="border-t border-border pt-2">
      <summary className="text-[10px] text-textDim uppercase tracking-wide cursor-pointer select-none">Mis poses y figuras ({poses.length})</summary>
      <div className="space-y-1.5 mt-1.5">
        <div className="flex gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCurrent()}
            placeholder="Nombre de la pose…"
            className="flex-1 min-w-0 bg-panel border border-border rounded text-[10px] px-1 py-0.5"
          />
          <button onClick={saveCurrent} disabled={!rig} className="bg-accent text-white text-[10px] rounded px-2 disabled:opacity-40" title="Guarda la pose y la figura actuales, con una miniatura">
            Guardar
          </button>
        </div>

        {poses.length === 0 ? (
          <p className="text-[9px] text-textDim">Aún no has guardado nada. Coloca la figura, ponle nombre y guárdala para reutilizarla en cualquier proyecto.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-0.5">
            {poses.map((p) => {
              const sameKind = rig?.state.kind === p.kind;
              return (
                <div key={p.id} className="bg-panelLight rounded overflow-hidden border border-border">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="w-full aspect-square object-cover bg-panel" />
                  ) : (
                    <div className="w-full aspect-square bg-panel flex items-center justify-center text-[9px] text-textDim">sin vista previa</div>
                  )}
                  <div className="p-1 space-y-0.5">
                    {renaming?.id === p.id ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) => setRenaming({ id: p.id, value: e.target.value })}
                        onBlur={() => {
                          if (renaming.value.trim()) rename(p.id, renaming.value);
                          setRenaming(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          else if (e.key === 'Escape') setRenaming(null);
                        }}
                        className="w-full bg-panel border border-border rounded text-[10px] px-1"
                      />
                    ) : (
                      <button className="block w-full text-left text-[10px] truncate hover:underline" title="Pulsa para renombrar" onClick={() => setRenaming({ id: p.id, value: p.name })}>
                        {p.name}
                      </button>
                    )}
                    <div className="text-[8px] text-textDim">{SUBJECT_LABELS[p.kind] ?? p.kind}</div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => applyPose(p)}
                        disabled={!sameKind}
                        title={sameKind ? 'Aplica solo la pose (articulaciones, manos, pies y cara) a la figura actual' : 'La figura actual es de otra especie: usa «Figura»'}
                        className="flex-1 bg-panel hover:bg-border text-[9px] rounded py-0.5 disabled:opacity-40"
                      >
                        Pose
                      </button>
                      <button onClick={() => applyFigure(p)} title="Carga la figura completa: especie, cuerpo, ropa y color" className="flex-1 bg-panel hover:bg-border text-[9px] rounded py-0.5">
                        Figura
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Borrar «${p.name}»?`)) remove(p.id);
                        }}
                        title="Borrar"
                        className="bg-panel hover:bg-red-500/30 text-[9px] rounded px-1.5 py-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-1">
          <button onClick={exportAll} disabled={poses.length === 0} className="flex-1 bg-panelLight text-[9px] rounded py-0.5 disabled:opacity-40">
            Exportar…
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex-1 bg-panelLight text-[9px] rounded py-0.5">
            Importar…
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        </div>
      </div>
    </details>
  );
}

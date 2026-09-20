import { ArrowUp, ArrowDown, Trash2, Grid2x2 } from 'lucide-react';
import { Layer, VectorObject } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useVectorLayerStore } from '@/store/vectorLayerStore';
import { objectLabel } from '@/services/vectorLayer.service';

/** Object list and property editor of a vector layer — its content stays editable until rasterized. */
export default function VectorObjectsEditor({ layer }: { layer: Layer }) {
  const objects = layer.vectorObjects ?? [];
  const setVectorObjects = useAppStore((s) => s.setVectorObjects);
  const rasterize = useAppStore((s) => s.rasterizeVectorLayer);
  const selectedId = useVectorLayerStore((s) => s.selectedId);
  const select = useVectorLayerStore((s) => s.select);
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  const update = (patch: (o: VectorObject) => VectorObject, label = 'Editar objeto vectorial') => {
    if (!selected) return;
    setVectorObjects(layer.id, objects.map((o) => (o.id === selected.id ? patch(o) : o)), label);
  };
  const move = (dir: -1 | 1) => {
    if (!selected) return;
    const i = objects.findIndex((o) => o.id === selected.id);
    const j = i + dir;
    if (j < 0 || j >= objects.length) return;
    const next = [...objects];
    [next[i], next[j]] = [next[j], next[i]];
    setVectorObjects(layer.id, next, 'Reordenar objeto');
  };
  const remove = () => {
    if (!selected) return;
    setVectorObjects(layer.id, objects.filter((o) => o.id !== selected.id), 'Eliminar objeto vectorial');
    select(null);
  };

  return (
    <div className="space-y-1.5 border border-border rounded p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-textDim">Objetos vectoriales ({objects.length})</span>
        <button onClick={() => rasterize(layer.id)} className="flex items-center gap-1 text-[10px] text-textDim hover:text-text" title="Convertir en capa de píxeles (ya no se podrá editar cada objeto)">
          <Grid2x2 size={11} /> Rasterizar
        </button>
      </div>
      {objects.length === 0 ? (
        <p className="text-[10px] text-textDim">Dibuja formas, texto o trazados de pluma sobre esta capa: cada uno queda como objeto editable. Con la herramienta «Seleccionar objeto» puedes moverlos.</p>
      ) : (
        <div className="max-h-28 overflow-y-auto space-y-0.5">
          {[...objects].reverse().map((o) => (
            <button key={o.id} onClick={() => select(o.id)} className={`w-full text-left text-[11px] rounded px-1.5 py-0.5 ${o.id === selectedId ? 'bg-accent text-white' : 'bg-panelLight hover:bg-border'}`}>
              {objectLabel(o)}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          <div className="flex gap-1">
            <button onClick={() => move(1)} className="flex-1 bg-panelLight rounded py-0.5 hover:bg-border" title="Subir"><ArrowUp size={12} className="mx-auto" /></button>
            <button onClick={() => move(-1)} className="flex-1 bg-panelLight rounded py-0.5 hover:bg-border" title="Bajar"><ArrowDown size={12} className="mx-auto" /></button>
            <button onClick={remove} className="flex-1 bg-panelLight rounded py-0.5 hover:text-red-400" title="Eliminar"><Trash2 size={12} className="mx-auto" /></button>
          </div>
          {selected.kind === 'text' && (
            <select
              value={selected.effect ?? 'normal'}
              onChange={(e) => update((o) => (o.kind === 'text' ? { ...o, effect: e.target.value as typeof selected.effect } : o))}
              className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
            >
              <option value="normal">Sin efecto</option>
              <option value="emboss">Relieve</option>
              <option value="longShadow">Sombra larga</option>
              <option value="neon">Neón</option>
            </select>
          )}
          {selected.kind === 'pathText' && (
            <>
              <textarea
                value={selected.text}
                onChange={(e) => update((o) => (o.kind === 'pathText' ? { ...o, text: e.target.value } : o))}
                rows={2}
                className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
              />
              <Num label="Tamaño" value={selected.fontSize} min={4} max={400} onChange={(v) => update((o) => (o.kind === 'pathText' ? { ...o, fontSize: v } : o))} />
            </>
          )}
          {selected.kind === 'text' && (
            <>
              <textarea
                value={selected.text}
                onChange={(e) => update((o) => (o.kind === 'text' ? { ...o, text: e.target.value } : o))}
                rows={2}
                className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
              />
              <Num label="Tamaño" value={selected.fontSize} min={4} max={400} onChange={(v) => update((o) => (o.kind === 'text' ? { ...o, fontSize: v } : o))} />
              <label className="flex items-center gap-1.5 text-[10px] text-textDim">
                <input type="checkbox" checked={selected.weight === 'bold'} onChange={(e) => update((o) => (o.kind === 'text' ? { ...o, weight: e.target.checked ? 'bold' : 'normal' } : o))} /> Negrita
              </label>
            </>
          )}
          {selected.kind === 'shape' && (
            <div className="grid grid-cols-2 gap-1">
              <Num label="X" value={Math.round(selected.draft.x)} min={-5000} max={20000} onChange={(v) => update((o) => (o.kind === 'shape' ? { ...o, draft: { ...o.draft, x: v } } : o))} />
              <Num label="Y" value={Math.round(selected.draft.y)} min={-5000} max={20000} onChange={(v) => update((o) => (o.kind === 'shape' ? { ...o, draft: { ...o.draft, y: v } } : o))} />
              <Num label="Ancho" value={Math.round(selected.draft.w)} min={1} max={20000} onChange={(v) => update((o) => (o.kind === 'shape' ? { ...o, draft: { ...o.draft, w: v } } : o))} />
              <Num label="Alto" value={Math.round(selected.draft.h)} min={1} max={20000} onChange={(v) => update((o) => (o.kind === 'shape' ? { ...o, draft: { ...o.draft, h: v } } : o))} />
              <Num label="Giro °" value={Math.round((selected.draft.angle * 180) / Math.PI)} min={-360} max={360} onChange={(v) => update((o) => (o.kind === 'shape' ? { ...o, draft: { ...o.draft, angle: (v * Math.PI) / 180 } } : o))} />
            </div>
          )}
          {selected.kind === 'text' && (
            <div className="grid grid-cols-2 gap-1">
              <Num label="X" value={Math.round(selected.x)} min={-5000} max={20000} onChange={(v) => update((o) => (o.kind === 'text' ? { ...o, x: v } : o))} />
              <Num label="Y" value={Math.round(selected.y)} min={-5000} max={20000} onChange={(v) => update((o) => (o.kind === 'text' ? { ...o, y: v } : o))} />
              <Num label="Giro °" value={Math.round((selected.angle * 180) / Math.PI)} min={-360} max={360} onChange={(v) => update((o) => (o.kind === 'text' ? { ...o, angle: (v * Math.PI) / 180 } : o))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-1 text-[10px] text-textDim">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={selected.fill.enabled} onChange={(e) => update((o) => ({ ...o, fill: { ...o.fill, enabled: e.target.checked } }))} />
              Relleno
              <input type="color" value={selected.fill.color} onChange={(e) => update((o) => ({ ...o, fill: { ...o.fill, color: e.target.value } }))} className="w-6 h-5 bg-transparent" />
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={selected.stroke.enabled} onChange={(e) => update((o) => ({ ...o, stroke: { ...o.stroke, enabled: e.target.checked } }))} />
              Trazo
              <input type="color" value={selected.stroke.color} onChange={(e) => update((o) => ({ ...o, stroke: { ...o.stroke, color: e.target.value } }))} className="w-6 h-5 bg-transparent" />
            </label>
          </div>
          <Num label="Grosor del trazo" value={selected.stroke.width} min={0} max={100} onChange={(v) => update((o) => ({ ...o, stroke: { ...o.stroke, width: v } }))} />
        </div>
      )}
    </div>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-1 text-[10px] text-textDim">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="w-16 bg-panel border border-border rounded px-1 py-0.5 text-[11px] text-text"
      />
    </label>
  );
}

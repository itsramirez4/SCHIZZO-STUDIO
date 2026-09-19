import { useMemo, useState } from 'react';
import { useBrush } from '@/hooks/useBrush';
import { useUIStore } from '@/store/uiStore';

const ALL = 'Todos';

export default function BrushSelector() {
  const { currentBrush, brushLibrary, setCurrentBrush } = useBrush();
  const openBrushEditor = useUIStore((s) => s.openBrushEditor);
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    brushLibrary.forEach((b) => set.add(b.category ?? 'Personalizados'));
    return [ALL, ...set];
  }, [brushLibrary]);

  const visible = category === ALL ? brushLibrary : brushLibrary.filter((b) => (b.category ?? 'Personalizados') === category);

  return (
    <div className="p-2 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-textDim">Pinceles</span>
        <button onClick={openBrushEditor} title="Editar pincel" className="text-xs text-accent hover:underline">
          Editar
        </button>
      </div>
      <select
        value={categories.includes(category) ? category : ALL}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-panel border border-border rounded text-[10px] px-1 py-0.5 mb-1"
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto">
        {visible.map((brush) => (
          <button
            key={brush.id}
            onClick={() => setCurrentBrush(brush)}
            title={brush.name}
            className={`rounded flex items-center gap-1.5 px-1.5 py-1 border text-left ${
              currentBrush.id === brush.id ? 'border-accent bg-panelLight' : 'border-border bg-panel'
            }`}
          >
            <span className="w-6 h-6 shrink-0 flex items-center justify-center">
              {brush.texture ? (
                <img src={brush.texture} alt="" className="w-6 h-6 rounded-full" style={{ opacity: Math.max(0.5, brush.opacity) }} />
              ) : (
                <span
                  className="rounded-full bg-white"
                  style={{
                    width: Math.min(22, Math.max(4, brush.size / 2)),
                    height: Math.min(22, Math.max(4, brush.size / 2)),
                    opacity: Math.max(0.3, brush.opacity),
                    filter: `blur(${(1 - brush.hardness) * 2}px)`,
                  }}
                />
              )}
            </span>
            <span className="text-[10px] leading-tight truncate">{brush.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

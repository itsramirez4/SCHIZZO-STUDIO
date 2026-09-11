import { useBrush } from '@/hooks/useBrush';
import { useUIStore } from '@/store/uiStore';

export default function BrushSelector() {
  const { currentBrush, brushLibrary, setCurrentBrush } = useBrush();
  const openBrushEditor = useUIStore((s) => s.openBrushEditor);

  return (
    <div className="p-2 border-t border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-textDim">Pinceles</span>
        <button onClick={openBrushEditor} className="text-xs text-accent hover:underline">
          Editar
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
        {brushLibrary.map((brush) => (
          <button
            key={brush.id}
            onClick={() => setCurrentBrush(brush)}
            title={brush.name}
            className={`aspect-square rounded flex items-center justify-center border ${
              currentBrush.id === brush.id ? 'border-accent bg-panelLight' : 'border-border bg-panel'
            }`}
          >
            <span
              className="rounded-full bg-white"
              style={{
                width: Math.min(20, brush.size / 2),
                height: Math.min(20, brush.size / 2),
                opacity: brush.opacity,
                filter: `blur(${(1 - brush.hardness) * 2}px)`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

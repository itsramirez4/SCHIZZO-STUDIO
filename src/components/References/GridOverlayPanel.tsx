import { useGridOverlayStore } from '@/store/gridOverlayStore';
import { GRID_TYPE_LABELS, GridOverlayType } from '@/services/gridOverlay.service';

const TYPES = Object.keys(GRID_TYPE_LABELS) as GridOverlayType[];

export default function GridOverlayPanel() {
  const enabled = useGridOverlayStore((s) => s.enabled);
  const type = useGridOverlayStore((s) => s.type);
  const color = useGridOverlayStore((s) => s.color);
  const opacity = useGridOverlayStore((s) => s.opacity);
  const columns = useGridOverlayStore((s) => s.columns);
  const rows = useGridOverlayStore((s) => s.rows);
  const toggleEnabled = useGridOverlayStore((s) => s.toggleEnabled);
  const setType = useGridOverlayStore((s) => s.setType);
  const setColor = useGridOverlayStore((s) => s.setColor);
  const setOpacity = useGridOverlayStore((s) => s.setOpacity);
  const setColumns = useGridOverlayStore((s) => s.setColumns);
  const setRows = useGridOverlayStore((s) => s.setRows);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
        Mostrar grilla de composición
      </label>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as GridOverlayType)}
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {GRID_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      {type === 'uniform' && (
        <div className="flex gap-2">
          <label className="flex items-center gap-1 text-[10px] text-textDim flex-1">
            Columnas
            <input
              type="number"
              min={2}
              max={32}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              className="w-12 bg-panel border border-border rounded px-1"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] text-textDim flex-1">
            Filas
            <input
              type="number"
              min={2}
              max={32}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="w-12 bg-panel border border-border rounded px-1"
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-textDim w-16">Color</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer" />
      </div>

      <label className="flex items-center gap-2 text-[10px] text-textDim">
        Opacidad
        <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="flex-1" />
        <span className="w-9 text-right">{Math.round(opacity * 100)}%</span>
      </label>
    </div>
  );
}

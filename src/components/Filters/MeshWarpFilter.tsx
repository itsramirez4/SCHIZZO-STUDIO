import { useMeshWarpStore } from '@/store/meshWarpStore';
import { applyMeshWarp } from '@/services/meshWarp.service';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';

export default function MeshWarpFilter() {
  const { currentLayer } = useLayers();
  const pushHistory = useAppStore((s) => s.pushHistory);
  const active = useMeshWarpStore((s) => s.active);
  const cols = useMeshWarpStore((s) => s.cols);
  const rows = useMeshWarpStore((s) => s.rows);
  const points = useMeshWarpStore((s) => s.points);
  const activate = useMeshWarpStore((s) => s.activate);
  const deactivate = useMeshWarpStore((s) => s.deactivate);
  const setDimensions = useMeshWarpStore((s) => s.setDimensions);
  const reset = useMeshWarpStore((s) => s.reset);

  function toggle() {
    if (!currentLayer) return;
    if (active) {
      deactivate();
    } else {
      activate(currentLayer.width, currentLayer.height);
    }
  }

  function applyFilter() {
    if (!currentLayer || !points) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    const warped = applyMeshWarp(canvas, cols, rows, points);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(warped, 0, 0);
    pushHistory('Deformar malla (mesh warp)');
    deactivate();
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Deformar malla (mesh warp)</div>
      <p className="text-[9px] text-textDim">Arrastrá los puntos de la cuadrícula directamente sobre el lienzo para deformar la capa.</p>

      <label className="flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={active} onChange={toggle} disabled={!currentLayer} />
        Activar cuadrícula en el lienzo
      </label>

      {active && currentLayer && (
        <>
          <div className="flex items-center gap-2 text-[10px] text-textDim">
            <span className="w-14">Columnas</span>
            <input
              type="range"
              min={2}
              max={10}
              value={cols}
              onChange={(e) => setDimensions(Number(e.target.value), rows, currentLayer.width, currentLayer.height)}
              className="flex-1"
            />
            <span className="w-4 text-right">{cols}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-textDim">
            <span className="w-14">Filas</span>
            <input
              type="range"
              min={2}
              max={10}
              value={rows}
              onChange={(e) => setDimensions(cols, Number(e.target.value), currentLayer.width, currentLayer.height)}
              className="flex-1"
            />
            <span className="w-4 text-right">{rows}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilter} className="flex-1 bg-accent text-white text-xs rounded py-1.5">
              Aplicar
            </button>
            <button onClick={() => reset(currentLayer.width, currentLayer.height)} className="flex-1 bg-panelLight text-xs rounded py-1.5">
              Restablecer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

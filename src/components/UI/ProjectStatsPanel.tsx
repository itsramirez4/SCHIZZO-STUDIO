import { useMemo } from 'react';
import { useAppStore, historyManager } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import { computeProjectStats } from '@/services/projectStats.service';

const TYPE_LABELS: Record<string, string> = {
  raster: 'Ráster',
  text: 'Texto',
  reference: 'Referencia',
  group: 'Grupo',
  adjustment: 'Ajuste',
  fill: 'Relleno',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ProjectStatsPanel() {
  const project = useAppStore((s) => s.project);
  // historyVersion changes on every push/undo/redo — recompute stats (and re-read the
  // history stack depth) whenever it does, not just when the panel first mounts.
  const historyVersion = useHistory().historyVersion;

  const stats = useMemo(() => {
    if (!project) return null;
    const pointer = historyManager.getPointer();
    const total = historyManager.getStack().length;
    return computeProjectStats(project, pointer, Math.max(0, total - 1 - pointer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, historyVersion]);

  if (!project || !stats) {
    return <p className="text-xs text-textDim p-3">Abrí un proyecto para ver sus estadísticas.</p>;
  }

  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">Lienzo</h3>
        <Row label="Tamaño" value={`${stats.canvasWidth} × ${stats.canvasHeight} px`} />
        <Row label="Colores distintos (aprox.)" value={stats.approxDistinctColors.toLocaleString()} />
      </div>

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">Capas</h3>
        <Row label="Total" value={String(stats.layerCount)} />
        {Object.entries(stats.layerCountByType).map(([type, count]) => (
          <Row key={type} label={TYPE_LABELS[type] ?? type} value={String(count)} indent />
        ))}
        <Row label="Modos de fusión usados" value={stats.blendModesUsed.join(', ') || '—'} />
      </div>

      {stats.hasAnimation && (
        <div>
          <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">Animación</h3>
          <Row label="Fotogramas" value={String(stats.frameCount)} />
        </div>
      )}

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">Archivo</h3>
        <Row label="Tamaño estimado" value={formatSize(stats.estimatedFileSizeBytes)} />
        <Row label="Creado" value={formatDate(stats.created)} />
        <Row label="Modificado" value={formatDate(stats.lastModified)} />
      </div>

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">Historial</h3>
        <Row label="Pasos para deshacer" value={String(stats.undoStepsAvailable)} />
        <Row label="Pasos para rehacer" value={String(stats.redoStepsAvailable)} />
      </div>
    </div>
  );
}

function Row({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 py-0.5 ${indent ? 'pl-3' : ''}`}>
      <span className="text-textDim">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

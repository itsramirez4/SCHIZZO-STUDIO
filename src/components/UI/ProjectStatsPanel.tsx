import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, historyManager } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import { computeProjectStats } from '@/services/projectStats.service';

const TYPE_LABEL_KEYS: Record<string, string> = {
  raster: 'projectStats.typeLabels.raster',
  text: 'projectStats.typeLabels.text',
  reference: 'projectStats.typeLabels.reference',
  group: 'projectStats.typeLabels.group',
  adjustment: 'projectStats.typeLabels.adjustment',
  fill: 'projectStats.typeLabels.fill',
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
  const { t } = useTranslation('panelsProject');
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
    return <p className="text-xs text-textDim p-3">{t('projectStats.openProjectHint')}</p>;
  }

  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">{t('projectStats.sections.canvas')}</h3>
        <Row label={t('projectStats.labels.size')} value={`${stats.canvasWidth} × ${stats.canvasHeight} px`} />
        <Row label={t('projectStats.labels.distinctColors')} value={stats.approxDistinctColors.toLocaleString()} />
      </div>

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">{t('projectStats.sections.layers')}</h3>
        <Row label={t('projectStats.labels.total')} value={String(stats.layerCount)} />
        {Object.entries(stats.layerCountByType).map(([type, count]) => (
          <Row key={type} label={TYPE_LABEL_KEYS[type] ? t(TYPE_LABEL_KEYS[type]) : type} value={String(count)} indent />
        ))}
        <Row label={t('projectStats.labels.blendModesUsed')} value={stats.blendModesUsed.join(', ') || '—'} />
      </div>

      {stats.hasAnimation && (
        <div>
          <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">{t('projectStats.sections.animation')}</h3>
          <Row label={t('projectStats.labels.frames')} value={String(stats.frameCount)} />
        </div>
      )}

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">{t('projectStats.sections.file')}</h3>
        <Row label={t('projectStats.labels.estimatedSize')} value={formatSize(stats.estimatedFileSizeBytes)} />
        <Row label={t('projectStats.labels.created')} value={formatDate(stats.created)} />
        <Row label={t('projectStats.labels.modified')} value={formatDate(stats.lastModified)} />
      </div>

      <div>
        <h3 className="text-textDim uppercase text-[10px] tracking-wide mb-1.5">{t('projectStats.sections.history')}</h3>
        <Row label={t('projectStats.labels.undoSteps')} value={String(stats.undoStepsAvailable)} />
        <Row label={t('projectStats.labels.redoSteps')} value={String(stats.redoStepsAvailable)} />
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

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import { useHistory } from '@/hooks/useHistory';
import * as layerService from '@/services/layer.service';

/**
 * A live but non-interactive mirrored preview of the current canvas — for catching proportion
 * and symmetry mistakes, the classic "flip view" trick. Deliberately implemented as a separate
 * read-only preview rather than flipping the actual interactive stage: every drawing tool's
 * pointer-coordinate math assumes an unmirrored view, and inverting that consistently for live
 * drawing is a real, separate piece of work this round doesn't take on.
 */
export default function MirrorViewPanel() {
  const { t } = useTranslation('panelsProject');
  const project = useAppStore((s) => s.project);
  const { layers } = useLayers();
  const { historyVersion } = useHistory();
  const [mode, setMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!project) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const flattened = layerService.flattenLayers(layers, project.width, project.height);
    canvas.width = project.width;
    canvas.height = project.height;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'horizontal') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(flattened, 0, 0);
    ctx.restore();
  }, [project, layers, historyVersion, mode]);

  if (!project) return <p className="text-[10px] text-textDim">{t('mirrorView.openProjectHint')}</p>;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode('horizontal')}
          className={`flex-1 text-[11px] rounded py-1.5 ${mode === 'horizontal' ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
        >
          {t('mirrorView.horizontal')}
        </button>
        <button
          onClick={() => setMode('vertical')}
          className={`flex-1 text-[11px] rounded py-1.5 ${mode === 'vertical' ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
        >
          {t('mirrorView.vertical')}
        </button>
      </div>
      <p className="text-[9px] text-textDim">{t('mirrorView.livePreviewHint')}</p>
      <div className="checkerboard border border-border rounded overflow-hidden">
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>
    </div>
  );
}

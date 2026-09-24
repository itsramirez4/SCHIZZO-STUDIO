import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/store/uiStore';
import { useAppStore, getFrameLayers } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import { seamCarveResize, estimateSeamCount } from '@/services/seamCarve.service';

const SLOW_WARNING_THRESHOLD = 150;

export default function ResizeDialog() {
  const { t } = useTranslation('dialogs');
  const show = useUIStore((s) => s.showResizeDialog);
  const close = useUIStore((s) => s.closeResizeDialog);
  const project = useAppStore((s) => s.project);
  const finishContentAwareResize = useAppStore((s) => s.finishContentAwareResize);

  const [width, setWidth] = useState(project?.width ?? 0);
  const [height, setHeight] = useState(project?.height ?? 0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);

  if (!show || !project) return null;

  const frameCount = project.animation ? project.animation.frames.length : 1;
  const seamsPerFrame = estimateSeamCount(project.width, project.height, width, height);
  const totalSeams = seamsPerFrame * frameCount;
  const unchanged = width === project.width && height === project.height;

  function handleClose() {
    if (running) cancelRef.current = true;
    close();
  }

  async function handleApply() {
    if (unchanged || width < 1 || height < 1) return;
    cancelRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: totalSeams });

    const resizedFrames: HTMLCanvasElement[] = [];
    let overallDone = 0;

    for (let i = 0; i < frameCount; i++) {
      const layers = getFrameLayers(project!, i);
      const source = layerService.flattenLayers(layers, project!.width, project!.height);
      const result = await seamCarveResize(source, width, height, {
        shouldCancel: () => cancelRef.current,
        onProgress: (done) => setProgress({ done: overallDone + done, total: totalSeams }),
      });
      if (!result) {
        setRunning(false);
        toast(t('resize.cancelledToast'));
        return;
      }
      resizedFrames.push(result);
      overallDone += seamsPerFrame;
      setProgress({ done: overallDone, total: totalSeams });
    }

    finishContentAwareResize(width, height, resizedFrames);
    setRunning(false);
    toast.success(t('resize.successToast'));
    close();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg w-[380px] p-5">
        <h2 className="text-lg font-semibold mb-1">{t('resize.title')}</h2>
        <p className="text-[11px] text-textDim mb-4">{t('resize.description')}</p>

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-textDim mb-1">{t('resize.width')}</label>
            <input
              type="number"
              value={width}
              min={1}
              disabled={running}
              onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
              className="w-full bg-panelLight border border-border rounded px-2 py-1.5 text-sm disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-textDim mb-1">{t('resize.height')}</label>
            <input
              type="number"
              value={height}
              min={1}
              disabled={running}
              onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
              className="w-full bg-panelLight border border-border rounded px-2 py-1.5 text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <p className="text-[11px] text-textDim mb-1">
          {t('resize.current', { width: project.width, height: project.height })}
          {frameCount > 1 ? t('resize.currentFrames', { count: frameCount }) : ''}
        </p>

        {!unchanged && totalSeams >= SLOW_WARNING_THRESHOLD && !running && (
          <p className="text-[11px] text-amber-400 mb-2">
            {t('resize.seamsWarning', { count: totalSeams })}
            {frameCount > 1 ? t('resize.seamsWarningFrames', { perFrame: seamsPerFrame, frames: frameCount }) : ''}
          </p>
        )}

        {running && (
          <div className="mb-3">
            <div className="h-1.5 bg-panelLight rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-textDim mt-1">{t('resize.progress', { done: progress.done, total: progress.total })}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={handleClose} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
            {running ? t('resize.cancel') : t('resize.close')}
          </button>
          {!running && (
            <button
              onClick={handleApply}
              disabled={unchanged}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-40"
            >
              {t('resize.apply')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

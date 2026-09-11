import { useEffect, useRef } from 'react';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';

/**
 * Gives a filter panel a "live preview, commit on Aplicar" workflow without redoing this
 * plumbing per filter: `preview(key, apply)` snapshots the untouched layer once, then on
 * every call restores that snapshot and reruns `apply` — so moving a slider always previews
 * from the true original rather than compounding filters on top of the last preview frame.
 * Calls are coalesced to one per animation frame so fast slider drags don't queue up work.
 * `key` scopes the snapshot to one filter at a time: switching to a different filter's
 * slider (a different key) first cancels/restores the previous filter's preview.
 */
export function useFilterPreview() {
  const { currentLayer } = useLayers();
  const pushHistory = useAppStore((s) => s.pushHistory);
  const originalRef = useRef<ImageData | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const layerIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<((canvas: HTMLCanvasElement) => void) | null>(null);

  function getCanvas(): HTMLCanvasElement | null {
    if (!currentLayer) return null;
    return layerService.getLayerCanvas(currentLayer.id) ?? null;
  }

  function cancel() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const canvas = layerIdRef.current ? layerService.getLayerCanvas(layerIdRef.current) : null;
    if (canvas && originalRef.current) {
      canvas.getContext('2d')!.putImageData(originalRef.current, 0, 0);
    }
    originalRef.current = null;
    activeKeyRef.current = null;
    layerIdRef.current = null;
  }

  // Switching layers mid-preview would apply further edits to the wrong canvas — bail out.
  useEffect(() => {
    if (activeKeyRef.current && layerIdRef.current !== (currentLayer?.id ?? null)) cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLayer?.id]);
  useEffect(() => () => cancel(), []);

  function preview(key: string, apply: (canvas: HTMLCanvasElement) => void) {
    if (activeKeyRef.current && activeKeyRef.current !== key) cancel();

    const canvas = getCanvas();
    if (!canvas) return;
    if (!originalRef.current) {
      originalRef.current = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      activeKeyRef.current = key;
      layerIdRef.current = currentLayer!.id;
    }

    pendingApplyRef.current = apply;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      pendingApplyRef.current = null;
      if (!originalRef.current) return;
      canvas.getContext('2d')!.putImageData(originalRef.current, 0, 0);
      apply(canvas);
    });
  }

  function commit(actionLabel: string) {
    if (!originalRef.current) return;
    // A preview frame may still be waiting on rAF — run it synchronously now so the pixels
    // committed to history actually match the last requested values, not a stale frame.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const canvas = getCanvas();
      if (canvas && pendingApplyRef.current) {
        canvas.getContext('2d')!.putImageData(originalRef.current, 0, 0);
        pendingApplyRef.current(canvas);
      }
      pendingApplyRef.current = null;
    }
    originalRef.current = null;
    activeKeyRef.current = null;
    layerIdRef.current = null;
    pushHistory(actionLabel);
  }

  return { preview, commit, cancel, isPreviewing: (key?: string) => (key ? activeKeyRef.current === key : !!activeKeyRef.current) };
}

import { useAppStore } from '@/store/appStore';
import { ZOOM_MAX, ZOOM_MIN } from '@/utils/constants';
import { clamp } from '@/utils/colorUtils';

export function useCanvas() {
  const zoom = useAppStore((s) => s.zoom);
  const panX = useAppStore((s) => s.panX);
  const panY = useAppStore((s) => s.panY);
  const canvasRotation = useAppStore((s) => s.canvasRotation);
  const viewFlippedH = useAppStore((s) => s.viewFlippedH);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPan = useAppStore((s) => s.setPan);
  const setCanvasRotation = useAppStore((s) => s.setCanvasRotation);
  const toggleViewFlip = useAppStore((s) => s.toggleViewFlip);
  const isDrawing = useAppStore((s) => s.isDrawing);
  const setIsDrawing = useAppStore((s) => s.setIsDrawing);

  const zoomBy = (factor: number) => {
    setZoom(clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX));
  };

  const rotateBy = (deltaDeg: number) => {
    // Reads the live store value rather than the `canvasRotation` closed over above —
    // several calls fired in the same tick (e.g. a fast double-click) would otherwise all
    // add to the same stale render's value instead of accumulating.
    useAppStore.setState((s) => ({ canvasRotation: s.canvasRotation + deltaDeg }));
  };

  return { zoom, panX, panY, canvasRotation, viewFlippedH, setZoom, setPan, setCanvasRotation, toggleViewFlip, zoomBy, rotateBy, isDrawing, setIsDrawing };
}

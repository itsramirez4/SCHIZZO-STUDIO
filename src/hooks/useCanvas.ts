import { useAppStore } from '@/store/appStore';
import { ZOOM_MAX, ZOOM_MIN } from '@/utils/constants';
import { clamp } from '@/utils/colorUtils';

export function useCanvas() {
  const zoom = useAppStore((s) => s.zoom);
  const panX = useAppStore((s) => s.panX);
  const panY = useAppStore((s) => s.panY);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPan = useAppStore((s) => s.setPan);
  const isDrawing = useAppStore((s) => s.isDrawing);
  const setIsDrawing = useAppStore((s) => s.setIsDrawing);

  const zoomBy = (factor: number) => {
    setZoom(clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX));
  };

  return { zoom, panX, panY, setZoom, setPan, zoomBy, isDrawing, setIsDrawing };
}

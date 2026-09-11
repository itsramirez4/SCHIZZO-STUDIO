import { useAppStore } from '@/store/appStore';

export function useBrush() {
  return {
    currentBrush: useAppStore((s) => s.currentBrush),
    brushLibrary: useAppStore((s) => s.brushLibrary),
    setCurrentBrush: useAppStore((s) => s.setCurrentBrush),
    updateCurrentBrush: useAppStore((s) => s.updateCurrentBrush),
    addBrushToLibrary: useAppStore((s) => s.addBrushToLibrary),
    removeBrushFromLibrary: useAppStore((s) => s.removeBrushFromLibrary),
  };
}

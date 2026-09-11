import { useAppStore } from '@/store/appStore';

export function useHistory() {
  return {
    canUndo: useAppStore((s) => s.canUndo),
    canRedo: useAppStore((s) => s.canRedo),
    undo: useAppStore((s) => s.undo),
    redo: useAppStore((s) => s.redo),
    historyVersion: useAppStore((s) => s.historyVersion),
  };
}

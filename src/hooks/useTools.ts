import { useAppStore } from '@/store/appStore';

export function useTools() {
  return {
    currentTool: useAppStore((s) => s.currentTool),
    setCurrentTool: useAppStore((s) => s.setCurrentTool),
    primaryColor: useAppStore((s) => s.primaryColor),
    secondaryColor: useAppStore((s) => s.secondaryColor),
    setPrimaryColor: useAppStore((s) => s.setPrimaryColor),
    setSecondaryColor: useAppStore((s) => s.setSecondaryColor),
    swapColors: useAppStore((s) => s.swapColors),
  };
}

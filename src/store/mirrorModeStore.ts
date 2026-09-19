import { create } from 'zustand';
import { useAppStore } from './appStore';

interface MirrorModeStore {
  running: boolean;
  intervalSec: number;
  start: (intervalSec: number) => void;
  stop: () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** "Mirror mode": flips the canvas view horizontally every N seconds so proportion and
 * symmetry mistakes jump out. Drawing keeps working while flipped (the canvas maps pointer
 * coordinates through the flip). Stopping restores the normal view. */
export const useMirrorModeStore = create<MirrorModeStore>((set, get) => ({
  running: false,
  intervalSec: 60,
  start: (intervalSec) => {
    if (timer) clearInterval(timer);
    set({ running: true, intervalSec });
    timer = setInterval(() => useAppStore.getState().toggleViewFlip(), intervalSec * 1000);
  },
  stop: () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (get().running && useAppStore.getState().viewFlippedH) useAppStore.getState().toggleViewFlip();
    set({ running: false });
  },
}));

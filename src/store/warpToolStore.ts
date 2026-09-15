import { create } from 'zustand';
import { LiquifyMode } from '@/services/warpTool.service';

interface WarpToolStore {
  radius: number;
  strength: number;
  mode: LiquifyMode;
  setRadius: (r: number) => void;
  setStrength: (s: number) => void;
  setMode: (m: LiquifyMode) => void;
}

export const useWarpToolStore = create<WarpToolStore>((set) => ({
  radius: 60,
  strength: 50,
  mode: 'push',
  setRadius: (r) => set({ radius: Math.max(5, Math.min(500, r)) }),
  setStrength: (s) => set({ strength: Math.max(0, Math.min(100, s)) }),
  setMode: (m) => set({ mode: m }),
}));

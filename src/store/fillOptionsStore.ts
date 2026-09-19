import { create } from 'zustand';

interface FillOptionsStore {
  smart: boolean;
  /** Decide the fill region from the flattened image instead of only the active layer. */
  sampleAllLayers: boolean;
  tolerance: number;
  gapClose: number;
  grow: number;
  set: (patch: Partial<Omit<FillOptionsStore, 'set'>>) => void;
}

interface SmudgeStore {
  size: number;
  /** 0–1: how much paint is dragged along the stroke. */
  strength: number;
  /** 0–1: how much of the primary colour is loaded into the brush at every step. */
  paintLoad: number;
  set: (patch: Partial<Omit<SmudgeStore, 'set'>>) => void;
}

export const useSmudgeStore = create<SmudgeStore>((set) => ({
  size: 40,
  strength: 0.6,
  paintLoad: 0,
  set: (patch) => set(patch),
}));

export const useFillOptionsStore = create<FillOptionsStore>((set) => ({
  smart: false,
  sampleAllLayers: false,
  tolerance: 32,
  gapClose: 3,
  grow: 1,
  set: (patch) => set(patch),
}));

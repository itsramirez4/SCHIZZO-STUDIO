import { create } from 'zustand';

/** Which object of the current vector layer is selected (session-only, never saved). */
interface VectorLayerStore {
  selectedId: string | null;
  select: (id: string | null) => void;
}

export const useVectorLayerStore = create<VectorLayerStore>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}));

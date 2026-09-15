import { create } from 'zustand';
import { GridOverlayType } from '@/services/gridOverlay.service';

interface GridOverlayStore {
  enabled: boolean;
  type: GridOverlayType;
  color: string;
  opacity: number;
  columns: number;
  rows: number;

  toggleEnabled: () => void;
  setType: (type: GridOverlayType) => void;
  setColor: (color: string) => void;
  setOpacity: (opacity: number) => void;
  setColumns: (n: number) => void;
  setRows: (n: number) => void;
}

export const useGridOverlayStore = create<GridOverlayStore>((set) => ({
  enabled: false,
  type: 'ruleOfThirds',
  color: '#ffffff',
  opacity: 0.5,
  columns: 6,
  rows: 6,

  toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
  setType: (type) => set({ type }),
  setColor: (color) => set({ color }),
  setOpacity: (opacity) => set({ opacity }),
  setColumns: (n) => set({ columns: Math.max(2, Math.min(32, n)) }),
  setRows: (n) => set({ rows: Math.max(2, Math.min(32, n)) }),
}));

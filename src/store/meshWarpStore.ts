import { create } from 'zustand';
import { createGridPoints, Point } from '@/services/meshWarp.service';

interface MeshWarpStore {
  active: boolean;
  cols: number;
  rows: number;
  points: Point[][] | null;

  activate: (width: number, height: number) => void;
  deactivate: () => void;
  setDimensions: (cols: number, rows: number, width: number, height: number) => void;
  movePoint: (row: number, col: number, x: number, y: number) => void;
  reset: (width: number, height: number) => void;
}

export const useMeshWarpStore = create<MeshWarpStore>((set, get) => ({
  active: false,
  cols: 4,
  rows: 4,
  points: null,

  activate: (width, height) => {
    const { cols, rows } = get();
    set({ active: true, points: createGridPoints(cols, rows, width, height) });
  },

  deactivate: () => set({ active: false, points: null }),

  setDimensions: (cols, rows, width, height) => {
    set({ cols, rows, points: createGridPoints(cols, rows, width, height) });
  },

  movePoint: (row, col, x, y) => {
    set((s) => {
      if (!s.points) return s;
      const points = s.points.map((r) => [...r]);
      points[row][col] = { x, y };
      return { points };
    });
  },

  reset: (width, height) => {
    const { cols, rows } = get();
    set({ points: createGridPoints(cols, rows, width, height) });
  },
}));

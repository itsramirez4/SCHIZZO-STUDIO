import { create } from 'zustand';
import { FigureType, LandmarkName, Landmarks, canonicalFigure } from '@/services/figureAnalysis.service';

interface FigureStore {
  landmarks: Landmarks | null;
  type: FigureType;
  setType: (t: FigureType) => void;
  /** Places a default standing figure to drag onto the drawing. */
  placeDefault: (canvasW: number, canvasH: number) => void;
  setLandmarks: (l: Landmarks | null) => void;
  movePoint: (name: LandmarkName, x: number, y: number) => void;
  clear: () => void;
}

/** Session-only: the landmarks are a measuring aid, not part of the artwork. */
export const useFigureStore = create<FigureStore>((set) => ({
  landmarks: null,
  type: 'adult',
  setType: (type) => set({ type }),
  placeDefault: (w, h) => set({ landmarks: canonicalFigure(w / 2, h * 0.92, h * 0.8, 7.5) }),
  setLandmarks: (landmarks) => set({ landmarks }),
  movePoint: (name, x, y) => set((s) => (s.landmarks ? { landmarks: { ...s.landmarks, [name]: { x, y } } } : s)),
  clear: () => set({ landmarks: null }),
}));

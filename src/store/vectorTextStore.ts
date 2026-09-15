import { create } from 'zustand';
import { useAppStore } from '@/store/appStore';
import { useShapeStore } from '@/store/shapeStore';
import * as layerService from '@/services/layer.service';
import { withClip, withAlphaLock } from '@/services/canvas.service';
import { textToPath2D, paintTextDraft, TextDraft } from '@/services/vectorText.service';

interface VectorTextStore {
  textDraft: TextDraft | null;
  fontSize: number;
  isBuilding: boolean;

  setFontSize: (v: number) => void;
  buildDraft: (text: string, x: number, y: number) => Promise<void>;
  updateTextDraft: (patch: Partial<Pick<TextDraft, 'x' | 'y' | 'w' | 'h' | 'angle'>>) => void;
  commitDraft: () => void;
  cancel: () => void;
}

/** Reuses `shapeStore`'s stroke/fill settings — vector text and vector shapes are both
 * "draft then bake" vector content sharing the same styling concept, so one stroke/fill editor
 * (already built for shapes) serves both instead of duplicating it. */
export const useVectorTextStore = create<VectorTextStore>((set, get) => ({
  textDraft: null,
  fontSize: 48,
  isBuilding: false,

  setFontSize: (v) => set({ fontSize: Math.max(4, v) }),

  buildDraft: async (text, x, y) => {
    if (!text.trim()) return;
    set({ isBuilding: true });
    try {
      const { fontSize } = get();
      const draft = await textToPath2D(text, fontSize);
      set({ textDraft: { ...draft, x, y }, isBuilding: false });
    } catch (err) {
      console.error('vectorTextStore.buildDraft failed:', err);
      set({ isBuilding: false });
    }
  },

  updateTextDraft: (patch) => set((s) => ({ textDraft: s.textDraft ? { ...s.textDraft, ...patch } : s.textDraft })),

  commitDraft: () => {
    const { textDraft } = get();
    if (!textDraft || textDraft.w < 1 || textDraft.h < 1) {
      set({ textDraft: null });
      return;
    }
    const app = useAppStore.getState();
    const { project, currentLayerId, selection } = app;
    if (!project || !currentLayerId) return;
    const layer = project.layers.find((l) => l.id === currentLayerId);
    if (!layer || layer.locked) return;
    const canvas = layerService.getLayerCanvas(currentLayerId);
    if (!canvas) return;
    const { stroke, fill } = useShapeStore.getState();

    withAlphaLock(canvas.getContext('2d')!, layer.lockAlpha, () => {
      withClip(canvas.getContext('2d')!, selection, () => {
        paintTextDraft(canvas.getContext('2d')!, textDraft, stroke, fill);
      });
    });
    app.pushHistory('Texto vectorial');
    set({ textDraft: null });
  },

  cancel: () => set({ textDraft: null }),
}));

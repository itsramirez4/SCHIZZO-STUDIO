import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { StudyGuide, StudyGuideKind } from '@/services/studyGuides.service';
import { Project } from '@/types';
import { useAppStore } from './appStore';

interface Point {
  x: number;
  y: number;
}

const persist = (get: () => { guides: StudyGuide[] }) => useAppStore.getState().updateStudyGuides(get().guides);

interface StudyGuidesStore {
  guides: StudyGuide[];
  selectedId: string | null;
  measure: { enabled: boolean; a: Point; b: Point };

  hydratedProjectId: string | null;
  hydrateFromProject: (project: Project | null) => void;
  addGuide: (kind: StudyGuideKind, canvasWidth: number, canvasHeight: number) => void;
  updateGuide: (id: string, patch: Partial<StudyGuide>) => void;
  removeGuide: (id: string) => void;
  selectGuide: (id: string | null) => void;
  setMeasureEnabled: (enabled: boolean, canvasWidth?: number, canvasHeight?: number) => void;
  setMeasurePoint: (which: 'a' | 'b', p: Point) => void;
}

/** Guides are saved with the project (Project.studyGuides); the measuring ruler is session-only. */
export const useStudyGuidesStore = create<StudyGuidesStore>((set, get) => ({
  hydratedProjectId: null,
  hydrateFromProject: (project) => {
    if (!project || get().hydratedProjectId === project.id) return;
    set({ hydratedProjectId: project.id, guides: project.studyGuides ?? [], selectedId: null, measure: { ...get().measure, enabled: false } });
  },
  guides: [],
  selectedId: null,
  measure: { enabled: false, a: { x: 100, y: 100 }, b: { x: 300, y: 100 } },

  addGuide: (kind, w, h) => {
    const guide: StudyGuide = {
      id: uuid(),
      kind,
      x: w / 2,
      y: h / 2,
      size: Math.round(h * (kind === 'figure' ? 0.8 : kind === 'ellipse' ? 0.3 : kind === 'curvilinear' ? 0.9 : kind === 'room' || kind === 'building' ? 0.85 : 0.5)),
      rotation: 0,
      opacity: 0.7,
      color: '#3ec6ff',
      flipH: false,
      ratio: 0.4,
      heads: kind === 'room' ? 8 : kind === 'building' ? 6 : 8,
    };
    set((s) => ({ guides: [...s.guides, guide], selectedId: guide.id }));
    persist(get);
  },
  updateGuide: (id, patch) => {
    set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
    persist(get);
  },
  removeGuide: (id) => {
    set((s) => ({ guides: s.guides.filter((g) => g.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }));
    persist(get);
  },
  selectGuide: (id) => set({ selectedId: id }),
  setMeasureEnabled: (enabled, w, h) =>
    set((s) => ({
      measure: {
        ...s.measure,
        enabled,
        ...(enabled && w && h ? { a: { x: w * 0.3, y: h / 2 }, b: { x: w * 0.7, y: h / 2 } } : {}),
      },
    })),
  setMeasurePoint: (which, p) => set((s) => ({ measure: { ...s.measure, [which]: p } })),
}));

import { create } from 'zustand';

const STORAGE_KEY = 'schizzo-completed-tours';

/** Just a handful of "have you seen this tour" checkmarks — low enough stakes (unlike the
 * Asset Library's user-created patterns/gradients/textures) that a dedicated Electron-fs IPC
 * round trip isn't worth it; localStorage's per-browser-profile scope is an acceptable
 * trade-off here specifically. */
function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCompleted(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort only.
  }
}

interface LearningStore {
  activeTourId: string | null;
  activeStepIndex: number;
  completedTours: Set<string>;

  startTour: (tourId: string) => void;
  nextStep: (totalSteps: number) => void;
  prevStep: () => void;
  endTour: () => void;
}

export const useLearningStore = create<LearningStore>((set, get) => ({
  activeTourId: null,
  activeStepIndex: 0,
  completedTours: loadCompleted(),

  startTour: (tourId) => set({ activeTourId: tourId, activeStepIndex: 0 }),

  nextStep: (totalSteps) => {
    const { activeTourId, activeStepIndex } = get();
    if (!activeTourId) return;
    if (activeStepIndex + 1 >= totalSteps) {
      const completed = new Set(get().completedTours);
      completed.add(activeTourId);
      saveCompleted(completed);
      set({ activeTourId: null, activeStepIndex: 0, completedTours: completed });
    } else {
      set({ activeStepIndex: activeStepIndex + 1 });
    }
  },

  prevStep: () => set((s) => ({ activeStepIndex: Math.max(0, s.activeStepIndex - 1) })),

  endTour: () => set({ activeTourId: null, activeStepIndex: 0 }),
}));

import { create } from 'zustand';

const STORAGE_KEY = 'schizzo-completed-tours';
const ONBOARDING_KEY = 'schizzo-onboarding-tour-shown';

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
  maybeStartOnboardingTour: () => void;
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

  // Called once, right after a project finishes being created (see NewProjectDialog.handleCreate)
  // — fires the "getting-started" tour the very first time this ever happens, regardless of
  // whether the person finishes or skips it, and never again after that.
  maybeStartOnboardingTour: () => {
    // window.electronAPI is a contextBridge object — intentionally read-only from the renderer,
    // so a check-harness test can't just flip isCheckMode off. This localStorage override exists
    // for exactly that: something to test with that real users would never stumble onto.
    let forceReal = false;
    try {
      forceReal = localStorage.getItem('schizzo-onboarding-force-real-user') === '1';
    } catch {
      /* ignore */
    }
    if (!forceReal && window.electronAPI?.isCheckMode) return; // the automated check battery doesn't count
    try {
      if (localStorage.getItem(ONBOARDING_KEY)) return;
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      return; // no storage means no way to remember "already shown" — skip rather than repeat it
    } // on every single new project
    get().startTour('getting-started');
  },
}));

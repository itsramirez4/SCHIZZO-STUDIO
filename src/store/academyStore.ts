import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { Exercise } from '@/content/academy';
import { HistoryEntry, Rating, StudyPlan } from '@/services/academy.service';

const KEY = 'schizzo-academy-v1';

export interface ChallengeResult {
  challengeId: string;
  date: string;
  done: number;
  target: number;
  secondsUsed: number;
}

interface Persisted {
  history: HistoryEntry[];
  plan: StudyPlan | null;
  challenges: ChallengeResult[];
}

/** Same low-stakes localStorage approach as learningStore: this is a personal practice log, and
 * a per-profile browser store is enough (it is not part of a project file or cloud-synced). */
function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { history: [], plan: null, challenges: [], ...JSON.parse(raw) };
  } catch {
    // Fall through to defaults.
  }
  return { history: [], plan: null, challenges: [] };
}

function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Best-effort only.
  }
}

interface AcademyStore extends Persisted {
  logExercise: (exercise: Exercise, rating: Rating, minutes?: number) => void;
  createPlan: (module: string, sessions: number, minutesPerSession: number, startLevel: number) => void;
  completeSession: () => void;
  clearPlan: () => void;
  logChallenge: (result: Omit<ChallengeResult, 'date'>) => void;
  resetProgress: () => void;
}

export const useAcademyStore = create<AcademyStore>((set, get) => {
  const persist = () => {
    const { history, plan, challenges } = get();
    save({ history, plan, challenges });
  };
  return {
    ...load(),

    logExercise: (exercise, rating, minutes) => {
      set((s) => ({
        history: [...s.history, { exerciseId: exercise.id, module: exercise.module, date: new Date().toISOString(), minutes: minutes ?? exercise.minutes, rating }],
      }));
      persist();
    },
    createPlan: (module, sessions, minutesPerSession, startLevel) => {
      set({ plan: { id: uuid(), module, sessions, minutesPerSession, startLevel, createdAt: new Date().toISOString(), completed: 0 } });
      persist();
    },
    completeSession: () => {
      set((s) => (s.plan ? { plan: { ...s.plan, completed: Math.min(s.plan.sessions, s.plan.completed + 1) } } : {}));
      persist();
    },
    clearPlan: () => {
      set({ plan: null });
      persist();
    },
    logChallenge: (result) => {
      set((s) => ({ challenges: [...s.challenges, { ...result, date: new Date().toISOString() }] }));
      persist();
    },
    resetProgress: () => {
      set({ history: [], plan: null, challenges: [] });
      persist();
    },
  };
});

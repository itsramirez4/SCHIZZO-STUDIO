import { create } from 'zustand';
import { useUIStore } from './uiStore';

export type PosePhase = 'off' | 'pose' | 'observe' | 'hidden' | 'reveal';
export type PoseMode = 'random' | 'memory';

const OBSERVE_SECONDS = 20;
const REVEAL_SECONDS = 15;

interface PoseSessionStore {
  mode: PoseMode;
  phase: PosePhase;
  /** Seconds per pose (random mode) or per drawing window (memory mode). */
  duration: number;
  remaining: number;
  posesDone: number;
  /** Bumped each time a new pose should be generated; the 3D panel reacts to it. */
  nonce: number;

  start: (mode: PoseMode, duration: number) => void;
  stop: () => void;
  skip: () => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

function clear() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Timed pose practice. The interval lives at module level (not in a component) so the countdown
 * keeps running whichever panels are open; the 3D reference panel just reacts to `nonce`/`phase`.
 */
export const usePoseSessionStore = create<PoseSessionStore>((set, get) => {
  function advance() {
    const s = get();
    if (s.mode === 'random') {
      set({ posesDone: s.posesDone + 1, nonce: s.nonce + 1, remaining: s.duration });
      return;
    }
    // memory: observe → hidden → reveal → next pose
    if (s.phase === 'observe') set({ phase: 'hidden', remaining: s.duration });
    else if (s.phase === 'hidden') set({ phase: 'reveal', remaining: REVEAL_SECONDS });
    else set({ phase: 'observe', remaining: OBSERVE_SECONDS, posesDone: s.posesDone + 1, nonce: s.nonce + 1 });
  }

  return {
    mode: 'random',
    phase: 'off',
    duration: 60,
    remaining: 0,
    posesDone: 0,
    nonce: 0,

    start: (mode, duration) => {
      clear();
      // The 3D reference window is where the pose appears.
      if (!useUIStore.getState().showReference3DPanel) useUIStore.getState().toggleReference3DPanel();
      set({
        mode,
        duration,
        phase: mode === 'random' ? 'pose' : 'observe',
        remaining: mode === 'random' ? duration : OBSERVE_SECONDS,
        posesDone: 0,
        nonce: get().nonce + 1,
      });
      timer = setInterval(() => {
        const s = get();
        if (s.phase === 'off') return clear();
        if (s.remaining <= 1) advance();
        else set({ remaining: s.remaining - 1 });
      }, 1000);
    },
    stop: () => {
      clear();
      set({ phase: 'off', remaining: 0 });
    },
    skip: () => {
      if (get().phase !== 'off') advance();
    },
  };
});

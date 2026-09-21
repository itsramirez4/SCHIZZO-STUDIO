import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { RigState, SubjectKind, normalizeRigState } from '@/services/mannequin.service';

/** A pose (or a whole figure: body type, clothes, colour) the artist kept for reuse. */
export interface SavedPose {
  id: string;
  name: string;
  kind: SubjectKind;
  created: number;
  /** Small JPEG of the figure at the time it was saved. */
  thumbnail?: string;
  state: RigState;
}

const KEY = 'schizzo-pose-library';

function load(): SavedPose[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isSavedPose) : [];
  } catch {
    return [];
  }
}

function isSavedPose(p: unknown): p is SavedPose {
  const x = p as SavedPose;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && !!x.state && typeof x.state.kind === 'string' && typeof x.state.pose === 'object';
}

function persist(list: SavedPose[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

interface PoseLibraryState {
  poses: SavedPose[];
  /** Returns false when the browser storage is full or unavailable (nothing is saved then). */
  save: (name: string, state: RigState, thumbnail?: string) => boolean;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  exportJson: () => string;
  /** Adds every valid pose in `text`; returns how many were imported (0 if it isn't a pose file). */
  importJson: (text: string) => number;
}

export const usePoseLibraryStore = create<PoseLibraryState>((set, get) => ({
  poses: load(),

  save: (name, state, thumbnail) => {
    const entry: SavedPose = {
      id: uuid(),
      name: name.trim() || 'Pose sin nombre',
      kind: state.kind,
      created: Date.now(),
      thumbnail,
      state: JSON.parse(JSON.stringify(state)),
    };
    const next = [entry, ...get().poses];
    if (!persist(next)) return false;
    set({ poses: next });
    return true;
  },

  remove: (id) => {
    const next = get().poses.filter((p) => p.id !== id);
    persist(next);
    set({ poses: next });
  },

  rename: (id, name) => {
    const next = get().poses.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
    persist(next);
    set({ poses: next });
  },

  exportJson: () => JSON.stringify({ app: 'schizzo-studio', type: 'pose-library', version: 1, poses: get().poses }, null, 2),

  importJson: (text) => {
    let parsed: { poses?: unknown[] } | unknown[];
    try {
      parsed = JSON.parse(text);
    } catch {
      return 0;
    }
    const raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.poses) ? parsed.poses : [];
    const incoming = raw.filter(isSavedPose).map((p) => ({ ...p, id: uuid(), state: normalizeRigState(p.state) }));
    if (incoming.length === 0) return 0;
    const next = [...incoming, ...get().poses];
    if (!persist(next)) return 0;
    set({ poses: next });
    return incoming.length;
  },
}));

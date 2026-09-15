import { create } from 'zustand';
import { ReferenceImage } from '@/types/references';
import { isElectron } from '@/utils/fileUtils';

interface PersistedReferenceLibrary {
  references: ReferenceImage[];
}

interface ReferenceLibraryStore {
  references: ReferenceImage[];
  loaded: boolean;
  loadLibrary: () => Promise<void>;

  addReference: (ref: ReferenceImage) => void;
  removeReference: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setTags: (id: string, tags: string[]) => void;
  recordView: (id: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Same debounced-autosave pattern as assetLibraryStore, in a separate file (reference-library.json)
 * so large reference photos don't bloat the much smaller patterns/gradients/textures/palettes file. */
function schedulePersist(get: () => ReferenceLibraryStore) {
  if (!isElectron()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload: PersistedReferenceLibrary = { references: get().references };
    window.electronAPI.saveReferenceLibrary(JSON.stringify(payload));
  }, 400);
}

export const useReferenceLibraryStore = create<ReferenceLibraryStore>((set, get) => ({
  references: [],
  loaded: false,

  loadLibrary: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    if (!isElectron()) return;
    const { json } = await window.electronAPI.loadReferenceLibrary();
    if (!json) return;
    try {
      const data = JSON.parse(json) as PersistedReferenceLibrary;
      set({ references: data.references ?? [] });
    } catch (err) {
      console.error('Biblioteca de referencias corrupta, se ignora', err);
    }
  },

  addReference: (ref) => {
    set((s) => ({ references: [ref, ...s.references] }));
    schedulePersist(get);
  },
  removeReference: (id) => {
    set((s) => ({ references: s.references.filter((r) => r.id !== id) }));
    schedulePersist(get);
  },
  toggleFavorite: (id) => {
    set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)) }));
    schedulePersist(get);
  },
  setTags: (id, tags) => {
    set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, tags } : r)) }));
    schedulePersist(get);
  },
  recordView: (id) => {
    set((s) => ({
      references: s.references.map((r) => (r.id === id ? { ...r, viewCount: r.viewCount + 1, lastViewedAt: Date.now() } : r)),
    }));
    schedulePersist(get);
  },
}));

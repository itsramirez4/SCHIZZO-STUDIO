import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { FilterPreset } from '@/types';
import { isElectron } from '@/utils/fileUtils';

interface FilterPresetsStore {
  presets: FilterPreset[];
  loaded: boolean;
  loadPresets: () => Promise<void>;
  savePreset: (filterId: string, name: string, params: Record<string, number | string>) => void;
  deletePreset: (id: string) => void;
  presetsFor: (filterId: string) => FilterPreset[];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(get: () => FilterPresetsStore) {
  if (!isElectron()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.electronAPI.saveFilterPresets(JSON.stringify(get().presets));
  }, 400);
}

export const useFilterPresetsStore = create<FilterPresetsStore>((set, get) => ({
  presets: [],
  loaded: false,

  loadPresets: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    if (!isElectron()) return;
    const { json } = await window.electronAPI.loadFilterPresets();
    if (!json) return;
    try {
      set({ presets: JSON.parse(json) as FilterPreset[] });
    } catch (err) {
      console.error('Presets de filtro corruptos, se ignoran', err);
    }
  },

  savePreset: (filterId, name, params) => {
    const preset: FilterPreset = { id: uuid(), filterId, name, params };
    set((s) => ({ presets: [...s.presets, preset] }));
    persist(get);
  },

  deletePreset: (id) => {
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
    persist(get);
  },

  presetsFor: (filterId) => get().presets.filter((p) => p.filterId === filterId),
}));

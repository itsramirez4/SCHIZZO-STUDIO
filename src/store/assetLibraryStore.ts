import { create } from 'zustand';
import { LibraryGradient, LibraryPattern, LibraryTexture, LibraryPalette } from '@/types/assetLibrary';
import { BUILT_IN_GRADIENTS } from '@/services/gradientLibrary.service';
import { BUILT_IN_PALETTES } from '@/services/paletteLibrary.service';
import { isElectron } from '@/utils/fileUtils';

interface PersistedLibrary {
  patterns: LibraryPattern[];
  gradients: LibraryGradient[];
  textures: LibraryTexture[];
  palettes: LibraryPalette[];
}

interface AssetLibraryStore extends PersistedLibrary {
  loaded: boolean;
  loadLibrary: () => Promise<void>;

  addPattern: (pattern: LibraryPattern) => void;
  removePattern: (id: string) => void;
  togglePatternFavorite: (id: string) => void;

  addGradient: (gradient: LibraryGradient) => void;
  removeGradient: (id: string) => void;
  toggleGradientFavorite: (id: string) => void;

  addTexture: (texture: LibraryTexture) => void;
  removeTexture: (id: string) => void;
  toggleTextureFavorite: (id: string) => void;

  addPalette: (palette: LibraryPalette) => void;
  removePalette: (id: string) => void;
  togglePaletteFavorite: (id: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced so rapid changes (e.g. several imports in a row) don't each trigger their own
 * disk write; every mutation still ends up persisted a moment later. */
function schedulePersist(get: () => AssetLibraryStore) {
  if (!isElectron()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { patterns, gradients, textures, palettes } = get();
    const customGradients = gradients.filter((g) => !g.builtIn);
    const customPalettes = palettes.filter((p) => !p.builtIn);
    const payload: PersistedLibrary = { patterns, gradients: customGradients, textures, palettes: customPalettes };
    window.electronAPI.saveAssetLibrary(JSON.stringify(payload));
  }, 400);
}

export const useAssetLibraryStore = create<AssetLibraryStore>((set, get) => ({
  patterns: [],
  gradients: [...BUILT_IN_GRADIENTS],
  textures: [],
  palettes: [...BUILT_IN_PALETTES],
  loaded: false,

  loadLibrary: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    if (!isElectron()) return;
    const { json } = await window.electronAPI.loadAssetLibrary();
    if (!json) return;
    try {
      const data = JSON.parse(json) as PersistedLibrary;
      set({
        patterns: data.patterns ?? [],
        gradients: [...BUILT_IN_GRADIENTS, ...(data.gradients ?? [])],
        textures: data.textures ?? [],
        palettes: [...BUILT_IN_PALETTES, ...(data.palettes ?? [])],
      });
    } catch (err) {
      console.error('Biblioteca de assets corrupta, se ignora', err);
    }
  },

  addPattern: (pattern) => {
    set((s) => ({ patterns: [...s.patterns, pattern] }));
    schedulePersist(get);
  },
  removePattern: (id) => {
    set((s) => ({ patterns: s.patterns.filter((p) => p.id !== id) }));
    schedulePersist(get);
  },
  togglePatternFavorite: (id) => {
    set((s) => ({ patterns: s.patterns.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)) }));
    schedulePersist(get);
  },

  addGradient: (gradient) => {
    set((s) => ({ gradients: [...s.gradients, gradient] }));
    schedulePersist(get);
  },
  removeGradient: (id) => {
    set((s) => ({ gradients: s.gradients.filter((g) => g.id !== id || g.builtIn) }));
    schedulePersist(get);
  },
  toggleGradientFavorite: (id) => {
    set((s) => ({ gradients: s.gradients.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)) }));
    schedulePersist(get);
  },

  addTexture: (texture) => {
    set((s) => ({ textures: [...s.textures, texture] }));
    schedulePersist(get);
  },
  removeTexture: (id) => {
    set((s) => ({ textures: s.textures.filter((t) => t.id !== id) }));
    schedulePersist(get);
  },
  toggleTextureFavorite: (id) => {
    set((s) => ({ textures: s.textures.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)) }));
    schedulePersist(get);
  },

  addPalette: (palette) => {
    set((s) => ({ palettes: [...s.palettes, palette] }));
    schedulePersist(get);
  },
  removePalette: (id) => {
    set((s) => ({ palettes: s.palettes.filter((p) => p.id !== id || p.builtIn) }));
    schedulePersist(get);
  },
  togglePaletteFavorite: (id) => {
    set((s) => ({ palettes: s.palettes.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)) }));
    schedulePersist(get);
  },
}));

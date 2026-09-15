import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  Guide,
  GuideType,
  PerspectiveGridSettings,
  PerspectiveGridType,
  PerspectivePreset,
  SnapSettings,
  SnapTarget,
  SymmetryMode,
  SymmetrySettings,
  VanishingPoint,
} from '@/types/perspective';
import { createDefaultGrid, gridPointsFromFractions, gridPointsToFractions, pointsForType } from '@/services/perspectiveGrid.service';
import { useAppStore } from '@/store/appStore';
import { Project } from '@/types';
import { isElectron } from '@/utils/fileUtils';

const DEFAULT_SYMMETRY: SymmetrySettings = {
  mode: 'none',
  centerX: 0,
  centerY: 0,
  enabled: false,
  showGuidelines: true,
  guidelineColor: '#4a9eff',
  guidelineOpacity: 0.35,
  angle: 45,
};

const DEFAULT_SNAP: SnapSettings = {
  enabled: true,
  targets: ['guides', 'canvas'],
  tolerance: 8,
};

interface PerspectiveStore {
  grid: PerspectiveGridSettings;
  symmetry: SymmetrySettings;
  guides: Guide[];
  snap: SnapSettings;

  hydratedProjectId: string | null;

  hydrateFromProject: (project: Project | null) => void;

  setGridType: (type: PerspectiveGridType, canvasWidth: number, canvasHeight: number) => void;
  toggleGridEnabled: () => void;
  updateGridSettings: (updates: Partial<Pick<PerspectiveGridSettings, 'color' | 'opacity' | 'divisions'>>) => void;
  moveVanishingPoint: (id: VanishingPoint['id'], x: number, y: number) => void;
  toggleVanishingPointLocked: (id: VanishingPoint['id']) => void;
  toggleVanishingPointVisible: (id: VanishingPoint['id']) => void;

  setSymmetryMode: (mode: SymmetryMode) => void;
  toggleSymmetryEnabled: () => void;
  updateSymmetrySettings: (updates: Partial<SymmetrySettings>) => void;
  moveSymmetryCenter: (x: number, y: number) => void;

  addGuide: (type: GuideType, x: number, y: number, angle?: number) => string;
  removeGuide: (id: string) => void;
  moveGuide: (id: string, x?: number, y?: number) => void;
  toggleGuideLocked: (id: string) => void;
  toggleGuideVisible: (id: string) => void;
  clearGuides: () => void;

  updateSnapSettings: (updates: Partial<SnapSettings>) => void;
  toggleSnapTarget: (target: SnapTarget) => void;

  presets: PerspectivePreset[];
  presetsLoaded: boolean;
  loadPresets: () => Promise<void>;
  saveCurrentAsPreset: (name: string, canvasWidth: number, canvasHeight: number) => void;
  applyPreset: (id: string, canvasWidth: number, canvasHeight: number) => void;
  deletePreset: (id: string) => void;
}

function persist(get: () => PerspectiveStore) {
  const { grid, guides, symmetry } = get();
  useAppStore.getState().updatePerspectiveData({ grid, guides, symmetry });
}

let presetsSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistPresets(get: () => PerspectiveStore) {
  if (!isElectron()) return;
  if (presetsSaveTimer) clearTimeout(presetsSaveTimer);
  presetsSaveTimer = setTimeout(() => {
    window.electronAPI.savePerspectivePresets(JSON.stringify(get().presets));
  }, 400);
}

export const usePerspectiveStore = create<PerspectiveStore>((set, get) => ({
  grid: createDefaultGrid(1000, 1000),
  symmetry: DEFAULT_SYMMETRY,
  guides: [],
  snap: DEFAULT_SNAP,
  hydratedProjectId: null,
  presets: [],
  presetsLoaded: false,

  // Perspective/guides/symmetry are per-project content (see Project.perspective); snap settings
  // stay as app-wide tool preferences and are deliberately NOT reset here.
  hydrateFromProject: (project) => {
    if (!project || get().hydratedProjectId === project.id) return;
    const saved = project.perspective;
    set({
      hydratedProjectId: project.id,
      grid: saved?.grid ?? createDefaultGrid(project.width, project.height),
      guides: saved?.guides ?? [],
      symmetry: saved?.symmetry ?? { ...DEFAULT_SYMMETRY, centerX: project.width / 2, centerY: project.height / 2 },
    });
  },

  setGridType: (type, canvasWidth, canvasHeight) => {
    set((s) => ({ grid: { ...s.grid, type, points: pointsForType(type, canvasWidth, canvasHeight, s.grid.points) } }));
    persist(get);
  },
  toggleGridEnabled: () => {
    set((s) => ({ grid: { ...s.grid, enabled: !s.grid.enabled } }));
    persist(get);
  },
  updateGridSettings: (updates) => {
    set((s) => ({ grid: { ...s.grid, ...updates } }));
    persist(get);
  },
  moveVanishingPoint: (id, x, y) => {
    set((s) => {
      const point = s.grid.points[id];
      if (!point || point.locked) return s;
      return { grid: { ...s.grid, points: { ...s.grid.points, [id]: { ...point, x, y } } } };
    });
    persist(get);
  },
  toggleVanishingPointLocked: (id) => {
    set((s) => {
      const point = s.grid.points[id];
      if (!point) return s;
      return { grid: { ...s.grid, points: { ...s.grid.points, [id]: { ...point, locked: !point.locked } } } };
    });
    persist(get);
  },
  toggleVanishingPointVisible: (id) => {
    set((s) => {
      const point = s.grid.points[id];
      if (!point) return s;
      return { grid: { ...s.grid, points: { ...s.grid.points, [id]: { ...point, visible: !point.visible } } } };
    });
    persist(get);
  },

  setSymmetryMode: (mode) => {
    set((s) => ({ symmetry: { ...s.symmetry, mode, enabled: mode !== 'none' } }));
    persist(get);
  },
  toggleSymmetryEnabled: () => {
    set((s) => ({ symmetry: { ...s.symmetry, enabled: !s.symmetry.enabled } }));
    persist(get);
  },
  updateSymmetrySettings: (updates) => {
    set((s) => ({ symmetry: { ...s.symmetry, ...updates } }));
    persist(get);
  },
  moveSymmetryCenter: (x, y) => {
    set((s) => ({ symmetry: { ...s.symmetry, centerX: x, centerY: y } }));
    persist(get);
  },

  addGuide: (type, x, y, angle) => {
    const id = uuid();
    const guide: Guide = {
      id,
      type,
      x: type !== 'horizontal' ? x : undefined,
      y: type !== 'vertical' ? y : undefined,
      angle: type === 'diagonal' ? (angle ?? 45) : undefined,
      visible: true,
      locked: false,
      color: '#4a9eff',
    };
    set((s) => ({ guides: [...s.guides, guide] }));
    persist(get);
    return id;
  },
  removeGuide: (id) => {
    set((s) => ({ guides: s.guides.filter((g) => g.id !== id) }));
    persist(get);
  },
  moveGuide: (id, x, y) => {
    set((s) => ({
      guides: s.guides.map((g) => {
        if (g.id !== id || g.locked) return g;
        return { ...g, x: x !== undefined ? x : g.x, y: y !== undefined ? y : g.y };
      }),
    }));
    persist(get);
  },
  toggleGuideLocked: (id) => {
    set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)) }));
    persist(get);
  },
  toggleGuideVisible: (id) => {
    set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, visible: !g.visible } : g)) }));
    persist(get);
  },
  clearGuides: () => {
    set({ guides: [] });
    persist(get);
  },

  updateSnapSettings: (updates) => set((s) => ({ snap: { ...s.snap, ...updates } })),
  toggleSnapTarget: (target) =>
    set((s) => ({
      snap: {
        ...s.snap,
        targets: s.snap.targets.includes(target) ? s.snap.targets.filter((t) => t !== target) : [...s.snap.targets, target],
      },
    })),

  loadPresets: async () => {
    if (get().presetsLoaded) return;
    set({ presetsLoaded: true });
    if (!isElectron()) return;
    const { json } = await window.electronAPI.loadPerspectivePresets();
    if (!json) return;
    try {
      set({ presets: JSON.parse(json) as PerspectivePreset[] });
    } catch (err) {
      console.error('Presets de perspectiva corruptos, se ignoran', err);
    }
  },

  saveCurrentAsPreset: (name, canvasWidth, canvasHeight) => {
    const grid = get().grid;
    const preset: PerspectivePreset = {
      id: uuid(),
      name,
      grid: { ...grid, points: gridPointsToFractions(grid.points, canvasWidth, canvasHeight) },
    };
    set((s) => ({ presets: [...s.presets, preset] }));
    persistPresets(get);
  },

  applyPreset: (id, canvasWidth, canvasHeight) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    const grid: PerspectiveGridSettings = {
      ...preset.grid,
      enabled: true,
      points: gridPointsFromFractions(preset.grid.points, canvasWidth, canvasHeight),
    };
    set({ grid });
    persist(get);
  },

  deletePreset: (id) => {
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
    persistPresets(get);
  },
}));

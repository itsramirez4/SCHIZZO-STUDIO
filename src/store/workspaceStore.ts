import { create } from 'zustand';
import { PanelId, PanelLayout, PanelPosition, ThemeMode } from '@/types/workspace';
import { WORKSPACE_PRESETS, getPreset } from '@/services/workspacePresets.service';

const STORAGE_KEY = 'schizzo-workspace-v1';

const PANEL_IDS: PanelId[] = ['toolbox', 'canvas', 'layers', 'filters', 'comic', 'animation', 'histogram', 'history'];

function resolveFraction(frac: { x: number; y: number; w: number; h: number }): PanelPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight - 40; // leave room for the workspace toolbar
  return { x: frac.x * vw, y: 40 + frac.y * vh, width: frac.w * vw, height: frac.h * vh };
}

function panelsFromPreset(presetId: string): Record<PanelId, PanelLayout> {
  const preset = getPreset(presetId) ?? WORKSPACE_PRESETS[0];
  const panels = {} as Record<PanelId, PanelLayout>;
  let z = 1;
  for (const id of PANEL_IDS) {
    const frac = preset.panels[id];
    panels[id] = {
      position: resolveFraction(frac),
      collapsed: !!frac.collapsed,
      visible: frac.visible !== false,
      zIndex: z++,
    };
  }
  return panels;
}

interface PersistedShape {
  version: number;
  mode: 'classic' | 'floating';
  presetId: string | null;
  uiScale: number;
  theme: ThemeMode;
  panels: Record<PanelId, PanelLayout>;
}

function loadPersisted(): PersistedShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(state: Pick<WorkspaceStore, 'mode' | 'presetId' | 'uiScale' | 'theme' | 'panels'>) {
  try {
    const data: PersistedShape = { version: 1, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage can throw (private mode, quota) — losing the saved layout isn't fatal.
  }
}

interface WorkspaceStore {
  mode: 'classic' | 'floating';
  panels: Record<PanelId, PanelLayout>;
  presetId: string | null;
  uiScale: number;
  theme: ThemeMode;
  nextZIndex: number;

  setMode: (mode: 'classic' | 'floating') => void;
  loadPreset: (id: string) => void;
  updatePanelPosition: (id: PanelId, position: PanelPosition) => void;
  toggleCollapsed: (id: PanelId) => void;
  toggleVisible: (id: PanelId) => void;
  bringToFront: (id: PanelId) => void;
  setUIScale: (scale: number) => void;
  setTheme: (theme: ThemeMode) => void;
  resetLayout: () => void;
}

const persisted = typeof window !== 'undefined' ? loadPersisted() : null;

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  mode: persisted?.mode ?? 'classic',
  panels: persisted?.panels ?? panelsFromPreset('digital-painting'),
  presetId: persisted?.presetId ?? null,
  uiScale: persisted?.uiScale ?? 1,
  theme: persisted?.theme ?? 'auto',
  nextZIndex: 100,

  setMode: (mode) => {
    set({ mode });
    persist({ mode, presetId: get().presetId, uiScale: get().uiScale, theme: get().theme, panels: get().panels });
  },

  loadPreset: (id) => {
    const preset = getPreset(id);
    if (!preset) return;
    const panels = panelsFromPreset(id);
    set({ mode: 'floating', presetId: id, uiScale: preset.uiScale, theme: preset.theme, panels });
    get().setTheme(preset.theme); // applies the data-theme attribute too, not just the store value
    persist({ mode: 'floating', presetId: id, uiScale: preset.uiScale, theme: preset.theme, panels });
  },

  // Called once, on drag/resize release — not on every intermediate pointermove frame, which
  // the dragging panel tracks in its own local state instead. Committing every frame here
  // would re-render every consumer of `panels` (any panel reading its own slice) and hammer
  // localStorage tens of times a second for one drag.
  updatePanelPosition: (id, position) => {
    set((s) => ({ panels: { ...s.panels, [id]: { ...s.panels[id], position } } }));
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: s.uiScale, theme: s.theme, panels: s.panels });
  },

  toggleCollapsed: (id) => {
    set((s) => ({ panels: { ...s.panels, [id]: { ...s.panels[id], collapsed: !s.panels[id].collapsed } } }));
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: s.uiScale, theme: s.theme, panels: s.panels });
  },

  toggleVisible: (id) => {
    set((s) => ({ panels: { ...s.panels, [id]: { ...s.panels[id], visible: !s.panels[id].visible } } }));
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: s.uiScale, theme: s.theme, panels: s.panels });
  },

  bringToFront: (id) => {
    set((s) => {
      // Already on top — every pointerdown on a panel calls this (header drag-start,
      // resize-start, and just clicking anywhere in its body), so skip the no-op update
      // rather than bumping zIndex and re-rendering the panel on every single click.
      if (s.panels[id].zIndex === s.nextZIndex) return s;
      const z = s.nextZIndex + 1;
      return { nextZIndex: z, panels: { ...s.panels, [id]: { ...s.panels[id], zIndex: z } } };
    });
  },

  setUIScale: (scale) => {
    const clamped = Math.max(0.8, Math.min(1.5, scale));
    set({ uiScale: clamped });
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: clamped, theme: s.theme, panels: s.panels });
  },

  setTheme: (theme) => {
    set({ theme });
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: s.uiScale, theme, panels: s.panels });
  },

  resetLayout: () => {
    const panels = panelsFromPreset(get().presetId ?? 'digital-painting');
    set({ panels });
    const s = get();
    persist({ mode: s.mode, presetId: s.presetId, uiScale: s.uiScale, theme: s.theme, panels });
  },
}));

// Apply the persisted (or default 'auto') theme attribute once at startup, same as setTheme
// would, without going through the full action (avoids an extra localStorage write on load).
if (typeof document !== 'undefined') {
  const theme = persisted?.theme ?? 'auto';
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

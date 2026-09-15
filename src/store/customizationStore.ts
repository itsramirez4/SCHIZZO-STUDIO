import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { KeyCombo } from '@/types/shortcuts';
import { DiscreteGestureType } from '@/types/gestures';
import { WorkflowProfile, RecordedMacro, MacroStep } from '@/types/profiles';
import { BUILT_IN_PROFILES } from '@/data/builtInProfiles';
import { PANEL_ID_TO_UI_KEY } from '@/data/panelIds';
import { isElectron } from '@/utils/fileUtils';
import { useAppStore } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';
import { useShortcutRuntimeStore } from '@/store/shortcutRuntimeStore';

const DEFAULT_GESTURE_BINDINGS: Record<DiscreteGestureType, string | null> = {
  tap: null,
  doubleTap: null,
  longPress: 'tool.eyedropper',
  swipeLeft: 'edit.undo',
  swipeRight: 'edit.redo',
  swipeUp: null,
  swipeDown: null,
  twoFingerTap: null,
  threeFingerTap: null,
};

interface PersistedCustomization {
  overrides: Record<string, KeyCombo | null>;
  customProfiles: WorkflowProfile[];
  activeProfileId: string | null;
  macros: RecordedMacro[];
  gestureBindings: Record<DiscreteGestureType, string | null>;
}

interface CustomizationStore {
  overrides: Record<string, KeyCombo | null>;
  customProfiles: WorkflowProfile[];
  activeProfileId: string | null;
  macros: RecordedMacro[];
  gestureBindings: Record<DiscreteGestureType, string | null>;
  loaded: boolean;

  setGestureBinding: (gesture: DiscreteGestureType, actionId: string | null) => void;

  isRecording: boolean;
  recordingSteps: MacroStep[];
  recordingLastTs: number;
  isPlaying: boolean;
  playingMacroId: string | null;

  loadAll: () => Promise<void>;
  setOverride: (id: string, combo: KeyCombo | null) => void;
  resetOverride: (id: string) => void;
  resetAllOverrides: () => void;

  applyProfile: (profileId: string) => void;
  saveCurrentAsProfile: (name: string) => void;
  deleteProfile: (profileId: string) => void;

  startRecording: () => void;
  stopRecording: (name: string) => void;
  cancelRecording: () => void;
  recordStep: (actionId: string) => void;
  deleteMacro: (id: string) => void;
  playMacro: (id: string, speed?: number) => Promise<void>;
  stopPlayback: () => void;

  exportProfile: (profileId: string) => string;
  importProfile: (json: string) => { ok: boolean; error?: string };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(get: () => CustomizationStore) {
  if (!isElectron()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { overrides, customProfiles, activeProfileId, macros, gestureBindings } = get();
    const payload: PersistedCustomization = { overrides, customProfiles, activeProfileId, macros, gestureBindings };
    window.electronAPI.saveCustomization(JSON.stringify(payload));
  }, 400);
}

export function allProfiles(store: Pick<CustomizationStore, 'customProfiles'>): WorkflowProfile[] {
  return [...BUILT_IN_PROFILES, ...store.customProfiles];
}

export const useCustomizationStore = create<CustomizationStore>((set, get) => ({
  overrides: {},
  customProfiles: [],
  activeProfileId: null,
  macros: [],
  gestureBindings: { ...DEFAULT_GESTURE_BINDINGS },
  loaded: false,

  setGestureBinding: (gesture, actionId) => {
    set((s) => ({ gestureBindings: { ...s.gestureBindings, [gesture]: actionId } }));
    schedulePersist(get);
  },

  isRecording: false,
  recordingSteps: [],
  recordingLastTs: 0,
  isPlaying: false,
  playingMacroId: null,

  loadAll: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    if (!isElectron()) return;
    const { json } = await window.electronAPI.loadCustomization();
    if (!json) return;
    try {
      const data = JSON.parse(json) as PersistedCustomization;
      set({
        overrides: data.overrides ?? {},
        customProfiles: data.customProfiles ?? [],
        activeProfileId: data.activeProfileId ?? null,
        macros: data.macros ?? [],
        gestureBindings: { ...DEFAULT_GESTURE_BINDINGS, ...(data.gestureBindings ?? {}) },
      });
    } catch (err) {
      console.error('Configuración de personalización corrupta, se ignora', err);
    }
  },

  setOverride: (id, combo) => {
    set((s) => ({ overrides: { ...s.overrides, [id]: combo } }));
    schedulePersist(get);
  },
  resetOverride: (id) => {
    set((s) => {
      const next = { ...s.overrides };
      delete next[id];
      return { overrides: next };
    });
    schedulePersist(get);
  },
  resetAllOverrides: () => {
    set({ overrides: {} });
    schedulePersist(get);
  },

  applyProfile: (profileId) => {
    const profile = allProfiles(get()).find((p) => p.id === profileId);
    if (!profile) return;

    set({ overrides: { ...profile.shortcutOverrides }, activeProfileId: profileId });
    schedulePersist(get);

    useAppStore.getState().updateCurrentBrush({ size: profile.defaultBrushSize, opacity: profile.defaultOpacity });

    const panelUpdates: Record<string, boolean> = {};
    for (const uiKey of Object.values(PANEL_ID_TO_UI_KEY)) panelUpdates[uiKey] = false;
    for (const panelId of profile.visiblePanels) {
      const uiKey = PANEL_ID_TO_UI_KEY[panelId];
      if (uiKey) panelUpdates[uiKey] = true;
    }
    useUIStore.setState(panelUpdates);
  },

  saveCurrentAsProfile: (name) => {
    const { currentBrush } = useAppStore.getState();
    const ui = useUIStore.getState();
    const visiblePanels = Object.entries(PANEL_ID_TO_UI_KEY)
      .filter(([, uiKey]) => (ui as unknown as Record<string, boolean>)[uiKey])
      .map(([panelId]) => panelId);

    const profile: WorkflowProfile = {
      id: uuid(),
      name,
      builtIn: false,
      shortcutOverrides: { ...get().overrides },
      defaultBrushSize: currentBrush.size,
      defaultOpacity: currentBrush.opacity,
      visiblePanels,
    };
    set((s) => ({ customProfiles: [...s.customProfiles, profile], activeProfileId: profile.id }));
    schedulePersist(get);
  },

  deleteProfile: (profileId) => {
    set((s) => ({
      customProfiles: s.customProfiles.filter((p) => p.id !== profileId),
      activeProfileId: s.activeProfileId === profileId ? null : s.activeProfileId,
    }));
    schedulePersist(get);
  },

  startRecording: () => {
    set({ isRecording: true, recordingSteps: [], recordingLastTs: Date.now() });
  },

  recordStep: (actionId) => {
    const state = get();
    if (!state.isRecording) return;
    const now = Date.now();
    const delayMs = now - state.recordingLastTs;
    set({ recordingSteps: [...state.recordingSteps, { actionId, delayMs }], recordingLastTs: now });
  },

  stopRecording: (name) => {
    const state = get();
    if (!state.isRecording || state.recordingSteps.length === 0) {
      set({ isRecording: false, recordingSteps: [] });
      return;
    }
    const macro: RecordedMacro = { id: uuid(), name, steps: state.recordingSteps, createdAt: Date.now() };
    set((s) => ({ macros: [...s.macros, macro], isRecording: false, recordingSteps: [] }));
    schedulePersist(get);
  },

  cancelRecording: () => {
    set({ isRecording: false, recordingSteps: [] });
  },

  deleteMacro: (id) => {
    set((s) => ({ macros: s.macros.filter((m) => m.id !== id) }));
    schedulePersist(get);
  },

  playMacro: async (id, speed = 1) => {
    const macro = get().macros.find((m) => m.id === id);
    if (!macro) return;
    set({ isPlaying: true, playingMacroId: id });
    try {
      const dispatch = useShortcutRuntimeStore.getState().dispatch;
      for (const step of macro.steps) {
        if (!get().isPlaying) break; // stopped mid-playback
        await new Promise((resolve) => setTimeout(resolve, Math.min(step.delayMs, 3000) / speed));
        dispatch(step.actionId);
      }
    } finally {
      set({ isPlaying: false, playingMacroId: null });
    }
  },

  stopPlayback: () => set({ isPlaying: false, playingMacroId: null }),

  exportProfile: (profileId) => {
    const profile = allProfiles(get()).find((p) => p.id === profileId);
    if (!profile) throw new Error('Perfil no encontrado');
    return JSON.stringify({ kind: 'schizzo-profile', v: 1, profile }, null, 2);
  },

  importProfile: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.kind !== 'schizzo-profile' || !data.profile) return { ok: false, error: 'Archivo inválido' };
      const imported: WorkflowProfile = { ...data.profile, id: uuid(), builtIn: false };
      set((s) => ({ customProfiles: [...s.customProfiles, imported] }));
      schedulePersist(get);
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo interpretar el archivo' };
    }
  },
}));

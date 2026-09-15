import { create } from 'zustand';
import * as autoSave from '@/services/autoSave.service';
import { useAppStore } from './appStore';

const PREFS_KEY = 'schizzo-autosave-prefs';

interface AutoSavePrefs {
  enabled: boolean;
  intervalMinutes: number;
}

/** Just two small preference values (enabled + interval) — the actual backups live as
 * real files on disk via the autosave IPC handler, same low-stakes-preference reasoning
 * as learningStore's completed-tours flag. */
function loadPrefs(): AutoSavePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { enabled: true, intervalMinutes: 3, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return { enabled: true, intervalMinutes: 3 };
}

function savePrefs(prefs: AutoSavePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort only
  }
}

interface AutoSaveState extends AutoSavePrefs {
  lastSavedAt: string | null;
  lastSavedHistoryVersion: number | null;
  entries: autoSave.AutoSaveEntry[];
  isDialogOpen: boolean;

  setEnabled: (enabled: boolean) => void;
  setIntervalMinutes: (minutes: number) => void;
  openDialog: () => void;
  closeDialog: () => void;
  refreshEntries: () => Promise<void>;
  /** Called on a timer; writes a new backup only if the project actually changed since
   * the last one (compares historyVersion — avoids piling up identical idle backups). */
  tick: () => Promise<void>;
  restore: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAutoSaveStore = create<AutoSaveState>((set, get) => {
  const prefs = loadPrefs();
  return {
    ...prefs,
    lastSavedAt: null,
    lastSavedHistoryVersion: null,
    entries: [],
    isDialogOpen: false,

    setEnabled: (enabled) => {
      savePrefs({ enabled, intervalMinutes: get().intervalMinutes });
      set({ enabled });
    },

    setIntervalMinutes: (intervalMinutes) => {
      savePrefs({ enabled: get().enabled, intervalMinutes });
      set({ intervalMinutes });
    },

    openDialog: () => {
      set({ isDialogOpen: true });
      get().refreshEntries();
    },

    closeDialog: () => set({ isDialogOpen: false }),

    refreshEntries: async () => {
      const entries = await autoSave.listAutoSaves();
      set({ entries });
    },

    tick: async () => {
      const { enabled, lastSavedHistoryVersion } = get();
      const { project, historyVersion } = useAppStore.getState();
      if (!enabled || !project) return;
      if (lastSavedHistoryVersion === historyVersion) return; // nothing changed — skip
      await autoSave.writeAutoSave(project);
      set({ lastSavedAt: new Date().toISOString(), lastSavedHistoryVersion: historyVersion });
    },

    restore: async (id) => {
      const project = await autoSave.restoreAutoSave(id);
      if (project) useAppStore.getState().loadProjectData(project);
    },

    remove: async (id) => {
      await autoSave.deleteAutoSave(id);
      await get().refreshEntries();
    },
  };
});

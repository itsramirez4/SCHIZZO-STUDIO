import { create } from 'zustand';

const STORAGE_KEY = 'schizzo-recent-colors';
const MAX_RECENT = 12;

/** Just a small swatch history — same low-stakes-preference reasoning as learningStore's
 * completed-tours flag, localStorage is fine, no need for an Electron-fs round trip. */
function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(colors: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // best-effort only
  }
}

interface RecentColorsStore {
  colors: string[];
  addColor: (hex: string) => void;
}

export const useRecentColorsStore = create<RecentColorsStore>((set, get) => ({
  colors: loadRecent(),

  addColor: (hex) => {
    const normalized = hex.toLowerCase();
    const deduped = get().colors.filter((c) => c !== normalized);
    const next = [normalized, ...deduped].slice(0, MAX_RECENT);
    saveRecent(next);
    set({ colors: next });
  },
}));

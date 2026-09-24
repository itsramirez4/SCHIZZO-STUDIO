import { create } from 'zustand';
import i18n from '@/i18n';
import { isElectron } from '@/utils/fileUtils';

/**
 * Only the app's core chrome (header, toolbox, sidebar tabs, start screen, the most common
 * dialogs, the getting-started tour) is translated so far — everything else (the 19 panels'
 * internal content, the docs/academy library) still shows its original Spanish regardless of
 * language, via i18next's `fallbackLng: 'es'`. See the plan this was built from for the full
 * scope split.
 */
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = 'auto' | Language;

const STORAGE_KEY = 'schizzo-language';

function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function readPreference(): LanguagePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'auto' || (raw && isLanguage(raw)) ? (raw as LanguagePreference) : 'auto';
  } catch {
    return 'auto';
  }
}

function savePreference(pref: LanguagePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Best-effort only.
  }
}

/** The system locale, as a real Electron launch would report it — unless a check/test run
 * left a simulated one behind, which wins (window.electronAPI is read-only from the renderer,
 * by design, so this is how tests exercise "what if the OS were in French" without touching it). */
async function readSystemLocale(): Promise<string> {
  try {
    const simulated = localStorage.getItem('schizzo-test-system-locale');
    if (simulated) return simulated;
  } catch {
    /* ignore */
  }
  if (isElectron() && window.electronAPI.getSystemLocale) {
    try {
      return await window.electronAPI.getSystemLocale();
    } catch {
      return navigator.language;
    }
  }
  return navigator.language;
}

/** "en-US" -> "en", falling back to English (not Spanish) for anything this app doesn't have a
 * translation for yet — the rule the app is meant to follow, not just "whatever it was built in". */
export function resolveLanguage(preference: LanguagePreference, systemLocale: string): Language {
  if (preference !== 'auto') return preference;
  const prefix = systemLocale.split(/[-_]/)[0]?.toLowerCase();
  return prefix && isLanguage(prefix) ? prefix : 'en';
}

interface LanguageStore {
  preference: LanguagePreference;
  resolvedLanguage: Language;
  /** Runs once at startup, before the app renders — resolves the effective language from the
   * stored preference + the system locale, and applies it to i18next. */
  bootstrap: () => Promise<void>;
  /** Picking a language by hand changes it instantly; picking "auto" re-resolves from the
   * current system locale right away too (no need to relaunch just to preview it). */
  setPreference: (pref: LanguagePreference) => Promise<void>;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  preference: readPreference(),
  resolvedLanguage: 'es',

  bootstrap: async () => {
    const preference = get().preference;
    const systemLocale = await readSystemLocale();
    const resolved = resolveLanguage(preference, systemLocale);
    set({ resolvedLanguage: resolved });
    await i18n.changeLanguage(resolved);
  },

  setPreference: async (pref) => {
    savePreference(pref);
    const systemLocale = await readSystemLocale();
    const resolved = resolveLanguage(pref, systemLocale);
    set({ preference: pref, resolvedLanguage: resolved });
    await i18n.changeLanguage(resolved);
  },
}));

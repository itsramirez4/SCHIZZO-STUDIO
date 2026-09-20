import { create } from 'zustand';

/**
 * The AI assistant's master switch and its (optional) image-generation provider.
 *
 * Switched off, the app is 100 % manual: the assistant panel is gone, no model is downloaded, no
 * automatic detection or analysis runs and nothing is ever sent anywhere. Everything the assistant
 * proposes lands as a reference, a guide or a new layer — it never edits the drawing by itself.
 */
export type ImageProviderKind = 'none' | 'local-sd' | 'openai-compatible';

export interface ImageProviderConfig {
  kind: ImageProviderKind;
  /** e.g. http://127.0.0.1:7860 (a Stable Diffusion server you run yourself) or https://api.openai.com */
  endpoint: string;
  model: string;
}

interface AiState {
  enabled: boolean;
  provider: ImageProviderConfig;
  setEnabled: (v: boolean) => void;
  setProvider: (patch: Partial<ImageProviderConfig>) => void;
}

const KEY = 'schizzo-ai';
const DEFAULT_PROVIDER: ImageProviderConfig = { kind: 'none', endpoint: '', model: '' };

function read(): { enabled: boolean; provider: ImageProviderConfig } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return { enabled: j.enabled !== false, provider: { ...DEFAULT_PROVIDER, ...(j.provider ?? {}) } };
    }
  } catch {
    // unreadable settings: fall back to the defaults
  }
  return { enabled: true, provider: { ...DEFAULT_PROVIDER } };
}

function write(s: { enabled: boolean; provider: ImageProviderConfig }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled: s.enabled, provider: s.provider }));
  } catch {
    // storage unavailable: the choice just lasts for this session
  }
}

export const useAiStore = create<AiState>((set, get) => ({
  ...read(),
  setEnabled: (enabled) => {
    set({ enabled });
    write(get());
  },
  setProvider: (patch) => {
    set((s) => ({ provider: { ...s.provider, ...patch } }));
    write(get());
  },
}));

export const isAiEnabled = () => useAiStore.getState().enabled;

/** Every AI service starts with this: with the switch off nothing may run. */
export function assertAiEnabled() {
  if (!isAiEnabled()) throw new Error('La IA está desactivada. Actívala en la barra superior o en el panel del asistente.');
}

/** The main process mirrors the switch (and refuses to generate while it is off, whatever the UI does). */
function mirrorToMain(enabled: boolean) {
  try {
    void window.electronAPI?.aiSetEnabled?.(enabled);
  } catch {
    // not running in the desktop app
  }
}
mirrorToMain(useAiStore.getState().enabled);
useAiStore.subscribe((s, prev) => {
  if (s.enabled !== prev.enabled) mirrorToMain(s.enabled);
});

import { create } from 'zustand';
import { CloudProvider, ProviderAppConfig, CloudFileMeta } from '@/types/cloudSync';

interface CloudSyncStore {
  configs: Partial<Record<CloudProvider, ProviderAppConfig>>;
  status: Partial<Record<CloudProvider, boolean>>;
  files: Partial<Record<CloudProvider, CloudFileMeta[]>>;
  redirectUri: string;
  busy: Partial<Record<CloudProvider, boolean>>;
  loaded: boolean;

  loadAll: () => Promise<void>;
  setConfig: (provider: CloudProvider, config: ProviderAppConfig) => Promise<void>;
  connect: (provider: CloudProvider) => Promise<{ ok: boolean; error?: string }>;
  disconnect: (provider: CloudProvider) => Promise<void>;
  refreshFiles: (provider: CloudProvider) => Promise<void>;
}

export const useCloudSyncStore = create<CloudSyncStore>((set, get) => ({
  configs: {},
  status: {},
  files: {},
  redirectUri: '',
  busy: {},
  loaded: false,

  loadAll: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    const [configs, status, redirectUri] = await Promise.all([
      window.electronAPI.cloudGetConfig(),
      window.electronAPI.cloudGetStatus(),
      window.electronAPI.cloudGetRedirectUri(),
    ]);
    set({ configs: configs as Partial<Record<CloudProvider, ProviderAppConfig>>, status: status as Partial<Record<CloudProvider, boolean>>, redirectUri });
  },

  setConfig: async (provider, config) => {
    await window.electronAPI.cloudSetConfig(provider, config);
    set((s) => ({ configs: { ...s.configs, [provider]: config } }));
  },

  connect: async (provider) => {
    set((s) => ({ busy: { ...s.busy, [provider]: true } }));
    try {
      const result = await window.electronAPI.cloudConnect(provider);
      if (result.ok) set((s) => ({ status: { ...s.status, [provider]: true } }));
      return result;
    } finally {
      set((s) => ({ busy: { ...s.busy, [provider]: false } }));
    }
  },

  disconnect: async (provider) => {
    await window.electronAPI.cloudDisconnect(provider);
    set((s) => ({ status: { ...s.status, [provider]: false }, files: { ...s.files, [provider]: [] } }));
  },

  refreshFiles: async (provider) => {
    set((s) => ({ busy: { ...s.busy, [provider]: true } }));
    try {
      const result = await window.electronAPI.cloudList(provider);
      set((s) => ({ files: { ...s.files, [provider]: result.files } }));
    } finally {
      set((s) => ({ busy: { ...s.busy, [provider]: false } }));
    }
  },
}));

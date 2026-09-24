export {};

interface IpcResult {
  canceled: boolean;
  filePath?: string;
}

declare global {
  interface Window {
    electronAPI: {
      saveProject: (json: string, existingPath?: string) => Promise<IpcResult>;
      saveProjectAs: (json: string) => Promise<IpcResult>;
      openProject: () => Promise<IpcResult & { json?: string }>;
      openProjectAtPath: (filePath: string) => Promise<IpcResult & { json?: string }>;
      getRecentProjects: () => Promise<string[]>;
      importImages: () => Promise<{ canceled: boolean; files: { name: string; dataUrl: string }[] }>;
      importKra: () => Promise<{ canceled: boolean; name?: string; base64?: string }>;
      importPaletteFile: () => Promise<{ canceled: boolean; name?: string; content?: string }>;
      readClipboardImage: () => Promise<{ empty: boolean; dataUrl?: string }>;
      writeClipboardImage: (dataUrl: string) => Promise<void>;
      exportBrush: (json: string, defaultName: string) => Promise<IpcResult>;
      importBrush: () => Promise<{ canceled: boolean; brushes: string[] }>;
      exportImage: (dataUrl: string, format: string, defaultName: string) => Promise<IpcResult>;
      exportGif: (base64: string, defaultName: string) => Promise<IpcResult>;
      exportPngSequence: (frames: string[], defaultName: string) => Promise<{ canceled: boolean; folderPath?: string }>;
      exportBatch: (files: { name: string; dataUrl: string }[], folderName: string) => Promise<{ canceled: boolean; folderPath?: string }>;
      getPoseModel: () => Promise<{ ok: boolean; modelJson?: string; weights?: Uint8Array; error?: string }>;
      aiSetEnabled: (on: boolean) => Promise<boolean>;
      aiHasKey: () => Promise<boolean>;
      aiSetKey: (key: string) => Promise<boolean>;
      aiTestConnection: (args: { kind: 'local-sd' | 'openai-compatible'; endpoint: string }) => Promise<{ ok: boolean; models?: string[]; error?: string }>;
      aiRewriteText: (args: { endpoint: string; model: string; text: string; vocabulary: string; task: 'pose' | 'expression' }) => Promise<{ ok: boolean; text?: string; error?: string }>;
      aiGenerateImage: (args: { kind: 'local-sd' | 'openai-compatible'; endpoint: string; model: string; prompt: string; negative?: string; width: number; height: number }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
      importModel3D: () => Promise<{ canceled: boolean; name?: string; dataUrl?: string; format?: string }>;
      loadAssetLibrary: () => Promise<{ json: string | null }>;
      saveAssetLibrary: (json: string) => Promise<{ ok: boolean }>;
      loadReferenceLibrary: () => Promise<{ json: string | null }>;
      saveReferenceLibrary: (json: string) => Promise<{ ok: boolean }>;
      fetchImageUrl: (url: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
      openReferenceWindow: (dataUrl: string, title: string) => Promise<{ id: string }>;
      getReferenceWindowData: (id: string) => Promise<{ dataUrl: string; title: string } | null>;
      setReferenceWindowAlwaysOnTop: (id: string, value: boolean) => Promise<{ ok: boolean }>;
      cloudGetConfig: () => Promise<Partial<Record<string, { clientId: string; clientSecret?: string }>>>;
      cloudSetConfig: (provider: string, config: { clientId: string; clientSecret?: string }) => Promise<{ ok: boolean }>;
      cloudGetStatus: () => Promise<Partial<Record<string, boolean>>>;
      cloudGetRedirectUri: () => Promise<string>;
      cloudConnect: (provider: string) => Promise<{ ok: boolean; error?: string }>;
      cloudDisconnect: (provider: string) => Promise<{ ok: boolean }>;
      cloudUpload: (provider: string, filename: string, base64Content: string) => Promise<{ ok: boolean; error?: string }>;
      cloudList: (provider: string, extensionFilter?: string) => Promise<{ ok: boolean; error?: string; files: { id: string; name: string; size: number; modifiedAt: string }[] }>;
      cloudDownload: (provider: string, fileId: string) => Promise<{ ok: boolean; error?: string; base64Content?: string }>;
      cloudDelete: (provider: string, fileId: string) => Promise<{ ok: boolean; error?: string }>;
      loadCustomization: () => Promise<{ json: string | null }>;
      saveCustomization: (json: string) => Promise<{ ok: boolean }>;
      loadPerspectivePresets: () => Promise<{ json: string | null }>;
      savePerspectivePresets: (json: string) => Promise<{ ok: boolean }>;
      loadFilterPresets: () => Promise<{ json: string | null }>;
      saveFilterPresets: (json: string) => Promise<{ ok: boolean }>;
      autosaveWrite: (json: string, projectId: string, projectName: string) => Promise<{ ok: boolean; timestamp: string; size: number }>;
      autosaveList: () => Promise<{ id: string; projectId: string; projectName: string; fileName: string; timestamp: string; size: number }[]>;
      autosaveRead: (id: string) => Promise<{ canceled: boolean; json?: string; projectName?: string }>;
      autosaveDelete: (id: string) => Promise<{ ok: boolean }>;
      feedbackSave: (content: string, defaultName: string) => Promise<IpcResult>;
      updateCheck: () => Promise<unknown>;
      updateInstall: () => Promise<void>;
      onUpdateEvent: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      onMenuEvent: (channel: string, callback: () => void) => () => void;
      isCheckMode: boolean;
    };
  }
}

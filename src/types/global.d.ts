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
      exportBrush: (json: string, defaultName: string) => Promise<IpcResult>;
      importBrush: () => Promise<{ canceled: boolean; brushes: string[] }>;
      exportImage: (dataUrl: string, format: string, defaultName: string) => Promise<IpcResult>;
      exportGif: (base64: string, defaultName: string) => Promise<IpcResult>;
      exportPngSequence: (frames: string[], defaultName: string) => Promise<{ canceled: boolean; folderPath?: string }>;
      importModel3D: () => Promise<{ canceled: boolean; name?: string; dataUrl?: string }>;
      onMenuEvent: (channel: string, callback: () => void) => () => void;
    };
  }
}

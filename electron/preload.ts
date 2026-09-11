import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Proyectos
  saveProject: (json: string, existingPath?: string) =>
    ipcRenderer.invoke('project:save', json, existingPath),
  saveProjectAs: (json: string) => ipcRenderer.invoke('project:save-as', json),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (filePath: string) => ipcRenderer.invoke('project:open-path', filePath),
  getRecentProjects: () => ipcRenderer.invoke('project:get-recent'),
  importImages: () => ipcRenderer.invoke('image:import'),
  importKra: () => ipcRenderer.invoke('kra:import'),

  // Pinceles
  exportBrush: (json: string, defaultName: string) =>
    ipcRenderer.invoke('brush:export', json, defaultName),
  importBrush: () => ipcRenderer.invoke('brush:import'),

  // Exportar
  exportImage: (dataUrl: string, format: string, defaultName: string) =>
    ipcRenderer.invoke('export:image', dataUrl, format, defaultName),
  exportGif: (base64: string, defaultName: string) => ipcRenderer.invoke('export:gif', base64, defaultName),
  exportPngSequence: (frames: string[], defaultName: string) => ipcRenderer.invoke('export:png-sequence', frames, defaultName),

  // Modelos 3D
  importModel3D: () => ipcRenderer.invoke('model3d:import'),

  // Menu events
  onMenuEvent: (channel: string, callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;

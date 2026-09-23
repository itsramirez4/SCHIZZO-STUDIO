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
  importPaletteFile: () => ipcRenderer.invoke('palette:import'),

  // Portapapeles del sistema (imágenes)
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
  writeClipboardImage: (dataUrl: string) => ipcRenderer.invoke('clipboard:write-image', dataUrl),

  // Pinceles
  exportBrush: (json: string, defaultName: string) =>
    ipcRenderer.invoke('brush:export', json, defaultName),
  importBrush: () => ipcRenderer.invoke('brush:import'),

  // Exportar
  exportImage: (dataUrl: string, format: string, defaultName: string) =>
    ipcRenderer.invoke('export:image', dataUrl, format, defaultName),
  exportGif: (base64: string, defaultName: string) => ipcRenderer.invoke('export:gif', base64, defaultName),
  exportPngSequence: (frames: string[], defaultName: string) => ipcRenderer.invoke('export:png-sequence', frames, defaultName),
  exportBatch: (files: { name: string; dataUrl: string }[], folderName: string) => ipcRenderer.invoke('export:batch', files, folderName),

  // Modelos 3D
  importModel3D: () => ipcRenderer.invoke('model3d:import'),
  getPoseModel: () => ipcRenderer.invoke('poseModel:get'),
  aiSetEnabled: (on: boolean) => ipcRenderer.invoke('ai:setEnabled', on),
  aiHasKey: () => ipcRenderer.invoke('ai:hasKey'),
  aiSetKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
  aiTestConnection: (args: unknown) => ipcRenderer.invoke('ai:testConnection', args),
  aiRewriteText: (args: unknown) => ipcRenderer.invoke('ai:rewriteText', args),
  aiGenerateImage: (args: unknown) => ipcRenderer.invoke('ai:generateImage', args),

  // Biblioteca de assets
  loadAssetLibrary: () => ipcRenderer.invoke('assetLibrary:load'),
  saveAssetLibrary: (json: string) => ipcRenderer.invoke('assetLibrary:save', json),

  // Biblioteca de referencias
  loadReferenceLibrary: () => ipcRenderer.invoke('referenceLibrary:load'),
  saveReferenceLibrary: (json: string) => ipcRenderer.invoke('referenceLibrary:save', json),
  fetchImageUrl: (url: string) => ipcRenderer.invoke('reference:fetchUrl', url),

  // Ventanas de referencia flotantes
  openReferenceWindow: (dataUrl: string, title: string) => ipcRenderer.invoke('referenceWindow:open', dataUrl, title),
  getReferenceWindowData: (id: string) => ipcRenderer.invoke('referenceWindow:getData', id),
  setReferenceWindowAlwaysOnTop: (id: string, value: boolean) => ipcRenderer.invoke('referenceWindow:setAlwaysOnTop', id, value),

  // Sincronización en la nube
  cloudGetConfig: () => ipcRenderer.invoke('cloudSync:getConfig'),
  cloudSetConfig: (provider: string, config: { clientId: string; clientSecret?: string }) =>
    ipcRenderer.invoke('cloudSync:setConfig', provider, config),
  cloudGetStatus: () => ipcRenderer.invoke('cloudSync:getStatus'),
  cloudGetRedirectUri: () => ipcRenderer.invoke('cloudSync:getRedirectUri'),
  cloudConnect: (provider: string) => ipcRenderer.invoke('cloudSync:connect', provider),
  cloudDisconnect: (provider: string) => ipcRenderer.invoke('cloudSync:disconnect', provider),
  cloudUpload: (provider: string, filename: string, base64Content: string) =>
    ipcRenderer.invoke('cloudSync:upload', provider, filename, base64Content),
  cloudList: (provider: string, extensionFilter?: string) => ipcRenderer.invoke('cloudSync:list', provider, extensionFilter),
  cloudDownload: (provider: string, fileId: string) => ipcRenderer.invoke('cloudSync:download', provider, fileId),
  cloudDelete: (provider: string, fileId: string) => ipcRenderer.invoke('cloudSync:delete', provider, fileId),

  // Personalización (atajos, perfiles, macros)
  loadCustomization: () => ipcRenderer.invoke('customization:load'),
  saveCustomization: (json: string) => ipcRenderer.invoke('customization:save', json),

  // Presets de perspectiva (globales, no por proyecto)
  loadPerspectivePresets: () => ipcRenderer.invoke('perspectivePresets:load'),
  savePerspectivePresets: (json: string) => ipcRenderer.invoke('perspectivePresets:save', json),

  // Presets de filtro (globales, no por proyecto)
  loadFilterPresets: () => ipcRenderer.invoke('filterPresets:load'),
  saveFilterPresets: (json: string) => ipcRenderer.invoke('filterPresets:save', json),

  // Auto-guardado (copias de seguridad reales en userData/autosave)
  autosaveWrite: (json: string, projectId: string, projectName: string) =>
    ipcRenderer.invoke('autosave:write', json, projectId, projectName),
  autosaveList: () => ipcRenderer.invoke('autosave:list'),
  autosaveRead: (id: string) => ipcRenderer.invoke('autosave:read', id),
  autosaveDelete: (id: string) => ipcRenderer.invoke('autosave:delete', id),

  // Feedback
  feedbackSave: (content: string, defaultName: string) => ipcRenderer.invoke('feedback:save', content, defaultName),

  // Menu events
  onMenuEvent: (channel: string, callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;

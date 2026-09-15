/** Maps a profile's `visiblePanels` id (matching Sidebar.tsx's tab ids) to the uiStore boolean
 * field that actually controls it. */
export const PANEL_ID_TO_UI_KEY: Record<string, string> = {
  layers: 'showLayerPanel',
  filters: 'showFilterPanel',
  history: 'showHistoryPanel',
  histogram: 'showHistogramPanel',
  animation: 'showAnimationPanel',
  comic: 'showComicPanel',
  colorTools: 'showColorToolsPanel',
  assetLibrary: 'showAssetLibraryPanel',
  batch: 'showBatchPanel',
  learning: 'showLearningPanel',
  recording: 'showRecordingPanel',
  references: 'showReferencesPanel',
  cloudSync: 'showCloudSyncPanel',
};

export const PANEL_ID_LABELS: Record<string, string> = {
  layers: 'Capas',
  filters: 'Filtros',
  history: 'Historial',
  histogram: 'Histograma',
  animation: 'Animación',
  comic: 'Cómic / Manga',
  colorTools: 'Herramientas de color',
  assetLibrary: 'Biblioteca de assets',
  batch: 'Procesamiento por lotes',
  learning: 'Aprender',
  recording: 'Grabación de sesión',
  references: 'Referencias',
  cloudSync: 'Nube',
};

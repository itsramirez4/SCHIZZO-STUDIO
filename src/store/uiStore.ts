import { create } from 'zustand';

interface UIState {
  showLayerPanel: boolean;
  showBrushPanel: boolean;
  showFilterPanel: boolean;
  showHistoryPanel: boolean;
  showHistogramPanel: boolean;
  showAnimationPanel: boolean;

  showNewProjectDialog: boolean;
  showExportDialog: boolean;
  showBrushEditor: boolean;
  showTextDialog: boolean;
  showModel3DViewer: boolean;
  showReference3DPanel: boolean;
  showResizeDialog: boolean;
  showReplayDialog: boolean;
  showComicPanel: boolean;
  showColorToolsPanel: boolean;
  showAssetLibraryPanel: boolean;
  showBatchPanel: boolean;
  showLearningPanel: boolean;
  showRecordingPanel: boolean;
  showReferencesPanel: boolean;
  showCloudSyncPanel: boolean;
  showCustomizationPanel: boolean;
  showPerspectivePanel: boolean;
  showStatsPanel: boolean;
  showStudyPanel: boolean;
  showAssistantPanel: boolean;
  showVersionsPanel: boolean;
  toggleVersionsPanel: () => void;
  showFeedbackDialog: boolean;
  /** Pre-fills the dialog's message when it was opened automatically (see openAutoFeedbackDialog). */
  feedbackContext: string | null;
  openFeedbackDialog: () => void;
  /** Opens the dialog with an explanatory message, unless one is already open — never steals a
   * draft someone's already writing. Used by ErrorBoundary when a whole region crashes. */
  openAutoFeedbackDialog: (context: string) => void;
  closeFeedbackDialog: () => void;
  /** Left-handed layout: toolbox on the right, side panels on the left. */
  leftHanded: boolean;
  toggleLeftHanded: () => void;

  toggleLayerPanel: () => void;
  toggleBrushPanel: () => void;
  toggleFilterPanel: () => void;
  toggleHistoryPanel: () => void;
  toggleHistogramPanel: () => void;
  toggleAnimationPanel: () => void;

  openNewProjectDialog: () => void;
  closeNewProjectDialog: () => void;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  openBrushEditor: () => void;
  closeBrushEditor: () => void;
  openTextDialog: () => void;
  closeTextDialog: () => void;
  openModel3DViewer: () => void;
  closeModel3DViewer: () => void;
  toggleReference3DPanel: () => void;
  openResizeDialog: () => void;
  closeResizeDialog: () => void;
  openReplayDialog: () => void;
  closeReplayDialog: () => void;
  toggleComicPanel: () => void;
  toggleColorToolsPanel: () => void;
  toggleAssetLibraryPanel: () => void;
  toggleBatchPanel: () => void;
  toggleLearningPanel: () => void;
  toggleRecordingPanel: () => void;
  toggleReferencesPanel: () => void;
  toggleCloudSyncPanel: () => void;
  toggleCustomizationPanel: () => void;
  togglePerspectivePanel: () => void;
  toggleStatsPanel: () => void;
  toggleStudyPanel: () => void;
  toggleAssistantPanel: () => void;
}

function readLeftHanded(): boolean {
  try {
    return localStorage.getItem('schizzo-left-handed') === '1';
  } catch {
    return false;
  }
}

// The 19 panels that live in the sidebar's icon rail (Sidebar.tsx `tabs`) behave like an
// accordion, not independent checkboxes: opening one closes whichever other was open, so at
// most one is ever visible — piling several up at once made "where is X" unanswerable. Every
// toggle below spreads this first and then overrides its own key, so opening/closing a single
// panel is still one `toggleXPanel()` call, same as before; nothing outside this file needed to
// change (`showXPanel`/`toggleXPanel` keep their exact names and one-argument-free signatures).
function closeAllSidebarPanels() {
  return {
    showLayerPanel: false,
    showFilterPanel: false,
    showHistoryPanel: false,
    showHistogramPanel: false,
    showAnimationPanel: false,
    showComicPanel: false,
    showColorToolsPanel: false,
    showAssetLibraryPanel: false,
    showBatchPanel: false,
    showLearningPanel: false,
    showRecordingPanel: false,
    showReferencesPanel: false,
    showCloudSyncPanel: false,
    showCustomizationPanel: false,
    showPerspectivePanel: false,
    showStatsPanel: false,
    showStudyPanel: false,
    showAssistantPanel: false,
    showVersionsPanel: false,
  };
}

export const useUIStore = create<UIState>((set, get) => ({
  showLayerPanel: true,
  showBrushPanel: false,
  showFilterPanel: false,
  showHistoryPanel: false,
  showHistogramPanel: false,
  showAnimationPanel: false,

  showNewProjectDialog: false,
  showExportDialog: false,
  showBrushEditor: false,
  showTextDialog: false,
  showModel3DViewer: false,
  showReference3DPanel: false,
  showResizeDialog: false,
  showReplayDialog: false,
  showComicPanel: false,
  showColorToolsPanel: false,
  showAssetLibraryPanel: false,
  showBatchPanel: false,
  showLearningPanel: false,
  showRecordingPanel: false,
  showReferencesPanel: false,
  showCloudSyncPanel: false,
  showCustomizationPanel: false,
  showPerspectivePanel: false,
  showStatsPanel: false,
  showStudyPanel: false,
  showAssistantPanel: false,
  showVersionsPanel: false,
  toggleVersionsPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showVersionsPanel: !s.showVersionsPanel })),
  showFeedbackDialog: false,
  feedbackContext: null,
  openFeedbackDialog: () => set({ showFeedbackDialog: true, feedbackContext: null }),
  openAutoFeedbackDialog: (context) => {
    if (get().showFeedbackDialog) return; // no pisar un mensaje que ya se está escribiendo
    set({ showFeedbackDialog: true, feedbackContext: context });
  },
  closeFeedbackDialog: () => set({ showFeedbackDialog: false, feedbackContext: null }),
  leftHanded: readLeftHanded(),
  toggleLeftHanded: () =>
    set((s) => {
      try {
        localStorage.setItem('schizzo-left-handed', s.leftHanded ? '0' : '1');
      } catch {
        // best-effort persistence
      }
      return { leftHanded: !s.leftHanded };
    }),

  toggleLayerPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showLayerPanel: !s.showLayerPanel })),
  toggleBrushPanel: () => set((s) => ({ showBrushPanel: !s.showBrushPanel })),
  toggleFilterPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showFilterPanel: !s.showFilterPanel })),
  toggleHistoryPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showHistoryPanel: !s.showHistoryPanel })),
  toggleHistogramPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showHistogramPanel: !s.showHistogramPanel })),
  toggleAnimationPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showAnimationPanel: !s.showAnimationPanel })),

  openNewProjectDialog: () => set({ showNewProjectDialog: true }),
  closeNewProjectDialog: () => set({ showNewProjectDialog: false }),
  openExportDialog: () => set({ showExportDialog: true }),
  closeExportDialog: () => set({ showExportDialog: false }),
  openBrushEditor: () => set({ showBrushEditor: true }),
  closeBrushEditor: () => set({ showBrushEditor: false }),
  openTextDialog: () => set({ showTextDialog: true }),
  closeTextDialog: () => set({ showTextDialog: false }),
  openModel3DViewer: () => set({ showModel3DViewer: true }),
  closeModel3DViewer: () => set({ showModel3DViewer: false }),
  toggleReference3DPanel: () => set((s) => ({ showReference3DPanel: !s.showReference3DPanel })),
  openResizeDialog: () => set({ showResizeDialog: true }),
  closeResizeDialog: () => set({ showResizeDialog: false }),
  openReplayDialog: () => set({ showReplayDialog: true }),
  closeReplayDialog: () => set({ showReplayDialog: false }),
  toggleComicPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showComicPanel: !s.showComicPanel })),
  toggleColorToolsPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showColorToolsPanel: !s.showColorToolsPanel })),
  toggleAssetLibraryPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showAssetLibraryPanel: !s.showAssetLibraryPanel })),
  toggleBatchPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showBatchPanel: !s.showBatchPanel })),
  toggleLearningPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showLearningPanel: !s.showLearningPanel })),
  toggleRecordingPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showRecordingPanel: !s.showRecordingPanel })),
  toggleReferencesPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showReferencesPanel: !s.showReferencesPanel })),
  toggleCloudSyncPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showCloudSyncPanel: !s.showCloudSyncPanel })),
  toggleCustomizationPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showCustomizationPanel: !s.showCustomizationPanel })),
  togglePerspectivePanel: () => set((s) => ({ ...closeAllSidebarPanels(), showPerspectivePanel: !s.showPerspectivePanel })),
  toggleStatsPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showStatsPanel: !s.showStatsPanel })),
  toggleStudyPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showStudyPanel: !s.showStudyPanel })),
  toggleAssistantPanel: () => set((s) => ({ ...closeAllSidebarPanels(), showAssistantPanel: !s.showAssistantPanel })),
}));

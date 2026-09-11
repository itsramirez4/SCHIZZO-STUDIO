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
  showComicPanel: boolean;
  showColorToolsPanel: boolean;

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
  toggleComicPanel: () => void;
  toggleColorToolsPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
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
  showComicPanel: false,
  showColorToolsPanel: false,

  toggleLayerPanel: () => set((s) => ({ showLayerPanel: !s.showLayerPanel })),
  toggleBrushPanel: () => set((s) => ({ showBrushPanel: !s.showBrushPanel })),
  toggleFilterPanel: () => set((s) => ({ showFilterPanel: !s.showFilterPanel })),
  toggleHistoryPanel: () => set((s) => ({ showHistoryPanel: !s.showHistoryPanel })),
  toggleHistogramPanel: () => set((s) => ({ showHistogramPanel: !s.showHistogramPanel })),
  toggleAnimationPanel: () => set((s) => ({ showAnimationPanel: !s.showAnimationPanel })),

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
  toggleComicPanel: () => set((s) => ({ showComicPanel: !s.showComicPanel })),
  toggleColorToolsPanel: () => set((s) => ({ showColorToolsPanel: !s.showColorToolsPanel })),
}));

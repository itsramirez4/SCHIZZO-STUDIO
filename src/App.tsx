import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBrush } from '@/hooks/useBrush';
import { useWorkspaceShortcuts } from '@/hooks/useWorkspaceShortcuts';
import { importImagesAsLayers } from '@/services/importImage';
import { isElectron } from '@/utils/fileUtils';
import { ToolType } from '@/types';

import Header from '@/components/UI/Header';
import StatusBar from '@/components/UI/StatusBar';
import Sidebar from '@/components/UI/Sidebar';
import StartScreen from '@/components/UI/StartScreen';
import Toolbox from '@/components/Toolbox/Toolbox';
import Canvas2D from '@/components/Canvas/Canvas2D';
import NewProjectDialog from '@/components/Dialogs/NewProjectDialog';
import ExportDialog from '@/components/Dialogs/ExportDialog';
import BrushEditor from '@/components/Brushes/BrushEditor';
import WorkspaceShell from '@/components/Workspace/WorkspaceShell';

// three.js pulls in a large bundle — only load it once the 3D dialog is actually opened.
const Model3DViewer = lazy(() => import('@/components/Models3D/Model3DViewer'));
const Reference3DPanel = lazy(() => import('@/components/Models3D/Reference3DPanel'));
const ResizeDialog = lazy(() => import('@/components/Dialogs/ResizeDialog'));

const SHORTCUT_TOOLS: Record<string, ToolType> = {
  b: 'brush',
  e: 'eraser',
  m: 'selection',
  g: 'paintbucket',
  t: 'text',
  i: 'eyedropper',
  p: 'pen',
  v: 'transform',
  z: 'zoom',
  h: 'pan',
};

export default function App() {
  const project = useAppStore((s) => s.project);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);
  const swapColors = useAppStore((s) => s.swapColors);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const addLayer = useAppStore((s) => s.addLayer);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const { updateCurrentBrush, currentBrush } = useBrush();

  const openNewProjectDialog = useUIStore((s) => s.openNewProjectDialog);
  const openExportDialog = useUIStore((s) => s.openExportDialog);
  const openModel3DViewer = useUIStore((s) => s.openModel3DViewer);
  const showModel3DViewer = useUIStore((s) => s.showModel3DViewer);
  const showReference3DPanel = useUIStore((s) => s.showReference3DPanel);
  const showResizeDialog = useUIStore((s) => s.showResizeDialog);
  const toggleLayerPanel = useUIStore((s) => s.toggleLayerPanel);
  const toggleFilterPanel = useUIStore((s) => s.toggleFilterPanel);
  const toggleHistoryPanel = useUIStore((s) => s.toggleHistoryPanel);

  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProjectDialog = useProjectStore((s) => s.openProjectDialog);

  const workspaceMode = useWorkspaceStore((s) => s.mode);
  useWorkspaceShortcuts();

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          redo();
        } else if (key === 'z') {
          e.preventDefault();
          undo();
        } else if (key === 's' && e.shiftKey) {
          e.preventDefault();
          saveCurrentProjectAs();
        } else if (key === 's') {
          e.preventDefault();
          saveCurrentProject();
        } else if (key === 'n') {
          e.preventDefault();
          openNewProjectDialog();
        } else if (key === 'o') {
          e.preventDefault();
          openProjectDialog();
        } else if (key === 'e') {
          e.preventDefault();
          openExportDialog();
        } else if (e.key === "'") {
          e.preventDefault();
          toggleGrid();
        }
        return;
      }

      if (!project) return;

      const key = e.key.toLowerCase();
      if (SHORTCUT_TOOLS[key]) {
        setCurrentTool(SHORTCUT_TOOLS[key]);
      } else if (key === 'd') {
        swapColors();
      } else if (key === '[') {
        updateCurrentBrush({ size: Math.max(1, currentBrush.size - 2) });
      } else if (key === ']') {
        updateCurrentBrush({ size: Math.min(300, currentBrush.size + 2) });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    project,
    undo,
    redo,
    saveCurrentProject,
    saveCurrentProjectAs,
    openNewProjectDialog,
    openProjectDialog,
    openExportDialog,
    setCurrentTool,
    swapColors,
    toggleGrid,
    updateCurrentBrush,
    currentBrush.size,
  ]);

  // Electron application menu events
  useEffect(() => {
    if (!isElectron()) return;
    const unsubs = [
      window.electronAPI.onMenuEvent('menu:new-project', openNewProjectDialog),
      window.electronAPI.onMenuEvent('menu:open-project', openProjectDialog),
      window.electronAPI.onMenuEvent('menu:save', saveCurrentProject),
      window.electronAPI.onMenuEvent('menu:save-as', saveCurrentProjectAs),
      window.electronAPI.onMenuEvent('menu:export', openExportDialog),
      window.electronAPI.onMenuEvent('menu:undo', undo),
      window.electronAPI.onMenuEvent('menu:redo', redo),
      window.electronAPI.onMenuEvent('menu:toggle-layers', toggleLayerPanel),
      window.electronAPI.onMenuEvent('menu:toggle-brushes', () => useUIStore.getState().openBrushEditor()),
      window.electronAPI.onMenuEvent('menu:toggle-filters', toggleFilterPanel),
      window.electronAPI.onMenuEvent('menu:toggle-history', toggleHistoryPanel),
      window.electronAPI.onMenuEvent('menu:import-image', async () => {
        const layerId = await importImagesAsLayers(addLayer);
        if (layerId) pushHistory('Importar imagen');
      }),
      window.electronAPI.onMenuEvent('menu:import-model3d', openModel3DViewer),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [
    openNewProjectDialog,
    openProjectDialog,
    saveCurrentProject,
    saveCurrentProjectAs,
    openExportDialog,
    openModel3DViewer,
    undo,
    redo,
    toggleLayerPanel,
    toggleFilterPanel,
    toggleHistoryPanel,
    addLayer,
    pushHistory,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col">
      <Toaster position="bottom-center" toastOptions={{ style: { background: '#2a2a2a', color: '#fff' } }} />
      {project ? (
        workspaceMode === 'floating' ? (
          <WorkspaceShell />
        ) : (
          <>
            <Header />
            <div className="flex-1 flex min-h-0">
              <Toolbox />
              <Canvas2D />
              <Sidebar />
            </div>
            <StatusBar />
          </>
        )
      ) : (
        <StartScreen />
      )}

      <NewProjectDialog />
      <ExportDialog />
      <BrushEditor />
      {showModel3DViewer && (
        <Suspense fallback={null}>
          <Model3DViewer />
        </Suspense>
      )}
      {showReference3DPanel && (
        <Suspense fallback={null}>
          <Reference3DPanel />
        </Suspense>
      )}
      {showResizeDialog && (
        <Suspense fallback={null}>
          <ResizeDialog />
        </Suspense>
      )}
    </div>
  );
}

import { useEffect, useRef, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBrush } from '@/hooks/useBrush';
import { useWorkspaceShortcuts } from '@/hooks/useWorkspaceShortcuts';
import { importImagesAsLayers, pasteImageFromClipboard } from '@/services/importImage';
import { isElectron } from '@/utils/fileUtils';
import { SHORTCUT_DEFINITIONS, TOOL_SHORTCUT_ACTIONS } from '@/data/shortcutDefinitions';
import { comboFromEvent, findDefinitionForCombo } from '@/services/shortcutEngine.service';
import { useCustomizationStore } from '@/store/customizationStore';
import { useShortcutRuntimeStore } from '@/store/shortcutRuntimeStore';
import { useAutoSaveStore } from '@/store/autoSaveStore';

import Header from '@/components/UI/Header';
import StatusBar from '@/components/UI/StatusBar';
import ErrorBoundary from '@/components/UI/ErrorBoundary';
import Sidebar from '@/components/UI/Sidebar';
import StartScreen from '@/components/UI/StartScreen';
import Toolbox from '@/components/Toolbox/Toolbox';
import Canvas2D from '@/components/Canvas/Canvas2D';
import NewProjectDialog from '@/components/Dialogs/NewProjectDialog';
import AutoSaveDialog from '@/components/Dialogs/AutoSaveDialog';
import TourOverlay from '@/components/Learning/TourOverlay';

// three.js pulls in a large bundle — only load it once the 3D dialog is actually opened.
const Model3DViewer = lazy(() => import('@/components/Models3D/Model3DViewer'));
const Reference3DPanel = lazy(() => import('@/components/Models3D/Reference3DPanel'));
const ResizeDialog = lazy(() => import('@/components/Dialogs/ResizeDialog'));
// Opened on demand only, so their code (and the brush-format/ABR importers) stays out of the startup chunk.
const ExportDialog = lazy(() => import('@/components/Dialogs/ExportDialog'));
const BrushEditor = lazy(() => import('@/components/Brushes/BrushEditor'));
const ReplayDialog = lazy(() => import('@/components/Replay/ReplayDialog'));
// The floating workspace is an opt-in alternate to the classic layout below (most sessions
// never touch it) — it also drags in its own copies of Filters/Comic/Animation/Histogram/
// History, so keeping it lazy keeps all of that out of the classic layout's startup cost too.
const WorkspaceShell = lazy(() => import('@/components/Workspace/WorkspaceShell'));

export default function App() {
  const project = useAppStore((s) => s.project);
  const currentTool = useAppStore((s) => s.currentTool);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);
  const swapColors = useAppStore((s) => s.swapColors);
  const resetColors = useAppStore((s) => s.resetColors);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const toggleRulerVisible = useAppStore((s) => s.toggleRulerVisible);
  const selectAll = useAppStore((s) => s.selectAll);
  const deselectAll = useAppStore((s) => s.deselectAll);
  const invertSelection = useAppStore((s) => s.invertSelection);
  const copyMerged = useAppStore((s) => s.copyMerged);
  const groupSelectedLayers = useAppStore((s) => s.groupSelectedLayers);
  const ungroupLayer = useAppStore((s) => s.ungroupLayer);
  const mergeLayerDown = useAppStore((s) => s.mergeLayerDown);
  const mergeVisibleLayers = useAppStore((s) => s.mergeVisibleLayers);
  const fillSelection = useAppStore((s) => s.fillSelection);
  const primaryColor = useAppStore((s) => s.primaryColor);
  const secondaryColor = useAppStore((s) => s.secondaryColor);
  const copySelection = useAppStore((s) => s.copySelection);
  const cutSelection = useAppStore((s) => s.cutSelection);
  const pasteAsLayer = useAppStore((s) => s.pasteAsLayer);
  const addLayer = useAppStore((s) => s.addLayer);
  const duplicateLayer = useAppStore((s) => s.duplicateLayer);
  const invertLayerColors = useAppStore((s) => s.invertLayerColors);
  const desaturateLayerColors = useAppStore((s) => s.desaturateLayerColors);
  const currentLayerId = useAppStore((s) => s.currentLayerId);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const { updateCurrentBrush, currentBrush } = useBrush();

  const openNewProjectDialog = useUIStore((s) => s.openNewProjectDialog);
  const openExportDialog = useUIStore((s) => s.openExportDialog);
  const openModel3DViewer = useUIStore((s) => s.openModel3DViewer);
  const leftHanded = useUIStore((s) => s.leftHanded);
  const historyVersion = useAppStore((s) => s.historyVersion);
  const showModel3DViewer = useUIStore((s) => s.showModel3DViewer);
  const showReference3DPanel = useUIStore((s) => s.showReference3DPanel);
  const showResizeDialog = useUIStore((s) => s.showResizeDialog);
  const showReplayDialog = useUIStore((s) => s.showReplayDialog);
  const openResizeDialog = useUIStore((s) => s.openResizeDialog);
  const openBrushEditor = useUIStore((s) => s.openBrushEditor);
  const showBrushEditor = useUIStore((s) => s.showBrushEditor);
  const showExportDialog = useUIStore((s) => s.showExportDialog);
  const toggleLayerPanel = useUIStore((s) => s.toggleLayerPanel);
  const toggleFilterPanel = useUIStore((s) => s.toggleFilterPanel);
  const toggleHistoryPanel = useUIStore((s) => s.toggleHistoryPanel);

  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const saveCurrentProjectAs = useProjectStore((s) => s.saveCurrentProjectAs);
  const openProjectDialog = useProjectStore((s) => s.openProjectDialog);

  const workspaceMode = useWorkspaceStore((s) => s.mode);
  useWorkspaceShortcuts();

  // Global keyboard shortcuts — data-driven and remappable (see src/data/shortcutDefinitions.ts
  // for the full, exact list this replaces). Every action is registered into
  // shortcutRuntimeStore so the macro recorder/player and the shortcut-editing UI can trigger
  // the very same real behavior a keypress does, not a separate parallel implementation.
  const overrides = useCustomizationStore((s) => s.overrides);
  const isRecordingMacro = useCustomizationStore((s) => s.isRecording);
  const recordStep = useCustomizationStore((s) => s.recordStep);
  const registerActions = useShortcutRuntimeStore((s) => s.registerActions);

  // Version history: remember how the project looked when opened (for before/after), make sure a
  // persistent "Estado inicial" version exists, and snapshot automatically every 10 minutes of work.
  const lastAutoVersion = useRef(0);
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(async () => {
      const versions = await import('@/services/versionHistory.service');
      const current = useAppStore.getState().project;
      if (!current || current.id !== project.id) return;
      versions.captureBaseline(current);
      versions.ensureInitialVersion(current);
      lastAutoVersion.current = useAppStore.getState().historyVersion;
    }, 600);
    return () => clearTimeout(t);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return;
    const timer = setInterval(async () => {
      const state = useAppStore.getState();
      if (!state.project || state.historyVersion === lastAutoVersion.current) return;
      lastAutoVersion.current = state.historyVersion;
      const versions = await import('@/services/versionHistory.service');
      versions.saveVersion(state.project, { name: 'Autoguardado', auto: true }).catch(() => undefined);
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    useCustomizationStore.getState().loadAll().then(() => {
      const activeProfileId = useCustomizationStore.getState().activeProfileId;
      if (activeProfileId) useCustomizationStore.getState().applyProfile(activeProfileId);
    });
  }, []);

  // Auto-guardado: reinicia el temporizador si cambia el intervalo configurado.
  const autoSaveIntervalMinutes = useAutoSaveStore((s) => s.intervalMinutes);
  useEffect(() => {
    const id = window.setInterval(() => {
      useAutoSaveStore.getState().tick();
    }, autoSaveIntervalMinutes * 60 * 1000);
    return () => window.clearInterval(id);
  }, [autoSaveIntervalMinutes]);

  useEffect(() => {
    const actionMap: Record<string, () => void> = {
      'edit.undo': () => undo(),
      'edit.redo': () => redo(),
      'file.save': () => saveCurrentProject(),
      'file.saveAs': () => saveCurrentProjectAs(),
      'file.new': () => openNewProjectDialog(),
      'file.open': () => openProjectDialog(),
      'file.export': () => openExportDialog(),
      'view.toggleGrid': () => toggleGrid(),
      'tool.swapColors': () => {
        if (project) swapColors();
      },
      'brush.decreaseSize': () => {
        if (project) updateCurrentBrush({ size: Math.max(1, currentBrush.size - 2) });
      },
      'brush.increaseSize': () => {
        if (project) updateCurrentBrush({ size: Math.min(300, currentBrush.size + 2) });
      },
      'edit.fillPrimary': () => {
        if (project) fillSelection(primaryColor);
      },
      'edit.fillSecondary': () => {
        if (project) fillSelection(secondaryColor);
      },
      'edit.copy': () => {
        if (project) copySelection();
      },
      'edit.cut': () => {
        if (project) cutSelection();
      },
      'edit.paste': async () => {
        if (!project) return;
        // An image freshly copied from outside the app (a screenshot, another program) takes
        // priority — matches every other app's Ctrl+V. Falls back to this app's own internal
        // clipboard (copySelection/cutSelection) when the OS clipboard has no image.
        const layerId = await pasteImageFromClipboard(addLayer);
        if (layerId) {
          pushHistory('Pegar imagen');
          return;
        }
        pasteAsLayer();
      },
      'layer.duplicate': () => {
        if (project && currentLayerId) duplicateLayer(currentLayerId);
      },
      'layer.invertColors': () => {
        if (project && currentLayerId) invertLayerColors(currentLayerId);
      },
      'layer.desaturate': () => {
        if (project && currentLayerId) desaturateLayerColors(currentLayerId);
      },
      'tool.resetColors': () => {
        if (project) resetColors();
      },
      'edit.freeTransform': () => {
        if (project) setCurrentTool('transform');
      },
      'edit.deselect': () => {
        if (project) deselectAll();
      },
      'edit.selectAll': () => {
        if (project) selectAll();
      },
      'edit.invertSelection': () => {
        if (project) invertSelection();
      },
      'edit.copyMerged': () => {
        if (project) copyMerged();
      },
      'layer.new': () => {
        if (project) addLayer();
      },
      'layer.group': () => {
        if (project) groupSelectedLayers();
      },
      'layer.ungroup': () => {
        if (project && currentLayerId) ungroupLayer(currentLayerId);
      },
      'layer.mergeDown': () => {
        if (project && currentLayerId) mergeLayerDown(currentLayerId);
      },
      'layer.mergeVisible': () => {
        if (project) mergeVisibleLayers();
      },
      'file.imageSize': () => {
        if (project) openResizeDialog();
      },
      'view.toggleRulers': () => {
        if (project) toggleRulerVisible();
      },
      'view.zoom100': () => {
        if (project) useAppStore.getState().setZoom(1);
      },
      'view.zoomIn': () => {
        if (!project) return;
        const { zoom, setZoom } = useAppStore.getState();
        setZoom(Math.min(32, zoom * 1.25));
      },
      'view.zoomOut': () => {
        if (!project) return;
        const { zoom, setZoom } = useAppStore.getState();
        setZoom(Math.max(0.05, zoom / 1.25));
      },
      'panel.toggleLayers': () => toggleLayerPanel(),
      'panel.toggleBrushes': () => openBrushEditor(),
    };
    for (const [actionId, toolType] of Object.entries(TOOL_SHORTCUT_ACTIONS)) {
      actionMap[actionId] = () => {
        if (project) setCurrentTool(toolType);
      };
    }
    registerActions(actionMap);

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Only actual text-entry controls should swallow shortcuts (so typing "g" into a layer
      // rename field doesn't ungroup, etc.) — a non-text input (opacity slider, checkbox,
      // color swatch...) keeping browser focus after a click shouldn't silently block every
      // global shortcut until the user thinks to click elsewhere to blur it.
      const NON_TEXT_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'color', 'button', 'submit', 'reset', 'file', 'image']);
      const isTextEntry =
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type));
      if (isTextEntry) return;

      // Photoshop/Krita convention: with the brush active, a bare digit sets its opacity —
      // 1-9 for 10%-90%, 0 for 100%. A single conventional gesture spanning 10 keys, so it
      // lives here rather than as 10 separate entries in the remappable shortcut list below.
      if (!e.ctrlKey && !e.altKey && !e.metaKey && currentTool === 'brush' && project && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        updateCurrentBrush({ opacity: e.key === '0' ? 1 : Number(e.key) / 10 });
        return;
      }

      const combo = comboFromEvent(e);
      const def = findDefinitionForCombo(combo, SHORTCUT_DEFINITIONS, overrides);
      if (!def) return;

      if (def.preventDefault) e.preventDefault();
      actionMap[def.id]?.();
      if (isRecordingMacro) recordStep(def.id);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    project,
    currentTool,
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
    fillSelection,
    primaryColor,
    secondaryColor,
    copySelection,
    cutSelection,
    pasteAsLayer,
    duplicateLayer,
    invertLayerColors,
    desaturateLayerColors,
    currentLayerId,
    resetColors,
    toggleRulerVisible,
    selectAll,
    deselectAll,
    invertSelection,
    copyMerged,
    groupSelectedLayers,
    ungroupLayer,
    mergeLayerDown,
    mergeVisibleLayers,
    openResizeDialog,
    openBrushEditor,
    toggleLayerPanel,
    overrides,
    isRecordingMacro,
    recordStep,
    registerActions,
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
          <ErrorBoundary name="Espacio de trabajo">
            <Suspense fallback={null}>
              <WorkspaceShell />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <>
            <ErrorBoundary name="Barra superior"><Header /></ErrorBoundary>
            <div className={`flex-1 flex min-h-0 ${leftHanded ? 'flex-row-reverse' : ''}`} data-lefty={leftHanded}>
              <ErrorBoundary name="Herramientas"><Toolbox /></ErrorBoundary>
              <ErrorBoundary name="Lienzo"><Canvas2D /></ErrorBoundary>
              <ErrorBoundary name="Paneles"><Sidebar /></ErrorBoundary>
            </div>
            <ErrorBoundary name="Barra de estado" compact><StatusBar /></ErrorBoundary>
          </>
        )
      ) : (
        <StartScreen />
      )}

      <TourOverlay />
      <ErrorBoundary name="Diálogo"><NewProjectDialog /></ErrorBoundary>
      {showExportDialog && (
        <ErrorBoundary name="Diálogo de exportación">
          <Suspense fallback={null}>
            <ExportDialog />
          </Suspense>
        </ErrorBoundary>
      )}
      <ErrorBoundary name="Diálogo de copias"><AutoSaveDialog /></ErrorBoundary>
      {showBrushEditor && (
        <ErrorBoundary name="Editor de pinceles">
          <Suspense fallback={null}>
            <BrushEditor />
          </Suspense>
        </ErrorBoundary>
      )}
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
      {showReplayDialog && (
        <Suspense fallback={null}>
          <ReplayDialog />
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

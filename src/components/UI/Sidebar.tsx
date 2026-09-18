import { lazy, Suspense } from 'react';
import { Layers, SlidersHorizontal, History, BarChart3, Film, MessageSquareText, Palette, LibraryBig, ListChecks, GraduationCap, Video, Image, Cloud, Keyboard, Triangle, Gauge } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import LayerPanel from '@/components/Layers/LayerPanel';

// Every other panel here starts closed (only the layer panel is open by default) — loading
// their JS lazily, on first actual toggle, keeps their combined weight (the bulk of the app's
// main bundle) out of the code every session pays for on startup regardless of which of these
// 15 panels, if any, get opened that session.
const FilterPanel = lazy(() => import('@/components/Filters/FilterPanel'));
const HistoryPanel = lazy(() => import('@/components/History/HistoryPanel'));
const Histogram = lazy(() => import('@/components/Analysis/Histogram'));
const TimelinePanel = lazy(() => import('@/components/Animation/TimelinePanel'));
const ComicPanel = lazy(() => import('@/components/Comic/ComicPanel'));
const ColorToolsPanel = lazy(() => import('@/components/ColorTools/ColorToolsPanel'));
const AssetLibraryPanel = lazy(() => import('@/components/AssetLibrary/AssetLibraryPanel'));
const BatchPanel = lazy(() => import('@/components/BatchOperations/BatchPanel'));
const LearningPanel = lazy(() => import('@/components/Learning/LearningPanel'));
const RecordingPanel = lazy(() => import('@/components/Recording/RecordingPanel'));
const ReferencesPanel = lazy(() => import('@/components/References/ReferencesPanel'));
const CloudSyncPanel = lazy(() => import('@/components/CloudSync/CloudSyncPanel'));
const CustomizationPanel = lazy(() => import('@/components/Customization/CustomizationPanel'));
const PerspectivePanel = lazy(() => import('@/components/Perspective/PerspectivePanel'));
const ProjectStatsPanel = lazy(() => import('@/components/UI/ProjectStatsPanel'));

type Tab = 'layers' | 'filters' | 'history' | 'histogram' | 'animation' | 'comic' | 'colorTools' | 'assetLibrary' | 'batch' | 'learning' | 'recording' | 'references' | 'cloudSync' | 'customization' | 'perspective' | 'stats';

export default function Sidebar() {
  const showLayerPanel = useUIStore((s) => s.showLayerPanel);
  const showFilterPanel = useUIStore((s) => s.showFilterPanel);
  const showHistoryPanel = useUIStore((s) => s.showHistoryPanel);
  const showHistogramPanel = useUIStore((s) => s.showHistogramPanel);
  const showAnimationPanel = useUIStore((s) => s.showAnimationPanel);
  const showComicPanel = useUIStore((s) => s.showComicPanel);
  const showColorToolsPanel = useUIStore((s) => s.showColorToolsPanel);
  const showAssetLibraryPanel = useUIStore((s) => s.showAssetLibraryPanel);
  const toggleLayerPanel = useUIStore((s) => s.toggleLayerPanel);
  const toggleFilterPanel = useUIStore((s) => s.toggleFilterPanel);
  const toggleHistoryPanel = useUIStore((s) => s.toggleHistoryPanel);
  const toggleHistogramPanel = useUIStore((s) => s.toggleHistogramPanel);
  const toggleAnimationPanel = useUIStore((s) => s.toggleAnimationPanel);
  const toggleComicPanel = useUIStore((s) => s.toggleComicPanel);
  const toggleColorToolsPanel = useUIStore((s) => s.toggleColorToolsPanel);
  const toggleAssetLibraryPanel = useUIStore((s) => s.toggleAssetLibraryPanel);
  const showBatchPanel = useUIStore((s) => s.showBatchPanel);
  const toggleBatchPanel = useUIStore((s) => s.toggleBatchPanel);
  const showLearningPanel = useUIStore((s) => s.showLearningPanel);
  const toggleLearningPanel = useUIStore((s) => s.toggleLearningPanel);
  const showRecordingPanel = useUIStore((s) => s.showRecordingPanel);
  const toggleRecordingPanel = useUIStore((s) => s.toggleRecordingPanel);
  const showReferencesPanel = useUIStore((s) => s.showReferencesPanel);
  const toggleReferencesPanel = useUIStore((s) => s.toggleReferencesPanel);
  const showCloudSyncPanel = useUIStore((s) => s.showCloudSyncPanel);
  const toggleCloudSyncPanel = useUIStore((s) => s.toggleCloudSyncPanel);
  const showCustomizationPanel = useUIStore((s) => s.showCustomizationPanel);
  const toggleCustomizationPanel = useUIStore((s) => s.toggleCustomizationPanel);
  const showPerspectivePanel = useUIStore((s) => s.showPerspectivePanel);
  const togglePerspectivePanel = useUIStore((s) => s.togglePerspectivePanel);
  const showStatsPanel = useUIStore((s) => s.showStatsPanel);
  const toggleStatsPanel = useUIStore((s) => s.toggleStatsPanel);

  const tabs: { id: Tab; icon: typeof Layers; label: string; active: boolean; toggle: () => void }[] = [
    { id: 'layers', icon: Layers, label: 'Capas', active: showLayerPanel, toggle: toggleLayerPanel },
    { id: 'filters', icon: SlidersHorizontal, label: 'Filtros', active: showFilterPanel, toggle: toggleFilterPanel },
    { id: 'colorTools', icon: Palette, label: 'Herramientas de color', active: showColorToolsPanel, toggle: toggleColorToolsPanel },
    { id: 'perspective', icon: Triangle, label: 'Perspectiva y simetría', active: showPerspectivePanel, toggle: togglePerspectivePanel },
    { id: 'assetLibrary', icon: LibraryBig, label: 'Biblioteca de assets', active: showAssetLibraryPanel, toggle: toggleAssetLibraryPanel },
    { id: 'references', icon: Image, label: 'Referencias', active: showReferencesPanel, toggle: toggleReferencesPanel },
    { id: 'cloudSync', icon: Cloud, label: 'Nube', active: showCloudSyncPanel, toggle: toggleCloudSyncPanel },
    { id: 'customization', icon: Keyboard, label: 'Atajos y personalización', active: showCustomizationPanel, toggle: toggleCustomizationPanel },
    { id: 'batch', icon: ListChecks, label: 'Procesamiento por lotes', active: showBatchPanel, toggle: toggleBatchPanel },
    { id: 'recording', icon: Video, label: 'Grabación de sesión', active: showRecordingPanel, toggle: toggleRecordingPanel },
    { id: 'learning', icon: GraduationCap, label: 'Aprender', active: showLearningPanel, toggle: toggleLearningPanel },
    { id: 'comic', icon: MessageSquareText, label: 'Cómic / Manga', active: showComicPanel, toggle: toggleComicPanel },
    { id: 'animation', icon: Film, label: 'Animación', active: showAnimationPanel, toggle: toggleAnimationPanel },
    { id: 'histogram', icon: BarChart3, label: 'Histograma', active: showHistogramPanel, toggle: toggleHistogramPanel },
    { id: 'history', icon: History, label: 'Historial', active: showHistoryPanel, toggle: toggleHistoryPanel },
    { id: 'stats', icon: Gauge, label: 'Estadísticas del proyecto', active: showStatsPanel, toggle: toggleStatsPanel },
  ];

  const anyOpen =
    showLayerPanel ||
    showFilterPanel ||
    showHistoryPanel ||
    showHistogramPanel ||
    showAnimationPanel ||
    showComicPanel ||
    showColorToolsPanel ||
    showAssetLibraryPanel ||
    showBatchPanel ||
    showLearningPanel ||
    showRecordingPanel ||
    showReferencesPanel ||
    showCloudSyncPanel ||
    showCustomizationPanel ||
    showPerspectivePanel ||
    showStatsPanel;

  return (
    <div className="flex border-l border-border bg-panel">
      {anyOpen && (
        <div className="w-64 border-r border-border flex flex-col">
        <Suspense fallback={<div className="p-3 text-xs text-textDim">Cargando…</div>}>
          {showLayerPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <LayerPanel />
            </div>
          )}
          {showFilterPanel && (
            <div className="border-b border-border overflow-y-auto max-h-96">
              <FilterPanel />
            </div>
          )}
          {showAnimationPanel && (
            <div className="border-b border-border overflow-y-auto max-h-96">
              <TimelinePanel />
            </div>
          )}
          {showComicPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <ComicPanel />
            </div>
          )}
          {showColorToolsPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <ColorToolsPanel />
            </div>
          )}
          {showAssetLibraryPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <AssetLibraryPanel />
            </div>
          )}
          {showReferencesPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <ReferencesPanel />
            </div>
          )}
          {showCloudSyncPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem] p-3">
              <CloudSyncPanel />
            </div>
          )}
          {showCustomizationPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <CustomizationPanel />
            </div>
          )}
          {showPerspectivePanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <PerspectivePanel />
            </div>
          )}
          {showBatchPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem] p-3">
              <BatchPanel />
            </div>
          )}
          {showLearningPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <LearningPanel />
            </div>
          )}
          {showRecordingPanel && (
            <div className="border-b border-border overflow-y-auto max-h-[32rem]">
              <RecordingPanel />
            </div>
          )}
          {showHistogramPanel && (
            <div className="border-b border-border overflow-y-auto">
              <Histogram />
            </div>
          )}
          {showHistoryPanel && (
            <div className="overflow-y-auto max-h-64">
              <HistoryPanel />
            </div>
          )}
          {showStatsPanel && (
            <div className="border-t border-border overflow-y-auto max-h-[32rem]">
              <ProjectStatsPanel />
            </div>
          )}
        </Suspense>
        </div>
      )}
      <div className="w-10 flex flex-col items-center py-2 gap-2">
        {tabs.map(({ id, icon: Icon, label, active, toggle }) => (
          <button
            key={id}
            onClick={toggle}
            title={label}
            className={`w-7 h-7 flex items-center justify-center rounded ${
              active ? 'bg-accent text-white' : 'text-textDim hover:bg-panelLight hover:text-text'
            }`}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

import { lazy, Suspense } from 'react';
import { Layers, SlidersHorizontal, History, BarChart3, Film, MessageSquareText, Palette, LibraryBig, ListChecks, GraduationCap, Video, Image, Cloud, Keyboard, Triangle, Gauge, PencilRuler, GitBranch, Sparkles } from 'lucide-react';
import { useAiStore } from '@/store/aiStore';
import { useUIStore } from '@/store/uiStore';
import ErrorBoundary from '@/components/UI/ErrorBoundary';
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
const StudyPanel = lazy(() => import('@/components/Study/StudyPanel'));
const VersionsPanel = lazy(() => import('@/components/Versions/VersionsPanel'));
const AssistantPanel = lazy(() => import('@/components/Assistant/AssistantPanel'));

type Tab = 'assistant' | 'layers' | 'filters' | 'history' | 'histogram' | 'animation' | 'comic' | 'colorTools' | 'assetLibrary' | 'batch' | 'learning' | 'recording' | 'references' | 'cloudSync' | 'customization' | 'perspective' | 'stats' | 'study' | 'versions';

// The 19 tabs grouped the way an artist actually goes looking for them, not alphabetically or by
// when they were added — each group renders as its own little cluster in the rail (a gap plus a
// divider line), and the open panel shows its group's name above it, so "where is this" has an
// answer beyond a tooltip. `uiStore`'s toggles already guarantee at most one of these is open at
// once (see `closeAllSidebarPanels` there), so grouping is purely presentational here.
const GROUP_LABELS: Record<string, string> = {
  paint: 'Pintura',
  color: 'Color y recursos',
  learn: 'Aprender',
  project: 'Proyecto',
  production: 'Producción',
  system: 'Sistema',
};
const GROUP_ORDER = ['paint', 'color', 'learn', 'project', 'production', 'system'];

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
  const showVersionsPanel = useUIStore((s) => s.showVersionsPanel);
  const toggleVersionsPanel = useUIStore((s) => s.toggleVersionsPanel);
  const aiEnabled = useAiStore((s) => s.enabled);
  const showAssistantPanel = useUIStore((s) => s.showAssistantPanel) && aiEnabled;
  const toggleAssistantPanel = useUIStore((s) => s.toggleAssistantPanel);
  const showStudyPanel = useUIStore((s) => s.showStudyPanel);
  const toggleStudyPanel = useUIStore((s) => s.toggleStudyPanel);

  const tabs: { id: Tab; icon: typeof Layers; label: string; active: boolean; toggle: () => void; group: string }[] = [
    { id: 'layers', icon: Layers, label: 'Capas', active: showLayerPanel, toggle: toggleLayerPanel, group: 'paint' },
    { id: 'filters', icon: SlidersHorizontal, label: 'Filtros', active: showFilterPanel, toggle: toggleFilterPanel, group: 'paint' },
    { id: 'perspective', icon: Triangle, label: 'Perspectiva y simetría', active: showPerspectivePanel, toggle: togglePerspectivePanel, group: 'paint' },
    { id: 'colorTools', icon: Palette, label: 'Herramientas de color', active: showColorToolsPanel, toggle: toggleColorToolsPanel, group: 'color' },
    { id: 'assetLibrary', icon: LibraryBig, label: 'Biblioteca de assets', active: showAssetLibraryPanel, toggle: toggleAssetLibraryPanel, group: 'color' },
    { id: 'references', icon: Image, label: 'Referencias', active: showReferencesPanel, toggle: toggleReferencesPanel, group: 'color' },
    { id: 'study', icon: PencilRuler, label: 'Estudio: guías, tutor y academia', active: showStudyPanel, toggle: toggleStudyPanel, group: 'learn' },
    { id: 'learning', icon: GraduationCap, label: 'Aprender', active: showLearningPanel, toggle: toggleLearningPanel, group: 'learn' },
    ...(aiEnabled ? [{ id: 'assistant' as Tab, icon: Sparkles, label: 'Asistente de IA (referencias, poses, paletas, limpieza…)', active: showAssistantPanel, toggle: toggleAssistantPanel, group: 'learn' }] : []),
    { id: 'history', icon: History, label: 'Historial', active: showHistoryPanel, toggle: toggleHistoryPanel, group: 'project' },
    { id: 'versions', icon: GitBranch, label: 'Versiones del proyecto y comparación', active: showVersionsPanel, toggle: toggleVersionsPanel, group: 'project' },
    { id: 'histogram', icon: BarChart3, label: 'Histograma', active: showHistogramPanel, toggle: toggleHistogramPanel, group: 'project' },
    { id: 'stats', icon: Gauge, label: 'Estadísticas del proyecto', active: showStatsPanel, toggle: toggleStatsPanel, group: 'project' },
    { id: 'comic', icon: MessageSquareText, label: 'Cómic / Manga', active: showComicPanel, toggle: toggleComicPanel, group: 'production' },
    { id: 'animation', icon: Film, label: 'Animación', active: showAnimationPanel, toggle: toggleAnimationPanel, group: 'production' },
    { id: 'batch', icon: ListChecks, label: 'Procesamiento por lotes', active: showBatchPanel, toggle: toggleBatchPanel, group: 'production' },
    { id: 'recording', icon: Video, label: 'Grabación de sesión', active: showRecordingPanel, toggle: toggleRecordingPanel, group: 'production' },
    { id: 'cloudSync', icon: Cloud, label: 'Nube', active: showCloudSyncPanel, toggle: toggleCloudSyncPanel, group: 'system' },
    { id: 'customization', icon: Keyboard, label: 'Atajos y personalización', active: showCustomizationPanel, toggle: toggleCustomizationPanel, group: 'system' },
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
    showStatsPanel ||
    showStudyPanel ||
    showAssistantPanel ||
    showVersionsPanel;

  const activeTab = tabs.find((t) => t.active);

  return (
    <div className="sidebar-root flex border-l border-border bg-panel">
      {anyOpen && (
        <div className="sidebar-panel w-72 border-r border-border flex flex-col overflow-x-hidden">
        {activeTab && (
          <div className="px-3 pt-2.5 pb-1 text-[9px] font-semibold uppercase tracking-wide text-textDim shrink-0">
            {GROUP_LABELS[activeTab.group]}
          </div>
        )}
        <Suspense fallback={<div className="p-3 text-xs text-textDim">Cargando…</div>}>
          {showLayerPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Capas" compact><LayerPanel /></ErrorBoundary>
            </div>
          )}
          {showFilterPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Filtros" compact><FilterPanel /></ErrorBoundary>
            </div>
          )}
          {showAnimationPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Animación" compact><TimelinePanel /></ErrorBoundary>
            </div>
          )}
          {showComicPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Cómic" compact><ComicPanel /></ErrorBoundary>
            </div>
          )}
          {showColorToolsPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Herramientas de color" compact><ColorToolsPanel /></ErrorBoundary>
            </div>
          )}
          {showAssetLibraryPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Biblioteca" compact><AssetLibraryPanel /></ErrorBoundary>
            </div>
          )}
          {showReferencesPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Referencias" compact><ReferencesPanel /></ErrorBoundary>
            </div>
          )}
          {showCloudSyncPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto p-3">
              <ErrorBoundary name="Nube" compact><CloudSyncPanel /></ErrorBoundary>
            </div>
          )}
          {showCustomizationPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Atajos" compact><CustomizationPanel /></ErrorBoundary>
            </div>
          )}
          {showPerspectivePanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Perspectiva" compact><PerspectivePanel /></ErrorBoundary>
            </div>
          )}
          {showVersionsPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Versiones" compact><VersionsPanel /></ErrorBoundary>
            </div>
          )}
          {showAssistantPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Asistente de IA" compact><AssistantPanel /></ErrorBoundary>
            </div>
          )}
          {showStudyPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Estudio" compact><StudyPanel /></ErrorBoundary>
            </div>
          )}
          {showBatchPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto p-3">
              <ErrorBoundary name="Lotes" compact><BatchPanel /></ErrorBoundary>
            </div>
          )}
          {showLearningPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Aprender" compact><LearningPanel /></ErrorBoundary>
            </div>
          )}
          {showRecordingPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Grabación" compact><RecordingPanel /></ErrorBoundary>
            </div>
          )}
          {showHistogramPanel && (
            <div className="flex-1 min-h-0 border-b border-border overflow-y-auto">
              <ErrorBoundary name="Histograma" compact><Histogram /></ErrorBoundary>
            </div>
          )}
          {showHistoryPanel && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ErrorBoundary name="Historial" compact><HistoryPanel /></ErrorBoundary>
            </div>
          )}
          {showStatsPanel && (
            <div className="flex-1 min-h-0 border-t border-border overflow-y-auto">
              <ErrorBoundary name="Estadísticas" compact><ProjectStatsPanel /></ErrorBoundary>
            </div>
          )}
        </Suspense>
        </div>
      )}
      <div className="w-11 flex flex-col items-center py-2 gap-2 overflow-y-auto">
        {GROUP_ORDER.map((group, gi) => {
          const groupTabs = tabs.filter((t) => t.group === group);
          if (groupTabs.length === 0) return null;
          return (
            <div key={group} className="flex flex-col items-center gap-1">
              {gi > 0 && <div className="w-5 h-px bg-border my-1" />}
              {groupTabs.map(({ id, icon: Icon, label, active, toggle }) => (
                <button
                  key={id}
                  onClick={toggle}
                  title={label}
                  className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors ${
                    active ? 'bg-accentSoft text-accent' : 'text-textDim hover:bg-panelLight hover:text-text'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
                  <Icon size={16} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

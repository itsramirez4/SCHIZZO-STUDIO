import { Layers, SlidersHorizontal, History, BarChart3, Film, MessageSquareText, Palette } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import LayerPanel from '@/components/Layers/LayerPanel';
import FilterPanel from '@/components/Filters/FilterPanel';
import HistoryPanel from '@/components/History/HistoryPanel';
import Histogram from '@/components/Analysis/Histogram';
import TimelinePanel from '@/components/Animation/TimelinePanel';
import ComicPanel from '@/components/Comic/ComicPanel';
import ColorToolsPanel from '@/components/ColorTools/ColorToolsPanel';

type Tab = 'layers' | 'filters' | 'history' | 'histogram' | 'animation' | 'comic' | 'colorTools';

export default function Sidebar() {
  const showLayerPanel = useUIStore((s) => s.showLayerPanel);
  const showFilterPanel = useUIStore((s) => s.showFilterPanel);
  const showHistoryPanel = useUIStore((s) => s.showHistoryPanel);
  const showHistogramPanel = useUIStore((s) => s.showHistogramPanel);
  const showAnimationPanel = useUIStore((s) => s.showAnimationPanel);
  const showComicPanel = useUIStore((s) => s.showComicPanel);
  const showColorToolsPanel = useUIStore((s) => s.showColorToolsPanel);
  const toggleLayerPanel = useUIStore((s) => s.toggleLayerPanel);
  const toggleFilterPanel = useUIStore((s) => s.toggleFilterPanel);
  const toggleHistoryPanel = useUIStore((s) => s.toggleHistoryPanel);
  const toggleHistogramPanel = useUIStore((s) => s.toggleHistogramPanel);
  const toggleAnimationPanel = useUIStore((s) => s.toggleAnimationPanel);
  const toggleComicPanel = useUIStore((s) => s.toggleComicPanel);
  const toggleColorToolsPanel = useUIStore((s) => s.toggleColorToolsPanel);

  const tabs: { id: Tab; icon: typeof Layers; label: string; active: boolean; toggle: () => void }[] = [
    { id: 'layers', icon: Layers, label: 'Capas', active: showLayerPanel, toggle: toggleLayerPanel },
    { id: 'filters', icon: SlidersHorizontal, label: 'Filtros', active: showFilterPanel, toggle: toggleFilterPanel },
    { id: 'colorTools', icon: Palette, label: 'Herramientas de color', active: showColorToolsPanel, toggle: toggleColorToolsPanel },
    { id: 'comic', icon: MessageSquareText, label: 'Cómic / Manga', active: showComicPanel, toggle: toggleComicPanel },
    { id: 'animation', icon: Film, label: 'Animación', active: showAnimationPanel, toggle: toggleAnimationPanel },
    { id: 'histogram', icon: BarChart3, label: 'Histograma', active: showHistogramPanel, toggle: toggleHistogramPanel },
    { id: 'history', icon: History, label: 'Historial', active: showHistoryPanel, toggle: toggleHistoryPanel },
  ];

  const anyOpen =
    showLayerPanel || showFilterPanel || showHistoryPanel || showHistogramPanel || showAnimationPanel || showComicPanel || showColorToolsPanel;

  return (
    <div className="flex border-l border-border bg-panel">
      {anyOpen && (
        <div className="w-64 border-r border-border flex flex-col">
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

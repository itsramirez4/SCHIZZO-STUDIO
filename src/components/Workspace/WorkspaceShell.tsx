import { PanelId } from '@/types/workspace';
import { useWorkspaceStore } from '@/store/workspaceStore';
import DockablePanel from './DockablePanel';
import PresetSwitcher from './PresetSwitcher';
import Toolbox from '@/components/Toolbox/Toolbox';
import Canvas2D from '@/components/Canvas/Canvas2D';
import LayerPanel from '@/components/Layers/LayerPanel';
import FilterPanel from '@/components/Filters/FilterPanel';
import ComicPanel from '@/components/Comic/ComicPanel';
import TimelinePanel from '@/components/Animation/TimelinePanel';
import Histogram from '@/components/Analysis/Histogram';
import HistoryPanel from '@/components/History/HistoryPanel';
import StatusBar from '@/components/UI/StatusBar';
import Logo from '@/components/UI/Logo';

const PANEL_REGISTRY: Record<PanelId, { title: string; closable: boolean; Component: React.ComponentType }> = {
  toolbox: { title: 'Herramientas', closable: true, Component: Toolbox },
  canvas: { title: 'Lienzo', closable: false, Component: Canvas2D },
  layers: { title: 'Capas', closable: true, Component: LayerPanel },
  filters: { title: 'Filtros', closable: true, Component: FilterPanel },
  comic: { title: 'Cómic / Manga', closable: true, Component: ComicPanel },
  animation: { title: 'Animación', closable: true, Component: TimelinePanel },
  histogram: { title: 'Histograma', closable: true, Component: Histogram },
  history: { title: 'Historial', closable: true, Component: HistoryPanel },
};

const PANEL_IDS = Object.keys(PANEL_REGISTRY) as PanelId[];

/** The "floating workspace" shell — an alternate to the classic fixed layout in App.tsx,
 * picked at runtime by workspaceStore.mode. Never mounted alongside the classic shell:
 * several of these components (Canvas2D above all) carry real side effects and DOM refs
 * tied into layerService's canvas registry, so mounting the same one twice at once would
 * corrupt that shared state — App.tsx renders exactly one shell at a time. */
export default function WorkspaceShell() {
  const uiScale = useWorkspaceStore((s) => s.uiScale);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden" style={{ fontSize: `${14 * uiScale}px` }}>
      <WorkspaceToolbar />
      <div className="flex-1 relative min-h-0">
        {PANEL_IDS.map((id) => {
          const { title, closable, Component } = PANEL_REGISTRY[id];
          return (
            <DockablePanel key={id} panelId={id} title={title} closable={closable}>
              <Component />
            </DockablePanel>
          );
        })}
        <PresetSwitcher />
      </div>
      <StatusBar />
    </div>
  );
}

function WorkspaceToolbar() {
  const setMode = useWorkspaceStore((s) => s.setMode);
  const resetLayout = useWorkspaceStore((s) => s.resetLayout);

  return (
    <div className="h-10 shrink-0 bg-panel border-b border-border flex items-center px-2 gap-2">
      <Logo size={22} />
      <span className="text-sm font-semibold text-accent px-1">SCHIZZO STUDIO</span>
      <span className="text-[11px] text-textDim">Workspace flotante</span>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={resetLayout} className="text-[11px] text-textDim hover:text-text px-2 py-1 rounded hover:bg-panelLight">
          Restablecer layout
        </button>
        <button onClick={() => setMode('classic')} className="text-[11px] bg-panelLight text-text px-2 py-1 rounded hover:bg-border">
          Volver al layout clásico
        </button>
      </div>
    </div>
  );
}

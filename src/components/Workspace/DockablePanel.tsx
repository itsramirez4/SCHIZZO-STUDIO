import { useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { PanelId, PanelPosition } from '@/types/workspace';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { snapToGrid, constrainToViewport } from '@/services/docking.service';

const GRID_SIZE = 8;
const MIN_WIDTH = 180;
const MIN_HEIGHT = 120;

interface Props {
  panelId: PanelId;
  title: string;
  closable: boolean;
  children: React.ReactNode;
}

/**
 * A real free-floating, draggable, resizable panel. Two bugs the original spec's version
 * had are fixed here: drag/resize listeners live on `window` during the gesture (via
 * pointer capture, the same pattern Canvas2D already uses) instead of the panel's own
 * element — attaching them to the element means the drag silently stops the moment the
 * cursor outruns it — and the in-progress position is tracked in local state, committed to
 * the shared store only on release, so dragging one panel doesn't re-render every other
 * panel on every pointermove frame.
 */
export default function DockablePanel({ panelId, title, closable, children }: Props) {
  const panel = useWorkspaceStore((s) => s.panels[panelId]);
  const updatePosition = useWorkspaceStore((s) => s.updatePanelPosition);
  const toggleCollapsed = useWorkspaceStore((s) => s.toggleCollapsed);
  const toggleVisible = useWorkspaceStore((s) => s.toggleVisible);
  const bringToFront = useWorkspaceStore((s) => s.bringToFront);

  const [liveOverride, setLiveOverride] = useState<PanelPosition | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; orig: PanelPosition; mode: 'move' | 'resize' } | null>(null);

  if (!panel || !panel.visible) return null;
  const position = liveOverride ?? panel.position;

  function beginDrag(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Some pointer ids can't be captured (same caveat Canvas2D's own drag handling
      // already works around) — the drag still works via move/up on this element either
      // way, this only loses the "keeps tracking outside the element's bounds" guarantee.
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig: panel.position, mode };
    bringToFront(panelId);
  }

  function onDragMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    let next: PanelPosition =
      drag.mode === 'move'
        ? { ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy }
        : { ...drag.orig, width: drag.orig.width + dx, height: drag.orig.height + dy };

    next = snapToGrid(next, GRID_SIZE);
    next = constrainToViewport(next, window.innerWidth, window.innerHeight, MIN_WIDTH, MIN_HEIGHT);
    setLiveOverride(next);
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setLiveOverride((current) => {
      if (current) updatePosition(panelId, current);
      return null;
    });
  }

  return (
    <div
      data-panel={panelId}
      className="absolute bg-panel border border-border rounded shadow-2xl flex flex-col"
      style={{ left: position.x, top: position.y, width: position.width, height: panel.collapsed ? 'auto' : position.height, zIndex: panel.zIndex }}
      onPointerDown={() => bringToFront(panelId)}
    >
      <div
        data-panel-header={panelId}
        onPointerDown={(e) => beginDrag(e, 'move')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        className="flex items-center gap-1 px-2 py-1.5 bg-panelLight border-b border-border cursor-move select-none shrink-0 rounded-t"
      >
        <span className="text-xs font-medium text-text flex-1 truncate">{title}</span>
        <button onClick={() => toggleCollapsed(panelId)} className="text-textDim hover:text-text" title={panel.collapsed ? 'Expandir' : 'Colapsar'}>
          {panel.collapsed ? <Plus size={13} /> : <Minus size={13} />}
        </button>
        {closable && (
          <button onClick={() => toggleVisible(panelId)} className="text-textDim hover:text-text" title="Cerrar">
            <X size={13} />
          </button>
        )}
      </div>

      {!panel.collapsed && (
        // The reused panel components (Toolbox, LayerPanel, ...) carry their own fixed
        // widths/borders from the classic fixed-column layout (e.g. Toolbox's `w-52`,
        // `border-r`) — a wrapping parent can't override a child's own width class through
        // the normal cascade, so this scoped !important adapts them to fill whatever size
        // this floating panel currently is instead. It's the one deliberate use of
        // !important in the codebase, specifically for reusing those components here.
        <div className="flex-1 min-h-0 overflow-auto [&>*]:!w-full [&>*]:!h-full [&>*]:!border-none [&>*]:!shrink">
          {children}
        </div>
      )}

      {!panel.collapsed && (
        <div
          onPointerDown={(e) => beginDrag(e, 'resize')}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-40 hover:opacity-100"
          style={{ background: 'linear-gradient(135deg, transparent 50%, var(--color-border) 50%)' }}
        />
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { drawPerspectiveGrid } from '@/services/perspectiveGrid.service';
import { VanishingPoint } from '@/types/perspective';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/** Same "canvas child of the zoomed stage" pattern as GridOverlay, plus draggable handles for
 * each vanishing point — that's the one thing the static composition-guide overlay can't do,
 * and the actual reason this is a separate system rather than an extra GridOverlayType. */
export default function PerspectiveGridOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const grid = usePerspectiveStore((s) => s.grid);
  const moveVanishingPoint = usePerspectiveStore((s) => s.moveVanishingPoint);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: VanishingPoint['id']; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid.enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawPerspectiveGrid(ctx, grid, canvasWidth, canvasHeight);
  }, [grid, canvasWidth, canvasHeight]);

  if (!grid.enabled) return null;

  function onHandlePointerDown(e: React.PointerEvent, vp: VanishingPoint) {
    if (vp.locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = getProjectPoint(e.clientX, e.clientY);
    dragRef.current = { id: vp.id, offsetX: vp.x - p.x, offsetY: vp.y - p.y };
  }
  function onHandlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    moveVanishingPoint(drag.id, p.x + drag.offsetX, p.y + drag.offsetY);
  }
  function onHandlePointerUp() {
    dragRef.current = null;
  }

  const handleSize = 14 / zoom;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {(Object.values(grid.points) as (VanishingPoint | undefined)[]).map(
        (vp) =>
          vp &&
          vp.visible && (
            <div
              key={vp.id}
              onPointerDown={(e) => onHandlePointerDown(e, vp)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              title={vp.label}
              style={{
                position: 'absolute',
                left: vp.x - handleSize / 2,
                top: vp.y - handleSize / 2,
                width: handleSize,
                height: handleSize,
                borderRadius: '50%',
                border: `${2 / zoom}px solid ${vp.color}`,
                background: 'rgba(0,0,0,0.15)',
                cursor: vp.locked ? 'not-allowed' : 'grab',
                pointerEvents: 'auto',
              }}
            />
          )
      )}
    </div>
  );
}

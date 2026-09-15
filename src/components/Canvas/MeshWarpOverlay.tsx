import { useRef } from 'react';
import { useMeshWarpStore } from '@/store/meshWarpStore';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/** Draggable control-point grid for the mesh warp filter — same "SVG lines + draggable handle
 * divs over the zoomed stage" pattern as the perspective grid's vanishing points. Purely a UI
 * overlay; the actual pixel warp happens once, on "Aplicar", via meshWarp.service.ts. */
export default function MeshWarpOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const active = useMeshWarpStore((s) => s.active);
  const points = useMeshWarpStore((s) => s.points);
  const movePoint = useMeshWarpStore((s) => s.movePoint);
  const dragRef = useRef<{ row: number; col: number } | null>(null);

  if (!active || !points) return null;

  function onPointerDown(e: React.PointerEvent, row: number, col: number) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { row, col };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    movePoint(dragRef.current.row, dragRef.current.col, p.x, p.y);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const handleSize = 10 / zoom;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={canvasWidth} height={canvasHeight} style={{ position: 'absolute', inset: 0 }}>
        {points.map((rowPoints, row) =>
          rowPoints.slice(0, -1).map((p, col) => (
            <line key={`h-${row}-${col}`} x1={p.x} y1={p.y} x2={points[row][col + 1].x} y2={points[row][col + 1].y} stroke="#4a9eff" strokeWidth={1 / zoom} opacity={0.7} />
          ))
        )}
        {points.slice(0, -1).map((rowPoints, row) =>
          rowPoints.map((p, col) => (
            <line key={`v-${row}-${col}`} x1={p.x} y1={p.y} x2={points[row + 1][col].x} y2={points[row + 1][col].y} stroke="#4a9eff" strokeWidth={1 / zoom} opacity={0.7} />
          ))
        )}
      </svg>
      {points.map((rowPoints, row) =>
        rowPoints.map((p, col) => (
          <div
            key={`${row}-${col}`}
            onPointerDown={(e) => onPointerDown(e, row, col)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: 'absolute',
              left: p.x - handleSize / 2,
              top: p.y - handleSize / 2,
              width: handleSize,
              height: handleSize,
              borderRadius: '50%',
              background: '#4a9eff',
              border: `${1.5 / zoom}px solid white`,
              cursor: 'grab',
              pointerEvents: 'auto',
            }}
          />
        ))
      )}
    </div>
  );
}

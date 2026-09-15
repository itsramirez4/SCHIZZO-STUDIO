import { useRef } from 'react';

export interface TransformState {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number; // radians
}

interface Point {
  x: number;
  y: number;
}

interface Props {
  transform: TransformState;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => Point;
  onChange: (transform: TransformState) => void;
  /** Smart-guide snapping, applied to the box's move (not resize/rotate, which derive their
   * result from a rotation-corrected offset rather than a raw pointer position). */
  snapFn?: (p: Point) => Point;
  /** Custom rotation center — defaults to the box's own geometric center when omitted. Passing
   * `onPivotChange` renders a draggable handle for it; passing `null` to that callback means
   * "reset to center" (there's no separate pivot state to clear otherwise). */
  pivot?: Point | null;
  onPivotChange?: (p: Point | null) => void;
  /** Perspective-warp mode: instead of an axis-aligned rotatable rectangle, renders 4
   * independently draggable corners (a general quadrilateral) with no rotate handle — dragging
   * the body moves all 4 together. Used for the "perspective transform" feature, distinct from
   * the normal affine scale/rotate this box does the rest of the time. */
  perspectiveMode?: boolean;
  freeCorners?: [Point, Point, Point, Point]; // nw, ne, se, sw, in project coordinates
  onFreeCornersChange?: (corners: [Point, Point, Point, Point]) => void;
}

interface DragState {
  mode: 'move' | 'corner' | 'rotate' | 'pivot' | 'freeCorner' | 'freeMove';
  cornerIndex?: number;
  startPointer: Point;
  startTransform: TransformState;
  startFreeCorners?: [Point, Point, Point, Point];
}

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

export default function TransformBox({
  transform,
  zoom,
  getProjectPoint,
  onChange,
  snapFn,
  pivot,
  onPivotChange,
  perspectiveMode,
  freeCorners,
  onFreeCornersChange,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const handleSize = 9 / zoom;
  const half = handleSize / 2;
  const cx = transform.x + transform.w / 2;
  const cy = transform.y + transform.h / 2;
  const pivotPoint = pivot ?? { x: cx, y: cy };

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const handleName = target.dataset.handle;
    const mode: DragState['mode'] = handleName === 'rotate' ? 'rotate' : handleName === 'pivot' ? 'pivot' : handleName ? 'corner' : 'move';
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some pointer ids (e.g. synthetic/secondary pointers) can't be captured; drag still works via bubbling.
    }
    dragRef.current = {
      mode,
      startPointer: getProjectPoint(e.clientX, e.clientY),
      startTransform: { ...transform },
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    const { mode, startPointer, startTransform } = drag;

    if (mode === 'move') {
      const raw = { x: startTransform.x + (p.x - startPointer.x), y: startTransform.y + (p.y - startPointer.y) };
      const snapped = snapFn ? snapFn(raw) : raw;
      onChange({ ...startTransform, x: snapped.x, y: snapped.y });
    } else if (mode === 'corner') {
      const bcx = startTransform.x + startTransform.w / 2;
      const bcy = startTransform.y + startTransform.h / 2;
      const dx = p.x - bcx;
      const dy = p.y - bcy;
      const cos = Math.cos(-startTransform.angle);
      const sin = Math.sin(-startTransform.angle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      const newW = Math.max(4, Math.abs(localX) * 2);
      const newH = Math.max(4, Math.abs(localY) * 2);
      onChange({ ...startTransform, x: bcx - newW / 2, y: bcy - newH / 2, w: newW, h: newH });
    } else if (mode === 'rotate') {
      let angle = Math.atan2(p.y - pivotPoint.y, p.x - pivotPoint.x) + Math.PI / 2;
      if (e.shiftKey) {
        const step = Math.PI / 12; // 15°, same convention as most other apps' shift-to-rotate-snap
        angle = Math.round(angle / step) * step;
      }
      onChange({ ...startTransform, angle });
    } else if (mode === 'pivot') {
      onPivotChange?.(p);
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function cornerStyle(name: (typeof CORNERS)[number]): React.CSSProperties {
    const style: React.CSSProperties = {
      position: 'absolute',
      width: handleSize,
      height: handleSize,
      background: '#5b8cff',
      border: `${1 / zoom}px solid white`,
      borderRadius: 2,
      cursor: name === 'nw' || name === 'se' ? 'nwse-resize' : 'nesw-resize',
    };
    if (name.includes('n')) style.top = -half;
    else style.bottom = -half;
    if (name.includes('w')) style.left = -half;
    else style.right = -half;
    return style;
  }

  if (perspectiveMode && freeCorners && onFreeCornersChange) {
    return (
      <PerspectiveCorners
        corners={freeCorners}
        zoom={zoom}
        getProjectPoint={getProjectPoint}
        onChange={onFreeCornersChange}
      />
    );
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: 'absolute',
        left: transform.x,
        top: transform.y,
        width: transform.w,
        height: transform.h,
        transform: `rotate(${transform.angle}rad)`,
        // Defaults to the box's own center (equivalent to 'center center') — when a custom pivot
        // is set, rotating the CSS transform around THAT point instead is all it takes to make
        // the live preview visually orbit around it, matching what commitTransform then bakes in.
        transformOrigin: `${pivotPoint.x - transform.x}px ${pivotPoint.y - transform.y}px`,
        border: `${2 / zoom}px solid #5b8cff`,
        cursor: 'move',
        boxSizing: 'border-box',
      }}
    >
      {CORNERS.map((name) => (
        <div key={name} data-handle={name} style={cornerStyle(name)} />
      ))}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -24 / zoom,
          width: 1 / zoom,
          height: 24 / zoom,
          background: '#5b8cff',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        data-handle="rotate"
        title="Arrastrar para rotar — mantené Shift para ajustar a 15°"
        style={{
          position: 'absolute',
          left: '50%',
          top: -28 / zoom,
          width: handleSize,
          height: handleSize,
          transform: 'translate(-50%, -50%)',
          background: '#5b8cff',
          border: `${1 / zoom}px solid white`,
          borderRadius: '50%',
          cursor: 'grab',
        }}
      />
      {onPivotChange && (
        <div
          data-handle="pivot"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onPivotChange(null);
          }}
          title="Punto de pivote (doble clic para restablecer)"
          style={{
            position: 'absolute',
            // pivotPoint is in project space; this box is rotated around its own center, so
            // position the handle un-rotated within the (unrotated) local box coordinate space.
            left: pivotPoint.x - transform.x - handleSize / 2,
            top: pivotPoint.y - transform.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            transform: `rotate(${-transform.angle}rad)`,
            background: 'transparent',
            border: `${1.5 / zoom}px solid #ffd43b`,
            borderRadius: '50%',
            cursor: 'grab',
          }}
        >
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1 / zoom, height: handleSize, background: '#ffd43b', transform: 'translate(-50%,-50%)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: handleSize, height: 1 / zoom, background: '#ffd43b', transform: 'translate(-50%,-50%)' }} />
        </div>
      )}
    </div>
  );
}

interface PerspectiveCornersProps {
  corners: [Point, Point, Point, Point];
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => Point;
  onChange: (corners: [Point, Point, Point, Point]) => void;
}

/** The 4-independent-corner UI for perspective-warp mode — a plain quadrilateral outline (SVG)
 * with one draggable handle per corner, plus dragging inside the shape moves all 4 together. */
function PerspectiveCorners({ corners, zoom, getProjectPoint, onChange }: PerspectiveCornersProps) {
  const dragRef = useRef<{ index: number; start: Point; startCorners: [Point, Point, Point, Point] } | null>(null);
  const moveDragRef = useRef<{ start: Point; startCorners: [Point, Point, Point, Point] } | null>(null);
  const handleSize = 11 / zoom;

  function onCornerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { index, start: getProjectPoint(e.clientX, e.clientY), startCorners: [...corners] as [Point, Point, Point, Point] };
  }
  function onCornerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    const next = [...drag.startCorners] as [Point, Point, Point, Point];
    next[drag.index] = { x: drag.startCorners[drag.index].x + (p.x - drag.start.x), y: drag.startCorners[drag.index].y + (p.y - drag.start.y) };
    onChange(next);
  }
  function onCornerUp() {
    dragRef.current = null;
  }

  function onBodyDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    moveDragRef.current = { start: getProjectPoint(e.clientX, e.clientY), startCorners: [...corners] as [Point, Point, Point, Point] };
  }
  function onBodyMove(e: React.PointerEvent) {
    const drag = moveDragRef.current;
    if (!drag) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    onChange(drag.startCorners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as [Point, Point, Point, Point]);
  }
  function onBodyUp() {
    moveDragRef.current = null;
  }

  const pointsAttr = corners.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <polygon
          points={pointsAttr}
          fill="rgba(91,140,255,0.08)"
          stroke="#5b8cff"
          strokeWidth={2 / zoom}
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onPointerDown={onBodyDown}
          onPointerMove={onBodyMove}
          onPointerUp={onBodyUp}
        />
      </svg>
      {corners.map((c, i) => (
        <div
          key={i}
          onPointerDown={(e) => onCornerDown(e, i)}
          onPointerMove={onCornerMove}
          onPointerUp={onCornerUp}
          style={{
            position: 'absolute',
            left: c.x - handleSize / 2,
            top: c.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            background: '#5b8cff',
            border: `${1.5 / zoom}px solid white`,
            borderRadius: 2,
            cursor: 'grab',
            pointerEvents: 'auto',
          }}
        />
      ))}
    </div>
  );
}

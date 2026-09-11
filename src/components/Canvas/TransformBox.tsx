import { useRef } from 'react';

export interface TransformState {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number; // radians
}

interface Props {
  transform: TransformState;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
  onChange: (transform: TransformState) => void;
}

interface DragState {
  mode: 'move' | 'corner' | 'rotate';
  startPointer: { x: number; y: number };
  startTransform: TransformState;
}

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;

export default function TransformBox({ transform, zoom, getProjectPoint, onChange }: Props) {
  const dragRef = useRef<DragState | null>(null);
  const handleSize = 9 / zoom;
  const half = handleSize / 2;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const handleName = target.dataset.handle;
    const mode: DragState['mode'] = handleName === 'rotate' ? 'rotate' : handleName ? 'corner' : 'move';
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
      onChange({
        ...startTransform,
        x: startTransform.x + (p.x - startPointer.x),
        y: startTransform.y + (p.y - startPointer.y),
      });
    } else if (mode === 'corner') {
      const cx = startTransform.x + startTransform.w / 2;
      const cy = startTransform.y + startTransform.h / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const cos = Math.cos(-startTransform.angle);
      const sin = Math.sin(-startTransform.angle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      const newW = Math.max(4, Math.abs(localX) * 2);
      const newH = Math.max(4, Math.abs(localY) * 2);
      onChange({ ...startTransform, x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
    } else if (mode === 'rotate') {
      const cx = startTransform.x + startTransform.w / 2;
      const cy = startTransform.y + startTransform.h / 2;
      const angle = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
      onChange({ ...startTransform, angle });
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
        transformOrigin: 'center center',
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
    </div>
  );
}

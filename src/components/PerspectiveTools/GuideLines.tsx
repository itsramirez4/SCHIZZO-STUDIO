import { useRef } from 'react';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { Guide } from '@/types/perspective';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/** Draggable ruler guides, rendered as plain DOM elements (a line is cheap enough not to need a
 * canvas redraw loop) — vertical/horizontal guides drag along their own axis; a diagonal guide's
 * anchor point drags freely, but its angle is only editable numerically from the Guides panel. */
export default function GuideLines({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const guides = usePerspectiveStore((s) => s.guides);
  const moveGuide = usePerspectiveStore((s) => s.moveGuide);
  const dragRef = useRef<{ id: string } | null>(null);

  function onPointerDown(e: React.PointerEvent, guide: Guide) {
    if (guide.locked) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: guide.id };
  }
  function onPointerMove(e: React.PointerEvent, guide: Guide) {
    if (!dragRef.current || dragRef.current.id !== guide.id) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    if (guide.type === 'vertical') moveGuide(guide.id, p.x, undefined);
    else if (guide.type === 'horizontal') moveGuide(guide.id, undefined, p.y);
    else moveGuide(guide.id, p.x, p.y);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const visible = guides.filter((g) => g.visible);
  if (visible.length === 0) return null;
  const diagLen = Math.hypot(canvasWidth, canvasHeight);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={canvasWidth} height={canvasHeight} style={{ position: 'absolute', inset: 0 }}>
        {visible
          .filter((g): g is Guide & { type: 'diagonal'; x: number; y: number; angle: number } => g.type === 'diagonal' && g.x !== undefined && g.y !== undefined && g.angle !== undefined)
          .map((g) => {
            const rad = (g.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * diagLen;
            const dy = Math.sin(rad) * diagLen;
            return (
              <line
                key={g.id}
                x1={g.x - dx}
                y1={g.y - dy}
                x2={g.x + dx}
                y2={g.y + dy}
                stroke={g.color}
                strokeWidth={1 / zoom}
                strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                style={{ pointerEvents: 'stroke', cursor: g.locked ? 'default' : 'move' }}
                onPointerDown={(e) => onPointerDown(e, g)}
                onPointerMove={(e) => onPointerMove(e, g)}
                onPointerUp={onPointerUp}
              />
            );
          })}
      </svg>
      {visible
        .filter((g) => g.type === 'vertical' && g.x !== undefined)
        .map((g) => (
          <div
            key={g.id}
            onPointerDown={(e) => onPointerDown(e, g)}
            onPointerMove={(e) => onPointerMove(e, g)}
            onPointerUp={onPointerUp}
            style={{
              position: 'absolute',
              left: g.x! - 3 / zoom,
              top: 0,
              width: 6 / zoom,
              height: canvasHeight,
              cursor: g.locked ? 'default' : 'ew-resize',
              pointerEvents: 'auto',
              borderLeft: `${1 / zoom}px dashed ${g.color}`,
              marginLeft: 3 / zoom,
            }}
          />
        ))}
      {visible
        .filter((g) => g.type === 'horizontal' && g.y !== undefined)
        .map((g) => (
          <div
            key={g.id}
            onPointerDown={(e) => onPointerDown(e, g)}
            onPointerMove={(e) => onPointerMove(e, g)}
            onPointerUp={onPointerUp}
            style={{
              position: 'absolute',
              top: g.y! - 3 / zoom,
              left: 0,
              height: 6 / zoom,
              width: canvasWidth,
              cursor: g.locked ? 'default' : 'ns-resize',
              pointerEvents: 'auto',
              borderTop: `${1 / zoom}px dashed ${g.color}`,
              marginTop: 3 / zoom,
            }}
          />
        ))}
    </div>
  );
}

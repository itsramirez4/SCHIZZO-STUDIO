import { useEffect, useRef, useState } from 'react';

interface Props {
  viewportRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  onCreateGuide: (type: 'vertical' | 'horizontal', projectPos: number) => void;
}

const THICKNESS = 18;
/** Screen-pixel spacing to aim for between ticks, before picking the nearest "nice" project-unit
 * interval (1/2/5 × a power of 10) that achieves roughly that spacing at the current zoom. */
const TARGET_TICK_SPACING_PX = 70;

function niceInterval(zoom: number): number {
  const rawUnits = TARGET_TICK_SPACING_PX / zoom;
  const pow = Math.pow(10, Math.floor(Math.log10(rawUnits)));
  const candidates = [1, 2, 5, 10];
  for (const c of candidates) {
    if (c * pow >= rawUnits) return c * pow;
  }
  return 10 * pow;
}

/**
 * Ruler bars fixed to the viewport edges (not scaled by the stage's own CSS transform, so tick
 * marks and labels stay crisp at any zoom) — measured against the actual stage element's
 * bounding box each time zoom/pan changes, since the stage is centered by flexbox and then
 * translated/scaled, not pinned to the viewport's own top-left corner.
 */
export default function RulerBars({ viewportRef, stageRef, zoom, panX, panY, canvasWidth, canvasHeight, onCreateGuide }: Props) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ type: 'vertical' | 'horizontal' } | null>(null);
  const [dragPreview, setDragPreview] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const viewport = viewportRef.current;
      const stage = stageRef.current;
      if (!viewport || !stage) return;
      const vRect = viewport.getBoundingClientRect();
      const sRect = stage.getBoundingClientRect();
      setOrigin({ x: sRect.left - vRect.left + viewport.scrollLeft, y: sRect.top - vRect.top + viewport.scrollTop });
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [viewportRef, stageRef, zoom, panX, panY, canvasWidth, canvasHeight]);

  if (!origin) return null;
  const interval = niceInterval(zoom);

  function ticks(lengthProject: number) {
    const out: { pos: number; label: string }[] = [];
    for (let v = 0; v <= lengthProject; v += interval) out.push({ pos: v, label: String(Math.round(v)) });
    return out;
  }

  function handlePointerDown(type: 'vertical' | 'horizontal') {
    dragRef.current = { type };
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !origin) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vRect = viewport.getBoundingClientRect();
    if (dragRef.current.type === 'vertical') {
      setDragPreview((e.clientX - vRect.left + viewport.scrollLeft - origin.x) / zoom);
    } else {
      setDragPreview((e.clientY - vRect.top + viewport.scrollTop - origin.y) / zoom);
    }
  }
  function handlePointerUp() {
    if (dragRef.current && dragPreview !== null) {
      onCreateGuide(dragRef.current.type, dragPreview);
    }
    dragRef.current = null;
    setDragPreview(null);
  }

  return (
    <>
      {/* Corner square */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: THICKNESS, height: THICKNESS, background: '#1e1e1e', zIndex: 3 }} />
      {/* Top (horizontal) ruler — dragging from it creates a HORIZONTAL guide at that Y. */}
      <div
        onPointerDown={() => handlePointerDown('horizontal')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          left: THICKNESS,
          right: 0,
          height: THICKNESS,
          background: '#1e1e1e',
          cursor: 'ns-resize',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', left: origin.x - THICKNESS, height: '100%' }}>
          {ticks(canvasWidth).map((t) => (
            <div key={t.pos} style={{ position: 'absolute', left: t.pos * zoom, top: 0, height: '100%', borderLeft: '1px solid #666', paddingLeft: 2 }}>
              <span style={{ fontSize: 8, color: '#999' }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Left (vertical) ruler — dragging from it creates a VERTICAL guide at that X. */}
      <div
        onPointerDown={() => handlePointerDown('vertical')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'absolute',
          top: THICKNESS,
          left: 0,
          bottom: 0,
          width: THICKNESS,
          background: '#1e1e1e',
          cursor: 'ew-resize',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', top: origin.y - THICKNESS, width: '100%' }}>
          {ticks(canvasHeight).map((t) => (
            <div key={t.pos} style={{ position: 'absolute', top: t.pos * zoom, left: 0, width: '100%', borderTop: '1px solid #666' }}>
              <span style={{ fontSize: 8, color: '#999', writingMode: 'vertical-rl' }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
      {dragPreview !== null && dragRef.current && (
        <div
          style={{
            position: 'absolute',
            zIndex: 4,
            background: '#4a9eff',
            pointerEvents: 'none',
            ...(dragRef.current.type === 'vertical'
              ? { left: origin.x + dragPreview * zoom, top: 0, width: 1, height: '100%' }
              : { top: origin.y + dragPreview * zoom, left: 0, height: 1, width: '100%' }),
          }}
        />
      )}
    </>
  );
}

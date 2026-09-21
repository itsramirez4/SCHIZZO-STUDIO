import { useEffect, useRef, useState } from 'react';
import { usePerspectiveStore } from '@/store/perspectiveStore';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/** The horizon (eye-level) line across the canvas. Only a small tab is grabbable, so the line never
 * gets in the way of drawing next to it; the tab sticks to the left edge of what is currently on
 * screen (a big canvas is wider than the work area), and the exact height is also editable in the
 * Perspective panel. */
export default function HorizonOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const horizon = usePerspectiveStore((s) => s.grid.horizon);
  const setHorizonY = usePerspectiveStore((s) => s.setHorizonY);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ offset: number } | null>(null);
  const [tabX, setTabX] = useState(0);
  const visible = !!horizon?.visible;

  const tabW = 92 / zoom;
  const tabH = 18 / zoom;

  // Keep the tab inside the visible part of the canvas as the user scrolls, zooms or resizes.
  useEffect(() => {
    if (!visible) return;
    const scroller = rootRef.current?.closest('.overflow-auto') as HTMLElement | null;
    if (!scroller) return;
    const update = () => {
      const r = scroller.getBoundingClientRect();
      const left = getProjectPoint(r.left + 8, r.top + r.height / 2).x;
      setTabX(Math.max(0, Math.min(canvasWidth - tabW, left)));
    };
    update();
    scroller.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [visible, zoom, canvasWidth, tabW, getProjectPoint]);

  if (!horizon?.visible) return null;

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // synthetic / already-released pointers can't be captured — dragging still works via move events
    }
    dragRef.current = { offset: horizon!.y - getProjectPoint(e.clientX, e.clientY).y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setHorizonY(Math.round(getProjectPoint(e.clientX, e.clientY).y + dragRef.current.offset), canvasHeight);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} data-testid="horizon-overlay">
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: canvasWidth,
          top: horizon.y,
          borderTop: `${2 / zoom}px dashed ${horizon.color}`,
          opacity: 0.9,
        }}
      />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Arrastra para subir o bajar el horizonte (nivel de los ojos)"
        style={{
          position: 'absolute',
          left: tabX,
          top: horizon.y - tabH / 2,
          width: tabW,
          height: tabH,
          background: horizon.color,
          color: '#1a1a1a',
          fontSize: 11 / zoom,
          lineHeight: `${tabH}px`,
          textAlign: 'center',
          borderRadius: `${4 / zoom}px`,
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        Horizonte ↕
      </div>
    </div>
  );
}

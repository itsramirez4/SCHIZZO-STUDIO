import { useEffect, useRef } from 'react';

interface Props {
  containerRef: React.RefObject<HTMLElement>;
  active: boolean;
  diameterPx: number;
  square: boolean;
}

/**
 * A Photoshop-style outline that follows the pointer showing exactly where — and how big —
 * the next stamp will land, BEFORE you click. Positioned in raw screen space (not the
 * zoomed/panned stage) since it only needs to track the cursor, not project coordinates.
 * `mix-blend-mode: difference` against a white border makes it invert against whatever's
 * underneath, so it stays visible on both light and dark art without needing a theme check.
 * Updates the DOM node directly via a ref instead of React state — pointermove fires far
 * too often to route through a re-render on every tick.
 */
export default function BrushCursor({ containerRef, active, diameterPx, square }: Props) {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor || !active) return;

    function onMove(e: PointerEvent) {
      cursor!.style.left = `${e.clientX}px`;
      cursor!.style.top = `${e.clientY}px`;
      cursor!.style.visibility = 'visible';
    }
    function onLeave() {
      cursor!.style.visibility = 'hidden';
    }

    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
    };
  }, [containerRef, active]);

  if (!active) return null;

  // A brush at 1px zoomed out would render an invisible outline — floor it so there's
  // always something to see, even though the real stamp is smaller than the ring shown.
  const size = Math.max(diameterPx, 6);

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        borderRadius: square ? 0 : '50%',
        border: '1px solid #fff',
        mixBlendMode: 'difference',
        pointerEvents: 'none',
        visibility: 'hidden',
        zIndex: 50,
      }}
    />
  );
}

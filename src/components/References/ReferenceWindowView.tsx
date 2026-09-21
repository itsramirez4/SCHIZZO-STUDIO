import { useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 12;

/** Rendered instead of the normal app shell when the page loads with a `?refWindow=<id>` query
 * param (see main.tsx) — this is what a real floating reference `BrowserWindow` shows. The image
 * data itself is fetched from the main process by id rather than embedded in the URL, since a
 * real photo's data URL can be megabytes. Besides flipping it can be zoomed (wheel), panned
 * (drag) and rotated, so a reference can be studied from any angle beside the canvas. */
export default function ReferenceWindowView() {
  const [id] = useState(() => new URLSearchParams(window.location.search).get('refWindow') || '');
  const [data, setData] = useState<{ dataUrl: string; title: string } | null>(null);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    window.electronAPI.getReferenceWindowData(id).then(setData);
  }, [id]);

  function toggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    window.electronAPI.setReferenceWindowAlwaysOnTop(id, next);
  }

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  const zoomBy = (factor: number) => setZoom((z) => clampZoom(z * factor));
  const rotateBy = (deg: number) => setRotation((r) => ((((r + deg + 180) % 360) + 360) % 360) - 180);
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const btnClass = (active: boolean) => `text-[11px] px-2 py-1 rounded border border-border ${active ? 'bg-accent text-white' : 'bg-panel text-textDim hover:text-text'}`;

  if (!data) {
    return <div className="h-screen flex items-center justify-center bg-panel text-textDim text-xs">Cargando…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-panel">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-panelLight border-b border-border" data-testid="ref-window-toolbar">
        <button onClick={() => setFlipH((v) => !v)} className={btnClass(flipH)} title="Voltear en horizontal (espejo): revela errores de proporción">
          Flip H
        </button>
        <button onClick={() => setFlipV((v) => !v)} className={btnClass(flipV)} title="Voltear en vertical">
          Flip V
        </button>
        <span className="w-px h-4 bg-border" />
        <button onClick={() => zoomBy(1 / 1.25)} className={btnClass(false)} title="Reducir">
          −
        </button>
        <span className="text-[11px] text-textDim w-10 text-center" data-testid="ref-window-zoom">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => zoomBy(1.25)} className={btnClass(false)} title="Ampliar">
          +
        </button>
        <span className="w-px h-4 bg-border" />
        <button onClick={() => rotateBy(-15)} className={btnClass(false)} title="Girar 15° a la izquierda">
          ↺
        </button>
        <input type="range" min={-180} max={180} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-24" title="Ángulo" />
        <button onClick={() => rotateBy(15)} className={btnClass(false)} title="Girar 15° a la derecha">
          ↻
        </button>
        <span className="text-[11px] text-textDim w-9 text-center" data-testid="ref-window-rotation">
          {rotation}°
        </span>
        <span className="w-px h-4 bg-border" />
        <button onClick={resetView} className={btnClass(false)} title="Ajustar a la ventana y quitar el giro">
          Ajustar
        </button>
        <button onClick={toggleAlwaysOnTop} className={btnClass(alwaysOnTop)}>
          Siempre visible
        </button>
      </div>
      <div
        className="flex-1 overflow-hidden flex items-center justify-center checkerboard select-none"
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1)}
        onPointerDown={(e) => {
          dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // pointer already gone — the drag simply won't track outside the window
          }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (d) setPan({ x: d.panX + e.clientX - d.startX, y: d.panY + e.clientY - d.startY });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onDoubleClick={resetView}
      >
        <img
          src={data.dataUrl}
          alt={data.title}
          draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${(flipH ? -1 : 1) * zoom}, ${(flipV ? -1 : 1) * zoom})` }}
          data-testid="ref-window-image"
        />
      </div>
    </div>
  );
}

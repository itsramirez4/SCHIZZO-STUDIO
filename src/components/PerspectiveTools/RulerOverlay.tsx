import { useRef } from 'react';
import { usePerspectiveStore } from '@/store/perspectiveStore';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

type Handle = 'move' | 'rotate' | 'rx' | 'ry';

const COLOR = '#ff8a3d';
const rad = (d: number) => (d * Math.PI) / 180;

/** The drawing ruler on the canvas: a line, a family of parallels or an ellipse template, with small
 * handles to move, rotate and resize it. Only the handles catch the pointer, so drawing next to the
 * ruler is never blocked. */
export default function RulerOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const ruler = usePerspectiveStore((s) => s.ruler);
  const setRuler = usePerspectiveStore((s) => s.setRuler);
  const dragRef = useRef<{ handle: Handle; dx: number; dy: number } | null>(null);

  if (ruler.kind === 'off' || ruler.kind === 'perspective' || !ruler.visible) return null;

  const a = rad(ruler.angle);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const px = -uy; // perpendicular
  const py = ux;
  const hr = 7 / zoom;
  const out = 26 / zoom; // ellipse handles sit just outside the outline, so a stroke that starts on it is not a drag
  const reach = 130 / zoom;
  const big = 4 * Math.max(canvasWidth, canvasHeight);
  const snapBand = (2 * ruler.snapDistance) / zoom;

  const handles: { id: Handle; x: number; y: number; title: string }[] = [{ id: 'move', x: ruler.x, y: ruler.y, title: 'Mover la regla' }];
  if (ruler.kind === 'line' || ruler.kind === 'parallel') handles.push({ id: 'rotate', x: ruler.x + ux * reach, y: ruler.y + uy * reach, title: 'Girar la regla (Mayús: de 15° en 15°)' });
  if (ruler.kind === 'ellipse') {
    handles.push({ id: 'rx', x: ruler.x + ux * (ruler.rx + out), y: ruler.y + uy * (ruler.rx + out), title: 'Radio X y giro de la elipse (Mayús: giro de 15° en 15°)' });
    handles.push({ id: 'ry', x: ruler.x + px * (ruler.ry + out), y: ruler.y + py * (ruler.ry + out), title: 'Radio Y' });
  }

  function onDown(e: React.PointerEvent, h: Handle, hx: number, hy: number) {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // synthetic pointers can't be captured; dragging still follows the move events
    }
    const p = getProjectPoint(e.clientX, e.clientY);
    dragRef.current = { handle: h, dx: hx - p.x, dy: hy - p.y };
  }

  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    const x = p.x + d.dx;
    const y = p.y + d.dy;
    const snapAngle = (deg: number) => (e.shiftKey ? Math.round(deg / 15) * 15 : deg);
    if (d.handle === 'move') setRuler({ x: Math.round(x), y: Math.round(y) });
    else if (d.handle === 'rotate') setRuler({ angle: Math.round(snapAngle((Math.atan2(y - ruler.y, x - ruler.x) * 180) / Math.PI)) });
    else if (d.handle === 'rx') setRuler({ rx: Math.max(1, Math.round(Math.hypot(x - ruler.x, y - ruler.y) - out)), angle: Math.round(snapAngle((Math.atan2(y - ruler.y, x - ruler.x) * 180) / Math.PI)) });
    else if (d.handle === 'ry') setRuler({ ry: Math.max(1, Math.round((x - ruler.x) * px + (y - ruler.y) * py - out)) });
  }

  function onUp() {
    dragRef.current = null;
  }

  return (
    <svg
      data-testid="ruler-overlay"
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {ruler.kind === 'line' && (
        <>
          <line x1={ruler.x - ux * big} y1={ruler.y - uy * big} x2={ruler.x + ux * big} y2={ruler.y + uy * big} stroke={COLOR} strokeOpacity={0.12} strokeWidth={snapBand} />
          <line x1={ruler.x - ux * big} y1={ruler.y - uy * big} x2={ruler.x + ux * big} y2={ruler.y + uy * big} stroke={COLOR} strokeWidth={2 / zoom} />
        </>
      )}
      {ruler.kind === 'parallel' &&
        Array.from({ length: 41 }, (_, i) => i - 20).map((k) => {
          const ox = ruler.x + px * k * (60 / zoom);
          const oy = ruler.y + py * k * (60 / zoom);
          return <line key={k} x1={ox - ux * big} y1={oy - uy * big} x2={ox + ux * big} y2={oy + uy * big} stroke={COLOR} strokeOpacity={k === 0 ? 0.9 : 0.25} strokeWidth={(k === 0 ? 2 : 1) / zoom} strokeDasharray={k === 0 ? undefined : `${6 / zoom} ${6 / zoom}`} />;
        })}
      {ruler.kind === 'ellipse' && (
        <>
          <ellipse cx={ruler.x} cy={ruler.y} rx={ruler.rx} ry={ruler.ry} transform={`rotate(${ruler.angle} ${ruler.x} ${ruler.y})`} fill="none" stroke={COLOR} strokeOpacity={0.12} strokeWidth={snapBand} />
          <ellipse cx={ruler.x} cy={ruler.y} rx={ruler.rx} ry={ruler.ry} transform={`rotate(${ruler.angle} ${ruler.x} ${ruler.y})`} fill="none" stroke={COLOR} strokeWidth={2 / zoom} />
          <line x1={ruler.x - ux * ruler.rx} y1={ruler.y - uy * ruler.rx} x2={ruler.x + ux * ruler.rx} y2={ruler.y + uy * ruler.rx} stroke={COLOR} strokeOpacity={0.35} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />
        </>
      )}
      {handles.map((h) => (
        <circle
          key={h.id}
          data-testid={`ruler-handle-${h.id}`}
          cx={h.x}
          cy={h.y}
          r={hr}
          fill={h.id === 'move' ? COLOR : 'rgba(30,30,30,0.85)'}
          stroke={COLOR}
          strokeWidth={2 / zoom}
          style={{ pointerEvents: 'auto', cursor: h.id === 'move' ? 'move' : 'grab', touchAction: 'none' }}
          onPointerDown={(e) => onDown(e, h.id, h.x, h.y)}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <title>{h.title}</title>
        </circle>
      ))}
    </svg>
  );
}

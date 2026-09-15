import { useRef, useState } from 'react';
import * as filterService from '@/services/filter.service';
import { CurvePoint } from '@/services/filter.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const SIZE = 180;
const KEY = 'curves';
const DEFAULT_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

function toSvg(p: CurvePoint) {
  return { x: (p.x / 255) * SIZE, y: SIZE - (p.y / 255) * SIZE };
}

function fromSvg(sx: number, sy: number): CurvePoint {
  return {
    x: Math.max(0, Math.min(255, Math.round((sx / SIZE) * 255))),
    y: Math.max(0, Math.min(255, Math.round(((SIZE - sy) / SIZE) * 255))),
  };
}

/**
 * Curves: an arbitrary smooth tone curve (Catmull-Rom through draggable points) instead of
 * Levels' straight ramp + gamma — click the graph to add a point, drag to move it, double-click
 * to remove it (the two endpoints are pinned to x=0/x=255 and can't be deleted, only slid up
 * or down). Combined RGB only, matching every other tone tool here.
 */
export default function CurvesFilter() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [points, setPoints] = useState<CurvePoint[]>(DEFAULT_POINTS);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<number | null>(null);

  function runPreview(next: CurvePoint[]) {
    preview(KEY, (canvas) => filterService.applyCurve(canvas, next));
  }

  function svgPointFromEvent(e: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointPointerDown(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    draggingRef.current = index;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Some pointer ids can't be captured; dragging still works via the SVG's move handler.
    }
  }

  function handleSvgPointerMove(e: React.PointerEvent) {
    if (draggingRef.current === null) return;
    const idx = draggingRef.current;
    const { x: sx, y: sy } = svgPointFromEvent(e);
    const raw = fromSvg(sx, sy);
    const isEndpoint = idx === 0 || idx === points.length - 1;
    // Clamped to stay strictly between its own neighbors — never crosses them, so the array
    // stays sorted and `idx` keeps pointing at the same point for the whole drag (no re-sort
    // needed mid-drag, which would otherwise invalidate draggingRef's index).
    const minX = idx > 0 ? points[idx - 1].x + 1 : 0;
    const maxX = idx < points.length - 1 ? points[idx + 1].x - 1 : 255;
    const x = isEndpoint ? points[idx].x : Math.max(minX, Math.min(maxX, raw.x));
    const next = [...points];
    next[idx] = { x, y: raw.y };
    setPoints(next);
    runPreview(next);
  }

  function handleSvgPointerUp() {
    draggingRef.current = null;
  }

  function handleSvgClick(e: React.MouseEvent) {
    if (draggingRef.current !== null) return;
    const { x: sx, y: sy } = svgPointFromEvent(e);
    const p = fromSvg(sx, sy);
    const next = [...points, p].sort((a, b) => a.x - b.x);
    setPoints(next);
    runPreview(next);
  }

  function handlePointDoubleClick(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (index === 0 || index === points.length - 1) return;
    const next = points.filter((_, i) => i !== index);
    setPoints(next);
    runPreview(next);
  }

  function reset() {
    setPoints(DEFAULT_POINTS);
    cancel();
  }

  function apply() {
    if (!currentLayer) return;
    commit('Curvas');
    setPoints(DEFAULT_POINTS);
  }

  // Sampling the actual LUT (not just straight lines between points) keeps the drawn curve
  // an exact match for what applyCurve will paint.
  const lut = filterService.buildCurveLut(points);
  const pathD = Array.from({ length: 256 }, (_, x) => {
    const p = toSvg({ x, y: lut[x] });
    return `${x === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="space-y-1.5 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Curvas</div>
      {isPreviewing(KEY) && <div className="text-[10px] text-accent font-medium">Vista previa en vivo</div>}
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="bg-panelLight border border-border rounded cursor-crosshair touch-none"
        onClick={handleSvgClick}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerLeave={handleSvgPointerUp}
      >
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
        <path d={pathD} fill="none" stroke="#5b8cff" strokeWidth={1.5} />
        {points.map((p, i) => {
          const sp = toSvg(p);
          return (
            <circle
              key={i}
              cx={sp.x}
              cy={sp.y}
              r={4}
              fill="#5b8cff"
              stroke="#fff"
              strokeWidth={1}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => handlePointPointerDown(i, e)}
              onDoubleClick={(e) => handlePointDoubleClick(i, e)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        })}
      </svg>
      <p className="text-[10px] text-textDim">Clic para agregar un punto · arrastrar para mover · doble clic para quitarlo</p>
      <div className="flex gap-2">
        <button onClick={apply} disabled={!currentLayer} className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
          Aplicar
        </button>
        <button onClick={reset} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
          Restablecer
        </button>
      </div>
    </div>
  );
}

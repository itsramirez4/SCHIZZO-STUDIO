import { useEffect, useRef } from 'react';
import { useStudyGuidesStore } from '@/store/studyGuidesStore';
import { drawStudyGuide, measureBetween } from '@/services/studyGuides.service';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/** Study guides + measuring ruler. Same rendering pattern as SymmetryOverlay: a non-interactive
 * canvas of lines plus small draggable handles (the only pointer-active parts), so drawing
 * anywhere else on the canvas is unaffected. */
export default function StudyGuidesOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const guides = useStudyGuidesStore((s) => s.guides);
  const selectedId = useStudyGuidesStore((s) => s.selectedId);
  const measure = useStudyGuidesStore((s) => s.measure);
  const selectGuide = useStudyGuidesStore((s) => s.selectGuide);
  const updateGuide = useStudyGuidesStore((s) => s.updateGuide);
  const setMeasurePoint = useStudyGuidesStore((s) => s.setMeasurePoint);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ kind: 'guide' | 'a' | 'b'; id?: string } | null>(null);

  const active = guides.length > 0 || measure.enabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    guides.forEach((g) => drawStudyGuide(ctx, g, zoom));

    if (measure.enabled) {
      const { a, b } = measure;
      ctx.save();
      ctx.strokeStyle = '#ffd23f';
      ctx.fillStyle = '#ffd23f';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Reference horizontal + angle arc
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + Math.max(40, Math.abs(b.x - a.x)) * Math.sign(b.x - a.x || 1), a.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const m = measureBetween(a, b);
      // Heads: if a figure guide is present, express the distance in head units of that figure.
      const fig = guides.find((g) => g.kind === 'figure');
      const heads = fig ? ` · ${(m.distance / (fig.size / fig.heads)).toFixed(2)} cabezas` : '';
      const label = `${m.distance.toFixed(1)} px · ${m.angle.toFixed(1)}°${heads}`;
      ctx.font = `${13 / zoom}px sans-serif`;
      const tw = ctx.measureText(label).width;
      const lx = (a.x + b.x) / 2 + 8 / zoom;
      const ly = (a.y + b.y) / 2 - 8 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(lx - 3 / zoom, ly - 13 / zoom, tw + 6 / zoom, 17 / zoom);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }
  }, [active, guides, measure, canvasWidth, canvasHeight, zoom]);

  if (!active) return null;

  const handle = 14 / zoom;

  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    if (d.kind === 'guide' && d.id) updateGuide(d.id, { x: p.x, y: p.y });
    else if (d.kind === 'a' || d.kind === 'b') setMeasurePoint(d.kind, p);
  }
  function start(e: React.PointerEvent, kind: 'guide' | 'a' | 'b', id?: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, id };
    if (id) selectGuide(id);
  }
  const end = () => {
    dragRef.current = null;
  };

  const handleStyle = (x: number, y: number, color: string, selected: boolean): React.CSSProperties => ({
    position: 'absolute',
    left: x - handle / 2,
    top: y - handle / 2,
    width: handle,
    height: handle,
    borderRadius: '50%',
    border: `${(selected ? 3 : 2) / zoom}px solid ${color}`,
    background: 'rgba(0,0,0,0.25)',
    cursor: 'grab',
    pointerEvents: 'auto',
    touchAction: 'none',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {guides.map((g) => (
        <div
          key={g.id}
          title="Arrastra para mover la guía"
          onPointerDown={(e) => start(e, 'guide', g.id)}
          onPointerMove={move}
          onPointerUp={end}
          style={handleStyle(g.x, g.y, g.color, g.id === selectedId)}
        />
      ))}
      {measure.enabled &&
        (['a', 'b'] as const).map((k) => (
          <div key={k} title="Punto de medición" onPointerDown={(e) => start(e, k)} onPointerMove={move} onPointerUp={end} style={handleStyle(measure[k].x, measure[k].y, '#ffd23f', false)} />
        ))}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useFigureStore } from '@/store/figureStore';
import { LANDMARK_LABELS, LANDMARK_NAMES, LandmarkName, SKELETON } from '@/services/figureAnalysis.service';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

const COLORS: Record<string, string> = { head: '#ffd23f', arm: '#3ec6ff', leg: '#ff7ab8', torso: '#9dff6b' };
const groupOf = (n: LandmarkName) => (n === 'headTop' || n === 'chin' ? 'head' : /shoulder|elbow|wrist/.test(n) ? 'arm' : 'leg');

/** Skeleton of the measured figure with draggable landmark handles (only the handles take pointer input). */
export default function FigureOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const landmarks = useFigureStore((s) => s.landmarks);
  const movePoint = useFigureStore((s) => s.movePoint);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<LandmarkName | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !landmarks) return;
    c.width = canvasWidth;
    c.height = canvasHeight;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.lineWidth = 2 / zoom;
    for (const [a, b] of SKELETON) {
      ctx.strokeStyle = a.startsWith('shoulder') && b.startsWith('hip') ? COLORS.torso : COLORS[groupOf(b)];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x, landmarks[a].y);
      ctx.lineTo(landmarks[b].x, landmarks[b].y);
      ctx.stroke();
    }
  }, [landmarks, canvasWidth, canvasHeight, zoom]);

  if (!landmarks) return null;
  const size = 13 / zoom;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {LANDMARK_NAMES.map((n) => (
        <div
          key={n}
          title={LANDMARK_LABELS[n]}
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            dragRef.current = n;
          }}
          onPointerMove={(e) => {
            if (dragRef.current !== n) return;
            const p = getProjectPoint(e.clientX, e.clientY);
            movePoint(n, p.x, p.y);
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          style={{
            position: 'absolute',
            left: landmarks[n].x - size / 2,
            top: landmarks[n].y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            border: `${2 / zoom}px solid ${COLORS[groupOf(n)]}`,
            background: 'rgba(0,0,0,0.35)',
            cursor: 'grab',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
        />
      ))}
    </div>
  );
}

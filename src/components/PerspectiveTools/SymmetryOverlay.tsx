import { useEffect, useRef } from 'react';
import { usePerspectiveStore } from '@/store/perspectiveStore';
import { drawSymmetryGuidelines } from '@/services/symmetryEngine.service';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  getProjectPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

export default function SymmetryOverlay({ canvasWidth, canvasHeight, zoom, getProjectPoint }: Props) {
  const symmetry = usePerspectiveStore((s) => s.symmetry);
  const moveSymmetryCenter = usePerspectiveStore((s) => s.moveSymmetryCenter);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !symmetry.enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawSymmetryGuidelines(ctx, symmetry, canvasWidth, canvasHeight);
  }, [symmetry, canvasWidth, canvasHeight]);

  if (!symmetry.enabled || symmetry.mode === 'none') return null;

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const p = getProjectPoint(e.clientX, e.clientY);
    moveSymmetryCenter(p.x, p.y);
  }
  function onPointerUp() {
    draggingRef.current = false;
  }

  const handleSize = 16 / zoom;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Centro de simetría"
        style={{
          position: 'absolute',
          left: symmetry.centerX - handleSize / 2,
          top: symmetry.centerY - handleSize / 2,
          width: handleSize,
          height: handleSize,
          borderRadius: '50%',
          border: `${2 / zoom}px solid ${symmetry.guidelineColor}`,
          background: 'rgba(0,0,0,0.15)',
          cursor: 'grab',
          pointerEvents: 'auto',
        }}
      />
    </div>
  );
}

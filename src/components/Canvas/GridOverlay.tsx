import { useEffect, useRef } from 'react';
import { useGridOverlayStore } from '@/store/gridOverlayStore';
import { drawGridOverlay } from '@/services/gridOverlay.service';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

/** Compositional guide lines (rule of thirds, golden ratio, perspective, ...) — distinct from
 * PixelArtOverlay's pixel-snapping grid, which serves a different purpose (grid-size snapping
 * for pixel art) and has its own independent toggle. Same "canvas child of the zoomed/panned
 * stage" rendering pattern as that component. */
export default function GridOverlay({ canvasWidth, canvasHeight, zoom }: Props) {
  const enabled = useGridOverlayStore((s) => s.enabled);
  const type = useGridOverlayStore((s) => s.type);
  const color = useGridOverlayStore((s) => s.color);
  const opacity = useGridOverlayStore((s) => s.opacity);
  const columns = useGridOverlayStore((s) => s.columns);
  const rows = useGridOverlayStore((s) => s.rows);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1 / zoom;
    drawGridOverlay(ctx, type, canvasWidth, canvasHeight, columns, rows);
  }, [enabled, type, color, opacity, columns, rows, canvasWidth, canvasHeight, zoom]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

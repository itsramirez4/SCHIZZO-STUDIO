import { useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

/**
 * Renders as a child of Canvas2D's stage div, which already carries the pan/zoom CSS
 * transform — so this only ever needs to draw in project-space pixels once per relevant
 * change; the parent transform handles scaling/panning for free instead of us
 * recomputing screen-space offsets on every pan.
 */
export default function PixelArtOverlay({ visible, gridSize, canvasWidth, canvasHeight, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = Math.max(1, gridSize);
    // Keep line thickness constant on screen regardless of zoom, but skip drawing
    // altogether once cells would be sub-pixel — an unreadable solid wash isn't useful.
    if (size * zoom < 3) return;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1 / zoom;

    ctx.beginPath();
    for (let x = 0; x <= canvasWidth; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }
    for (let y = 0; y <= canvasHeight; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    }
    ctx.stroke();
  }, [visible, gridSize, canvasWidth, canvasHeight, zoom]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

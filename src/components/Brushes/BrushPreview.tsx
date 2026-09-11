import { useEffect, useRef } from 'react';
import { Brush } from '@/types';
import { strokeBrush } from '@/services/brush.service';

interface Props {
  brush: Brush;
  color?: string;
  width?: number;
  height?: number;
}

export default function BrushPreview({ brush, color = '#ffffff', width = 220, height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const points = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: 10 + t * (width - 20),
        y: height / 2 + Math.sin(t * Math.PI * 2) * (height / 4),
      });
    }
    strokeBrush(ctx, points, brush, color);
  }, [brush, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full rounded border border-border checkerboard"
      style={{ height }}
    />
  );
}

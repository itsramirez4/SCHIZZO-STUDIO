import { Grid3x3 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCanvas } from '@/hooks/useCanvas';
import { useTools } from '@/hooks/useTools';

export default function StatusBar() {
  const project = useAppStore((s) => s.project);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const { zoom, setZoom } = useCanvas();
  const { currentTool } = useTools();

  if (!project) return null;

  return (
    <div className="h-6 bg-panel border-t border-border flex items-center px-3 gap-4 text-[11px] text-textDim">
      <span>{project.width} × {project.height}px</span>
      <span className="capitalize">{project.type === 'pixelart' ? 'Pixel Art' : 'Dibujo'}</span>
      <span className="capitalize">{currentTool}</span>
      <button
        onClick={toggleGrid}
        title={`Mostrar cuadrícula (Ctrl+') — ${project.settings.gridVisible ? 'activada' : 'desactivada'}`}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${project.settings.gridVisible ? 'text-accent' : 'hover:text-text'}`}
      >
        <Grid3x3 size={12} /> Grid
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setZoom(Math.max(0.05, zoom / 1.25))} className="px-1 hover:text-text">
          -
        </button>
        <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(32, zoom * 1.25))} className="px-1 hover:text-text">
          +
        </button>
        <button onClick={() => setZoom(1)} className="px-2 hover:text-text">
          100%
        </button>
      </div>
    </div>
  );
}

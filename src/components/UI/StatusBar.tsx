import { Grid3x3, RotateCcw, RotateCw, FlipHorizontal } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCanvas } from '@/hooks/useCanvas';
import { useTools } from '@/hooks/useTools';
import { ProjectType } from '@/types';

const TYPE_LABELS: Record<ProjectType, string> = {
  drawing: 'Dibujo',
  pixelart: 'Pixel Art',
  comic: 'Cómic',
  '3d': '3D',
  hybrid: 'Híbrido',
};

export default function StatusBar() {
  const project = useAppStore((s) => s.project);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const setGridSize = useAppStore((s) => s.setGridSize);
  const setTransparentBg = useAppStore((s) => s.setTransparentBg);
  const setBackgroundColor = useAppStore((s) => s.setBackgroundColor);
  const { zoom, setZoom, canvasRotation, setCanvasRotation, rotateBy, viewFlippedH, toggleViewFlip } = useCanvas();
  const { currentTool } = useTools();

  if (!project) return null;

  return (
    <div className="h-6 bg-panel border-t border-border flex items-center px-3 gap-4 text-[11px] text-textDim">
      <span>{project.width} × {project.height}px</span>
      <span className="capitalize">{TYPE_LABELS[project.type]}</span>
      <span className="capitalize">{currentTool}</span>
      <button
        onClick={toggleGrid}
        title={`Mostrar cuadrícula (Ctrl+') — ${project.settings.gridVisible ? 'activada' : 'desactivada'}`}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${project.settings.gridVisible ? 'text-accent' : 'hover:text-text'}`}
      >
        <Grid3x3 size={12} /> Grid
      </button>
      {project.settings.gridVisible && (
        <input
          type="number"
          min={1}
          value={project.settings.gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          title="Tamaño de celda de la cuadrícula (px)"
          className="w-10 bg-panelLight border border-border rounded px-1 py-0.5 text-[10px]"
        />
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTransparentBg(true)}
          title="Fondo transparente"
          className={`w-3.5 h-3.5 rounded-sm checkerboard border ${project.settings.transparentBg ? 'border-accent' : 'border-border'}`}
        />
        <input
          type="color"
          value={project.settings.backgroundColor ?? '#ffffff'}
          onChange={(e) => setBackgroundColor(e.target.value)}
          title="Color de fondo del lienzo"
          className={`w-3.5 h-3.5 p-0 rounded-sm border cursor-pointer bg-transparent ${!project.settings.transparentBg ? 'border-accent' : 'border-border'}`}
        />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggleViewFlip}
          title="Espejo de vista (horizontal) — no altera los píxeles, solo cómo lo ves"
          className={`px-1 ${viewFlippedH ? 'text-accent' : 'hover:text-text'}`}
        >
          <FlipHorizontal size={12} />
        </button>
        <div className="w-px h-3 bg-border mx-1" />
        <button onClick={() => rotateBy(-15)} title="Rotar lienzo -15°" className="px-1 hover:text-text">
          <RotateCcw size={12} />
        </button>
        <button
          onClick={() => setCanvasRotation(0)}
          disabled={canvasRotation === 0}
          title="Restablecer rotación"
          className="w-10 text-center hover:text-text disabled:hover:text-textDim"
        >
          {Math.round(canvasRotation)}°
        </button>
        <button onClick={() => rotateBy(15)} title="Rotar lienzo +15°" className="px-1 hover:text-text">
          <RotateCw size={12} />
        </button>
        <div className="w-px h-3 bg-border mx-1" />
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

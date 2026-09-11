import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, RotateCcw, X, GripHorizontal } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { Model3DViewerEngine } from '@/services/model3d.service';
import { isElectron } from '@/utils/fileUtils';

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 260;
const VIEWER_HEIGHT = 220;

/**
 * A floating, draggable, always-on window (not a blocking modal) that keeps a live,
 * orbit-controllable 3D model visible as a pose/perspective reference while the user
 * keeps drawing on the main canvas underneath it. Unlike Model3DViewer, it never inserts
 * anything into the layer stack — it's a transient viewing aid, not saved with the project.
 */
export default function Reference3DPanel() {
  const show = useUIStore((s) => s.showReference3DPanel);
  const close = useUIStore((s) => s.toggleReference3DPanel);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Model3DViewerEngine | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);

  const [pos, setPos] = useState(() => ({
    x: Math.max(8, window.innerWidth - PANEL_WIDTH - 24),
    y: Math.max(8, window.innerHeight - PANEL_HEIGHT - 80),
  }));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (!show || !canvasRef.current) return;
    const engine = new Model3DViewerEngine(canvasRef.current, PANEL_WIDTH, VIEWER_HEIGHT);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [show]);

  if (!show) return null;

  async function handleImport() {
    if (!isElectron()) {
      toast.error('Importar modelos 3D solo está disponible en la app de escritorio');
      return;
    }
    const result = await window.electronAPI.importModel3D();
    if (result.canceled || !result.dataUrl) return;
    setLoading(true);
    try {
      await engineRef.current?.loadModel(result.dataUrl);
      setModelName(result.name ?? null);
    } catch (err) {
      toast.error('No se pudo cargar el modelo 3D');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function onDragStart(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const nx = Math.min(Math.max(0, dragRef.current.origX + dx), window.innerWidth - PANEL_WIDTH);
    const ny = Math.min(Math.max(0, dragRef.current.origY + dy), window.innerHeight - 40);
    setPos({ x: nx, y: ny });
  }
  function onDragEnd() {
    dragRef.current = null;
  }

  return (
    <div
      className="fixed bg-panel border border-border rounded-lg shadow-2xl z-40 overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: PANEL_WIDTH }}
    >
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-panelLight cursor-move select-none border-b border-border"
      >
        <GripHorizontal size={13} className="text-textDim" />
        <span className="text-xs font-medium flex-1 truncate">Referencia 3D {modelName ? `· ${modelName}` : ''}</span>
        <button onClick={close} className="text-textDim hover:text-text" title="Cerrar">
          <X size={14} />
        </button>
      </div>

      <div className="checkerboard" style={{ width: PANEL_WIDTH, height: VIEWER_HEIGHT }}>
        <canvas ref={canvasRef} width={PANEL_WIDTH} height={VIEWER_HEIGHT} />
      </div>

      <div className="flex items-center gap-1.5 p-1.5">
        <button
          onClick={handleImport}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 bg-panelLight hover:bg-border text-[11px] rounded px-2 py-1 disabled:opacity-50"
        >
          <Upload size={12} /> {loading ? 'Cargando…' : 'Importar modelo'}
        </button>
        <button
          onClick={() => engineRef.current?.resetCamera()}
          title="Restablecer cámara"
          className="bg-panelLight hover:bg-border text-textDim rounded px-2 py-1"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
}

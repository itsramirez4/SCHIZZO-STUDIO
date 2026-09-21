import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, RotateCcw, X, GripHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { Model3DViewerEngine } from '@/services/model3d.service';
import { isElectron } from '@/utils/fileUtils';
import LightingControls from './LightingControls';
import PoseEditor from './PoseEditor';
import MannequinControls from './MannequinControls';
import { usePoseSessionStore } from '@/store/poseSessionStore';
import { useViewerRequestStore } from '@/store/viewerRequestStore';
import { getPoses } from '@/services/mannequin.service';
import { HAND_PRESETS, FOOT_PRESETS, defaultRigState, randomPose, BODY_TYPES, BodyTypeId } from '@/services/mannequin.service';

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
  const [modelVersion, setModelVersion] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const session = usePoseSessionStore();
  const request = useViewerRequestStore((s) => s.request);
  const [autoRotate, setAutoRotate] = useState(false);

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

  // Requests from the Study modes (live model, anatomy study, ...).
  useEffect(() => {
    const engine = engineRef.current;
    if (!show || !engine || !request) return;
    const kind = request.kind ?? engine.getRig()?.state.kind ?? 'human';
    const base = engine.getRig()?.state.kind === kind ? engine.getRig()!.state : defaultRigState(kind);
    const poseDef = request.pose ? getPoses(kind).find((p) => p.id === request.pose) : undefined;
    engine.setRigState({
      ...base,
      pose: request.poseData ? { ...request.poseData } : poseDef ? { ...poseDef.pose } : base.pose,
      bodyType: request.bodyType ?? base.bodyType,
      expression: request.expression ? { ...request.expression } : base.expression,
      anatomy: request.anatomy ?? base.anatomy,
    });
    if (request.autoRotate !== undefined) {
      engine.setAutoRotate(request.autoRotate);
      setAutoRotate(request.autoRotate);
    }
    setModelVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce, show]);

  // Timed pose practice: every `nonce` bump generates a new random (anatomically limited) pose.
  useEffect(() => {
    const engine = engineRef.current;
    if (!show || !engine || session.phase === 'off') return;
    const base = engine.getRig()?.state ?? defaultRigState('human');
    const bodies = Object.keys(BODY_TYPES) as BodyTypeId[];
    const hand = () => [...HAND_PRESETS[Math.floor(Math.random() * HAND_PRESETS.length)].curls];
    const foot = () => [...FOOT_PRESETS[Math.floor(Math.random() * FOOT_PRESETS.length)].curls];
    engine.setRigState({
      ...base,
      kind: 'human',
      bodyType: bodies[Math.floor(Math.random() * bodies.length)],
      pose: randomPose('human'),
      hands: { L: hand(), R: hand() },
      feet: { L: foot(), R: foot() },
    });
    setModelVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.nonce, show]);

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
      await engineRef.current?.loadModel(result.dataUrl, result.format as 'glb' | 'gltf' | 'obj' | 'fbx' | undefined);
      setModelName(result.name ?? null);
      setModelVersion((v) => v + 1);
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
        <span className="text-xs font-medium flex-1 truncate">
          {session.phase === 'off'
            ? `Referencia 3D ${modelName ? `· ${modelName}` : ''}`
            : `${{ pose: 'Pose', observe: 'Observa', hidden: 'Dibuja de memoria', reveal: 'Compara', off: '' }[session.phase]} · ${Math.floor(session.remaining / 60)}:${String(session.remaining % 60).padStart(2, '0')} · #${session.posesDone + 1}`}
        </span>
        {session.phase !== 'off' && (
          <>
            <button onClick={session.skip} className="text-[10px] text-textDim hover:text-text px-1" title="Siguiente pose">
              ⏭
            </button>
            <button onClick={session.stop} className="text-[10px] text-textDim hover:text-text px-1" title="Detener la práctica">
              ■
            </button>
          </>
        )}
        <button onClick={close} className="text-textDim hover:text-text" title="Cerrar">
          <X size={14} />
        </button>
      </div>

      <div className="checkerboard relative" style={{ width: PANEL_WIDTH, height: VIEWER_HEIGHT }}>
        <canvas ref={canvasRef} width={PANEL_WIDTH} height={VIEWER_HEIGHT} />
        {session.phase === 'hidden' && (
          <div className="absolute inset-0 bg-panel flex flex-col items-center justify-center gap-1 text-center px-4">
            <div className="text-sm font-medium">Dibuja la pose de memoria</div>
            <div className="text-2xl tabular-nums">
              {Math.floor(session.remaining / 60)}:{String(session.remaining % 60).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-textDim">El modelo reaparecerá al terminar para que compares.</div>
          </div>
        )}
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
        <button
          onClick={() => {
            const next = !autoRotate;
            setAutoRotate(next);
            engineRef.current?.setAutoRotate(next);
          }}
          title="Modelo vivo: gira la cámara alrededor del modelo"
          className={`rounded px-2 py-1 text-[11px] ${autoRotate ? 'bg-accent text-white' : 'bg-panelLight hover:bg-border text-textDim'}`}
        >
          ⟳
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          title="Iluminación y pose"
          className="bg-panelLight hover:bg-border text-textDim rounded px-2 py-1"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <div className="p-1.5 pt-0 space-y-2 max-h-64 overflow-y-auto border-t border-border">
          <div className="pt-1.5">
            <div className="text-[10px] text-textDim uppercase tracking-wide mb-1">Iluminación</div>
            <LightingControls engine={engineRef.current} />
          </div>
          <PoseEditor engine={engineRef.current} modelVersion={modelVersion} />
          <MannequinControls engine={engineRef.current} onSceneChange={() => setModelVersion((v) => v + 1)} />
        </div>
      )}
    </div>
  );
}

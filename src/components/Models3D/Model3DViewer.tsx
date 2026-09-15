import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, RotateCcw } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { Model3DViewerEngine, CameraPreset } from '@/services/model3d.service';
import * as layerService from '@/services/layer.service';
import { isElectron } from '@/utils/fileUtils';
import LightingControls from './LightingControls';
import PoseEditor from './PoseEditor';

const VIEWER_WIDTH = 720;
const VIEWER_HEIGHT = 480;
const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'front', label: 'Frente' },
  { id: 'side', label: 'Perfil' },
  { id: 'threeQuarter', label: '3/4' },
];

export default function Model3DViewer() {
  const show = useUIStore((s) => s.showModel3DViewer);
  const close = useUIStore((s) => s.closeModel3DViewer);
  const project = useAppStore((s) => s.project);
  const addLayer = useAppStore((s) => s.addLayer);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Model3DViewerEngine | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const [modelVersion, setModelVersion] = useState(0);
  const [wireframe, setWireframe] = useState(false);

  useEffect(() => {
    if (!show || !canvasRef.current) return;
    const engine = new Model3DViewerEngine(canvasRef.current, VIEWER_WIDTH, VIEWER_HEIGHT);
    engineRef.current = engine;
    setHasModel(false);
    setModelName(null);
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
      await engineRef.current?.loadModel(result.dataUrl, result.format as 'glb' | 'gltf' | 'obj' | undefined);
      setModelName(result.name ?? null);
      setHasModel(true);
      setWireframe(false);
      setModelVersion((v) => v + 1);
    } catch (err) {
      toast.error('No se pudo cargar el modelo 3D');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleExtractSilhouette() {
    const engine = engineRef.current;
    if (!engine?.hasModel() || !project) return;
    const silhouette = engine.renderSilhouette('#000000', 2);

    const layerId = addLayer(`${modelName ?? 'Modelo'} (silueta)`);
    const layerCanvas = layerService.getLayerCanvas(layerId);
    if (!layerCanvas) return;

    const scale = Math.min(project.width / silhouette.width, project.height / silhouette.height);
    const drawW = silhouette.width * scale;
    const drawH = silhouette.height * scale;
    const dx = (project.width - drawW) / 2;
    const dy = (project.height - drawH) / 2;

    layerCanvas.getContext('2d')!.drawImage(silhouette, dx, dy, drawW, drawH);
    pushHistory('Extraer silueta 3D');
    toast.success('Silueta insertada en una nueva capa');
    close();
  }

  function handleInsert() {
    const engine = engineRef.current;
    if (!engine || !engine.hasModel() || !project) return;

    const layerId = addLayer(modelName ?? 'Modelo 3D');
    const layerCanvas = layerService.getLayerCanvas(layerId);
    if (!layerCanvas) return;

    const source = engine.getCanvas();
    const scale = Math.min(project.width / source.width, project.height / source.height);
    const drawW = source.width * scale;
    const drawH = source.height * scale;
    const dx = (project.width - drawW) / 2;
    const dy = (project.height - drawH) / 2;

    const ctx = layerCanvas.getContext('2d')!;
    ctx.drawImage(source, dx, dy, drawW, drawH);

    pushHistory('Insertar modelo 3D');
    toast.success('Modelo insertado en una nueva capa');
    close();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg p-5 w-[1020px] max-w-[95vw]">
        <h2 className="text-lg font-semibold mb-3">Modelo 3D</h2>

        <div className="flex gap-4">
          <div>
            <div className="bg-black/40 rounded overflow-hidden checkerboard" style={{ width: VIEWER_WIDTH, height: VIEWER_HEIGHT }}>
              <canvas ref={canvasRef} width={VIEWER_WIDTH} height={VIEWER_HEIGHT} />
            </div>
            <p className="text-[11px] text-textDim mt-2">
              Arrastra para orbitar, rueda para zoom. Formatos soportados: .glb, .gltf, .obj.
            </p>
          </div>

          <div className="w-64 shrink-0 space-y-3 overflow-y-auto max-h-[480px]">
            <div className="space-y-1.5">
              <div className="text-[10px] text-textDim uppercase tracking-wide">Cámara</div>
              <div className="flex gap-1">
                {CAMERA_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => engineRef.current?.setCameraPreset(p.id)}
                    disabled={!hasModel}
                    className="flex-1 bg-panelLight text-[10px] rounded py-1 disabled:opacity-40"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-textDim">
                <input
                  type="checkbox"
                  checked={wireframe}
                  disabled={!hasModel}
                  onChange={(e) => {
                    setWireframe(e.target.checked);
                    engineRef.current?.setWireframe(e.target.checked);
                  }}
                />
                Wireframe
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] text-textDim uppercase tracking-wide">Iluminación</div>
              <LightingControls engine={engineRef.current} />
            </div>

            <PoseEditor engine={engineRef.current} modelVersion={modelVersion} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button onClick={handleImport} disabled={loading} className="flex items-center gap-1.5 bg-panelLight text-xs rounded px-3 py-1.5 disabled:opacity-50">
            <Upload size={14} /> {loading ? 'Cargando…' : 'Importar modelo'}
          </button>
          <button
            onClick={() => engineRef.current?.resetCamera()}
            className="flex items-center gap-1.5 bg-panelLight text-xs rounded px-3 py-1.5"
          >
            <RotateCcw size={14} /> Restablecer cámara
          </button>
          {modelName && <span className="text-xs text-textDim truncate">{modelName}</span>}

          <div className="ml-auto flex gap-2">
            <button onClick={close} className="px-3 py-1.5 text-sm text-textDim hover:text-text">
              Cerrar
            </button>
            <button
              onClick={handleExtractSilhouette}
              disabled={!hasModel}
              className="px-3 py-1.5 text-sm bg-panelLight rounded disabled:opacity-40"
            >
              Extraer silueta
            </button>
            <button
              onClick={handleInsert}
              disabled={!hasModel}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-40"
            >
              Insertar en capa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

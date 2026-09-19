import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import { useGridOverlayStore } from '@/store/gridOverlayStore';
import { useUIStore } from '@/store/uiStore';
import * as layerService from '@/services/layer.service';
import { analyzeDrawing, AnalysisResult, Finding, FindingAction } from '@/services/drawingAnalysis.service';
import { LIGHT_TIPS } from '@/content/academy';
import { detectVanishingPoints, DetectedVanishingPoint } from '@/services/autoPerspective.service';
import { usePerspectiveStore } from '@/store/perspectiveStore';

type Preview = 'values' | 'flat';

const ICONS = { good: CheckCircle2, info: Info, warning: AlertTriangle } as const;
const COLORS = { good: 'text-green-400', info: 'text-sky-300', warning: 'text-amber-400' } as const;

function PreviewCanvas({ source }: { source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = source.width;
    c.height = source.height;
    c.getContext('2d')?.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={ref} className="w-full rounded border border-border" style={{ imageRendering: 'pixelated' }} />;
}

/**
 * The "why isn't it working?" tutor. It only observes and explains — every suggestion is a
 * question or an optional visual aid; nothing here ever edits a layer.
 */
export default function AnalyzeTab() {
  const project = useAppStore((s) => s.project);
  const { layers } = useLayers();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const grid = useGridOverlayStore();
  const [vps, setVps] = useState<{ points: DetectedVanishingPoint[]; lines: number } | null>(null);
  const showReferences = useUIStore((s) => s.showReferencesPanel);
  const toggleReferences = useUIStore((s) => s.toggleReferencesPanel);

  if (!project) return <p className="text-[11px] text-textDim">Abre un proyecto para analizarlo.</p>;

  function run() {
    if (!project) return;
    const flat = layerService.flattenLayers(layers, project.width, project.height);
    const bg = project.settings.transparentBg ? '#ffffff' : (project.settings.backgroundColor ?? '#ffffff');
    setResult(analyzeDrawing(flat, bg));
    setDismissed(new Set());
    setApplied(new Set());
  }

  function act(id: FindingAction, findingId: string) {
    if (id === 'gridThirds') {
      grid.setType('ruleOfThirds');
      if (!grid.enabled) grid.toggleEnabled();
    } else if (id === 'gridUniform') {
      grid.setType('uniform');
      if (!grid.enabled) grid.toggleEnabled();
    } else if (id === 'mirrorView') {
      if (!showReferences) toggleReferences();
    } else if (id === 'valueView') {
      setPreview('values');
    }
    setApplied((s) => new Set(s).add(findingId));
  }

  function detectPerspective() {
    if (!project) return;
    const flat = layerService.flattenLayers(layers, project.width, project.height);
    const bg = project.settings.transparentBg ? '#ffffff' : (project.settings.backgroundColor ?? '#ffffff');
    setVps(detectVanishingPoints(flat, bg));
  }

  function applyVanishingPoints() {
    if (!project || !vps || vps.points.length === 0) return;
    const store = usePerspectiveStore.getState();
    const pts = [...vps.points].sort((a, b) => a.x - b.x);
    if (pts.length === 1) {
      store.setGridType('onePoint', project.width, project.height);
      store.moveVanishingPoint('center', pts[0].x, pts[0].y);
    } else {
      store.setGridType('twoPoint', project.width, project.height);
      store.moveVanishingPoint('left', pts[0].x, pts[0].y);
      store.moveVanishingPoint('right', pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    if (!usePerspectiveStore.getState().grid.enabled) store.toggleGridEnabled();
    if (!useUIStore.getState().showPerspectivePanel) useUIStore.getState().togglePerspectivePanel();
  }

  const visible: Finding[] = (result?.findings ?? []).filter((f) => !dismissed.has(f.id));
  const order = { warning: 0, info: 1, good: 2 } as const;
  visible.sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <div className="space-y-3">
      <div className="rounded bg-panelLight p-2 space-y-1">
        <div className="text-[11px] font-medium">Modo tutor: «¿Por qué no funciona?»</div>
        <p className="text-[10px] text-textDim leading-relaxed">
          Mide valores, reparto del peso visual, simetría, inclinación de las líneas dominantes y dispersión del color, y te explica lo que ve. <b>No modifica tu dibujo</b>, y no reconoce
          anatomía ni rostros: no puede decirte si una mano «está bien», solo si el conjunto se lee.
        </p>
      </div>

      <button onClick={run} className="w-full bg-accent text-white text-[11px] rounded py-2">
        Analizar mi dibujo
      </button>

      {result && (
        <>
          <div className="flex gap-1">
            {(['values', 'flat'] as Preview[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreview(preview === p ? null : p)}
                className={`flex-1 text-[10px] rounded py-1 ${preview === p ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
              >
                {p === 'values' ? 'Mapa de 4 valores' : 'Zonas planas'}
              </button>
            ))}
          </div>
          {preview && (
            <div className="space-y-1">
              <PreviewCanvas source={preview === 'values' ? result.valueMap : result.flatMap} />
              <p className="text-[9px] text-textDim">
                {preview === 'values'
                  ? 'Tu dibujo reducido a 4 tonos: si una forma importante desaparece aquí, no se lee por valor.'
                  : 'En naranja, las zonas con un tono uniforme. Ahí puedes decidir dónde va la luz y dónde la sombra para dar volumen.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {visible.length === 0 && <p className="text-[11px] text-textDim">No hay observaciones pendientes.</p>}
            {visible.map((f) => {
              const Icon = ICONS[f.severity];
              return (
                <div key={f.id} className="border border-border rounded p-2 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <Icon size={14} className={`${COLORS[f.severity]} shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <div className="text-[11px] font-medium leading-snug">{f.title}</div>
                      <div className="text-[9px] uppercase tracking-wide text-textDim">{f.category}</div>
                    </div>
                    <button onClick={() => setDismissed((s) => new Set(s).add(f.id))} className="text-[10px] text-textDim hover:text-text" title="Ocultar">
                      ✕
                    </button>
                  </div>
                  <p className="text-[10px] text-textDim leading-relaxed">
                    <b className="text-text">Por qué: </b>
                    {f.why}
                  </p>
                  <p className="text-[10px] text-textDim leading-relaxed">
                    <b className="text-text">Qué probar: </b>
                    {f.suggestion}
                  </p>
                  {f.question && f.action && (
                    <div className="rounded bg-panelLight p-1.5 space-y-1">
                      <p className="text-[10px] italic">{f.question}</p>
                      <button onClick={() => act(f.action!.id, f.id)} disabled={applied.has(f.id)} className="w-full bg-accent/80 text-white text-[10px] rounded py-1 disabled:opacity-50">
                        {applied.has(f.id) ? 'Activado' : f.action.label}
                      </button>
                    </div>
                  )}
                  {!f.question && f.action && (
                    <button onClick={() => act(f.action!.id, f.id)} className="w-full bg-panelLight text-[10px] rounded py-1">
                      {f.action.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="border border-border rounded p-2 space-y-1.5">
        <div className="text-[11px] font-medium">Perspectiva automática</div>
        <p className="text-[10px] text-textDim leading-relaxed">Busca líneas rectas que convergen (edificios, habitaciones, calles, cajas) y propone los puntos de fuga. Necesita líneas de construcción claras: en dibujos orgánicos no encontrará nada.</p>
        <button onClick={detectPerspective} className="w-full bg-panelLight text-[10px] rounded py-1">Detectar puntos de fuga</button>
        {vps && vps.points.length === 0 && <p className="text-[10px] text-textDim">No he encontrado puntos de fuga fiables ({vps.lines} líneas rectas relevantes).</p>}
        {vps && vps.points.length > 0 && (
          <div className="space-y-1">
            {vps.points.map((p, i) => (
              <div key={i} className="text-[10px] text-textDim">
                Punto {i + 1}: ({Math.round(p.x)}, {Math.round(p.y)}) px · {p.support} líneas convergen
                {project && (p.x < 0 || p.x > project.width || p.y < 0 || p.y > project.height) ? ' · fuera del lienzo' : ''}
              </div>
            ))}
            <button onClick={applyVanishingPoints} className="w-full bg-accent/80 text-white text-[10px] rounded py-1">Colocar en la cuadrícula de perspectiva</button>
          </div>
        )}
      </div>

      <details className="border border-border rounded">
        <summary className="text-[11px] px-2 py-1.5 cursor-pointer">Consejos para colocar luces y sombras</summary>
        <ul className="px-3 pb-2 space-y-1.5 list-disc list-inside">
          {LIGHT_TIPS.map((t) => (
            <li key={t} className="text-[10px] text-textDim leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
        <p className="px-2 pb-2 text-[10px] text-textDim">Para probar luces sobre una pose, abre el visor 3D y mueve la fuente de luz con la vista de valores activada.</p>
      </details>
    </div>
  );
}

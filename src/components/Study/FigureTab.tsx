import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import { useFigureStore } from '@/store/figureStore';
import { useStudyGuidesStore } from '@/store/studyGuidesStore';
import { useGridOverlayStore } from '@/store/gridOverlayStore';
import * as layerService from '@/services/layer.service';
import { FIGURE_TYPES, FigureType, analyzeFigure } from '@/services/figureAnalysis.service';
import type { Finding, FindingAction } from '@/services/drawingAnalysis.service';
import type { FaceReading } from '@/services/poseDetect.service';
import { useAiStore } from '@/store/aiStore';

const ICONS = { good: CheckCircle2, info: Info, warning: AlertTriangle } as const;
const COLORS = { good: 'text-green-400', info: 'text-sky-300', warning: 'text-amber-400' } as const;

/**
 * Proportion and anatomy checks. The landmarks can be dropped by hand on ANY drawing (that is the
 * reliable path) or proposed by a pose model, which only recognises realistic/shaded figures.
 * Nothing here edits the drawing.
 */
export default function FigureTab() {
  const project = useAppStore((s) => s.project);
  const { layers } = useLayers();
  const { landmarks, type, setType, placeDefault, setLandmarks, clear } = useFigureStore();
  const addGuide = useStudyGuidesStore((s) => s.addGuide);
  const updateGuide = useStudyGuidesStore((s) => s.updateGuide);
  const grid = useGridOverlayStore();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ findings: Finding[]; heads: number } | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  /** A head found when there is no whole figure to measure (portraits, busts). */
  const [face, setFace] = useState<FaceReading | null>(null);
  const aiEnabled = useAiStore((s) => s.enabled);

  if (!project) return <p className="text-[11px] text-textDim">Abre un proyecto para analizar una figura.</p>;
  const proj = project;

  async function autoDetect() {
    setBusy(true);
    try {
      const flat = layerService.flattenLayers(layers, proj.width, proj.height);
      const { detectPose } = await import('@/services/poseDetect.service');
      toast('Buscando la figura… (la primera vez se descarga un modelo de 12 MB)', { icon: '🔎', duration: 3000 });
      const pose = await detectPose(flat, proj.settings.transparentBg ? '#ffffff' : (proj.settings.backgroundColor ?? '#ffffff'));
      const r = pose.body;
      setFace(pose.face);
      if (r.landmarks) {
        setLandmarks(r.landmarks);
        setResult(null);
        const how = r.method ? ` Se encontró convirtiendo el dibujo (${r.method}).` : '';
        if (r.uncertain) toast(`Lectura aproximada (confianza ${Math.round(r.confidence * 100)} %).${how} Los puntos son un punto de partida: corrígelos a mano antes de analizar.`, { icon: '⚠️', duration: 9000 });
        else toast.success(`Puntos colocados (confianza ${Math.round(r.confidence * 100)} %).${how} Revísalos y ajusta la coronilla y la barbilla: son una estimación.`, { duration: 7000 });
      } else if (pose.face) {
        toast('No hay una figura completa que medir, pero he encontrado la cabeza: mira la tarjeta «Rostro encontrado».', { icon: '🙂', duration: 7000 });
      } else {
        toast(r.reason ?? 'No se reconoció una figura.', { icon: 'ℹ️', duration: 8000 });
        if (!landmarks) placeDefault(proj.width, proj.height);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo detectar la figura');
    } finally {
      setBusy(false);
    }
  }

  function placeFaceGuide() {
    if (!face) return;
    addGuide('faceFront', proj.width, proj.height);
    const g = useStudyGuidesStore.getState().guides.at(-1);
    if (g) updateGuide(g.id, { x: face.center.x, y: face.center.y, size: face.headHeight, rotation: face.rollDeg });
  }

  function measureEyeLine() {
    if (!face) return;
    const st = useStudyGuidesStore.getState();
    st.setMeasureEnabled(true, proj.width, proj.height);
    st.setMeasurePoint('a', face.eyeA);
    st.setMeasurePoint('b', face.eyeB);
  }

  function analyze() {
    if (!landmarks) return;
    const r = analyzeFigure(landmarks, type);
    const order = { warning: 0, info: 1, good: 2 } as const;
    setResult({ findings: r.findings.sort((a, b) => order[a.severity] - order[b.severity]), heads: r.measures.heads });
    setApplied(new Set());
  }

  function act(id: FindingAction, findingId: string) {
    if (id === 'figureGuide' && landmarks) {
      const ys = [landmarks.headTop.y, landmarks.ankleL.y, landmarks.ankleR.y];
      const top = landmarks.headTop.y;
      const bottom = Math.max(landmarks.ankleL.y, landmarks.ankleR.y);
      addGuide('figure', proj.width, proj.height);
      const g = useStudyGuidesStore.getState().guides.at(-1);
      const [lo, hi] = FIGURE_TYPES[type].heads;
      if (g) updateGuide(g.id, { x: (landmarks.shoulderL.x + landmarks.shoulderR.x) / 2, y: (top + bottom) / 2, size: bottom - top, heads: type === 'stylized' ? 7.5 : Math.round(((lo + hi) / 2) * 2) / 2 });
      void ys;
    } else if (id === 'gridUniform') {
      grid.setType('uniform');
      if (!grid.enabled) grid.toggleEnabled();
    }
    setApplied((s) => new Set(s).add(findingId));
  }

  return (
    <div className="space-y-3">
      <div className="rounded bg-panelLight p-2 space-y-1">
        <div className="text-[11px] font-medium">Proporciones y anatomía</div>
        <p className="text-[10px] text-textDim leading-relaxed">
          Marca sobre tu dibujo 14 puntos de la figura (coronilla, barbilla, hombros, codos, muñecas, caderas, rodillas y tobillos) y la app mide sus proporciones, inclinaciones y equilibrio.{' '}
          <b>Los mide en el plano de la imagen</b>: un brazo apuntando a cámara o una figura de perfil dará medidas engañosas, y los estilos estilizados rompen el canon a propósito.
        </p>
      </div>

      <label className="block text-[10px] text-textDim">
        Tipo de figura
        <select value={type} onChange={(e) => setType(e.target.value as FigureType)} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1 mt-0.5">
          {(Object.keys(FIGURE_TYPES) as FigureType[]).map((t) => (
            <option key={t} value={t}>
              {FIGURE_TYPES[t].label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-1.5">
        <button onClick={() => placeDefault(proj.width, proj.height)} className="bg-accent text-white text-[11px] rounded py-2">
          {landmarks ? 'Recolocar los puntos' : 'Colocar puntos (a mano)'}
        </button>
        {aiEnabled && (
                  <button onClick={autoDetect} disabled={busy} className="bg-panelLight text-[11px] rounded py-1.5 disabled:opacity-50">
          {busy ? 'Buscando…' : 'Intentar colocarlos automáticamente'}
        </button>
        )}
        <p className="text-[9px] text-textDim leading-relaxed">
          Lo automático está pensado para figuras completas: en dibujos de línea recorta la figura y prueba varias versiones más parecidas a una foto. Si el dibujo es un retrato o un busto (sin caderas ni piernas) no hay figura que medir, pero puede encontrar la cabeza. Requiere la app de escritorio; si no reconoce nada, colócalos tú. Arrastra cada círculo hasta su articulación.
        </p>
      </div>

      {aiEnabled && face && (
        <div className="rounded border border-border p-2 space-y-1.5">
          <div className="text-[11px] font-medium">Rostro encontrado</div>
          <p className="text-[10px] text-textDim leading-relaxed">
            {face.estimated
              ? 'No he podido leer los ojos (gafas, ojos cerrados o cabeza girada): he colocado la cabeza por las proporciones de los hombros. Es solo una estimación de dónde iría, no una lectura del dibujo: ajusta la guía de rostro a mano. '
              : Math.abs(face.rollDeg) < 2.5
              ? `Los ojos están casi a nivel (${face.rollDeg.toFixed(1).replace('.', ',')}°): la cabeza parece recta.`
              : `La cabeza parece inclinada unos ${Math.abs(face.rollDeg).toFixed(0)}° hacia la ${face.rollDeg > 0 ? 'derecha' : 'izquierda'} del dibujo (por la línea de los ojos). ¿Quieres activar una guía para comprobar la inclinación?`}
            {face.estimated ? null : <>{' '}Es una lectura automática{face.uncertain ? ' dudosa' : ''} (confianza {Math.round(face.confidence * 100)} %): comprueba que los puntos caen sobre los ojos.</>}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {!face.estimated && <button onClick={measureEyeLine} className="bg-accent/80 text-white text-[10px] rounded py-1.5">Medir la línea de los ojos</button>}
            <button onClick={placeFaceGuide} className="bg-panelLight text-[10px] rounded py-1.5">Poner guía de rostro</button>
          </div>
          <p className="text-[9px] text-textDim">No se modifica el dibujo: son guías que puedes quitar.</p>
        </div>
      )}

      {landmarks && (
        <div className="flex gap-1.5">
          <button onClick={analyze} className="flex-1 bg-accent text-white text-[11px] rounded py-2">
            Analizar la figura
          </button>
          <button
            onClick={() => {
              clear();
              setResult(null);
            }}
            className="bg-panelLight text-[11px] rounded px-3"
          >
            Quitar
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-[10px] text-textDim">Altura medida: <b className="text-text">{result.heads.toFixed(1).replace('.', ',')} cabezas</b>.</p>
          {result.findings.map((f) => {
            const Icon = ICONS[f.severity];
            return (
              <div key={f.id} className="border border-border rounded p-2 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <Icon size={14} className={`${COLORS[f.severity]} shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <div className="text-[11px] font-medium leading-snug">{f.title}</div>
                    <div className="text-[9px] uppercase tracking-wide text-textDim">{f.category}</div>
                  </div>
                </div>
                <p className="text-[10px] text-textDim leading-relaxed"><b className="text-text">Por qué: </b>{f.why}</p>
                <p className="text-[10px] text-textDim leading-relaxed"><b className="text-text">Qué probar: </b>{f.suggestion}</p>
                {f.question && f.action && (
                  <div className="rounded bg-panelLight p-1.5 space-y-1">
                    <p className="text-[10px] italic">{f.question}</p>
                    <button onClick={() => act(f.action!.id, f.id)} disabled={applied.has(f.id)} className="w-full bg-accent/80 text-white text-[10px] rounded py-1 disabled:opacity-50">
                      {applied.has(f.id) ? 'Activado' : f.action.label}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {result.findings.length === 0 && <p className="text-[11px] text-textDim">Sin observaciones.</p>}
        </div>
      )}
    </div>
  );
}

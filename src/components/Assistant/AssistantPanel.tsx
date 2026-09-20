import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, PowerOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useLayers } from '@/hooks/useLayers';
import { useAiStore } from '@/store/aiStore';
import { useViewerRequestStore } from '@/store/viewerRequestStore';
import { useFigureStore } from '@/store/figureStore';
import { useGridOverlayStore } from '@/store/gridOverlayStore';
import { useReferenceLibraryStore } from '@/store/referenceLibraryStore';
import * as layerService from '@/services/layer.service';
import type { Landmarks } from '@/services/figureAnalysis.service';
import { analyzeFigure, FIGURE_TYPES, FigureType } from '@/services/figureAnalysis.service';
import type { Finding } from '@/services/drawingAnalysis.service';
import { buildReferenceFromDataUrl } from '@/services/referenceImport.service';
import { dataUrlToImage } from '@/utils/canvasUtils';
import { isElectron } from '@/utils/fileUtils';
import { poseFromText, expressionFromText, POSE_VOCABULARY, EXPRESSION_VOCABULARY } from '@/services/ai/textToPose.service';
import { fitMannequinPose, DepthHint } from '@/services/ai/poseFit.service';
import { relightVariants, relightFull, LightVariant } from '@/services/ai/relight.service';
import { paletteFromText, paletteFromImage, PaletteIdea } from '@/services/ai/paletteSuggest.service';
import { analyzeComposition, CompositionResult } from '@/services/ai/composition.service';
import { cleanDrawing, CleanResult } from '@/services/ai/cleanup.service';
import { separateLineArt, separateBackground, separateByColors, SeparatedLayer } from '@/services/ai/layerSeparation.service';
import { buildReferencePrompt, REFERENCE_GOALS, ReferenceGoal } from '@/services/ai/referencePrompt.service';

/**
 * The AI assistant. It helps — it does not draw for you: everything it produces lands as a reference,
 * a guide, a suggestion or a NEW layer, and your drawing is never edited. The whole panel disappears when
 * AI is switched off (button in the top bar), and with it every automatic analysis and download.
 */

function Card({ id, title, open, setOpen, children }: { id: string; title: string; open: string | null; setOpen: (v: string | null) => void; children: React.ReactNode }) {
  const isOpen = open === id;
  return (
    <div className="border border-border rounded" data-ai-card={id}>
      <button onClick={() => setOpen(isOpen ? null : id)} className="w-full flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-left hover:bg-panelLight">
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {isOpen && <div className="p-2 pt-0 space-y-2">{children}</div>}
    </div>
  );
}

const Btn = ({ onClick, children, disabled, primary }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; primary?: boolean }) => (
  <button onClick={onClick} disabled={disabled} className={`text-[10px] rounded px-2 py-1 disabled:opacity-40 ${primary ? 'bg-accent text-white' : 'bg-panelLight hover:bg-border'}`}>
    {children}
  </button>
);
const Hint = ({ children }: { children: React.ReactNode }) => <p className="text-[10px] text-textDim leading-relaxed">{children}</p>;
const inputCls = 'w-full bg-panelLight border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:border-accent';

function CanvasThumb({ canvas, onClick, label }: { canvas: HTMLCanvasElement; onClick?: () => void; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  return (
    <button onClick={onClick} title={label} className="block text-left">
      <canvas
        ref={(el) => {
          (ref as { current: HTMLCanvasElement | null }).current = el;
          if (!el) return;
          el.width = canvas.width;
          el.height = canvas.height;
          el.getContext('2d')!.drawImage(canvas, 0, 0);
        }}
        className="w-full rounded border border-border bg-white"
      />
      {label && <span className="text-[9px] text-textDim">{label}</span>}
    </button>
  );
}

export default function AssistantPanel() {
  const project = useAppStore((s) => s.project);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const setPrimaryColor = useAppStore((s) => s.setPrimaryColor);
  const { layers, addLayer, addReferenceLayer } = useLayers();
  const ai = useAiStore();
  const sendViewer = useViewerRequestStore((s) => s.send);
  const figure = useFigureStore();
  const grid = useGridOverlayStore();
  const addRef = useReferenceLibraryStore((s) => s.addReference);
  const [open, setOpen] = useState<string | null>('pose');
  const [busy, setBusy] = useState<string | null>(null);

  // ---- state per tool
  const [poseText, setPoseText] = useState('');
  const [poseInfo, setPoseInfo] = useState<{ understood: string[]; ignored: string[] } | null>(null);
  const [exprText, setExprText] = useState('');
  const [exprInfo, setExprInfo] = useState<{ understood: string[]; ignored: string[] } | null>(null);
  const [fitInfo, setFitInfo] = useState<string | null>(null);
  const [fitLm, setFitLm] = useState<Landmarks | null>(null);
  const [depth, setDepth] = useState<Partial<Record<'armL' | 'armR' | 'legL' | 'legR', DepthHint>>>({});
  const [variants, setVariants] = useState<LightVariant[]>([]);
  const [palText, setPalText] = useState('');
  const [ideas, setIdeas] = useState<{ title: string; list: PaletteIdea[]; current?: string[] } | null>(null);
  const [comp, setComp] = useState<{ r: CompositionResult; overlay: HTMLCanvasElement } | null>(null);
  const [speck, setSpeck] = useState(12);
  const [gap, setGap] = useState(3);
  const [clean, setClean] = useState<CleanResult | null>(null);
  const [parts, setParts] = useState<SeparatedLayer[] | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [figType, setFigType] = useState<FigureType>('adult');
  const [goal, setGoal] = useState<ReferenceGoal>('pose');
  const [request, setRequest] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [rewritten, setRewritten] = useState<string | null>(null);

  if (!project) return <p className="p-3 text-[11px] text-textDim">Abre un proyecto para usar el asistente.</p>;
  const proj = project;

  const flat = () => layerService.flattenLayers(layers, proj.width, proj.height);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** New layer holding `canvas` (drawn after the layer's DOM canvas is mounted, as the importers do). */
  async function putOnLayer(canvas: HTMLCanvasElement, name: string, asReference = false) {
    const id = asReference ? addReferenceLayer(name) : addLayer(name);
    await wait(80);
    const target = layerService.getLayerCanvas(id);
    if (!target) throw new Error('No se pudo crear la capa');
    const s = Math.min(target.width / canvas.width, target.height / canvas.height, 1);
    const w = canvas.width * s;
    const h = canvas.height * s;
    target.getContext('2d')!.drawImage(canvas, (target.width - w) / 2, (target.height - h) / 2, w, h);
    pushHistory(asReference ? `Referencia de IA: ${name}` : `Asistente: ${name}`);
  }

  async function run(name: string, fn: () => Promise<void> | void) {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------- poses / expressions
  const canRewrite = ai.provider.kind === 'openai-compatible' && ai.provider.endpoint.trim() !== '' && isElectron();
  /** Free sentences: an optional language model rewrites them into the interpreter's vocabulary; the interpreter still does the parsing. */
  async function rewrite(text: string, task: 'pose' | 'expression'): Promise<string> {
    const res = await window.electronAPI.aiRewriteText({ endpoint: ai.provider.endpoint.trim(), model: ai.provider.model.trim(), text, vocabulary: task === 'pose' ? POSE_VOCABULARY : EXPRESSION_VOCABULARY, task });
    if (!res.ok || !res.text) throw new Error(res.error ?? 'El proveedor no devolvió texto');
    setRewritten(res.text);
    return res.text;
  }
  function poseToViewer(text = poseText) {
    const r = poseFromText(text);
    setPoseInfo({ understood: r.understood, ignored: r.ignored });
    if (!r.understood.length) return toast('No reconocí una pose en esa descripción. Prueba con «corriendo», «sentado con los brazos cruzados», «saltando»…', { icon: 'ℹ️' });
    sendViewer({ kind: r.kind, poseData: r.pose, bodyType: r.bodyType });
  }
  function exprToViewer(text = exprText) {
    const r = expressionFromText(text);
    setExprInfo({ understood: r.understood, ignored: r.ignored });
    if (!r.understood.length) return toast('No reconocí una emoción. Prueba con «alegre», «muy sorprendido», «triste pero cansado»…', { icon: 'ℹ️' });
    sendViewer({ kind: 'human', expression: r.expression });
  }
  const poseSmart = () => run('rewrite', async () => { poseToViewer(await rewrite(poseText, 'pose')); });
  const exprSmart = () => run('rewrite', async () => { exprToViewer(await rewrite(exprText, 'expression')); });

  function applyFit(lm: Landmarks, source: string, hints: typeof depth) {
    const fit = fitMannequinPose(lm, { depth: hints });
    sendViewer({ kind: 'human', poseData: fit.pose });
    setFitLm(lm);
    setFitInfo(`Maniquí colocado a partir de ${source}. Ajuste de la vista frontal: error medio ${Math.round(fit.error * 100)} % del torso. Un dibujo plano no dice si un brazo o una pierna acortados apuntan hacia ti o hacia atrás: elígelo abajo y reajusta.`);
  }

  async function poseFromDrawing() {
    await run('fit', async () => {
      let lm = figure.landmarks;
      let source = 'los puntos que ya colocaste';
      if (!lm) {
        const { detectPose } = await import('@/services/poseDetect.service');
        toast('Buscando la figura… (la primera vez se descarga un modelo de 12 MB)', { icon: '🔎', duration: 3000 });
        const res = await detectPose(flat(), proj.settings.transparentBg ? '#ffffff' : (proj.settings.backgroundColor ?? '#ffffff'));
        lm = res.body.landmarks;
        if (!lm) throw new Error(res.body.reason ?? 'No se reconoció una figura completa. Coloca los puntos a mano en Estudio → Figura y vuelve a probar.');
        figure.setLandmarks(lm);
        source = res.body.uncertain ? 'una lectura aproximada del dibujo' : 'lo detectado en el dibujo';
      }
      applyFit(lm, source, depth);
    });
  }

  // ---------------------------------------------------------------- light
  const makeVariants = () => run('light', () => setVariants(relightVariants(flat(), 320)));
  async function applyVariant(v: LightVariant) {
    await run('lightApply', async () => {
      await putOnLayer(relightFull(flat(), v.id), v.label, true);
      toast.success(`«${v.label}» añadida como capa de referencia (bloqueada, no se exporta)`);
    });
  }

  // ---------------------------------------------------------------- palettes
  const palettesText = () => {
    const r = paletteFromText(palText);
    setIdeas({ title: r.understood.length ? `Entendí: ${r.understood.join(', ')}` : 'No reconocí un ambiente; paleta de partida', list: r.ideas });
  };
  const palettesImage = () => run('pal', () => {
    const r = paletteFromImage(flat());
    setIdeas({ title: 'Ideas a partir de los colores de tu dibujo', list: r.ideas, current: r.current });
  });

  // ---------------------------------------------------------------- composition
  const analyseComp = () => run('comp', () => {
    const src = flat();
    const r = analyzeComposition(src);
    const o = document.createElement('canvas');
    o.width = 320;
    o.height = Math.round((320 * src.height) / src.width);
    const x = o.getContext('2d')!;
    x.drawImage(src, 0, 0, o.width, o.height);
    x.globalAlpha = 0.6;
    x.drawImage(r.heat, 0, 0, o.width, o.height);
    x.globalAlpha = 1;
    x.fillStyle = '#00ccff';
    x.beginPath();
    x.arc(r.focus.x * o.width, r.focus.y * o.height, 6, 0, 7);
    x.fill();
    if (r.suggestedCrop) {
      const k = o.width / src.width;
      x.strokeStyle = '#33ff66';
      x.lineWidth = 2;
      x.strokeRect(r.suggestedCrop.x * k, r.suggestedCrop.y * k, r.suggestedCrop.w * k, r.suggestedCrop.h * k);
    }
    setComp({ r, overlay: o });
  });
  function showGrid(id: 'thirds' | 'center' | 'golden') {
    if (!grid.enabled) grid.toggleEnabled();
    grid.setType(id === 'golden' ? 'goldenRatio' : id === 'center' ? 'diagonals' : 'ruleOfThirds');
  }

  // ---------------------------------------------------------------- cleanup / separation
  const previewClean = () => run('clean', () => setClean(cleanDrawing(flat(), { minSpeckArea: speck, closeGapRadius: gap })));
  async function applyClean() {
    if (!clean) return;
    await run('cleanApply', async () => {
      await putOnLayer(clean.canvas, 'Dibujo limpio');
      toast.success('Limpieza añadida en una capa nueva; tu dibujo original no se ha tocado');
      setClean(null);
    });
  }
  async function addParts() {
    if (!parts) return;
    await run('parts', async () => {
      for (const p of [...parts].reverse()) await putOnLayer(p.canvas, p.name);
      toast.success(`${parts.length} capas añadidas; las originales siguen intactas`);
      setParts(null);
    });
  }

  // ---------------------------------------------------------------- anatomy
  async function analyseAnatomy() {
    await run('anat', async () => {
      let lm = figure.landmarks;
      if (!lm) {
        const { detectPose } = await import('@/services/poseDetect.service');
        const res = await detectPose(flat(), proj.settings.transparentBg ? '#ffffff' : (proj.settings.backgroundColor ?? '#ffffff'));
        lm = res.body.landmarks;
        if (!lm) throw new Error(res.body.reason ?? 'No se reconoció una figura completa. Coloca los puntos a mano en Estudio → Figura.');
        figure.setLandmarks(lm);
      }
      setFindings(analyzeFigure(lm, figType).findings);
    });
  }

  // ---------------------------------------------------------------- provider generation
  const refreshKey = async () => {
    if (isElectron() && hasKey === null) setHasKey(await window.electronAPI.aiHasKey());
  };
  const providerReady = ai.provider.kind !== 'none' && ai.provider.endpoint.trim() !== '' && isElectron();
  function makePrompt() {
    const p = buildReferencePrompt(request, goal);
    setPrompt(p.prompt);
  }
  async function generate() {
    await run('gen', async () => {
      if (!providerReady) throw new Error('Configura primero un proveedor de imágenes (abajo, «Proveedor de imágenes»).');
      const negative = buildReferencePrompt(request, goal).negative;
      const res = await window.electronAPI.aiGenerateImage({ kind: ai.provider.kind as 'local-sd' | 'openai-compatible', endpoint: ai.provider.endpoint.trim(), model: ai.provider.model.trim(), prompt, negative, width: 768, height: 768 });
      if (!res.ok || !res.dataUrl) throw new Error(res.error ?? 'El proveedor no devolvió nada');
      setGenerated(res.dataUrl);
    });
  }
  async function keepGenerated(asLayer: boolean) {
    if (!generated) return;
    await run('keep', async () => {
      const ref = await buildReferenceFromDataUrl(generated, `IA: ${request.trim().slice(0, 40) || 'referencia'}`);
      addRef({ ...ref, tags: ['ia'] });
      if (asLayer) await putOnLayer(await dataUrlToImageCanvas(generated), 'Referencia (IA)', true);
      toast.success(asLayer ? 'Guardada en tu biblioteca de referencias (etiqueta «ia») y como capa de referencia' : 'Guardada en tu biblioteca de referencias (etiqueta «ia»)');
    });
  }

  return (
    <div className="p-2 space-y-2" data-assistant-panel>
      <div className="flex items-center gap-1.5">
        <Sparkles size={14} className="text-accent" />
        <span className="text-xs font-medium flex-1">Asistente de IA</span>
        <button onClick={() => { ai.setEnabled(false); toast('IA desactivada: la app queda 100 % manual', { icon: '🖐️' }); }} className="flex items-center gap-1 text-[10px] bg-panelLight hover:bg-border rounded px-2 py-1" title="Desactivar toda la IA">
          <PowerOff size={11} /> Desactivar IA
        </button>
      </div>
      <Hint>Te ayuda, no dibuja por ti: lo que propone llega como referencia, guía o capa nueva. Tu dibujo no se modifica nunca.</Hint>

      <Card id="pose" title="Pose desde una descripción → modelo 3D" open={open} setOpen={setOpen}>
        <input className={inputCls} value={poseText} onChange={(e) => setPoseText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && poseToViewer()} placeholder="mujer corriendo con los brazos hacia arriba" />
        <div className="flex gap-1.5 flex-wrap">
          <Btn primary onClick={() => poseToViewer()} disabled={!poseText.trim()}>Colocar el maniquí 3D</Btn>
          {canRewrite && <Btn onClick={poseSmart} disabled={!poseText.trim() || busy === 'rewrite'}>{busy === 'rewrite' ? 'Interpretando…' : 'Entender frase libre'}</Btn>}
        </div>
        {!canRewrite && <Hint>Entiende palabras clave (con tolerancia a erratas). Para frases libres, configura una API compatible con OpenAI en «Proveedor de imágenes»: se le envía solo tu frase para reescribirla con esas palabras.</Hint>}
        {rewritten && canRewrite && <Hint>Reescrita como: «{rewritten}»</Hint>}
        {poseInfo && <Hint>{poseInfo.understood.length ? `Entendido: ${poseInfo.understood.join(', ')}.` : 'Nada reconocido.'}{poseInfo.ignored.length ? ` Sin usar: ${poseInfo.ignored.join(', ')}.` : ''}</Hint>}
      </Card>

      <Card id="expr" title="Expresión facial → modelo 3D" open={open} setOpen={setOpen}>
        <input className={inputCls} value={exprText} onChange={(e) => setExprText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && exprToViewer()} placeholder="alegre pero cansado / muy sorprendido" />
        <div className="flex gap-1.5 flex-wrap">
          <Btn primary onClick={() => exprToViewer()} disabled={!exprText.trim()}>Poner la expresión</Btn>
          {canRewrite && <Btn onClick={exprSmart} disabled={!exprText.trim() || busy === 'rewrite'}>{busy === 'rewrite' ? 'Interpretando…' : 'Entender frase libre'}</Btn>}
        </div>
        {exprInfo && <Hint>{exprInfo.understood.length ? `Entendido: ${exprInfo.understood.join(', ')}.` : 'Nada reconocido.'}{exprInfo.ignored.length ? ` Sin usar: ${exprInfo.ignored.join(', ')}.` : ''}</Hint>}
      </Card>

      <Card id="fit" title="Convertir la pose de mi dibujo en un modelo 3D" open={open} setOpen={setOpen}>
        <Hint>Usa los puntos de figura que ya colocaste (Estudio → Figura) o busca la figura en el dibujo. Coloca el maniquí en esa pose para verla desde otros ángulos.</Hint>
        <Btn primary onClick={poseFromDrawing} disabled={busy === 'fit'}>{busy === 'fit' ? 'Trabajando…' : 'Crear modelo 3D de esta pose'}</Btn>
        {fitInfo && <Hint>{fitInfo}</Hint>}
        {fitLm && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1">
              {([['armL', 'Brazo izq.'], ['armR', 'Brazo der.'], ['legL', 'Pierna izq.'], ['legR', 'Pierna der.']] as const).map(([k, label]) => (
                <label key={k} className="text-[10px] text-textDim">{label}
                  <select className={inputCls} value={depth[k] ?? 'auto'} onChange={(e) => setDepth((d) => ({ ...d, [k]: e.target.value === 'auto' ? undefined : (e.target.value as DepthHint) }))}>
                    <option value="auto">Como se ve</option>
                    <option value="toward">Hacia ti</option>
                    <option value="away">Hacia atrás</option>
                  </select>
                </label>
              ))}
            </div>
            <Btn onClick={() => run('fit', () => applyFit(fitLm, 'los mismos puntos', depth))}>Reajustar con estas pistas</Btn>
          </div>
        )}
      </Card>

      <Card id="light" title="Variaciones de iluminación" open={open} setOpen={setOpen}>
        <Hint>Lee el brillo de tu dibujo como relieve y lo ilumina desde otras direcciones. Sirve para estudiar dónde irían luces y sombras; no es una iluminación físicamente exacta.</Hint>
        <Btn primary onClick={makeVariants} disabled={busy === 'light'}>Ver variaciones</Btn>
        {variants.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {variants.map((v) => <CanvasThumb key={v.id} canvas={v.canvas} label={`${v.label} · clic = añadir como referencia`} onClick={() => applyVariant(v)} />)}
          </div>
        )}
      </Card>

      <Card id="anat" title="Analizar anatomía" open={open} setOpen={setOpen}>
        <select className={inputCls} value={figType} onChange={(e) => setFigType(e.target.value as FigureType)}>
          {Object.entries(FIGURE_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
        </select>
        <Btn primary onClick={analyseAnatomy} disabled={busy === 'anat'}>{busy === 'anat' ? 'Analizando…' : 'Analizar proporciones'}</Btn>
        {findings && (
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <li key={f.id} className="text-[10px] leading-relaxed">
                <span className={f.severity === 'warning' ? 'text-amber-400' : f.severity === 'good' ? 'text-green-400' : 'text-sky-300'}>● {f.title}</span>
                <span className="text-textDim block">{f.why} {f.suggestion}</span>
              </li>
            ))}
          </ul>
        )}
        <Hint>Los puntos quedan en Estudio → Figura para que los corrijas a mano: una medición automática es un punto de partida.</Hint>
      </Card>

      <Card id="palette" title="Sugerir paletas" open={open} setOpen={setOpen}>
        <input className={inputCls} value={palText} onChange={(e) => setPalText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && palettesText()} placeholder="atardecer melancólico con toques azules" />
        <div className="flex gap-1.5">
          <Btn primary onClick={palettesText} disabled={!palText.trim()}>Desde texto</Btn>
          <Btn onClick={palettesImage}>Desde mi dibujo</Btn>
        </div>
        {ideas && (
          <div className="space-y-1.5">
            <Hint>{ideas.title}</Hint>
            {ideas.current && <Swatches name="Colores actuales" colors={ideas.current} pick={setPrimaryColor} />}
            {ideas.list.map((i) => <Swatches key={i.name} name={i.name} why={i.why} colors={i.colors} pick={setPrimaryColor} />)}
            <Hint>Haz clic en un color para usarlo como color principal.</Hint>
          </div>
        )}
      </Card>

      <Card id="comp" title="Ayuda con la composición" open={open} setOpen={setOpen}>
        <Btn primary onClick={analyseComp} disabled={busy === 'comp'}>Analizar composición</Btn>
        {comp && (
          <div className="space-y-1.5">
            <CanvasThumb canvas={comp.overlay} label="Mapa de atención (punto azul = foco, verde = recorte sugerido)" />
            {comp.r.tips.map((t) => (
              <div key={t.id} className="text-[10px] leading-relaxed">
                <span className={t.severity === 'warning' ? 'text-amber-400' : t.severity === 'good' ? 'text-green-400' : 'text-sky-300'}>● {t.title}</span>
                <span className="text-textDim block">{t.why} {t.suggestion}</span>
                {t.action && <button onClick={() => showGrid(t.action!.id)} className="text-accent underline">{t.action.label}</button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card id="clean" title="Limpiar pequeños errores" open={open} setOpen={setOpen}>
        <label className="text-[10px] text-textDim block">Quitar motas de menos de {speck} píxeles
          <input type="range" min={0} max={120} value={speck} onChange={(e) => setSpeck(+e.target.value)} className="w-full" />
        </label>
        <label className="text-[10px] text-textDim block">Cerrar huecos de hasta {gap} px en las líneas
          <input type="range" min={0} max={8} value={gap} onChange={(e) => setGap(+e.target.value)} className="w-full" />
        </label>
        <Btn primary onClick={previewClean} disabled={busy === 'clean'}>Previsualizar cambios</Btn>
        {clean && (
          <div className="space-y-1.5">
            <CanvasThumb canvas={clean.preview} label="Rojo = se quita · verde = se añade" />
            <Hint>{clean.specksRemoved} motas y {clean.gapPixelsAdded} píxeles de hueco cambiarían.</Hint>
            <Btn primary onClick={applyClean}>Añadir el resultado en una capa nueva</Btn>
          </div>
        )}
      </Card>

      <Card id="split" title="Separar en capas" open={open} setOpen={setOpen}>
        <Hint>Reparte lo que ya está dibujado en capas nuevas. Las originales no cambian.</Hint>
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={() => run('split', () => setParts(separateLineArt(flat())))}>Línea y color</Btn>
          <Btn onClick={() => run('split', () => setParts(separateBackground(flat(), 30)))}>Sujeto y fondo</Btn>
          <Btn onClick={() => run('split', () => setParts(separateByColors(flat(), 4)))}>Por colores</Btn>
        </div>
        {parts && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">{parts.map((p) => <CanvasThumb key={p.name} canvas={p.canvas} label={p.name} />)}</div>
            <Btn primary onClick={addParts}>Crear {parts.length} capas</Btn>
          </div>
        )}
      </Card>

      <Card id="gen" title="Generar referencias (proveedor externo)" open={open} setOpen={(v) => { setOpen(v); if (v === 'gen') void refreshKey(); }}>
        <Hint>Para referencias de estudio (poses, luz, objetos), no para arte final. Solo se envía lo que escribes aquí, y solo al pulsar «Generar». Sin proveedor configurado no se conecta a nada.</Hint>
        <select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as ReferenceGoal)}>
          {REFERENCE_GOALS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <input className={inputCls} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="mujer corriendo bajo la lluvia" />
        <Btn onClick={makePrompt} disabled={!request.trim()}>Preparar el texto</Btn>
        {prompt && (
          <>
            <textarea className={`${inputCls} h-20`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <Hint>Este es el texto exacto que se enviaría. Puedes editarlo.</Hint>
            <Btn primary onClick={generate} disabled={busy === 'gen' || !providerReady}>{busy === 'gen' ? 'Generando…' : providerReady ? 'Generar' : 'Configura un proveedor'}</Btn>
          </>
        )}
        {generated && (
          <div className="space-y-1.5">
            <img src={generated} alt="referencia generada" className="w-full rounded border border-border" />
            <div className="flex gap-1.5 flex-wrap">
              <Btn onClick={() => keepGenerated(false)}>Guardar en referencias</Btn>
              <Btn onClick={() => keepGenerated(true)}>Guardar y poner como capa</Btn>
              <Btn onClick={() => setGenerated(null)}>Descartar</Btn>
            </div>
          </div>
        )}
      </Card>

      <Card id="provider" title="Proveedor de imágenes" open={open} setOpen={(v) => { setOpen(v); if (v === 'provider') void refreshKey(); }}>
        <select className={inputCls} value={ai.provider.kind} onChange={(e) => ai.setProvider({ kind: e.target.value as typeof ai.provider.kind })}>
          <option value="none">Ninguno (sin conexión)</option>
          <option value="local-sd">Servidor local de Stable Diffusion</option>
          <option value="openai-compatible">API compatible con OpenAI</option>
        </select>
        {ai.provider.kind !== 'none' && (
          <>
            <input className={inputCls} value={ai.provider.endpoint} onChange={(e) => ai.setProvider({ endpoint: e.target.value })} placeholder={ai.provider.kind === 'local-sd' ? 'http://127.0.0.1:7860' : 'https://api.openai.com/v1'} />
            <input className={inputCls} value={ai.provider.model} onChange={(e) => ai.setProvider({ model: e.target.value })} placeholder="modelo (opcional)" />
            {ai.provider.kind === 'openai-compatible' && (
              <div className="flex gap-1.5">
                <input className={inputCls} type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder={hasKey ? 'Clave guardada (escribe otra para cambiarla)' : 'Clave de API'} />
                <Btn onClick={async () => { if (!isElectron()) return; await window.electronAPI.aiSetKey(keyDraft); setHasKey(keyDraft.trim() !== ''); setKeyDraft(''); toast.success(keyDraft.trim() ? 'Clave guardada cifrada en este equipo' : 'Clave borrada'); }}>{keyDraft.trim() ? 'Guardar' : 'Borrar'}</Btn>
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <Btn onClick={() => run('test', async () => {
                const r = await window.electronAPI.aiTestConnection({ kind: ai.provider.kind as 'local-sd' | 'openai-compatible', endpoint: ai.provider.endpoint.trim() });
                if (!r.ok) throw new Error(r.error ?? 'No se pudo conectar');
                setModels(r.models ?? []);
                toast.success(`Conectado${r.models?.length ? `: ${r.models.length} modelos disponibles` : ''}`);
              })} disabled={!providerReady || busy === 'test'}>{busy === 'test' ? 'Probando…' : 'Probar conexión'}</Btn>
              {models.length > 0 && <select className={inputCls} value={ai.provider.model} onChange={(e) => ai.setProvider({ model: e.target.value })}><option value="">(modelo por defecto)</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select>}
            </div>
            <Hint>La clave se guarda cifrada en tu equipo y solo la usa el proceso principal de la app; el resto de la interfaz nunca la ve. Las direcciones remotas deben ser https; http solo vale para localhost.</Hint>
          </>
        )}
        {!isElectron() && <Hint>La generación solo funciona en la app de escritorio.</Hint>}
      </Card>
    </div>
  );
}

async function dataUrlToImageCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await dataUrlToImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

function Swatches({ name, why, colors, pick }: { name: string; why?: string; colors: string[]; pick: (c: string) => void }) {
  return (
    <div>
      <div className="text-[10px] font-medium">{name}</div>
      <div className="flex gap-0.5">
        {colors.map((c, i) => <button key={i} onClick={() => pick(c)} title={c} className="h-6 flex-1 rounded-sm border border-border" style={{ background: c }} />)}
      </div>
      {why && <div className="text-[9px] text-textDim leading-snug">{why}</div>}
    </div>
  );
}

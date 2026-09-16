import { useState } from 'react';
import * as comicService from '@/services/comic.service';
import { BubbleType, PanelTemplate, BUBBLE_TYPE_LABELS, PANEL_TEMPLATE_LABELS } from '@/services/comic.service';
import { useLayers } from '@/hooks/useLayers';
import { useTools } from '@/hooks/useTools';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';

/**
 * All four comic/manga tools share the same interaction model: make a rectangular selection
 * (the existing Selection tool) to define where something goes, then click an "Insertar"
 * button here — no new drag-tools or canvas overlays needed, this reuses the selection the
 * app already has. Panel templates are the one exception: they lay out across the whole
 * canvas and don't need a selection at all.
 */
export default function ComicPanel() {
  const { currentLayer } = useLayers();
  const { primaryColor } = useTools();
  const selection = useAppStore((s) => s.selection);
  const project = useAppStore((s) => s.project);
  const pushHistory = useAppStore((s) => s.pushHistory);

  const canApplyToSelection = !!currentLayer && !currentLayer.locked && !!selection && selection.w > 4 && selection.h > 4;

  function withCanvas(run: (canvas: HTMLCanvasElement) => void, label: string) {
    if (!currentLayer) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    run(canvas);
    pushHistory(label);
  }

  return (
    <div className="p-3 overflow-y-auto space-y-4">
      <h3 className="text-xs font-semibold text-textDim uppercase tracking-wide">Cómic / Manga</h3>
      {!canApplyToSelection && (
        <p className="text-[10px] text-amber-400">
          Hacé una selección rectangular en el lienzo para ubicar viñetas, líneas de velocidad o globos (las plantillas de página no la
          necesitan).
        </p>
      )}

      <ScreentoneSection currentLayerLocked={!currentLayer || currentLayer.locked} selection={selection} withCanvas={withCanvas} />
      <PanelSection
        canApply={canApplyToSelection}
        currentLayerLocked={!currentLayer || currentLayer.locked}
        selection={selection}
        project={project}
        withCanvas={withCanvas}
      />
      <SpeedLinesSection canApply={canApplyToSelection} selection={selection} primaryColor={primaryColor} withCanvas={withCanvas} />
      <BubbleSection canApply={canApplyToSelection} selection={selection} withCanvas={withCanvas} />
    </div>
  );
}

type WithCanvas = (run: (canvas: HTMLCanvasElement) => void, label: string) => void;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 pt-3 border-t border-border first:border-t-0 first:pt-0">
      <div className="text-xs text-textDim font-medium">{title}</div>
      {hint && <p className="text-[10px] text-textDim">{hint}</p>}
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-textDim">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="w-14 bg-panel border border-border rounded text-[11px] px-1 py-0.5"
      />
    </label>
  );
}

function ScreentoneSection({
  currentLayerLocked,
  selection,
  withCanvas,
}: {
  currentLayerLocked: boolean;
  selection: { x: number; y: number; w: number; h: number } | null;
  withCanvas: WithCanvas;
}) {
  const [type, setType] = useState<comicService.ScreentoneType>('dot');
  const [frequency, setFrequency] = useState(8);
  const [angle, setAngle] = useState(45);
  const [weight, setWeight] = useState(0.5);
  const [color, setColor] = useState('#000000');

  return (
    <Section title="Tramas (screentone)" hint="Se aplica a la selección, o a toda la capa si no hay ninguna.">
      <div className="flex gap-1">
        {(['dot', 'line'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 text-[10px] rounded py-1 border ${type === t ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
          >
            {t === 'dot' ? 'Puntos' : 'Líneas'}
          </button>
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer" />
      </div>
      <div className="flex justify-between text-[10px] text-textDim">
        <span>Frecuencia</span>
        <span>{frequency}</span>
      </div>
      <input type="range" min={1} max={20} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} className="w-full" />
      {type === 'line' && (
        <>
          <div className="flex justify-between text-[10px] text-textDim">
            <span>Ángulo</span>
            <span>{angle}°</span>
          </div>
          <input type="range" min={0} max={179} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
        </>
      )}
      <div className="flex justify-between text-[10px] text-textDim">
        <span>Tono (tamaño)</span>
        <span>{Math.round(weight * 100)}%</span>
      </div>
      <input type="range" min={5} max={100} value={weight * 100} onChange={(e) => setWeight(Number(e.target.value) / 100)} className="w-full" />
      <button
        onClick={() =>
          withCanvas(
            (canvas) => comicService.fillWithScreentone(canvas, type, frequency, angle, weight, color, selection ?? undefined),
            'Aplicar trama'
          )
        }
        disabled={currentLayerLocked}
        className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
      >
        Aplicar trama
      </button>
    </Section>
  );
}

function PanelSection({
  canApply,
  currentLayerLocked,
  selection,
  project,
  withCanvas,
}: {
  canApply: boolean;
  currentLayerLocked: boolean;
  selection: { x: number; y: number; w: number; h: number } | null;
  project: { width: number; height: number } | null;
  withCanvas: WithCanvas;
}) {
  const [borderWidth, setBorderWidth] = useState(4);
  const [borderStyle, setBorderStyle] = useState<'solid' | 'double' | 'dashed'>('solid');
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillColor, setFillColor] = useState('#ffffff');

  const style: comicService.PanelStyle = {
    borderWidth,
    borderStyle,
    borderColor: '#000000',
    fillColor: fillEnabled ? fillColor : undefined,
  };

  return (
    <Section title="Viñetas de panel">
      <div className="flex gap-3">
        <NumberField label="Grosor" value={borderWidth} onChange={setBorderWidth} min={1} max={20} />
        <select
          value={borderStyle}
          onChange={(e) => setBorderStyle(e.target.value as typeof borderStyle)}
          className="bg-panel border border-border rounded text-[11px] px-1 py-0.5"
        >
          <option value="solid">Sólido</option>
          <option value="double">Doble</option>
          <option value="dashed">Punteado</option>
        </select>
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-textDim">
        <input type="checkbox" checked={fillEnabled} onChange={(e) => setFillEnabled(e.target.checked)} />
        Fondo
        {fillEnabled && (
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-6 h-5 bg-transparent border border-border rounded cursor-pointer" />
        )}
      </label>
      <button
        onClick={() => selection && withCanvas((canvas) => comicService.drawPanelBorder(canvas, selection, style), 'Dibujar viñeta')}
        disabled={!canApply}
        className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
      >
        Dibujar viñeta en selección
      </button>
      <div className="text-[10px] text-textDim pt-1">Plantillas de página (usan toda la capa)</div>
      <div className="grid grid-cols-2 gap-1">
        {(Object.keys(PANEL_TEMPLATE_LABELS) as PanelTemplate[]).map((t) => (
          <button
            key={t}
            onClick={() => project && withCanvas((canvas) => comicService.applyPanelTemplate(canvas, t, style), 'Plantilla de página')}
            disabled={!project || currentLayerLocked}
            className="text-[10px] bg-panel border border-border rounded py-1 disabled:opacity-40 hover:bg-panelLight"
          >
            {PANEL_TEMPLATE_LABELS[t]}
          </button>
        ))}
      </div>
    </Section>
  );
}

function SpeedLinesSection({
  canApply,
  selection,
  primaryColor,
  withCanvas,
}: {
  canApply: boolean;
  selection: { x: number; y: number; w: number; h: number } | null;
  primaryColor: string;
  withCanvas: WithCanvas;
}) {
  const [mode, setMode] = useState<'radial' | 'parallel'>('radial');
  const [count, setCount] = useState(24);
  const [thickness, setThickness] = useState(2);
  const [hollow, setHollow] = useState(0.3);

  function apply() {
    if (!selection) return;
    withCanvas((canvas) => {
      if (mode === 'radial') {
        const cx = selection.x + selection.w / 2;
        const cy = selection.y + selection.h / 2;
        const radius = Math.min(selection.w, selection.h) / 2;
        comicService.drawSpeedLinesRadial(canvas, cx, cy, radius, { count, thickness, color: primaryColor, hollow });
      } else {
        const y = selection.y + selection.h / 2;
        comicService.drawSpeedLinesParallel(canvas, selection.x, y, selection.x + selection.w, y, {
          count,
          thickness,
          color: primaryColor,
          hollow: 0,
          spacing: selection.h / Math.max(1, count),
        });
      }
    }, 'Líneas de velocidad');
  }

  return (
    <Section title="Líneas de velocidad" hint="Radial: ráfaga desde el centro de la selección. Paralelas: franjas horizontales que llenan la selección.">
      <div className="flex gap-1">
        {(['radial', 'parallel'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-[10px] rounded py-1 border ${mode === m ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
          >
            {m === 'radial' ? 'Radial' : 'Paralelas'}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <NumberField label="Cantidad" value={count} onChange={setCount} min={3} max={120} />
        <NumberField label="Grosor" value={thickness} onChange={setThickness} min={1} max={20} />
      </div>
      {mode === 'radial' && (
        <>
          <div className="flex justify-between text-[10px] text-textDim">
            <span>Hueco central</span>
            <span>{Math.round(hollow * 100)}%</span>
          </div>
          <input type="range" min={0} max={90} value={hollow * 100} onChange={(e) => setHollow(Number(e.target.value) / 100)} className="w-full" />
        </>
      )}
      <button onClick={apply} disabled={!canApply} className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40">
        Dibujar en selección
      </button>
    </Section>
  );
}

function BubbleSection({
  canApply,
  selection,
  withCanvas,
}: {
  canApply: boolean;
  selection: { x: number; y: number; w: number; h: number } | null;
  withCanvas: WithCanvas;
}) {
  const [type, setType] = useState<BubbleType>('speech');
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(18);

  return (
    <Section title="Globos de diálogo">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as BubbleType)}
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1"
      >
        {(Object.keys(BUBBLE_TYPE_LABELS) as BubbleType[]).map((t) => (
          <option key={t} value={t}>
            {BUBBLE_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto del globo…"
        rows={2}
        className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1 resize-none"
      />
      <NumberField label="Tamaño de texto" value={fontSize} onChange={setFontSize} min={8} max={60} />
      <button
        onClick={() =>
          selection &&
          withCanvas((canvas) => {
            comicService.drawSpeechBubble(canvas, selection, text, type, fontSize);
          }, 'Globo de diálogo')
        }
        disabled={!canApply}
        className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
      >
        Insertar en selección
      </button>
    </Section>
  );
}

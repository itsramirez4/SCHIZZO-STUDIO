import { useState } from 'react';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import * as layerService from '@/services/layer.service';
import {
  traceBitmap,
  paintTracedRegions,
  exportRegionsAsSvg,
  traceCenterline,
  paintTracedStrokes,
  exportStrokesAsSvg,
  TraceSettings,
} from '@/services/traceBitmap.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';

type Mode = TraceSettings['colorMode'] | 'centerline';

/** Vectorizes the current layer's raster content — either as flat-colored filled regions (bw /
 * colors, contour tracing) or as open centerline strokes (skeletonization, a genuinely different
 * algorithm — see traceBitmap.service.ts). Runs synchronously on the main thread — fine at the
 * canvas sizes this app targets, but a large canvas will visibly block for a moment; a future
 * round could move this to a worker if that becomes a real complaint. */
export default function TraceBitmapPanel() {
  const { currentLayer } = useLayers();
  const [mode, setMode] = useState<Mode>('bw');
  const [threshold, setThreshold] = useState(128);
  const [maxColors, setMaxColors] = useState(6);
  const [simplifyTolerance, setSimplifyTolerance] = useState(2);
  const [minBlobArea, setMinBlobArea] = useState(8);
  const [minLength, setMinLength] = useState(6);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  function computeRegions(source: HTMLCanvasElement) {
    return traceBitmap(source, { colorMode: mode as TraceSettings['colorMode'], threshold, maxColors, simplifyTolerance, minBlobArea });
  }
  function computeStrokes(source: HTMLCanvasElement) {
    return traceCenterline(source, { threshold, simplifyTolerance, minLength, strokeColor, strokeWidth });
  }

  function run() {
    if (!currentLayer) return;
    const source = layerService.getLayerCanvas(currentLayer.id);
    if (!source) return;

    setIsRunning(true);
    // Synchronous, but yielding one frame first lets the "Procesando…" label actually paint.
    requestAnimationFrame(() => {
      const app = useAppStore.getState();
      const { project } = app;
      if (project) {
        const newLayer = layerService.createLayer(mode === 'centerline' ? 'Centerline' : 'Trazado', project.width, project.height);
        const canvas = layerService.getLayerCanvas(newLayer.id)!;
        const ctx = canvas.getContext('2d')!;
        let count: number;
        if (mode === 'centerline') {
          const strokes = computeStrokes(source);
          paintTracedStrokes(ctx, strokes);
          count = strokes.length;
        } else {
          const regions = computeRegions(source);
          paintTracedRegions(ctx, regions);
          count = regions.length;
        }
        useAppStore.setState({ project: { ...project, layers: [newLayer, ...project.layers] }, currentLayerId: newLayer.id });
        app.pushHistory(mode === 'centerline' ? 'Vectorizar centerline' : 'Vectorizar bitmap');
        setLastCount(count);
      }
      setIsRunning(false);
    });
  }

  async function exportSvg() {
    if (!currentLayer) return;
    const source = layerService.getLayerCanvas(currentLayer.id);
    if (!source) return;

    setIsRunning(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    let svg: string;
    let count: number;
    if (mode === 'centerline') {
      const strokes = computeStrokes(source);
      svg = exportStrokesAsSvg(strokes, source.width, source.height);
      count = strokes.length;
    } else {
      const regions = computeRegions(source);
      svg = exportRegionsAsSvg(regions, source.width, source.height);
      count = regions.length;
    }
    const filename = sanitizeFilename(currentLayer.name || 'trazado');

    if (isElectron()) {
      // export:image is generic — it just strips a "data:...;base64," prefix and writes the
      // raw bytes, so it works fine for a plain-text SVG export too (same trick the palette
      // exporter uses for its JSON/CSS/GPL formats).
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      await window.electronAPI.exportImage(`data:image/svg+xml;base64,${base64}`, 'svg', filename);
    } else {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.svg`;
      link.click();
    }
    setLastCount(count);
    setIsRunning(false);
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Vectorizar bitmap (trace)</div>

      <div className="flex gap-1.5">
        {(['bw', 'colors', 'centerline'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded text-[10px] ${mode === m ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}
          >
            {m === 'bw' ? 'Blanco y negro' : m === 'colors' ? 'Colores planos' : 'Centerline'}
          </button>
        ))}
      </div>

      {mode === 'colors' ? (
        <label className="flex items-center gap-2 text-[10px] text-textDim">
          Colores aprox.
          <input type="range" min={2} max={16} value={maxColors} onChange={(e) => setMaxColors(Number(e.target.value))} className="flex-1" />
          <span className="w-7 text-right">{maxColors}</span>
        </label>
      ) : (
        <label className="flex items-center gap-2 text-[10px] text-textDim">
          Umbral
          <input type="range" min={1} max={254} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1" />
          <span className="w-7 text-right">{threshold}</span>
        </label>
      )}

      {mode === 'centerline' && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim w-20">Color de trazo</span>
            <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-7 h-7 bg-transparent border border-border rounded cursor-pointer" />
          </div>
          <label className="flex items-center gap-2 text-[10px] text-textDim">
            Grosor
            <input type="range" min={1} max={20} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="flex-1" />
            <span className="w-7 text-right">{strokeWidth}px</span>
          </label>
          <label className="flex items-center gap-2 text-[10px] text-textDim">
            Ignorar trazos menores a
            <input type="range" min={0} max={60} value={minLength} onChange={(e) => setMinLength(Number(e.target.value))} className="flex-1" />
            <span className="w-9 text-right">{minLength}px</span>
          </label>
        </>
      )}

      <label className="flex items-center gap-2 text-[10px] text-textDim">
        Simplificar trazo
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={simplifyTolerance}
          onChange={(e) => setSimplifyTolerance(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-7 text-right">{simplifyTolerance}px</span>
      </label>

      {mode !== 'centerline' && (
        <label className="flex items-center gap-2 text-[10px] text-textDim">
          Ignorar manchas menores a
          <input type="range" min={0} max={200} value={minBlobArea} onChange={(e) => setMinBlobArea(Number(e.target.value))} className="flex-1" />
          <span className="w-9 text-right">{minBlobArea}px²</span>
        </label>
      )}

      <p className="text-[9px] text-textDim">
        {mode === 'centerline'
          ? 'Reduce el trazo a su línea central (esqueleto) — pensado para bocetos/línea, no para rellenos.'
          : 'No soporta agujeros dentro de una forma (p. ej. la "O" saldría rellena) — solo regiones de color plano.'}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={run} disabled={!currentLayer || isRunning} className="bg-panelLight text-xs rounded py-1.5 disabled:opacity-40">
          {isRunning ? 'Procesando…' : 'Vectorizar en capa nueva'}
        </button>
        <button onClick={exportSvg} disabled={!currentLayer || isRunning} className="bg-panelLight text-xs rounded py-1.5 disabled:opacity-40">
          {isRunning ? 'Procesando…' : 'Exportar como SVG'}
        </button>
      </div>
      {lastCount !== null && !isRunning && (
        <p className="text-[9px] text-textDim">{lastCount} {mode === 'centerline' ? 'trazo(s)' : 'región(es)'} trazado(s).</p>
      )}
    </div>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { RGBA } from '@/types/colorTools';
import * as extraction from '@/services/paletteExtraction.service';
import { rgbaColorToHex } from '@/services/colorSpace.service';
import { useLayers } from '@/hooks/useLayers';
import * as layerService from '@/services/layer.service';
import { dataUrlToImage, createCanvas } from '@/utils/canvasUtils';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';

type Method = 'kmeans' | 'dominant';
type SortBy = 'hue' | 'lightness' | 'saturation';

export default function PaletteExtractor() {
  const { currentLayer } = useLayers();
  const [colors, setColors] = useState<RGBA[]>([]);
  const [method, setMethod] = useState<Method>('kmeans');
  const [colorCount, setColorCount] = useState(6);
  const [sortBy, setSortBy] = useState<SortBy>('hue');
  const [busy, setBusy] = useState(false);

  function runExtraction(imageData: ImageData) {
    const raw = method === 'kmeans' ? extraction.extractKMeans(imageData, colorCount) : extraction.extractDominant(imageData, colorCount);
    setColors(extraction.sortColors(raw, sortBy));
  }

  function extractFromLayer() {
    if (!currentLayer) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    runExtraction(imageData);
  }

  async function extractFromImage() {
    if (!isElectron()) {
      toast.error('Importar imágenes solo está disponible en la app de escritorio');
      return;
    }
    const result = await window.electronAPI.importImages();
    if (result.canceled || result.files.length === 0) return;
    setBusy(true);
    try {
      const img = await dataUrlToImage(result.files[0].dataUrl);
      const canvas = createCanvas(img.width, img.height);
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      runExtraction(imageData);
    } finally {
      setBusy(false);
    }
  }

  function reSort(next: SortBy) {
    setSortBy(next);
    if (colors.length) setColors(extraction.sortColors(colors, next));
  }

  async function exportPalette(format: 'json' | 'css' | 'gpl' | 'tailwind') {
    if (colors.length === 0) return;
    const content =
      format === 'json'
        ? extraction.exportAsJson(colors)
        : format === 'css'
          ? extraction.exportAsCss(colors)
          : format === 'tailwind'
            ? extraction.exportAsTailwind(colors)
            : extraction.exportAsGpl(colors, 'SCHIZZO Palette');

    const filename = sanitizeFilename('paleta');
    const ext = format === 'tailwind' ? 'js' : format;

    if (isElectron()) {
      // export:image is fully generic — it just strips a "data:...;base64," prefix and
      // writes the raw bytes, so it works just as well for plain-text palette exports as
      // for images. Reusing it avoids a whole new IPC round trip for four text formats.
      const base64 = btoa(unescape(encodeURIComponent(content)));
      await window.electronAPI.exportImage(`data:text/plain;base64,${base64}`, ext, filename);
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.${ext}`;
      link.click();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['kmeans', 'dominant'] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`flex-1 text-[10px] rounded py-1 border ${method === m ? 'bg-accent text-white border-accent' : 'bg-panel border-border text-textDim'}`}
          >
            {m === 'kmeans' ? 'K-means' : 'Dominantes'}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-textDim">
        Cantidad de colores
        <input
          type="number"
          min={2}
          max={16}
          value={colorCount}
          onChange={(e) => setColorCount(Math.max(2, Math.min(16, Number(e.target.value))))}
          className="w-14 bg-panel border border-border rounded px-1 py-0.5"
        />
      </label>

      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={extractFromLayer} disabled={!currentLayer} className="text-[11px] bg-panelLight rounded py-1.5 disabled:opacity-40">
          Extraer de la capa actual
        </button>
        <button onClick={extractFromImage} disabled={busy} className="text-[11px] bg-panelLight rounded py-1.5 disabled:opacity-40">
          {busy ? 'Cargando…' : 'Extraer de imagen…'}
        </button>
      </div>

      {colors.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-textDim">Ordenar</span>
            <select value={sortBy} onChange={(e) => reSort(e.target.value as SortBy)} className="bg-panel border border-border rounded text-[10px] px-1 py-0.5">
              <option value="hue">Tono</option>
              <option value="lightness">Luminosidad</option>
              <option value="saturation">Saturación</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {colors.map((c, i) => {
              const hex = rgbaColorToHex(c);
              return (
                <div key={i} className="rounded border border-border overflow-hidden">
                  <div className="h-10" style={{ background: hex }} />
                  <div className="text-[9px] font-mono text-textDim text-center py-0.5">{hex}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button onClick={() => exportPalette('json')} className="text-[10px] bg-panel border border-border rounded py-1 hover:bg-panelLight">
              JSON
            </button>
            <button onClick={() => exportPalette('css')} className="text-[10px] bg-panel border border-border rounded py-1 hover:bg-panelLight">
              CSS
            </button>
            <button onClick={() => exportPalette('gpl')} className="text-[10px] bg-panel border border-border rounded py-1 hover:bg-panelLight">
              GPL
            </button>
            <button onClick={() => exportPalette('tailwind')} className="text-[10px] bg-panel border border-border rounded py-1 hover:bg-panelLight">
              Tailwind
            </button>
          </div>
        </>
      )}
    </div>
  );
}

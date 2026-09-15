import { useRef, useState } from 'react';
import { applyDisplacementMap, DisplacementChannel } from '@/services/displacementMap.service';
import { dataUrlToCanvas } from '@/utils/canvasUtils';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEY = 'displacementMap';
const CHANNEL_LABELS: Record<DisplacementChannel, string> = {
  luminance: 'Luminancia',
  red: 'Rojo',
  green: 'Verde',
  blue: 'Azul',
  rgb: 'RGB (rojo=X, verde=Y)',
};

export default function DisplacementMapFilter() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [mapCanvas, setMapCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const [scaleX, setScaleX] = useState(30);
  const [scaleY, setScaleY] = useState(30);
  const [channel, setChannel] = useState<DisplacementChannel>('luminance');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function runPreview(map: HTMLCanvasElement, sx: number, sy: number, ch: DisplacementChannel) {
    preview(KEY, (c) => applyDisplacementMap(c, map, sx, sy, ch));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const canvas = await dataUrlToCanvas(dataUrl);
    setMapCanvas(canvas);
    setMapName(file.name);
    runPreview(canvas, scaleX, scaleY, channel);
  }

  function applyFilter() {
    if (!currentLayer || !mapCanvas) return;
    if (!isPreviewing(KEY)) runPreview(mapCanvas, scaleX, scaleY, channel);
    commit('Mapa de desplazamiento');
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Mapa de desplazamiento</div>
      <p className="text-[9px] text-textDim">Una imagen controla hacia dónde se desplaza cada píxel — gris medio (128) no mueve nada.</p>

      <button onClick={() => fileInputRef.current?.click()} className="w-full text-[10px] bg-panelLight rounded py-1.5">
        {mapName ? `Mapa: ${mapName}` : 'Cargar imagen como mapa…'}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {mapCanvas && (
        <>
          <div>
            <div className="flex justify-between text-[11px] text-textDim mb-0.5">
              <span>Escala X</span>
              <span>{scaleX}</span>
            </div>
            <input type="range" min={-100} max={100} value={scaleX} onChange={(e) => { const v = Number(e.target.value); setScaleX(v); runPreview(mapCanvas, v, scaleY, channel); }} className="w-full" />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-textDim mb-0.5">
              <span>Escala Y</span>
              <span>{scaleY}</span>
            </div>
            <input type="range" min={-100} max={100} value={scaleY} onChange={(e) => { const v = Number(e.target.value); setScaleY(v); runPreview(mapCanvas, scaleX, v, channel); }} className="w-full" />
          </div>
          <select
            value={channel}
            onChange={(e) => { const v = e.target.value as DisplacementChannel; setChannel(v); runPreview(mapCanvas, scaleX, scaleY, v); }}
            className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1"
          >
            {(Object.keys(CHANNEL_LABELS) as DisplacementChannel[]).map((c) => (
              <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={applyFilter} disabled={!currentLayer} className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
              Aplicar
            </button>
            {isPreviewing(KEY) && (
              <button onClick={cancel} className="flex-1 bg-panelLight text-xs rounded py-1.5">
                Cancelar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

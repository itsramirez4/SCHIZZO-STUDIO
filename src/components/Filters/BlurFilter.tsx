import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import * as layerService from '@/services/layer.service';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEY = 'blur';

export default function BlurFilter() {
  const { currentLayer } = useLayers();
  const pushHistory = useAppStore((s) => s.pushHistory);
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [radius, setRadius] = useState(4);
  const [gaussian, setGaussian] = useState(false);

  function previewWith(nextRadius: number, nextGaussian: boolean) {
    preview(KEY, (canvas) => {
      if (nextGaussian) filterService.gaussianBlur(canvas, nextRadius);
      else filterService.blur(canvas, nextRadius);
    });
  }

  function apply() {
    if (!currentLayer) return;
    // commit() flushes any pending preview frame synchronously, so this covers both
    // "never touched the slider" (nothing previewed yet — schedule it now) and
    // "mid-preview" (frame may still be pending) uniformly.
    if (!isPreviewing(KEY)) previewWith(radius, gaussian);
    commit('Desenfoque');
  }

  function handleCancel() {
    cancel();
  }

  function applyOneShot(fn: (c: HTMLCanvasElement) => void, action: string) {
    if (!currentLayer) return;
    const canvas = layerService.getLayerCanvas(currentLayer.id);
    if (!canvas) return;
    fn(canvas);
    pushHistory(action);
  }

  return (
    <div className="space-y-2 mt-4 pt-3 border-t border-border">
      {isPreviewing(KEY) && <div className="text-[10px] text-accent font-medium">Vista previa en vivo</div>}
      <div>
        <div className="flex justify-between text-xs text-textDim mb-1">
          <span>Radio de desenfoque</span>
          <span>{radius}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={40}
          value={radius}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRadius(v);
            previewWith(v, gaussian);
          }}
          className="w-full"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-textDim">
        <input
          type="checkbox"
          checked={gaussian}
          onChange={(e) => {
            const v = e.target.checked;
            setGaussian(v);
            previewWith(radius, v);
          }}
        />
        Desenfoque gaussiano
      </label>
      <div className="flex gap-2">
        <button onClick={apply} disabled={!currentLayer} className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
          Aplicar desenfoque
        </button>
        {isPreviewing(KEY) && (
          <button onClick={handleCancel} className="flex-1 bg-panelLight text-xs rounded py-1.5">
            Cancelar
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => applyOneShot(filterService.invert, 'Invertir')}
          disabled={!currentLayer}
          className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
        >
          Invertir
        </button>
        <button
          onClick={() => applyOneShot(filterService.desaturate, 'Escala de grises')}
          disabled={!currentLayer}
          className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
        >
          Grises
        </button>
      </div>
    </div>
  );
}

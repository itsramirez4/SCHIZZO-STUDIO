import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEY = 'color-adjustments';

export default function ColorAdjustments() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturationVal, setSaturationVal] = useState(0);
  const [hueVal, setHueVal] = useState(0);

  function previewWith(next: { brightness: number; contrast: number; saturationVal: number; hueVal: number }) {
    preview(KEY, (canvas) => {
      if (next.brightness !== 0 || next.contrast !== 0) filterService.brightnessContrast(canvas, next.brightness, next.contrast);
      if (next.saturationVal !== 0) filterService.saturation(canvas, next.saturationVal);
      if (next.hueVal !== 0) filterService.hue(canvas, next.hueVal);
    });
  }

  function reset() {
    setBrightness(0);
    setContrast(0);
    setSaturationVal(0);
    setHueVal(0);
  }

  function apply() {
    if (!currentLayer) return;
    commit('Ajustes de color');
    reset();
  }

  function handleCancel() {
    cancel();
    reset();
  }

  const sliders: [string, number, (v: number) => void, number, number][] = [
    ['Brillo', brightness, (v) => { setBrightness(v); previewWith({ brightness: v, contrast, saturationVal, hueVal }); }, -100, 100],
    ['Contraste', contrast, (v) => { setContrast(v); previewWith({ brightness, contrast: v, saturationVal, hueVal }); }, -100, 100],
    ['Saturación', saturationVal, (v) => { setSaturationVal(v); previewWith({ brightness, contrast, saturationVal: v, hueVal }); }, -100, 100],
    ['Tono', hueVal, (v) => { setHueVal(v); previewWith({ brightness, contrast, saturationVal, hueVal: v }); }, -180, 180],
  ];

  return (
    <div className="space-y-2">
      {isPreviewing(KEY) && <div className="text-[10px] text-accent font-medium">Vista previa en vivo</div>}
      {sliders.map(([label, value, setter, min, max]) => (
        <div key={label}>
          <div className="flex justify-between text-xs text-textDim mb-1">
            <span>{label}</span>
            <span>{value}</span>
          </div>
          <input type="range" min={min} max={max} value={value} onChange={(e) => setter(Number(e.target.value))} className="w-full" />
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={apply} disabled={!currentLayer} className="flex-1 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
          Aplicar
        </button>
        {isPreviewing(KEY) && (
          <button onClick={handleCancel} className="flex-1 bg-panelLight text-xs rounded py-1.5">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

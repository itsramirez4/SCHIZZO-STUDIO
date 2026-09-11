import { Layer } from '@/types';
import { useLayers } from '@/hooks/useLayers';

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
}

const SLIDERS: Record<string, SliderDef[]> = {
  'brightness-contrast': [
    { key: 'brightness', label: 'Brillo', min: -100, max: 100 },
    { key: 'contrast', label: 'Contraste', min: -100, max: 100 },
  ],
  'hue-saturation': [
    { key: 'hue', label: 'Tono', min: -180, max: 180 },
    { key: 'saturation', label: 'Saturación', min: -100, max: 100 },
  ],
  posterize: [{ key: 'levels', label: 'Niveles', min: 2, max: 8 }],
  sepia: [{ key: 'intensity', label: 'Intensidad', min: 0, max: 100 }],
  invert: [],
  desaturate: [],
};

export default function AdjustmentEditor({ layer }: { layer: Layer }) {
  const { setAdjustmentParams, commitAdjustmentParams } = useLayers();
  const sliders = SLIDERS[layer.adjustmentType ?? 'brightness-contrast'] ?? [];
  const params = layer.adjustmentParams ?? {};

  if (sliders.length === 0) {
    return <div className="text-[10px] text-textDim">Sin parámetros ajustables.</div>;
  }

  return (
    <div className="space-y-1.5">
      {sliders.map(({ key, label, min, max }) => (
        <div key={key}>
          <div className="flex justify-between text-[10px] text-textDim mb-0.5">
            <span>{label}</span>
            <span>{params[key] ?? 0}</span>
          </div>
          <input
            type="range"
            title={label}
            min={min}
            max={max}
            value={params[key] ?? 0}
            onChange={(e) => setAdjustmentParams(layer.id, { ...params, [key]: Number(e.target.value) })}
            onPointerUp={commitAdjustmentParams}
            onKeyUp={commitAdjustmentParams}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}

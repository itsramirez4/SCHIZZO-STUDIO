import { useTranslation } from 'react-i18next';
import { Layer } from '@/types';
import { useLayers } from '@/hooks/useLayers';

interface SliderDef {
  key: string;
  labelKey: string;
  min: number;
  max: number;
}

const SLIDERS: Record<string, SliderDef[]> = {
  'brightness-contrast': [
    { key: 'brightness', labelKey: 'brightness', min: -100, max: 100 },
    { key: 'contrast', labelKey: 'contrast', min: -100, max: 100 },
  ],
  'hue-saturation': [
    { key: 'hue', labelKey: 'hue', min: -180, max: 180 },
    { key: 'saturation', labelKey: 'saturation', min: -100, max: 100 },
  ],
  posterize: [{ key: 'levels', labelKey: 'levels', min: 2, max: 8 }],
  sepia: [{ key: 'intensity', labelKey: 'intensity', min: 0, max: 100 }],
  levels: [
    { key: 'inputBlack', labelKey: 'inputBlack', min: 0, max: 255 },
    { key: 'inputWhite', labelKey: 'inputWhite', min: 0, max: 255 },
    { key: 'gamma', labelKey: 'gamma', min: 10, max: 300 },
    { key: 'outputBlack', labelKey: 'outputBlack', min: 0, max: 255 },
    { key: 'outputWhite', labelKey: 'outputWhite', min: 0, max: 255 },
  ],
  threshold: [{ key: 'level', labelKey: 'level', min: 0, max: 255 }],
  invert: [],
  desaturate: [],
};

export default function AdjustmentEditor({ layer }: { layer: Layer }) {
  const { t } = useTranslation('panelsPaint');
  const { setAdjustmentParams, commitAdjustmentParams } = useLayers();
  const sliders = SLIDERS[layer.adjustmentType ?? 'brightness-contrast'] ?? [];
  const params = layer.adjustmentParams ?? {};

  if (sliders.length === 0) {
    return <div className="text-[10px] text-textDim">{t('adjustmentEditor.noParams')}</div>;
  }

  return (
    <div className="space-y-1.5">
      {sliders.map(({ key, labelKey, min, max }) => (
        <div key={key}>
          <div className="flex justify-between text-[10px] text-textDim mb-0.5">
            <span>{t(`adjustmentEditor.sliders.${labelKey}`)}</span>
            <span>{params[key] ?? 0}</span>
          </div>
          <input
            type="range"
            title={t(`adjustmentEditor.sliders.${labelKey}`)}
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

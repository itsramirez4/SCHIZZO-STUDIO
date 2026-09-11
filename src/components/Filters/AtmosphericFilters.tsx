import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEYS = { fog: 'fog', dust: 'dust', smoke: 'smoke', rain: 'rain' } as const;

export default function AtmosphericFilters() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [fogDensity, setFogDensity] = useState(50);
  const [fogColor, setFogColor] = useState('#c8c8c8');

  const [dustDensity, setDustDensity] = useState(40);
  const [dustColor, setDustColor] = useState('#e0d8c0');

  const [smokeDensity, setSmokeDensity] = useState(40);
  const [smokeColor, setSmokeColor] = useState('#969696');

  const [rainDensity, setRainDensity] = useState(50);
  const [rainAngle, setRainAngle] = useState(70);
  const [rainColor, setRainColor] = useState('#a8c8e0');

  function apply(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

  // Color pickers don't drive `preview()` on their own — if a density/angle drag already
  // started a preview, changing the color afterward needs to re-run it too, or Aplicar
  // would commit the last-previewed (stale) color instead of the one now shown in the swatch.
  function changeColor(key: string, setColor: (hex: string) => void, hex: string, rerun: (color: string) => void) {
    setColor(hex);
    if (isPreviewing(key)) rerun(hex);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Atmósfera</div>

      <FilterGroup
        label="Niebla"
        active={isPreviewing(KEYS.fog)}
        onCancel={cancel}
        onApply={() => apply(KEYS.fog, () => preview(KEYS.fog, (c) => filterService.applyFog(c, fogDensity / 100, fogColor)), 'Niebla')}
        disabled={!currentLayer}
        color={fogColor}
        onColorChange={(hex) => changeColor(KEYS.fog, setFogColor, hex, (c) => preview(KEYS.fog, (canvas) => filterService.applyFog(canvas, fogDensity / 100, c)))}
      >
        <Slider
          label="Densidad"
          value={fogDensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setFogDensity(v);
            preview(KEYS.fog, (c) => filterService.applyFog(c, v / 100, fogColor));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Polvo"
        active={isPreviewing(KEYS.dust)}
        onCancel={cancel}
        onApply={() => apply(KEYS.dust, () => preview(KEYS.dust, (c) => filterService.applyDust(c, dustDensity, dustColor)), 'Polvo')}
        disabled={!currentLayer}
        color={dustColor}
        onColorChange={(hex) => changeColor(KEYS.dust, setDustColor, hex, (c) => preview(KEYS.dust, (canvas) => filterService.applyDust(canvas, dustDensity, c)))}
      >
        <Slider
          label="Densidad"
          value={dustDensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setDustDensity(v);
            preview(KEYS.dust, (c) => filterService.applyDust(c, v, dustColor));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Humo"
        active={isPreviewing(KEYS.smoke)}
        onCancel={cancel}
        onApply={() => apply(KEYS.smoke, () => preview(KEYS.smoke, (c) => filterService.applySmoke(c, smokeDensity, smokeColor)), 'Humo')}
        disabled={!currentLayer}
        color={smokeColor}
        onColorChange={(hex) => changeColor(KEYS.smoke, setSmokeColor, hex, (c) => preview(KEYS.smoke, (canvas) => filterService.applySmoke(canvas, smokeDensity, c)))}
      >
        <Slider
          label="Densidad"
          value={smokeDensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setSmokeDensity(v);
            preview(KEYS.smoke, (c) => filterService.applySmoke(c, v, smokeColor));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Lluvia"
        active={isPreviewing(KEYS.rain)}
        onCancel={cancel}
        onApply={() =>
          apply(KEYS.rain, () => preview(KEYS.rain, (c) => filterService.applyRain(c, rainDensity, rainAngle, rainColor)), 'Lluvia')
        }
        disabled={!currentLayer}
        color={rainColor}
        onColorChange={(hex) =>
          changeColor(KEYS.rain, setRainColor, hex, (c) => preview(KEYS.rain, (canvas) => filterService.applyRain(canvas, rainDensity, rainAngle, c)))
        }
      >
        <Slider
          label="Densidad"
          value={rainDensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setRainDensity(v);
            preview(KEYS.rain, (c) => filterService.applyRain(c, v, rainAngle, rainColor));
          }}
        />
        <Slider
          label="Ángulo"
          value={rainAngle}
          min={30}
          max={150}
          unit="°"
          onChange={(v) => {
            setRainAngle(v);
            preview(KEYS.rain, (c) => filterService.applyRain(c, rainDensity, v, rainColor));
          }}
        />
      </FilterGroup>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-textDim mb-0.5">
        <span>{label}</span>
        <span>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function FilterGroup({
  label,
  active,
  disabled,
  onApply,
  onCancel,
  color,
  onColorChange,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onApply: () => void;
  onCancel: () => void;
  color: string;
  onColorChange: (hex: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-textDim font-medium">
          {label} {active && <span className="text-accent">· vista previa</span>}
        </div>
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-6 h-6 bg-transparent border border-border rounded cursor-pointer"
        />
      </div>
      {children}
      <div className="flex gap-2">
        <button onClick={onApply} disabled={disabled} className="flex-1 bg-panelLight text-xs rounded py-1.5 disabled:opacity-40">
          Aplicar
        </button>
        {active && (
          <button onClick={onCancel} className="flex-1 bg-panelLight text-xs rounded py-1.5 text-textDim">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

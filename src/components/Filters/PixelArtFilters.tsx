import { useState } from 'react';
import toast from 'react-hot-toast';
import * as filterService from '@/services/filter.service';
import { RGB } from '@/services/filter.service';
import { colorPalettes } from '@/data/colorPalettes';
import { hexToRgba } from '@/utils/colorUtils';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEYS = { quantize: 'quantize', dither: 'dither' } as const;

function toRgbPalette(hexColors: string[]): RGB[] {
  return hexColors.map((hex) => {
    const { r, g, b } = hexToRgba(hex);
    return [r, g, b] as RGB;
  });
}

export default function PixelArtFilters() {
  const { currentLayer } = useLayers();
  const generateColorCycleFrames = useAppStore((s) => s.generateColorCycleFrames);
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [paletteId, setPaletteId] = useState(colorPalettes[0].id);
  const [ditherStrength, setDitherStrength] = useState(48);
  const [cycleStart, setCycleStart] = useState(0);
  const [cycleEnd, setCycleEnd] = useState(3);
  const [cycleSteps, setCycleSteps] = useState(4);
  const [cycleDurationMs, setCycleDurationMs] = useState(150);

  const palette = colorPalettes.find((p) => p.id === paletteId) ?? colorPalettes[0];
  const rgbPalette = toRgbPalette(palette.colors);

  const maxIndex = palette.colors.length - 1;
  const clampedStart = Math.min(cycleStart, maxIndex);
  const clampedEnd = Math.max(clampedStart, Math.min(cycleEnd, maxIndex));
  const cycleRange = rgbPalette.slice(clampedStart, clampedEnd + 1);

  function handleGenerateCycle() {
    if (cycleRange.length < 2) {
      toast.error('Elegí un rango de al menos 2 colores');
      return;
    }
    generateColorCycleFrames(cycleRange, cycleSteps, cycleDurationMs);
    toast.success(`${cycleSteps} frames generados — revisá el panel de Animación`);
  }

  function apply(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Pixel art</div>

      <div>
        <div className="text-[11px] text-textDim mb-1">Paleta objetivo</div>
        <select
          value={paletteId}
          onChange={(e) => setPaletteId(e.target.value)}
          className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1 mb-1.5"
        >
          {colorPalettes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-10 gap-0.5">
          {palette.colors.map((hex) => (
            <div key={hex} style={{ background: hex }} title={hex} className="aspect-square rounded-sm border border-border/50" />
          ))}
        </div>
      </div>

      <FilterGroup
        label="Cuantizar a paleta"
        active={isPreviewing(KEYS.quantize)}
        onCancel={cancel}
        onApply={() => apply(KEYS.quantize, () => preview(KEYS.quantize, (c) => filterService.quantizeToPalette(c, rgbPalette)), 'Cuantizar a paleta')}
        disabled={!currentLayer}
      >
        <p className="text-[10px] text-textDim">Reemplaza cada color por el más cercano de la paleta elegida.</p>
      </FilterGroup>

      <FilterGroup
        label="Dithering (Bayer)"
        active={isPreviewing(KEYS.dither)}
        onCancel={cancel}
        onApply={() =>
          apply(KEYS.dither, () => preview(KEYS.dither, (c) => filterService.ditherToPalette(c, rgbPalette, ditherStrength)), 'Dithering')
        }
        disabled={!currentLayer}
      >
        <p className="text-[10px] text-textDim mb-1">Aproxima degradados con una trama, en vez de bandas planas, al reducir a la paleta.</p>
        <Slider
          label="Intensidad"
          value={ditherStrength}
          min={0}
          max={128}
          onChange={(v) => {
            setDitherStrength(v);
            preview(KEYS.dither, (c) => filterService.ditherToPalette(c, rgbPalette, v));
          }}
        />
      </FilterGroup>

      <div className="space-y-1.5">
        <div className="text-xs text-textDim font-medium">Ciclado de color</div>
        <p className="text-[10px] text-textDim">
          Genera frames de animación reales rotando un rango de la paleta (agua, lava, luces) — funciona mejor sobre una capa ya
          cuantizada a esta paleta. Reproducí o exportá desde el panel de Animación.
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-textDim">Rango</span>
          <input
            type="number"
            min={0}
            max={maxIndex}
            value={clampedStart}
            onChange={(e) => setCycleStart(Math.max(0, Number(e.target.value)))}
            className="w-12 bg-panel border border-border rounded text-[11px] px-1 py-0.5"
          />
          <span className="text-[10px] text-textDim">a</span>
          <input
            type="number"
            min={0}
            max={maxIndex}
            value={clampedEnd}
            onChange={(e) => setCycleEnd(Math.max(0, Number(e.target.value)))}
            className="w-12 bg-panel border border-border rounded text-[11px] px-1 py-0.5"
          />
        </div>
        <div className="grid grid-cols-10 gap-0.5">
          {palette.colors.map((hex, i) => (
            <div
              key={hex + i}
              style={{ background: hex }}
              title={hex}
              className={`aspect-square rounded-sm border ${i >= clampedStart && i <= clampedEnd ? 'border-accent' : 'border-border/50 opacity-40'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[10px] text-textDim">
            Frames
            <input
              type="number"
              min={2}
              max={32}
              value={cycleSteps}
              onChange={(e) => setCycleSteps(Math.max(2, Number(e.target.value)))}
              className="w-12 bg-panel border border-border rounded text-[11px] px-1 py-0.5"
            />
          </label>
          <label className="flex items-center gap-1 text-[10px] text-textDim">
            Duración (ms)
            <input
              type="number"
              min={20}
              value={cycleDurationMs}
              onChange={(e) => setCycleDurationMs(Math.max(20, Number(e.target.value)))}
              className="w-14 bg-panel border border-border rounded text-[11px] px-1 py-0.5"
            />
          </label>
        </div>
        <button
          onClick={handleGenerateCycle}
          disabled={!currentLayer || cycleRange.length < 2}
          className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
        >
          Generar animación
        </button>
      </div>
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
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onApply: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-textDim font-medium">
        {label} {active && <span className="text-accent">· vista previa</span>}
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

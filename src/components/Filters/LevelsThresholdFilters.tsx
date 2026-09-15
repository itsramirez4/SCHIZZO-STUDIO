import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';

const KEYS = { levels: 'levels', threshold: 'threshold', autoContrast: 'auto-contrast' } as const;

/** Two classic tone tools missing until now: Levels (remap input/output range + gamma) and
 * Threshold (collapse to pure black/white at a cutoff) — distinct from Brillo/Contraste
 * (which only shifts/scales) and from Posterizar (which keeps color, just fewer steps). */
export default function LevelsThresholdFilters() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [inputBlack, setInputBlack] = useState(0);
  const [inputWhite, setInputWhite] = useState(255);
  const [gamma, setGamma] = useState(100);
  const [outputBlack, setOutputBlack] = useState(0);
  const [outputWhite, setOutputWhite] = useState(255);
  const [thresholdLevel, setThresholdLevel] = useState(128);

  function previewLevels(next: { inputBlack: number; inputWhite: number; gamma: number; outputBlack: number; outputWhite: number }) {
    preview(KEYS.levels, (canvas) =>
      filterService.levels(canvas, { ...next, gamma: next.gamma / 100 })
    );
  }

  function resetLevels() {
    setInputBlack(0);
    setInputWhite(255);
    setGamma(100);
    setOutputBlack(0);
    setOutputWhite(255);
  }

  function applyLevels() {
    if (!currentLayer) return;
    commit('Niveles');
    resetLevels();
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Tono (niveles y umbral)</div>

      <FilterGroup
        label="Auto-contraste"
        active={isPreviewing(KEYS.autoContrast)}
        onCancel={cancel}
        onApply={() => {
          if (!currentLayer) return;
          if (!isPreviewing(KEYS.autoContrast)) preview(KEYS.autoContrast, (canvas) => filterService.autoContrast(canvas));
          commit('Auto-contraste');
        }}
        disabled={!currentLayer}
      >
        <p className="text-[10px] text-textDim">Estira el rango tonal de la capa automáticamente, sin mover controles a mano.</p>
        <button
          onClick={() => preview(KEYS.autoContrast, (canvas) => filterService.autoContrast(canvas))}
          disabled={!currentLayer}
          className="w-full bg-panelLight text-xs rounded py-1.5 disabled:opacity-40"
        >
          Previsualizar
        </button>
      </FilterGroup>

      <FilterGroup label="Niveles" active={isPreviewing(KEYS.levels)} onCancel={() => { cancel(); resetLevels(); }} onApply={applyLevels} disabled={!currentLayer}>
        <Slider label="Entrada: negro" value={inputBlack} min={0} max={254} onChange={(v) => { setInputBlack(v); previewLevels({ inputBlack: v, inputWhite, gamma, outputBlack, outputWhite }); }} />
        <Slider label="Entrada: blanco" value={inputWhite} min={1} max={255} onChange={(v) => { setInputWhite(v); previewLevels({ inputBlack, inputWhite: v, gamma, outputBlack, outputWhite }); }} />
        <Slider label="Gamma" value={gamma} min={10} max={300} unit="%" onChange={(v) => { setGamma(v); previewLevels({ inputBlack, inputWhite, gamma: v, outputBlack, outputWhite }); }} />
        <Slider label="Salida: negro" value={outputBlack} min={0} max={254} onChange={(v) => { setOutputBlack(v); previewLevels({ inputBlack, inputWhite, gamma, outputBlack: v, outputWhite }); }} />
        <Slider label="Salida: blanco" value={outputWhite} min={1} max={255} onChange={(v) => { setOutputWhite(v); previewLevels({ inputBlack, inputWhite, gamma, outputBlack, outputWhite: v }); }} />
      </FilterGroup>

      <FilterGroup
        label="Umbral"
        active={isPreviewing(KEYS.threshold)}
        onCancel={() => { cancel(); setThresholdLevel(128); }}
        onApply={() => {
          if (!currentLayer) return;
          commit('Umbral');
          setThresholdLevel(128);
        }}
        disabled={!currentLayer}
      >
        <Slider label="Nivel" value={thresholdLevel} min={0} max={255} onChange={(v) => { setThresholdLevel(v); preview(KEYS.threshold, (c) => filterService.threshold(c, v)); }} />
      </FilterGroup>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
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

function FilterGroup({ label, active, disabled, onApply, onCancel, children }: { label: string; active: boolean; disabled: boolean; onApply: () => void; onCancel: () => void; children: React.ReactNode }) {
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

import { useState } from 'react';
import * as toneFilters from '@/services/toneFilters.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import FilterPresetControls from './FilterPresetControls';

const KEYS = { duotone: 'duotone', tritone: 'tritone', vintage: 'vintage', noir: 'noir', solarize: 'solarize' } as const;

export default function ToneFilters() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [duoShadow, setDuoShadow] = useState('#1a1a2e');
  const [duoHighlight, setDuoHighlight] = useState('#f5a623');
  const [triShadow, setTriShadow] = useState('#0d1b2a');
  const [triMid, setTriMid] = useState('#748cab');
  const [triHighlight, setTriHighlight] = useState('#e0e1dd');
  const [vintageStrength, setVintageStrength] = useState(70);
  const [noirContrast, setNoirContrast] = useState(60);
  const [solarizeThreshold, setSolarizeThreshold] = useState(50);

  function apply(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Tonos y looks</div>

      <FilterGroup
        label="Duotono"
        active={isPreviewing(KEYS.duotone)}
        onCancel={cancel}
        onApply={() => apply(KEYS.duotone, () => preview(KEYS.duotone, (c) => toneFilters.duotone(c, duoShadow, duoHighlight)), 'Duotono')}
        disabled={!currentLayer}
      >
        <ColorRow label="Sombras" value={duoShadow} onChange={(v) => { setDuoShadow(v); preview(KEYS.duotone, (c) => toneFilters.duotone(c, v, duoHighlight)); }} />
        <ColorRow label="Luces" value={duoHighlight} onChange={(v) => { setDuoHighlight(v); preview(KEYS.duotone, (c) => toneFilters.duotone(c, duoShadow, v)); }} />
        <FilterPresetControls
          filterId="duotone"
          currentParams={{ shadow: duoShadow, highlight: duoHighlight }}
          onApply={(p) => {
            const shadow = String(p.shadow);
            const highlight = String(p.highlight);
            setDuoShadow(shadow);
            setDuoHighlight(highlight);
            preview(KEYS.duotone, (c) => toneFilters.duotone(c, shadow, highlight));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Tritono"
        active={isPreviewing(KEYS.tritone)}
        onCancel={cancel}
        onApply={() => apply(KEYS.tritone, () => preview(KEYS.tritone, (c) => toneFilters.tritone(c, triShadow, triMid, triHighlight)), 'Tritono')}
        disabled={!currentLayer}
      >
        <ColorRow label="Sombras" value={triShadow} onChange={(v) => { setTriShadow(v); preview(KEYS.tritone, (c) => toneFilters.tritone(c, v, triMid, triHighlight)); }} />
        <ColorRow label="Medios" value={triMid} onChange={(v) => { setTriMid(v); preview(KEYS.tritone, (c) => toneFilters.tritone(c, triShadow, v, triHighlight)); }} />
        <ColorRow label="Luces" value={triHighlight} onChange={(v) => { setTriHighlight(v); preview(KEYS.tritone, (c) => toneFilters.tritone(c, triShadow, triMid, v)); }} />
        <FilterPresetControls
          filterId="tritone"
          currentParams={{ shadow: triShadow, mid: triMid, highlight: triHighlight }}
          onApply={(p) => {
            const shadow = String(p.shadow);
            const mid = String(p.mid);
            const highlight = String(p.highlight);
            setTriShadow(shadow);
            setTriMid(mid);
            setTriHighlight(highlight);
            preview(KEYS.tritone, (c) => toneFilters.tritone(c, shadow, mid, highlight));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Vintage"
        active={isPreviewing(KEYS.vintage)}
        onCancel={cancel}
        onApply={() => apply(KEYS.vintage, () => preview(KEYS.vintage, (c) => toneFilters.vintage(c, vintageStrength)), 'Vintage')}
        disabled={!currentLayer}
      >
        <Slider label="Intensidad" value={vintageStrength} min={0} max={100} unit="%" onChange={(v) => { setVintageStrength(v); preview(KEYS.vintage, (c) => toneFilters.vintage(c, v)); }} />
        <FilterPresetControls
          filterId="vintage"
          currentParams={{ strength: vintageStrength }}
          onApply={(p) => {
            const strength = Number(p.strength);
            setVintageStrength(strength);
            preview(KEYS.vintage, (c) => toneFilters.vintage(c, strength));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Noir"
        active={isPreviewing(KEYS.noir)}
        onCancel={cancel}
        onApply={() => apply(KEYS.noir, () => preview(KEYS.noir, (c) => toneFilters.noir(c, noirContrast)), 'Noir')}
        disabled={!currentLayer}
      >
        <Slider label="Contraste" value={noirContrast} min={0} max={100} unit="%" onChange={(v) => { setNoirContrast(v); preview(KEYS.noir, (c) => toneFilters.noir(c, v)); }} />
        <FilterPresetControls
          filterId="noir"
          currentParams={{ contrast: noirContrast }}
          onApply={(p) => {
            const contrast = Number(p.contrast);
            setNoirContrast(contrast);
            preview(KEYS.noir, (c) => toneFilters.noir(c, contrast));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Solarizar"
        active={isPreviewing(KEYS.solarize)}
        onCancel={cancel}
        onApply={() => apply(KEYS.solarize, () => preview(KEYS.solarize, (c) => toneFilters.solarize(c, solarizeThreshold)), 'Solarizar')}
        disabled={!currentLayer}
      >
        <Slider label="Umbral" value={solarizeThreshold} min={0} max={100} unit="%" onChange={(v) => { setSolarizeThreshold(v); preview(KEYS.solarize, (c) => toneFilters.solarize(c, v)); }} />
        <FilterPresetControls
          filterId="solarize"
          currentParams={{ threshold: solarizeThreshold }}
          onApply={(p) => {
            const threshold = Number(p.threshold);
            setSolarizeThreshold(threshold);
            preview(KEYS.solarize, (c) => toneFilters.solarize(c, threshold));
          }}
        />
      </FilterGroup>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-textDim">
      <span className="w-14 shrink-0">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-6 bg-panelLight border border-border rounded" />
    </label>
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

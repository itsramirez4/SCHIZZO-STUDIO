import { useState } from 'react';
import * as geometryFilters from '@/services/geometryFilters.service';
import { Waveform } from '@/services/geometryFilters.service';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import FilterPresetControls from './FilterPresetControls';

const KEYS = { twirl: 'twirl', pinch: 'pinch', wave: 'wave', ripple: 'ripple', lens: 'lens', polar: 'polar' } as const;

/** Real geometric distortion — deliberately named "WarpFilters", not "DistortionFilters" (an
 * existing panel already uses that name for motion-blur/sharpen/pixelate/noise, none of which
 * are geometric warps). */
export default function WarpFilters() {
  const { currentLayer } = useLayers();
  const project = useAppStore((s) => s.project);
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const cx = project ? project.width / 2 : 0;
  const cy = project ? project.height / 2 : 0;
  const maxRadius = project ? Math.min(project.width, project.height) / 2 : 100;

  const [twirlAngle, setTwirlAngle] = useState(90);
  const [twirlRadius, setTwirlRadius] = useState(maxRadius);
  const [pinchStrength, setPinchStrength] = useState(50);
  const [pinchRadius, setPinchRadius] = useState(maxRadius);
  const [waveAmplitude, setWaveAmplitude] = useState(20);
  const [waveLength, setWaveLength] = useState(60);
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [rippleAmplitude, setRippleAmplitude] = useState(15);
  const [rippleLength, setRippleLength] = useState(40);
  const [lensAmount, setLensAmount] = useState(30);
  const [lensVignette, setLensVignette] = useState(0);

  function apply(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Distorsión geométrica</div>

      <FilterGroup
        label="Twirl (remolino)"
        active={isPreviewing(KEYS.twirl)}
        onCancel={cancel}
        onApply={() => apply(KEYS.twirl, () => preview(KEYS.twirl, (c) => geometryFilters.twirl(c, cx, cy, twirlAngle, twirlRadius)), 'Twirl')}
        disabled={!currentLayer}
      >
        <Slider label="Ángulo" value={twirlAngle} min={-360} max={360} onChange={(v) => { setTwirlAngle(v); preview(KEYS.twirl, (c) => geometryFilters.twirl(c, cx, cy, v, twirlRadius)); }} />
        <Slider label="Radio" value={twirlRadius} min={10} max={Math.max(10, maxRadius * 2)} onChange={(v) => { setTwirlRadius(v); preview(KEYS.twirl, (c) => geometryFilters.twirl(c, cx, cy, twirlAngle, v)); }} />
        <FilterPresetControls
          filterId="twirl"
          currentParams={{ angle: twirlAngle, radius: twirlRadius }}
          onApply={(p) => {
            const angle = Number(p.angle);
            const radius = Number(p.radius);
            setTwirlAngle(angle);
            setTwirlRadius(radius);
            preview(KEYS.twirl, (c) => geometryFilters.twirl(c, cx, cy, angle, radius));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Pinch / Spherize"
        active={isPreviewing(KEYS.pinch)}
        onCancel={cancel}
        onApply={() => apply(KEYS.pinch, () => preview(KEYS.pinch, (c) => geometryFilters.pinch(c, cx, cy, pinchStrength / 100, pinchRadius)), 'Pinch')}
        disabled={!currentLayer}
      >
        <Slider label="Fuerza" value={pinchStrength} min={-100} max={100} unit="%" onChange={(v) => { setPinchStrength(v); preview(KEYS.pinch, (c) => geometryFilters.pinch(c, cx, cy, v / 100, pinchRadius)); }} />
        <Slider label="Radio" value={pinchRadius} min={10} max={Math.max(10, maxRadius * 2)} onChange={(v) => { setPinchRadius(v); preview(KEYS.pinch, (c) => geometryFilters.pinch(c, cx, cy, pinchStrength / 100, v)); }} />
        <p className="text-[9px] text-textDim">Positivo pellizca hacia el centro, negativo abomba hacia afuera.</p>
        <FilterPresetControls
          filterId="pinch"
          currentParams={{ strength: pinchStrength, radius: pinchRadius }}
          onApply={(p) => {
            const strength = Number(p.strength);
            const radius = Number(p.radius);
            setPinchStrength(strength);
            setPinchRadius(radius);
            preview(KEYS.pinch, (c) => geometryFilters.pinch(c, cx, cy, strength / 100, radius));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Ola (horizontal)"
        active={isPreviewing(KEYS.wave)}
        onCancel={cancel}
        onApply={() => apply(KEYS.wave, () => preview(KEYS.wave, (c) => geometryFilters.wave(c, waveAmplitude, waveLength, waveform)), 'Ola')}
        disabled={!currentLayer}
      >
        <Slider label="Amplitud" value={waveAmplitude} min={0} max={100} unit="px" onChange={(v) => { setWaveAmplitude(v); preview(KEYS.wave, (c) => geometryFilters.wave(c, v, waveLength, waveform)); }} />
        <Slider label="Longitud" value={waveLength} min={5} max={300} unit="px" onChange={(v) => { setWaveLength(v); preview(KEYS.wave, (c) => geometryFilters.wave(c, waveAmplitude, v, waveform)); }} />
        <WaveformSelect value={waveform} onChange={(v) => { setWaveform(v); preview(KEYS.wave, (c) => geometryFilters.wave(c, waveAmplitude, waveLength, v)); }} />
        <FilterPresetControls
          filterId="wave"
          currentParams={{ amplitude: waveAmplitude, wavelength: waveLength, waveform }}
          onApply={(p) => {
            const amplitude = Number(p.amplitude);
            const wavelength = Number(p.wavelength);
            const wf = p.waveform as Waveform;
            setWaveAmplitude(amplitude);
            setWaveLength(wavelength);
            setWaveform(wf);
            preview(KEYS.wave, (c) => geometryFilters.wave(c, amplitude, wavelength, wf));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Ondulación (radial)"
        active={isPreviewing(KEYS.ripple)}
        onCancel={cancel}
        onApply={() => apply(KEYS.ripple, () => preview(KEYS.ripple, (c) => geometryFilters.ripple(c, cx, cy, rippleAmplitude, rippleLength, waveform)), 'Ondulación')}
        disabled={!currentLayer}
      >
        <Slider label="Amplitud" value={rippleAmplitude} min={0} max={80} unit="px" onChange={(v) => { setRippleAmplitude(v); preview(KEYS.ripple, (c) => geometryFilters.ripple(c, cx, cy, v, rippleLength, waveform)); }} />
        <Slider label="Longitud" value={rippleLength} min={5} max={200} unit="px" onChange={(v) => { setRippleLength(v); preview(KEYS.ripple, (c) => geometryFilters.ripple(c, cx, cy, rippleAmplitude, v, waveform)); }} />
        <FilterPresetControls
          filterId="ripple"
          currentParams={{ amplitude: rippleAmplitude, wavelength: rippleLength }}
          onApply={(p) => {
            const amplitude = Number(p.amplitude);
            const wavelength = Number(p.wavelength);
            setRippleAmplitude(amplitude);
            setRippleLength(wavelength);
            preview(KEYS.ripple, (c) => geometryFilters.ripple(c, cx, cy, amplitude, wavelength, waveform));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Distorsión de lente"
        active={isPreviewing(KEYS.lens)}
        onCancel={cancel}
        onApply={() => apply(KEYS.lens, () => preview(KEYS.lens, (c) => geometryFilters.lensDistortion(c, lensAmount, lensVignette)), 'Distorsión de lente')}
        disabled={!currentLayer}
      >
        <Slider label="Cantidad" value={lensAmount} min={-100} max={100} onChange={(v) => { setLensAmount(v); preview(KEYS.lens, (c) => geometryFilters.lensDistortion(c, v, lensVignette)); }} />
        <Slider label="Viñeta" value={lensVignette} min={0} max={100} unit="%" onChange={(v) => { setLensVignette(v); preview(KEYS.lens, (c) => geometryFilters.lensDistortion(c, lensAmount, v)); }} />
        <p className="text-[9px] text-textDim">Positivo = ojo de pez (barril), negativo = cojín.</p>
        <FilterPresetControls
          filterId="lensDistortion"
          currentParams={{ amount: lensAmount, vignette: lensVignette }}
          onApply={(p) => {
            const amount = Number(p.amount);
            const vignette = Number(p.vignette);
            setLensAmount(amount);
            setLensVignette(vignette);
            preview(KEYS.lens, (c) => geometryFilters.lensDistortion(c, amount, vignette));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Coordenadas polares"
        active={isPreviewing(KEYS.polar)}
        onCancel={cancel}
        onApply={() => apply(KEYS.polar, () => preview(KEYS.polar, (c) => geometryFilters.polarCoordinates(c, 'toPolar')), 'Coordenadas polares')}
        disabled={!currentLayer}
      >
        <div className="flex gap-1.5">
          <button
            onClick={() => apply(KEYS.polar, () => preview(KEYS.polar, (c) => geometryFilters.polarCoordinates(c, 'toPolar')), 'Coordenadas polares')}
            className="flex-1 text-[10px] bg-panelLight rounded py-1"
          >
            Rectangular → Polar
          </button>
          <button
            onClick={() => apply(KEYS.polar, () => preview(KEYS.polar, (c) => geometryFilters.polarCoordinates(c, 'toRectangular')), 'Coordenadas polares')}
            className="flex-1 text-[10px] bg-panelLight rounded py-1"
          >
            Polar → Rectangular
          </button>
        </div>
      </FilterGroup>
    </div>
  );
}

function WaveformSelect({ value, onChange }: { value: Waveform; onChange: (v: Waveform) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Waveform)} className="w-full bg-panel border border-border rounded text-[10px] px-1.5 py-1">
      <option value="sine">Senoidal</option>
      <option value="triangle">Triangular</option>
      <option value="sawtooth">Diente de sierra</option>
      <option value="square">Cuadrada</option>
    </select>
  );
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-textDim mb-0.5">
        <span>{label}</span>
        <span>{Math.round(value)}{unit}</span>
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

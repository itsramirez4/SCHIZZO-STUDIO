import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import * as layerService from '@/services/layer.service';
import { useLayers } from '@/hooks/useLayers';
import { useAppStore } from '@/store/appStore';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import FilterPresetControls from './FilterPresetControls';

const KEY = 'blur';
const KEYS = { radial: 'radialBlur', zoom: 'zoomBlur', tiltShift: 'tiltShift' } as const;

export default function BlurFilter() {
  const { currentLayer } = useLayers();
  const project = useAppStore((s) => s.project);
  const pushHistory = useAppStore((s) => s.pushHistory);
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();
  const [radius, setRadius] = useState(4);
  const [gaussian, setGaussian] = useState(false);

  const cx = project ? project.width / 2 : 0;
  const cy = project ? project.height / 2 : 0;
  const [radialAmount, setRadialAmount] = useState(30);
  const [zoomAmount, setZoomAmount] = useState(30);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [tiltOffset, setTiltOffset] = useState(0);
  const [tiltFocusWidth, setTiltFocusWidth] = useState(200);
  const [tiltBlur, setTiltBlur] = useState(10);

  function applyFilter(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

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

      <FilterGroup
        label="Desenfoque radial (giro)"
        active={isPreviewing(KEYS.radial)}
        onCancel={cancel}
        onApply={() => applyFilter(KEYS.radial, () => preview(KEYS.radial, (c) => filterService.radialBlur(c, cx, cy, radialAmount)), 'Desenfoque radial')}
        disabled={!currentLayer}
      >
        <Slider label="Cantidad" value={radialAmount} min={1} max={100} unit="%" onChange={(v) => { setRadialAmount(v); preview(KEYS.radial, (c) => filterService.radialBlur(c, cx, cy, v)); }} />
        <FilterPresetControls
          filterId="radialBlur"
          currentParams={{ amount: radialAmount }}
          onApply={(p) => {
            const amount = Number(p.amount);
            setRadialAmount(amount);
            preview(KEYS.radial, (c) => filterService.radialBlur(c, cx, cy, amount));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Desenfoque de zoom"
        active={isPreviewing(KEYS.zoom)}
        onCancel={cancel}
        onApply={() => applyFilter(KEYS.zoom, () => preview(KEYS.zoom, (c) => filterService.zoomBlur(c, cx, cy, zoomAmount)), 'Desenfoque de zoom')}
        disabled={!currentLayer}
      >
        <Slider label="Cantidad" value={zoomAmount} min={1} max={100} unit="%" onChange={(v) => { setZoomAmount(v); preview(KEYS.zoom, (c) => filterService.zoomBlur(c, cx, cy, v)); }} />
        <FilterPresetControls
          filterId="zoomBlur"
          currentParams={{ amount: zoomAmount }}
          onApply={(p) => {
            const amount = Number(p.amount);
            setZoomAmount(amount);
            preview(KEYS.zoom, (c) => filterService.zoomBlur(c, cx, cy, amount));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Tilt-shift (miniatura)"
        active={isPreviewing(KEYS.tiltShift)}
        onCancel={cancel}
        onApply={() => applyFilter(KEYS.tiltShift, () => preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, tiltAngle, tiltOffset, tiltFocusWidth, tiltBlur)), 'Tilt-shift')}
        disabled={!currentLayer}
      >
        <Slider label="Ángulo" value={tiltAngle} min={0} max={180} onChange={(v) => { setTiltAngle(v); preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, v, tiltOffset, tiltFocusWidth, tiltBlur)); }} />
        <Slider label="Posición" value={tiltOffset} min={-400} max={400} unit="px" onChange={(v) => { setTiltOffset(v); preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, tiltAngle, v, tiltFocusWidth, tiltBlur)); }} />
        <Slider label="Ancho de foco" value={tiltFocusWidth} min={20} max={600} unit="px" onChange={(v) => { setTiltFocusWidth(v); preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, tiltAngle, tiltOffset, v, tiltBlur)); }} />
        <Slider label="Desenfoque" value={tiltBlur} min={1} max={40} unit="px" onChange={(v) => { setTiltBlur(v); preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, tiltAngle, tiltOffset, tiltFocusWidth, v)); }} />
        <FilterPresetControls
          filterId="tiltShift"
          currentParams={{ angle: tiltAngle, offset: tiltOffset, focusWidth: tiltFocusWidth, blur: tiltBlur }}
          onApply={(p) => {
            const angle = Number(p.angle);
            const offset = Number(p.offset);
            const focusWidth = Number(p.focusWidth);
            const blur = Number(p.blur);
            setTiltAngle(angle);
            setTiltOffset(offset);
            setTiltFocusWidth(focusWidth);
            setTiltBlur(blur);
            preview(KEYS.tiltShift, (c) => filterService.tiltShift(c, angle, offset, focusWidth, blur));
          }}
        />
      </FilterGroup>
    </div>
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
    <div className="space-y-1.5 pt-2">
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

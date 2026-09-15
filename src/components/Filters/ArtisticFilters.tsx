import { useState } from 'react';
import * as filterService from '@/services/filter.service';
import * as geometryFilters from '@/services/geometryFilters.service';
import { useLayers } from '@/hooks/useLayers';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import FilterPresetControls from './FilterPresetControls';

const KEYS = {
  oil: 'oil',
  charcoal: 'charcoal',
  posterize: 'posterize',
  sepia: 'sepia',
  edges: 'edges',
  bloom: 'bloom',
  pencil: 'pencil',
  toon: 'toon',
  mosaic: 'mosaic',
  crystallize: 'crystallize',
} as const;

export default function ArtisticFilters() {
  const { currentLayer } = useLayers();
  const { preview, commit, cancel, isPreviewing } = useFilterPreview();

  const [oilRadius, setOilRadius] = useState(3);
  const [charcoalStrength, setCharcoalStrength] = useState(2);
  const [posterizeLevels, setPosterizeLevels] = useState(4);
  const [sepiaIntensity, setSepiaIntensity] = useState(80);
  const [edgeThreshold, setEdgeThreshold] = useState(80);
  const [bloomRadius, setBloomRadius] = useState(8);
  const [bloomStrength, setBloomStrength] = useState(60);
  const [pencilBlur, setPencilBlur] = useState(8);
  const [pencilDarkness, setPencilDarkness] = useState(90);
  const [toonLevels, setToonLevels] = useState(5);
  const [toonEdge, setToonEdge] = useState(80);
  const [mosaicTile, setMosaicTile] = useState(16);
  const [mosaicGrout, setMosaicGrout] = useState(2);
  const [mosaicGroutColor, setMosaicGroutColor] = useState('#101010');
  const [crystallizeSize, setCrystallizeSize] = useState(20);

  function apply(key: string, run: () => void, label: string) {
    if (!currentLayer) return;
    if (!isPreviewing(key)) run();
    commit(label);
  }

  return (
    <div className="space-y-4 mt-4 pt-3 border-t border-border">
      <div className="text-xs text-textDim uppercase tracking-wide font-medium">Efectos artísticos</div>

      <FilterGroup
        label="Óleo"
        active={isPreviewing(KEYS.oil)}
        onCancel={cancel}
        onApply={() => apply(KEYS.oil, () => preview(KEYS.oil, (c) => filterService.oilPaint(c, oilRadius)), 'Óleo')}
        disabled={!currentLayer}
      >
        <Slider label="Radio" value={oilRadius} min={1} max={6} unit="px" onChange={(v) => { setOilRadius(v); preview(KEYS.oil, (c) => filterService.oilPaint(c, v)); }} />
      </FilterGroup>

      <FilterGroup
        label="Carboncillo"
        active={isPreviewing(KEYS.charcoal)}
        onCancel={cancel}
        onApply={() => apply(KEYS.charcoal, () => preview(KEYS.charcoal, (c) => filterService.charcoal(c, charcoalStrength)), 'Carboncillo')}
        disabled={!currentLayer}
      >
        <Slider label="Intensidad" value={charcoalStrength} min={0.5} max={5} step={0.5} onChange={(v) => { setCharcoalStrength(v); preview(KEYS.charcoal, (c) => filterService.charcoal(c, v)); }} />
      </FilterGroup>

      <FilterGroup
        label="Posterizar"
        active={isPreviewing(KEYS.posterize)}
        onCancel={cancel}
        onApply={() => apply(KEYS.posterize, () => preview(KEYS.posterize, (c) => filterService.posterize(c, posterizeLevels)), 'Posterizar')}
        disabled={!currentLayer}
      >
        <Slider label="Niveles" value={posterizeLevels} min={2} max={16} onChange={(v) => { setPosterizeLevels(v); preview(KEYS.posterize, (c) => filterService.posterize(c, v)); }} />
      </FilterGroup>

      <FilterGroup
        label="Sepia"
        active={isPreviewing(KEYS.sepia)}
        onCancel={cancel}
        onApply={() => apply(KEYS.sepia, () => preview(KEYS.sepia, (c) => filterService.sepia(c, sepiaIntensity / 100)), 'Sepia')}
        disabled={!currentLayer}
      >
        <Slider label="Intensidad" value={sepiaIntensity} min={0} max={100} unit="%" onChange={(v) => { setSepiaIntensity(v); preview(KEYS.sepia, (c) => filterService.sepia(c, v / 100)); }} />
      </FilterGroup>

      <FilterGroup
        label="Detección de bordes"
        active={isPreviewing(KEYS.edges)}
        onCancel={cancel}
        onApply={() => apply(KEYS.edges, () => preview(KEYS.edges, (c) => filterService.edgeDetection(c, edgeThreshold)), 'Detección de bordes')}
        disabled={!currentLayer}
      >
        <Slider label="Umbral" value={edgeThreshold} min={10} max={300} onChange={(v) => { setEdgeThreshold(v); preview(KEYS.edges, (c) => filterService.edgeDetection(c, v)); }} />
      </FilterGroup>

      <FilterGroup
        label="Resplandor (bloom)"
        active={isPreviewing(KEYS.bloom)}
        onCancel={cancel}
        onApply={() => apply(KEYS.bloom, () => preview(KEYS.bloom, (c) => filterService.bloom(c, bloomRadius, bloomStrength / 100)), 'Resplandor')}
        disabled={!currentLayer}
      >
        <Slider label="Radio" value={bloomRadius} min={2} max={30} unit="px" onChange={(v) => { setBloomRadius(v); preview(KEYS.bloom, (c) => filterService.bloom(c, v, bloomStrength / 100)); }} />
        <Slider label="Fuerza" value={bloomStrength} min={0} max={150} unit="%" onChange={(v) => { setBloomStrength(v); preview(KEYS.bloom, (c) => filterService.bloom(c, bloomRadius, v / 100)); }} />
      </FilterGroup>

      <FilterGroup
        label="Boceto a lápiz"
        active={isPreviewing(KEYS.pencil)}
        onCancel={cancel}
        onApply={() => apply(KEYS.pencil, () => preview(KEYS.pencil, (c) => geometryFilters.pencilSketch(c, pencilBlur, pencilDarkness)), 'Boceto a lápiz')}
        disabled={!currentLayer}
      >
        <Slider label="Suavidad" value={pencilBlur} min={1} max={30} unit="px" onChange={(v) => { setPencilBlur(v); preview(KEYS.pencil, (c) => geometryFilters.pencilSketch(c, v, pencilDarkness)); }} />
        <Slider label="Oscuridad" value={pencilDarkness} min={10} max={200} unit="%" onChange={(v) => { setPencilDarkness(v); preview(KEYS.pencil, (c) => geometryFilters.pencilSketch(c, pencilBlur, v)); }} />
        <FilterPresetControls
          filterId="pencilSketch"
          currentParams={{ blur: pencilBlur, darkness: pencilDarkness }}
          onApply={(p) => {
            const blur = Number(p.blur);
            const darkness = Number(p.darkness);
            setPencilBlur(blur);
            setPencilDarkness(darkness);
            preview(KEYS.pencil, (c) => geometryFilters.pencilSketch(c, blur, darkness));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Cómic (cel-shading)"
        active={isPreviewing(KEYS.toon)}
        onCancel={cancel}
        onApply={() => apply(KEYS.toon, () => preview(KEYS.toon, (c) => geometryFilters.toonShading(c, toonLevels, toonEdge)), 'Cómic')}
        disabled={!currentLayer}
      >
        <Slider label="Niveles de color" value={toonLevels} min={2} max={12} onChange={(v) => { setToonLevels(v); preview(KEYS.toon, (c) => geometryFilters.toonShading(c, v, toonEdge)); }} />
        <Slider label="Umbral de bordes" value={toonEdge} min={10} max={300} onChange={(v) => { setToonEdge(v); preview(KEYS.toon, (c) => geometryFilters.toonShading(c, toonLevels, v)); }} />
        <FilterPresetControls
          filterId="toonShading"
          currentParams={{ levels: toonLevels, edge: toonEdge }}
          onApply={(p) => {
            const levels = Number(p.levels);
            const edge = Number(p.edge);
            setToonLevels(levels);
            setToonEdge(edge);
            preview(KEYS.toon, (c) => geometryFilters.toonShading(c, levels, edge));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Mosaico"
        active={isPreviewing(KEYS.mosaic)}
        onCancel={cancel}
        onApply={() => apply(KEYS.mosaic, () => preview(KEYS.mosaic, (c) => geometryFilters.mosaic(c, mosaicTile, mosaicGrout, mosaicGroutColor)), 'Mosaico')}
        disabled={!currentLayer}
      >
        <Slider label="Tamaño" value={mosaicTile} min={4} max={80} unit="px" onChange={(v) => { setMosaicTile(v); preview(KEYS.mosaic, (c) => geometryFilters.mosaic(c, v, mosaicGrout, mosaicGroutColor)); }} />
        <Slider label="Junta" value={mosaicGrout} min={0} max={10} unit="px" onChange={(v) => { setMosaicGrout(v); preview(KEYS.mosaic, (c) => geometryFilters.mosaic(c, mosaicTile, v, mosaicGroutColor)); }} />
        <ColorRow label="Color de junta" value={mosaicGroutColor} onChange={(v) => { setMosaicGroutColor(v); preview(KEYS.mosaic, (c) => geometryFilters.mosaic(c, mosaicTile, mosaicGrout, v)); }} />
        <FilterPresetControls
          filterId="mosaic"
          currentParams={{ tile: mosaicTile, grout: mosaicGrout, groutColor: mosaicGroutColor }}
          onApply={(p) => {
            const tile = Number(p.tile);
            const grout = Number(p.grout);
            const groutColor = String(p.groutColor);
            setMosaicTile(tile);
            setMosaicGrout(grout);
            setMosaicGroutColor(groutColor);
            preview(KEYS.mosaic, (c) => geometryFilters.mosaic(c, tile, grout, groutColor));
          }}
        />
      </FilterGroup>

      <FilterGroup
        label="Cristalizar"
        active={isPreviewing(KEYS.crystallize)}
        onCancel={cancel}
        onApply={() => apply(KEYS.crystallize, () => preview(KEYS.crystallize, (c) => geometryFilters.crystallize(c, crystallizeSize)), 'Cristalizar')}
        disabled={!currentLayer}
      >
        <Slider label="Tamaño de celda" value={crystallizeSize} min={5} max={100} unit="px" onChange={(v) => { setCrystallizeSize(v); preview(KEYS.crystallize, (c) => geometryFilters.crystallize(c, v)); }} />
        <FilterPresetControls
          filterId="crystallize"
          currentParams={{ cellSize: crystallizeSize }}
          onApply={(p) => {
            const cellSize = Number(p.cellSize);
            setCrystallizeSize(cellSize);
            preview(KEYS.crystallize, (c) => geometryFilters.crystallize(c, cellSize));
          }}
        />
      </FilterGroup>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-textDim">
      <span className="w-20 shrink-0">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-6 bg-panelLight border border-border rounded" />
    </label>
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

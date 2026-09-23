import { useState } from 'react';
import { useLayers } from '@/hooks/useLayers';
import ColorAdjustments from './ColorAdjustments';
import LevelsThresholdFilters from './LevelsThresholdFilters';
import CurvesFilter from './CurvesFilter';
import ToneFilters from './ToneFilters';
import ChannelsPanel from './ChannelsPanel';
import BlurFilter from './BlurFilter';
import DistortionFilters from './DistortionFilters';
import WarpFilters from './WarpFilters';
import DisplacementMapFilter from './DisplacementMapFilter';
import MeshWarpFilter from './MeshWarpFilter';
import ArtisticFilters from './ArtisticFilters';
import AtmosphericFilters from './AtmosphericFilters';
import PixelArtFilters from './PixelArtFilters';
import ColorBlindnessFilter from './ColorBlindnessFilter';
import PrintPreviewFilter from './PrintPreviewFilter';
import TraceBitmapPanel from './TraceBitmapPanel';

type Tab = 'adjust' | 'tones' | 'curves' | 'levels' | 'blur' | 'distort' | 'artistic' | 'atmosphere' | 'pixelart' | 'output';

const TABS: { id: Tab; label: string }[] = [
  { id: 'adjust', label: 'Ajustes' },
  { id: 'tones', label: 'Tonos y looks' },
  { id: 'curves', label: 'Curvas' },
  { id: 'levels', label: 'Niveles' },
  { id: 'blur', label: 'Desenfoque' },
  { id: 'distort', label: 'Distorsión' },
  { id: 'artistic', label: 'Artísticos' },
  { id: 'atmosphere', label: 'Atmósfera' },
  { id: 'pixelart', label: 'Pixel art' },
  { id: 'output', label: 'Salida' },
];

/**
 * All 16 filter categories used to render stacked, all at once, all the time — on a normal
 * window that was several screens' worth of sliders to scroll through even to reach something
 * near the bottom (Trazado bitmap, say). Grouped into tabs instead, one category visible at a
 * time, same convention every other tool panel here already uses (ColorToolsPanel, StudyPanel…).
 */
export default function FilterPanel() {
  const { currentLayer } = useLayers();
  const unsupportedLayer =
    currentLayer && currentLayer.type !== 'raster' && currentLayer.type !== 'text' && currentLayer.type !== 'reference';
  const [tab, setTab] = useState<Tab>('adjust');

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-2 text-[11px] border-b-2 ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-textDim hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {unsupportedLayer && (
          <p className="text-[10px] text-amber-400 mb-2">
            Esta capa ({currentLayer.type === 'group' ? 'grupo' : currentLayer.type === 'fill' ? 'de relleno' : 'de ajuste'}) no tiene
            píxeles propios — los filtros no tienen efecto aquí. Elegí una capa normal o de referencia.
          </p>
        )}
        {tab === 'adjust' && (
          <>
            <ColorAdjustments />
            <ChannelsPanel />
          </>
        )}
        {tab === 'tones' && <ToneFilters />}
        {tab === 'curves' && <CurvesFilter />}
        {tab === 'levels' && <LevelsThresholdFilters />}
        {tab === 'blur' && <BlurFilter />}
        {tab === 'distort' && (
          <>
            <DistortionFilters />
            <WarpFilters />
            <DisplacementMapFilter />
            <MeshWarpFilter />
          </>
        )}
        {tab === 'artistic' && <ArtisticFilters />}
        {tab === 'atmosphere' && <AtmosphericFilters />}
        {tab === 'pixelart' && <PixelArtFilters />}
        {tab === 'output' && (
          <>
            <ColorBlindnessFilter />
            <PrintPreviewFilter />
            <TraceBitmapPanel />
          </>
        )}
      </div>
    </div>
  );
}

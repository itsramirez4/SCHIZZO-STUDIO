import ColorAdjustments from './ColorAdjustments';
import LevelsThresholdFilters from './LevelsThresholdFilters';
import CurvesFilter from './CurvesFilter';
import BlurFilter from './BlurFilter';
import DistortionFilters from './DistortionFilters';
import WarpFilters from './WarpFilters';
import ArtisticFilters from './ArtisticFilters';
import ToneFilters from './ToneFilters';
import ChannelsPanel from './ChannelsPanel';
import PixelArtFilters from './PixelArtFilters';
import AtmosphericFilters from './AtmosphericFilters';
import ColorBlindnessFilter from './ColorBlindnessFilter';
import PrintPreviewFilter from './PrintPreviewFilter';
import TraceBitmapPanel from './TraceBitmapPanel';
import DisplacementMapFilter from './DisplacementMapFilter';
import MeshWarpFilter from './MeshWarpFilter';

export default function FilterPanel() {
  return (
    <div className="p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">Filtros</h3>
      <ColorAdjustments />
      <CurvesFilter />
      <LevelsThresholdFilters />
      <ToneFilters />
      <BlurFilter />
      <DistortionFilters />
      <WarpFilters />
      <ArtisticFilters />
      <PixelArtFilters />
      <AtmosphericFilters />
      <ColorBlindnessFilter />
      <PrintPreviewFilter />
      <DisplacementMapFilter />
      <MeshWarpFilter />
      <TraceBitmapPanel />
      <ChannelsPanel />
    </div>
  );
}

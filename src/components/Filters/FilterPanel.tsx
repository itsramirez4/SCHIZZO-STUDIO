import ColorAdjustments from './ColorAdjustments';
import BlurFilter from './BlurFilter';
import DistortionFilters from './DistortionFilters';
import ArtisticFilters from './ArtisticFilters';
import ChannelsPanel from './ChannelsPanel';
import PixelArtFilters from './PixelArtFilters';
import AtmosphericFilters from './AtmosphericFilters';
import ColorBlindnessFilter from './ColorBlindnessFilter';

export default function FilterPanel() {
  return (
    <div className="p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold mb-2 text-textDim uppercase tracking-wide">Filtros</h3>
      <ColorAdjustments />
      <BlurFilter />
      <DistortionFilters />
      <ArtisticFilters />
      <PixelArtFilters />
      <AtmosphericFilters />
      <ColorBlindnessFilter />
      <ChannelsPanel />
    </div>
  );
}

import { v4 as uuid } from 'uuid';
import { LibraryPalette } from '@/types/assetLibrary';

export function createPalette(name: string, colors: string[]): LibraryPalette {
  return {
    id: uuid(),
    name,
    tags: [],
    favorite: false,
    colors: [...colors],
    builtIn: false,
    created: Date.now(),
  };
}

function builtIn(name: string, colors: string[]): LibraryPalette {
  return { ...createPalette(name, colors), builtIn: true };
}

/**
 * Hand-picked starter palettes with plain descriptive names — deliberately NOT presented as
 * "Pantone Color of the Year" or any other real brand's trend forecast, since we have no
 * license or live feed for that and fabricating the attribution would be presenting made-up
 * data as if it came from those companies.
 */
export const BUILT_IN_PALETTES: LibraryPalette[] = [
  builtIn('Amanecer cálido', ['#FF6B6B', '#FF9F43', '#FFC93C', '#FFE66D', '#F7F1E3']),
  builtIn('Profundidades oceánicas', ['#03045E', '#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8']),
  builtIn('Bosque otoñal', ['#582F0E', '#7F4F24', '#936639', '#A68A64', '#B6AD90']),
  builtIn('Sueño pastel', ['#FFD6E8', '#E4C1F9', '#C9E4DE', '#F6EAC2', '#FFCFD2']),
  builtIn('Neón urbano', ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0']),
  builtIn('Tierra y arcilla', ['#7F5539', '#9C6644', '#B08968', '#DDB892', '#E6CCB2']),
  builtIn('Menta y piedra', ['#264653', '#2A9D8F', '#8AB17D', '#E9C46A', '#E76F51']),
];

export interface ColorPalette {
  id: string;
  name: string;
  category: 'material' | 'pastel' | 'neon' | 'grayscale' | 'skin';
  colors: string[];
}

export const colorPalettes: ColorPalette[] = [
  {
    id: 'material-design',
    name: 'Material Design',
    category: 'material',
    colors: [
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
      '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
      '#795548', '#9E9E9E', '#607D8B',
    ],
  },
  {
    id: 'pastel-colors',
    name: 'Pastel',
    category: 'pastel',
    colors: [
      '#FFB3BA', '#FFCCCB', '#FFE0B2', '#FFF9C4', '#B2DFDB', '#B2EBF2', '#B3E5FC', '#BBDEFB',
      '#C5CAE9', '#DCEDC8', '#F0F4C3', '#FFF59D', '#FFCCBC', '#D7CCC8',
    ],
  },
  {
    id: 'neon-colors',
    name: 'Neon',
    category: 'neon',
    colors: [
      '#FF006E', '#FB5607', '#FFBE0B', '#8338EC', '#3A86FF', '#06FFA5', '#FF1493', '#00FF00',
      '#FFD700', '#FF4500', '#00FFFF', '#FF00FF', '#ADFF2F', '#00FA9A', '#FF69B4',
    ],
  },
  {
    id: 'grayscale',
    name: 'Escala de grises',
    category: 'grayscale',
    colors: [
      '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080', '#999999', '#B3B3B3',
      '#CCCCCC', '#E6E6E6', '#FFFFFF',
    ],
  },
  {
    id: 'skin-tones',
    name: 'Tonos de piel',
    category: 'skin',
    colors: [
      '#FDBCB4', '#F7A582', '#F5A372', '#EE9B6D', '#E09064', '#D68B5B', '#D07D54', '#C9704A',
      '#B66C45', '#9B5E44', '#8B5A3C', '#785A46', '#6B4D3E', '#5A3E35', '#4A2E28',
    ],
  },
  {
    id: 'sunset',
    name: 'Atardecer',
    category: 'pastel',
    colors: [
      '#FF6B6B', '#FF8B5B', '#FFB84B', '#FFE66D', '#FFD700', '#FFA500', '#FF7F50', '#FF6347',
      '#DC143C', '#8B0000',
    ],
  },
  {
    id: 'ocean',
    name: 'Océano',
    category: 'pastel',
    colors: [
      '#000080', '#001F3F', '#0074D9', '#0099FF', '#00BFFF', '#00CED1', '#40E0D0', '#7FFFD4',
      '#AFEEEE', '#E0FFFF', '#F0F8FF',
    ],
  },
];

export function getPaletteById(id: string): ColorPalette | undefined {
  return colorPalettes.find((p) => p.id === id);
}

import { RGBA } from './index';

// Reuses the app's existing RGBA object type (r/g/b/a) instead of inventing a new "RGB"
// interface — filter.service.ts already exports an RGB *tuple* type ([r,g,b]) for its own
// palette functions, and a same-named object type here would collide with it everywhere
// both are imported. Alpha is carried through but unused by anything in this module.

export type ColorBlindnessType =
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'monochromacy'
  | 'protanomaly'
  | 'deuteranomaly'
  | 'tritanomaly';

export const COLOR_BLINDNESS_LABELS: Record<ColorBlindnessType, string> = {
  protanopia: 'Protanopia (ceguera al rojo)',
  deuteranopia: 'Deuteranopia (ceguera al verde)',
  tritanopia: 'Tritanopia (ceguera al azul)',
  monochromacy: 'Monocromacía (acromatopsia)',
  protanomaly: 'Protanomalía (rojo débil)',
  deuteranomaly: 'Deuteranomalía (verde débil)',
  tritanomaly: 'Tritanomalía (azul débil)',
};

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'compound'
  | 'shades'
  | 'tints'
  | 'monochromatic';

export const HARMONY_LABELS: Record<HarmonyType, string> = {
  complementary: 'Complementaria',
  analogous: 'Análoga',
  triadic: 'Triádica',
  tetradic: 'Tetrádica',
  compound: 'Compuesta',
  shades: 'Sombras',
  tints: 'Tintes',
  monochromatic: 'Monocromática',
};

export type MoodTheme = 'warm' | 'cool' | 'vibrant' | 'muted' | 'pastel' | 'neon' | 'dark' | 'light' | 'earthy' | 'ocean' | 'sunset' | 'forest';

export const MOOD_LABELS: Record<MoodTheme, string> = {
  warm: 'Cálido',
  cool: 'Frío',
  vibrant: 'Vibrante',
  muted: 'Apagado',
  pastel: 'Pastel',
  neon: 'Neón',
  dark: 'Oscuro',
  light: 'Claro',
  earthy: 'Terroso',
  ocean: 'Océano',
  sunset: 'Atardecer',
  forest: 'Bosque',
};

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface HSVColor {
  h: number;
  s: number;
  v: number;
}

export interface LABColor {
  l: number;
  a: number;
  b: number;
}

export interface CMYKColor {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface ContrastResult {
  ratio: number;
  level: 'fail' | 'AA' | 'AAA';
  largeTextPass: boolean;
  largeTextAAA: boolean;
  smallTextPass: boolean;
  smallTextAAA: boolean;
  description: string;
}

export interface AccessibilityReport {
  contrast: ContrastResult;
  colorBlindDistinguishable: Record<ColorBlindnessType, boolean>;
  recommendations: string[];
  alternativeColors: RGBA[];
}

export interface ExtractedPalette {
  colors: RGBA[];
  method: 'kmeans' | 'dominant';
}

export type { RGBA };

export interface ColorAdjustments {
  brightness: number; // -100 .. 100
  contrast: number; // -100 .. 100
  saturation: number; // -100 .. 100
  hue: number; // -180 .. 180
}

export type FilterType =
  | 'brightness-contrast'
  | 'saturation'
  | 'hue'
  | 'blur'
  | 'gaussian-blur'
  | 'invert'
  | 'desaturate';

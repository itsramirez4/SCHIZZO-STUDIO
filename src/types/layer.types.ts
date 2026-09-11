export type LayerType = 'raster' | 'text' | 'reference' | 'group' | 'adjustment' | 'fill';

/** Non-destructive color adjustments applied to everything stacked below the layer. */
export type AdjustmentType = 'brightness-contrast' | 'hue-saturation' | 'invert' | 'desaturate' | 'posterize' | 'sepia';

export type FillType = 'solid' | 'gradient' | 'pattern';

export interface GradientFill {
  kind: 'linear' | 'radial';
  color1: string;
  color2: string;
  /** Degrees, linear gradients only. */
  angle: number;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Base64 PNG snapshot of the layer's pixel content, used for persistence. */
  dataUrl?: string;
  locked: boolean;
  parent?: string;
  /** Whether a paint mask (in layerService's mask registry) is attached to this layer. */
  hasMask?: boolean;

  // --- Adjustment layers: no pixels of their own, transform everything below instead. ---
  adjustmentType?: AdjustmentType;
  adjustmentParams?: Record<string, number>;

  // --- Fill layers: pixels generated from a solid color, gradient or pattern. ---
  fillType?: FillType;
  fillColor?: string;
  gradient?: GradientFill;
  patternId?: string;
  patternColor?: string;
}

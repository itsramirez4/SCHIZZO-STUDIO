import { LayerEffects } from './layerEffects';
import type { ShapeDraft, VectorFillStyle, VectorStrokeStyle } from './vectorShapes';
import type { PenPath } from '@/services/path.service';

export type LayerType = 'raster' | 'text' | 'reference' | 'group' | 'adjustment' | 'fill' | 'vector';

/** One editable object of a vector layer. The layer's pixels are only a cache re-rendered from these. */
export type VectorObject =
  | { id: string; kind: 'shape'; draft: ShapeDraft; stroke: VectorStrokeStyle; fill: VectorFillStyle }
  | {
      id: string;
      kind: 'text';
      text: string;
      /** Top-left of the (unrotated) text box, in layer pixels. */
      x: number;
      y: number;
      angle: number;
      /** Uniform scale on top of `fontSize`. */
      scale: number;
      font: string;
      fontSize: number;
      weight: 'normal' | 'bold';
      fill: VectorFillStyle;
      stroke: VectorStrokeStyle;
      /** Text effect (emboss, long shadow, neon); the text colour is the fill colour. */
      effect?: 'normal' | 'emboss' | 'longShadow' | 'neon';
    }
  | {
      id: string;
      kind: 'pathText';
      text: string;
      path: PenPath;
      font: string;
      fontSize: number;
      weight: 'normal' | 'bold';
      fill: VectorFillStyle;
      stroke: VectorStrokeStyle;
    }
  | { id: string; kind: 'path'; path: PenPath; stroke: VectorStrokeStyle; fill: VectorFillStyle };

/** Non-destructive color adjustments applied to everything stacked below the layer. */
export type AdjustmentType = 'brightness-contrast' | 'hue-saturation' | 'invert' | 'desaturate' | 'posterize' | 'sepia' | 'levels' | 'threshold';

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
  /** Non-destructive layer styles (drop shadow, glow, bevel, overlays, stroke). */
  effects?: LayerEffects;
  /** Clips this layer's content to the alpha of the nearest preceding non-clipped sibling
   * (its "clip base"), Photoshop-style — walks up the sibling list, so multiple consecutive
   * clipTo layers all clip to the same base. */
  clipTo?: boolean;
  /** When set, this layer's pixel content is the SAME canvas as the layer with this id (a
   * "linked instance") — painting on either one paints on both. Opacity/blendMode/effects/mask
   * stay independent per instance; only the raw pixel content is shared. */
  linkedSourceId?: string;
  /** "Lock transparent pixels" (Photoshop/Krita) — brush/paintbucket/shapes/text only
   * composite onto pixels that already have alpha, and can't raise that alpha, so nothing
   * spills outside the layer's existing silhouette. Doesn't affect the eraser or warp. */
  lockAlpha?: boolean;

  /** Vector layers only: the objects the layer is drawn from (bottom to top). */
  vectorObjects?: VectorObject[];

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

/** Layer styles (Photoshop-style non-destructive effects) — one slot per effect type on a
 * layer, not a repeatable list, since a layer having two drop shadows isn't a meaningful real
 * operation and this keeps the data model (and its persistence) a plain flat object. */

export type EffectType = 'dropShadow' | 'innerShadow' | 'outerGlow' | 'innerGlow' | 'bevel' | 'colorOverlay' | 'gradientOverlay' | 'stroke';

export interface DropShadowSettings {
  enabled: boolean;
  angle: number; // degrees
  distance: number; // px
  spread: number; // 0-100, pre-expands the silhouette before blurring
  size: number; // blur radius, px
  opacity: number; // 0-1
  color: string;
}

export type InnerShadowSettings = DropShadowSettings;

export interface GlowSettings {
  enabled: boolean;
  size: number; // blur radius, px
  spread: number; // 0-100
  opacity: number; // 0-1
  color: string;
}

export interface BevelSettings {
  enabled: boolean;
  style: 'outer' | 'inner' | 'emboss' | 'pillow' | 'stroke';
  size: number; // px, width of the edge band
  softness: number; // blur radius applied before lighting, px
  depth: number; // 0-100, intensity multiplier
  angle: number; // degrees
  altitude: number; // 0-90
  highlightColor: string;
  highlightOpacity: number; // 0-1
  shadowColor: string;
  shadowOpacity: number; // 0-1
}

export interface ColorOverlaySettings {
  enabled: boolean;
  color: string;
  opacity: number; // 0-1
}

export interface GradientOverlaySettings {
  enabled: boolean;
  color1: string;
  color2: string;
  angle: number; // degrees
  opacity: number; // 0-1
}

export interface StrokeSettings {
  enabled: boolean;
  size: number; // px
  position: 'outside' | 'inside' | 'center';
  color: string;
  opacity: number; // 0-1
}

export interface LayerEffects {
  dropShadow?: DropShadowSettings;
  innerShadow?: InnerShadowSettings;
  outerGlow?: GlowSettings;
  innerGlow?: GlowSettings;
  bevel?: BevelSettings;
  colorOverlay?: ColorOverlaySettings;
  gradientOverlay?: GradientOverlaySettings;
  stroke?: StrokeSettings;
}

export const DEFAULT_DROP_SHADOW: DropShadowSettings = {
  enabled: true,
  angle: 135,
  distance: 8,
  spread: 0,
  size: 10,
  opacity: 0.6,
  color: '#000000',
};

export const DEFAULT_GLOW: GlowSettings = {
  enabled: true,
  size: 14,
  spread: 0,
  opacity: 0.75,
  color: '#ffd966',
};

export const DEFAULT_BEVEL: BevelSettings = {
  enabled: true,
  style: 'outer',
  size: 6,
  softness: 3,
  depth: 60,
  angle: 135,
  altitude: 45,
  highlightColor: '#ffffff',
  highlightOpacity: 0.75,
  shadowColor: '#000000',
  shadowOpacity: 0.6,
};

export const DEFAULT_COLOR_OVERLAY: ColorOverlaySettings = { enabled: true, color: '#ff0000', opacity: 1 };
export const DEFAULT_GRADIENT_OVERLAY: GradientOverlaySettings = { enabled: true, color1: '#000000', color2: '#ffffff', angle: 90, opacity: 1 };
export const DEFAULT_STROKE: StrokeSettings = { enabled: true, size: 3, position: 'outside', color: '#000000', opacity: 1 };

export const EFFECT_LABELS: Record<EffectType, string> = {
  dropShadow: 'Sombra paralela',
  innerShadow: 'Sombra interior',
  outerGlow: 'Resplandor exterior',
  innerGlow: 'Resplandor interior',
  bevel: 'Bisel y relieve',
  colorOverlay: 'Superposición de color',
  gradientOverlay: 'Superposición de degradado',
  stroke: 'Contorno',
};

// ===== Layer comps =====

export interface LayerCompState {
  layerId: string;
  visible: boolean;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  effects?: LayerEffects;
}

export interface LayerComp {
  id: string;
  name: string;
  states: LayerCompState[];
  createdAt: string;
  /** Canvas view (zoom/pan) at capture time — makes this a real "scene" (visual state, not just
   * layer properties), restored alongside the layer states when applied. Optional so comps
   * captured before this field existed still load fine. */
  view?: { zoom: number; panX: number; panY: number };
}

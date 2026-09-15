/**
 * A deliberately small slice of the original "Advanced Animation Pro" spec.
 *
 * The spec's Keyframe/PathAnimation system (interpolating per-layer transform, rotation,
 * scale and position over time) has no home in this codebase: `Layer` has no position,
 * rotation or scale — layers are plain raster canvases composited by opacity/blendMode/mask
 * (see layer.types.ts). Building a keyframe track system for properties that don't exist and
 * a renderer doesn't apply would be decorative, not functional, so it — and Path Animation,
 * which depends on the same missing transform system — is left out. What's genuinely buildable
 * on top of the app's REAL animation model (`ProjectAnimation.frames`, each a full layer-set
 * snapshot — see project.types.ts) is scoped down to this.
 */

export interface OnionSkinSettings {
  framesBack: number;
  framesForward: number;
  opacityBack: number;
  opacityForward: number;
  tint: boolean;
}

export const DEFAULT_ONION_SKIN_SETTINGS: OnionSkinSettings = {
  framesBack: 1,
  framesForward: 1,
  opacityBack: 0.25,
  opacityForward: 0.15,
  tint: false,
};

/** Only the easing shapes that meaningfully change a pixel crossfade's timing curve — the
 * pasted spec's other ~20 (elastic/bounce/back/...) are motion-curve refinements for property
 * animation, indistinguishable from each other when the only thing they drive is a blend %. */
export type TweenEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export const TWEEN_EASING_LABELS: Record<TweenEasing, string> = {
  linear: 'Lineal',
  easeIn: 'Entrada',
  easeOut: 'Salida',
  easeInOut: 'Entrada/salida',
};

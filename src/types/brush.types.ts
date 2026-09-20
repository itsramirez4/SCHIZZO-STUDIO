export interface BrushDynamics {
  sizeToPressure: boolean;
  opacityToPressure: boolean;
  angleToDirection: boolean;
  /** Stylus tilt widens the stamp (a pencil held on its side lays down a broader mark). */
  tiltToSize?: boolean;
  /** Pressure → size response curve as flat [x0,y0,x1,y1,…] control points in 0–1 (linear if absent). */
  sizeCurve?: number[];
  /** Pressure → opacity response curve, same format. */
  opacityCurve?: number[];
}

/** A brush that does not lay down paint but runs one of the editing tools (Krita's non-paint engines). */
/** Photoshop "Color Dynamics": how much each stamp's colour varies (all 0–1 except purity, −1…1). */
export interface ColorDynamics {
  /** Random blend between the foreground and background colour. */
  fgBg: number;
  hue: number;
  saturation: number;
  brightness: number;
  /** Global saturation shift: −1 = grey, +1 = fully saturated. */
  purity: number;
  /** New random colour for every stamp instead of once per stroke. */
  perTip: boolean;
}

export type BrushEngine =
  | { kind: 'smudge'; strength: number; paintLoad: number; /** Krita "dulling": paint with the average colour under the brush instead of dragging it. */ dulling?: boolean }
  | { kind: 'deform'; mode: 'push' | 'twirl' | 'pinch' | 'expand' | 'turbulence' | 'smooth'; amount: number }
  | { kind: 'fillPath'; /** Fill rule where the path crosses itself. */ winding: boolean }
  | { kind: 'clone'; /** Match the copied patch to the brightness and colour around it. */ healing?: boolean };

export interface Brush {
  id: string;
  name: string;
  type: 'preset' | 'custom';
  size: number;
  hardness: number;
  opacity: number;
  spacing: number;
  scatter: number;
  angleJitter: number;
  sizeJitter: number;
  texture?: string;
  dynamics?: BrushDynamics;
  color?: string;
  /** 0 (no lag, default/backward-compatible) to 1 (heavy lag) — the actual stamped point
   * trails the real pointer position, smoothing out a shaky freehand line. Optional so
   * existing saved brushes/presets without it just behave as 0, unchanged. */
  smoothing?: number;

  // Asset Library metadata (optional so existing presets/exported .brush files stay valid).
  tags?: string[];
  favorite?: boolean;
  /** Grouping shown in the brush picker (pencil, ink, paint, dry media, texture, ...). */
  category?: string;
  /** Extra tip frames of an animated brush (GIMP .gih); `texture` is frame 0. */
  textures?: string[];
  /** How the next frame is chosen for each stamp. */
  tipSelection?: 'random' | 'incremental';
  /** How much paint each stamp lays down (0–1). When set, `opacity` becomes a ceiling for the whole
   * stroke (Photoshop-style); when absent the brush keeps the classic per-stamp opacity. */
  flow?: number;
  colorDynamics?: ColorDynamics;
  /** Set for smudge / deform / clone brushes: the brush drives that tool instead of painting. */
  engine?: BrushEngine;
  /** Watercolour-style edges, 0–1: paint pools at the rim of the stroke and is thinner in the middle. */
  wetEdges?: number;
  /** Length in px over which a stroke grows from a point to full size (lineart). Applies to the start
   * of freehand strokes and to both ends of the Line and Curve tools. */
  taperStart?: number;
  /** Length in px over which a Line/Curve stroke narrows to a point at its end. */
  taperEnd?: number;
  /** Composite mode used while stamping; 'erase' removes paint instead of adding it. */
  blendMode?: GlobalCompositeOperation | 'erase';
}

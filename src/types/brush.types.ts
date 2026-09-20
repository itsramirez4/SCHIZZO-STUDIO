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
  /** Composite mode used while stamping; 'erase' removes paint instead of adding it. */
  blendMode?: GlobalCompositeOperation | 'erase';
}

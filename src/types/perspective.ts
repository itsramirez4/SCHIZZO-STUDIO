/**
 * Types for Perspective & Symmetry Tools. String literal unions throughout (matching this
 * codebase's convention — ToolType, CloudProvider, etc. — never TS enums), and plain
 * arrays/records everywhere instead of Map, since this data round-trips through
 * JSON.stringify as part of the project file (see project.types.ts's `perspective` field).
 */

export type PerspectiveGridType = 'onePoint' | 'twoPoint' | 'threePoint';

export interface VanishingPoint {
  id: 'left' | 'right' | 'center' | 'top';
  x: number;
  y: number;
  visible: boolean;
  locked: boolean;
  label: string;
  color: string;
}

/** The horizon / eye-level line. Vanishing points of 1- and 2-point perspective live on it. */
export interface HorizonSettings {
  /** Height of the line in canvas pixels (may lie outside the canvas for very high or low views). */
  y: number;
  visible: boolean;
  /** When true the left / right / center vanishing points always stay on the line. */
  linked: boolean;
  color: string;
}

export interface PerspectiveGridSettings {
  type: PerspectiveGridType;
  enabled: boolean;
  points: Partial<Record<VanishingPoint['id'], VanishingPoint>>;
  /** Optional so projects saved before the horizon existed keep loading unchanged. */
  horizon?: HorizonSettings;
  color: string;
  opacity: number;
  divisions: number;
}

export type SymmetryMode =
  | 'none'
  | 'mirrorHorizontal'
  | 'mirrorVertical'
  | 'mirrorBoth'
  | 'mirrorDiagonal'
  | 'radial2'
  | 'radial3'
  | 'radial4'
  | 'radial6'
  | 'radial8'
  | 'kaleidoscope6'
  | 'kaleidoscope8';

export const SYMMETRY_MODE_LABELS: Record<SymmetryMode, string> = {
  none: 'Ninguna',
  mirrorHorizontal: 'Espejo horizontal',
  mirrorVertical: 'Espejo vertical',
  mirrorBoth: 'Espejo ambos ejes',
  mirrorDiagonal: 'Espejo diagonal',
  radial2: 'Radial (2)',
  radial3: 'Radial (3)',
  radial4: 'Radial (4)',
  radial6: 'Radial (6)',
  radial8: 'Radial (8)',
  kaleidoscope6: 'Caleidoscopio (6)',
  kaleidoscope8: 'Caleidoscopio (8)',
};

export interface SymmetrySettings {
  mode: SymmetryMode;
  centerX: number;
  centerY: number;
  enabled: boolean;
  showGuidelines: boolean;
  guidelineColor: string;
  guidelineOpacity: number;
  /** Angle in degrees for `mirrorDiagonal` — the line of reflection through the center. */
  angle: number;
}

export type GuideType = 'vertical' | 'horizontal' | 'diagonal';

export interface Guide {
  id: string;
  type: GuideType;
  x?: number; // vertical: the guide's x position. diagonal: x of the anchor point it passes through.
  y?: number; // horizontal: the guide's y position. diagonal: y of the anchor point.
  angle?: number; // diagonal only: slope in degrees from the x-axis, through (x, y).
  visible: boolean;
  locked: boolean;
  color: string;
}

export type SnapTarget = 'guides' | 'perspectiveGrid' | 'canvas' | 'pixelGrid';

export interface SnapSettings {
  enabled: boolean;
  targets: SnapTarget[];
  tolerance: number; // project-space pixels
}

export interface SnapPoint {
  x: number;
  y: number;
  target: SnapTarget;
}

/** A reusable, cross-project grid configuration (e.g. "Interior 1 punto") — saved globally
 * (see electron/handlers/perspectivePresetsHandler.ts), unlike the grid/guides/symmetry data
 * below which travel with a specific project file. */
export interface PerspectivePreset {
  id: string;
  name: string;
  grid: PerspectiveGridSettings;
}

/** The subset of this feature's state that's saved with the project file (see `Project.perspective`
 * in project.types.ts) — everything an artist would expect to still be there after reopening a
 * file: the perspective grid, guides, and symmetry setup. Snap settings and ruler visibility are
 * deliberately app-wide preferences instead (closer to a tool option than project content). */
export interface PerspectiveProjectData {
  grid: PerspectiveGridSettings;
  guides: Guide[];
  symmetry: SymmetrySettings;
  /** Drawing ruler (optional so projects saved before it existed load unchanged). */
  ruler?: import('@/services/rulerAssist.service').RulerSettings;
}

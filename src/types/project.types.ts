import { Layer } from './layer.types';
import { Brush } from './brush.types';
import { PerspectiveProjectData } from './perspective';
import { LayerComp } from './layerEffects';

export type ProjectType = 'drawing' | 'pixelart' | 'hybrid' | 'comic' | '3d';

export interface ProjectSettings {
  gridVisible: boolean;
  gridSize: number;
  snapToGrid: boolean;
  rulerVisible: boolean;
  transparentBg: boolean;
  /** Solid canvas background color, used when `transparentBg` is false. Optional so projects
   * saved before this setting existed still load fine, falling back to white. */
  backgroundColor?: string;
}

export interface AnimationFrame {
  id: string;
  durationMs: number;
  /**
   * Only authoritative for frames OTHER than the active one — the active frame's real,
   * live layer state is `project.layers` itself. Switching frames writes `project.layers`
   * back here before loading the target frame's layers, so this can go briefly stale
   * while a frame is active; never read it for the current frame without accounting for that.
   */
  layers: Layer[];
}

export interface ProjectAnimation {
  frames: AnimationFrame[];
  currentFrameIndex: number;
  fps: number;
  loop: boolean;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  width: number;
  height: number;
  dpi: number;
  created: string;
  lastModified: string;
  layers: Layer[];
  brushes: Brush[];
  settings: ProjectSettings;
  filePath?: string;
  animation?: ProjectAnimation;
  /** Perspective grid, guides and symmetry setup — optional so older saved files (without this
   * field) still load fine; consumers fall back to defaults when it's absent. */
  perspective?: PerspectiveProjectData;
  /** Construction guides (face, figure, room...) placed over the canvas; saved with the project. */
  studyGuides?: import('@/services/studyGuides.service').StudyGuide[];
  /** Reference photos that belong to this project only (the global library is separate). */
  references?: import('./references').ReferenceImage[];
  /** Palettes that belong to this project only. */
  palettes?: import('./assetLibrary').LibraryPalette[];
  /** Named snapshots of per-layer visibility/opacity/blendMode/effects — "layer comps". */
  layerComps?: LayerComp[];
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  gridVisible: false,
  gridSize: 32,
  snapToGrid: false,
  rulerVisible: false,
  transparentBg: true,
  backgroundColor: '#ffffff',
};

import { Layer } from './layer.types';
import { Brush } from './brush.types';

export type ProjectType = 'drawing' | 'pixelart' | 'hybrid';

export interface ProjectSettings {
  gridVisible: boolean;
  gridSize: number;
  snapToGrid: boolean;
  rulerVisible: boolean;
  transparentBg: boolean;
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
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  gridVisible: false,
  gridSize: 32,
  snapToGrid: false,
  rulerVisible: false,
  transparentBg: true,
};

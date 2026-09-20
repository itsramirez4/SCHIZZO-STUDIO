export * from './brush.types';
export * from './layer.types';
export * from './layerEffects';
export * from './filterPresets';
export * from './project.types';
export * from './filter.types';

export interface HistoryState {
  id: string;
  action: string;
  timestamp: string;
  layerId?: string;
}

export type ToolType =
  | 'brush'
  | 'eraser'
  | 'selection'
  | 'lasso'
  | 'magicWand'
  | 'paintbucket'
  | 'gradient'
  | 'text'
  | 'eyedropper'
  | 'zoom'
  | 'pan'
  | 'transform'
  | 'pen'
  | 'shapeRect'
  | 'shapeEllipse'
  | 'shapePolygon'
  | 'shapeStar'
  | 'vectorText'
  | 'warp'
  | 'smudge'
  | 'line'
  | 'curve'
  | 'vectorSelect'
  | 'clone';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

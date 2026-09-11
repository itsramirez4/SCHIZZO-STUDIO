export * from './brush.types';
export * from './layer.types';
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
  | 'paintbucket'
  | 'text'
  | 'eyedropper'
  | 'zoom'
  | 'pan'
  | 'transform'
  | 'pen';

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

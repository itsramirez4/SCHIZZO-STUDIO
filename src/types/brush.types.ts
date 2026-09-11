export interface BrushDynamics {
  sizeToPressure: boolean;
  opacityToPressure: boolean;
  angleToDirection: boolean;
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
}

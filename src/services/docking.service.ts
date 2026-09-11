import { PanelPosition } from '@/types/workspace';

/**
 * Deliberately just the two primitives a real free-floating panel needs (move/resize
 * within bounds, snapped to a grid). Cross-panel edge-docking, tab-grouping, and
 * auto-hide-on-edge are real additional features a docking system like Blender's has,
 * but each is a meaningful chunk of interaction design on its own — scoped out here to
 * ship a solid, correct core (drag/resize/collapse/pin/close + presets + persistence)
 * rather than a shakier attempt at all of it at once.
 */

export function snapToGrid(position: PanelPosition, gridSize: number): PanelPosition {
  if (gridSize <= 1) return position;
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
    width: Math.round(position.width / gridSize) * gridSize,
    height: Math.round(position.height / gridSize) * gridSize,
  };
}

export function constrainToViewport(
  position: PanelPosition,
  viewportWidth: number,
  viewportHeight: number,
  minWidth: number,
  minHeight: number
): PanelPosition {
  const width = Math.max(minWidth, Math.min(position.width, viewportWidth));
  const height = Math.max(minHeight, Math.min(position.height, viewportHeight));
  return {
    width,
    height,
    x: Math.max(0, Math.min(position.x, viewportWidth - width)),
    y: Math.max(0, Math.min(position.y, viewportHeight - height)),
  };
}

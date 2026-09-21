import { HorizonSettings, PerspectiveGridSettings, PerspectiveGridType, VanishingPoint } from '@/types/perspective';

/** The vanishing points that sit on the horizon (the "top" one of 3-point perspective does not). */
export const HORIZON_POINT_IDS: VanishingPoint['id'][] = ['left', 'right', 'center'];

export const DEFAULT_HORIZON_COLOR = '#ffd43b';

/** The grid's horizon, or a hidden, unlinked default derived from where its points already are. */
export function resolveHorizon(grid: PerspectiveGridSettings, canvasHeight: number): HorizonSettings {
  if (grid.horizon) return grid.horizon;
  const p = grid.points.center ?? grid.points.left ?? grid.points.right;
  return { y: p?.y ?? canvasHeight / 2, visible: false, linked: false, color: DEFAULT_HORIZON_COLOR };
}

/** Moves the horizon and, when it is linked, drags every (unlocked) horizon vanishing point onto it. */
export function applyHorizonY(grid: PerspectiveGridSettings, y: number, canvasHeight: number): PerspectiveGridSettings {
  const horizon = { ...resolveHorizon(grid, canvasHeight), y };
  if (!horizon.linked) return { ...grid, horizon };
  const points = { ...grid.points };
  for (const id of HORIZON_POINT_IDS) {
    const p = points[id];
    if (p && !p.locked) points[id] = { ...p, y };
  }
  return { ...grid, horizon, points };
}

const COLORS: Record<VanishingPoint['id'], string> = {
  left: '#ff6b6b',
  right: '#4a9eff',
  center: '#ffd43b',
  top: '#51cf66',
};

function makeVP(id: VanishingPoint['id'], x: number, y: number, label: string): VanishingPoint {
  return { id, x, y, visible: true, locked: false, label, color: COLORS[id] };
}

export function createDefaultGrid(width: number, height: number, type: PerspectiveGridType = 'onePoint'): PerspectiveGridSettings {
  return {
    type,
    enabled: false,
    points: pointsForType(type, width, height),
    color: '#ffffff',
    opacity: 0.35,
    divisions: 12,
  };
}

/** Seeds the vanishing points a grid type needs, preserving any that already exist (so switching
 * type back and forth doesn't reset points you already dragged into place). */
export function pointsForType(
  type: PerspectiveGridType,
  width: number,
  height: number,
  existing: Partial<Record<VanishingPoint['id'], VanishingPoint>> = {}
): Partial<Record<VanishingPoint['id'], VanishingPoint>> {
  const cx = width / 2;
  const cy = height / 2;
  const points: Partial<Record<VanishingPoint['id'], VanishingPoint>> = {};

  if (type === 'onePoint') {
    points.center = existing.center ?? makeVP('center', cx, cy, 'Punto central');
  } else {
    points.left = existing.left ?? makeVP('left', cx - width * 0.7, cy, 'Punto izquierdo');
    points.right = existing.right ?? makeVP('right', cx + width * 0.7, cy, 'Punto derecho');
    if (type === 'threePoint') {
      points.top = existing.top ?? makeVP('top', cx, cy - height * 1.2, 'Punto vertical');
    }
  }
  return points;
}

/** Draws the convergence-line grid for whichever vanishing points are present and visible —
 * works the same regardless of grid `type`, since it just fans lines from the frame toward
 * every visible point, so 2-point and 3-point naturally combine (3-point is 2-point + the extra
 * vertical-convergence lines from the top point). */
export function drawPerspectiveGrid(ctx: CanvasRenderingContext2D, grid: PerspectiveGridSettings, width: number, height: number) {
  if (!grid.enabled) return;
  const activePoints = Object.values(grid.points).filter((p): p is VanishingPoint => !!p && p.visible);
  if (activePoints.length === 0) return;

  ctx.save();
  ctx.strokeStyle = grid.color;
  ctx.globalAlpha = grid.opacity;
  ctx.lineWidth = 1;

  const divisions = Math.max(2, Math.round(grid.divisions));
  const framePoints = frameAnchorPoints(width, height, divisions);

  for (const vp of activePoints) {
    ctx.beginPath();
    for (const [x, y] of framePoints) {
      ctx.moveTo(x, y);
      ctx.lineTo(vp.x, vp.y);
    }
    ctx.stroke();
  }
  ctx.restore();

  for (const vp of activePoints) drawVanishingPointMarker(ctx, vp);
}

function frameAnchorPoints(width: number, height: number, divisions: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= divisions; i++) {
    const x = (width / divisions) * i;
    points.push([x, 0], [x, height]);
  }
  for (let i = 1; i < divisions; i++) {
    const y = (height / divisions) * i;
    points.push([0, y], [width, y]);
  }
  return points;
}

/** Presets are saved with point positions as fractions (0..1) of the canvas they were created on,
 * so a "1-point interior" preset applies sensibly to a differently-sized canvas later instead of
 * placing its vanishing point somewhere nonsensical (or off-canvas). */
export function gridPointsToFractions(
  points: PerspectiveGridSettings['points'],
  width: number,
  height: number
): PerspectiveGridSettings['points'] {
  const out: PerspectiveGridSettings['points'] = {};
  for (const [id, p] of Object.entries(points)) {
    if (p) out[id as VanishingPoint['id']] = { ...p, x: p.x / width, y: p.y / height };
  }
  return out;
}

export function gridPointsFromFractions(
  points: PerspectiveGridSettings['points'],
  width: number,
  height: number
): PerspectiveGridSettings['points'] {
  const out: PerspectiveGridSettings['points'] = {};
  for (const [id, p] of Object.entries(points)) {
    if (p) out[id as VanishingPoint['id']] = { ...p, x: p.x * width, y: p.y * height };
  }
  return out;
}

function drawVanishingPointMarker(ctx: CanvasRenderingContext2D, vp: VanishingPoint) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = vp.color;
  ctx.beginPath();
  ctx.arc(vp.x, vp.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = vp.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vp.x - 9, vp.y);
  ctx.lineTo(vp.x + 9, vp.y);
  ctx.moveTo(vp.x, vp.y - 9);
  ctx.lineTo(vp.x, vp.y + 9);
  ctx.stroke();
  ctx.restore();
}

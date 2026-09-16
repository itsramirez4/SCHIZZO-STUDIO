import { Guide, PerspectiveGridSettings, SnapPoint, SnapSettings, VanishingPoint } from '@/types/perspective';

interface Pt {
  x: number;
  y: number;
}

/** Distance from `p` to the infinite line through `anchor` at `angleDeg`. */
function distanceToLine(p: Pt, anchor: Pt, angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const relX = p.x - anchor.x;
  const relY = p.y - anchor.y;
  // Perpendicular distance = |cross product of (rel) and (dir)|, dir already unit-length.
  return Math.abs(relX * dirY - relY * dirX);
}

function projectOntoLine(p: Pt, anchor: Pt, angleDeg: number): Pt {
  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const relX = p.x - anchor.x;
  const relY = p.y - anchor.y;
  const t = relX * dirX + relY * dirY;
  return { x: anchor.x + dirX * t, y: anchor.y + dirY * t };
}

/**
 * Finds the single best snap candidate near (x, y), scoped deliberately to shape/transform/guide
 * dragging — NOT the freehand brush, which would feel broken if it kept jumping to a grid.
 * Returns null when nothing is within tolerance.
 */
export function findSnapPoint(
  x: number,
  y: number,
  settings: SnapSettings,
  guides: Guide[],
  grid: PerspectiveGridSettings,
  canvasWidth: number,
  canvasHeight: number,
  pixelGrid?: { enabled: boolean; size: number }
): SnapPoint | null {
  if (!settings.enabled) return null;
  const tolerance = settings.tolerance;
  let best: SnapPoint | null = null;
  let bestDist = tolerance;

  function consider(px: number, py: number, target: SnapPoint['target']) {
    const d = Math.hypot(px - x, py - y);
    if (d < bestDist) {
      bestDist = d;
      best = { x: px, y: py, target };
    }
  }

  if (settings.targets.includes('guides')) {
    for (const g of guides) {
      if (!g.visible) continue;
      if (g.type === 'vertical' && g.x !== undefined && Math.abs(g.x - x) < bestDist) {
        consider(g.x, y, 'guides');
      } else if (g.type === 'horizontal' && g.y !== undefined && Math.abs(g.y - y) < bestDist) {
        consider(x, g.y, 'guides');
      } else if (g.type === 'diagonal' && g.x !== undefined && g.y !== undefined && g.angle !== undefined) {
        if (distanceToLine({ x, y }, { x: g.x, y: g.y }, g.angle) < bestDist) {
          const proj = projectOntoLine({ x, y }, { x: g.x, y: g.y }, g.angle);
          consider(proj.x, proj.y, 'guides');
        }
      }
    }
  }

  if (settings.targets.includes('perspectiveGrid') && grid.enabled) {
    for (const vp of Object.values(grid.points) as (VanishingPoint | undefined)[]) {
      if (vp && vp.visible) consider(vp.x, vp.y, 'perspectiveGrid');
    }
  }

  if (settings.targets.includes('canvas')) {
    const candidates: Pt[] = [
      { x: 0, y: 0 },
      { x: canvasWidth, y: 0 },
      { x: 0, y: canvasHeight },
      { x: canvasWidth, y: canvasHeight },
      { x: canvasWidth / 2, y: canvasHeight / 2 },
      { x: canvasWidth / 2, y: 0 },
      { x: canvasWidth / 2, y: canvasHeight },
      { x: 0, y: canvasHeight / 2 },
      { x: canvasWidth, y: canvasHeight / 2 },
    ];
    for (const c of candidates) consider(c.x, c.y, 'canvas');
  }

  // Pixel-art snapping: pulls the point to the nearest pixel-grid intersection so shape/
  // selection/transform anchors land on exact pixel boundaries instead of sub-pixel positions.
  if (pixelGrid?.enabled && pixelGrid.size > 0) {
    const size = pixelGrid.size;
    consider(Math.round(x / size) * size, Math.round(y / size) * size, 'pixelGrid');
  }

  return best;
}

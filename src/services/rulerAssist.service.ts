/**
 * Drawing rulers: while a ruler is active, freehand strokes (brush, eraser, smudge) are pulled onto
 * it, like a real ruler or a French curve — the hand can wobble and the line still comes out
 * straight. Four kinds:
 *  - 'line':        a straight ruler; a stroke that starts near it follows it.
 *  - 'parallel':    every stroke keeps the ruler's angle, wherever it starts (hatching, panel edges).
 *  - 'ellipse':     a circle / ellipse template; a stroke that starts near its outline follows it.
 *  - 'perspective': strokes follow the line from their start toward a vanishing point of the
 *                   perspective grid (or the vertical, when the grid has no vertical point): the
 *                   direction of the first few pixels of the stroke decides which.
 */
export type RulerKind = 'off' | 'line' | 'parallel' | 'ellipse' | 'perspective';

export const RULER_LABELS: Record<RulerKind, string> = {
  off: 'Sin regla',
  line: 'Regla recta',
  parallel: 'Paralelas',
  ellipse: 'Elipse / círculo',
  perspective: 'Perspectiva',
};

export const RULER_HELP: Record<RulerKind, string> = {
  off: 'Los trazos son libres.',
  line: 'Un trazo que empieza cerca de la regla se pega a ella. Arrastra el centro para moverla y el extremo para girarla.',
  parallel: 'Todos los trazos toman el ángulo de la regla, empiecen donde empiecen: ideal para sombreado en líneas y bordes de viñeta.',
  ellipse: 'Un trazo que empieza cerca del contorno lo sigue. Arrastra el centro, los tiradores de los ejes y gira la elipse desde el eje horizontal.',
  perspective: 'El trazo sigue la línea que va desde donde empieza hasta un punto de fuga (o la vertical): mueve el lápiz hacia donde quieras la línea. Necesita la grilla de perspectiva activa.',
};

export interface RulerSettings {
  kind: RulerKind;
  visible: boolean;
  /** Centre of the line / ellipse, in canvas pixels. */
  x: number;
  y: number;
  /** Angle in degrees (line, parallel) or rotation of the ellipse. */
  angle: number;
  rx: number;
  ry: number;
  /** How close a stroke must start to the ruler to be pulled onto it, in screen pixels. */
  snapDistance: number;
}

export function defaultRuler(width: number, height: number): RulerSettings {
  return { kind: 'off', visible: true, x: width / 2, y: height / 2, angle: 0, rx: Math.round(width * 0.18), ry: Math.round(height * 0.18), snapDistance: 18 };
}

interface Pt {
  x: number;
  y: number;
}

export interface RulerConstraint {
  /** Maps a raw pointer position onto the ruler. */
  apply: (p: Pt) => Pt;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Projects `p` onto the infinite line through `origin` with direction (dx, dy) (unit length). */
function projectOnto(p: Pt, origin: Pt, dx: number, dy: number): Pt {
  const t = (p.x - origin.x) * dx + (p.y - origin.y) * dy;
  return { x: origin.x + dx * t, y: origin.y + dy * t };
}

/** Distance from a point to an ellipse outline (approximate, exact on the axes). */
export function ellipseOutlineDistance(p: Pt, r: RulerSettings): number {
  const { lx, ly } = toLocal(p, r);
  const nd = Math.hypot(lx / r.rx, ly / r.ry);
  return Math.abs(nd - 1) * Math.min(r.rx, r.ry);
}

function toLocal(p: Pt, r: RulerSettings) {
  const c = Math.cos(rad(-r.angle));
  const s = Math.sin(rad(-r.angle));
  const dx = p.x - r.x;
  const dy = p.y - r.y;
  return { lx: dx * c - dy * s, ly: dx * s + dy * c };
}

function nearestOnEllipse(p: Pt, r: RulerSettings): Pt {
  const { lx, ly } = toLocal(p, r);
  const a = Math.atan2(ly / Math.max(1, r.ry), lx / Math.max(1, r.rx));
  const ex = r.rx * Math.cos(a);
  const ey = r.ry * Math.sin(a);
  const c = Math.cos(rad(r.angle));
  const s = Math.sin(rad(r.angle));
  return { x: r.x + ex * c - ey * s, y: r.y + ex * s + ey * c };
}

/**
 * Called when a stroke starts. Returns the constraint to apply to it, or null when the stroke is free
 * (no ruler, or it started too far from a line / ellipse to be pulled onto it).
 * `vanishingPoints` are only used by the perspective ruler; `zoom` turns the screen snap distance
 * into canvas pixels.
 */
export function beginRulerStroke(ruler: RulerSettings, start: Pt, vanishingPoints: Pt[], zoom: number): RulerConstraint | null {
  const snap = ruler.snapDistance / Math.max(0.01, zoom);
  switch (ruler.kind) {
    case 'line': {
      const dx = Math.cos(rad(ruler.angle));
      const dy = Math.sin(rad(ruler.angle));
      const onLine = projectOnto(start, ruler, dx, dy);
      if (Math.hypot(onLine.x - start.x, onLine.y - start.y) > snap) return null;
      return { apply: (p) => projectOnto(p, ruler, dx, dy) };
    }
    case 'parallel': {
      const dx = Math.cos(rad(ruler.angle));
      const dy = Math.sin(rad(ruler.angle));
      return { apply: (p) => projectOnto(p, start, dx, dy) };
    }
    case 'ellipse': {
      if (ellipseOutlineDistance(start, ruler) > snap) return null;
      return { apply: (p) => nearestOnEllipse(p, ruler) };
    }
    case 'perspective': {
      // Candidate directions: toward every vanishing point, plus the vertical when there is no
      // vertical point (2-point perspective keeps its verticals vertical).
      const dirs: Pt[] = [];
      for (const vp of vanishingPoints) {
        const len = Math.hypot(vp.x - start.x, vp.y - start.y);
        if (len > 1) dirs.push({ x: (vp.x - start.x) / len, y: (vp.y - start.y) / len });
      }
      if (dirs.length === 0) return null;
      dirs.push({ x: 0, y: 1 });
      let locked: Pt | null = null;
      // The direction is decided from the pen's net movement after this distance, so a shaky first few pixels
      // do not pick the wrong line.
      const lockDistance = 14 / Math.max(0.01, zoom);
      return {
        apply: (p) => {
          if (!locked) {
            const mx = p.x - start.x;
            const my = p.y - start.y;
            const len = Math.hypot(mx, my);
            if (len < lockDistance) return start;
            // the candidate line that makes the smallest angle with the way the pen moved
            let best = dirs[0];
            let bestCross = Infinity;
            for (const d of dirs) {
              const cross = Math.abs(mx * d.y - my * d.x) / len;
              if (cross < bestCross) {
                bestCross = cross;
                best = d;
              }
            }
            locked = best;
          }
          return projectOnto(p, start, locked.x, locked.y);
        },
      };
    }
    default:
      return null;
  }
}

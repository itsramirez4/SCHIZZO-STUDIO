import { SymmetryMode, SymmetrySettings } from '@/types/perspective';

interface Pt {
  x: number;
  y: number;
}

function rotateAround(p: Pt, c: Pt, angleDeg: number): Pt {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Reflects `p` across the line through `c` at `angleDeg` from the x-axis — the general form of
 * "mirror diagonal": at 45° it reduces to swapping the point's offset axes, which is what a fixed
 * 45°-only version would hardcode, but here the spec's own (previously unused) `angle` field
 * actually drives the result. */
function reflectAcross(p: Pt, c: Pt, angleDeg: number): Pt {
  const theta2 = (2 * angleDeg * Math.PI) / 180;
  const cos2 = Math.cos(theta2);
  const sin2 = Math.sin(theta2);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos2 + dy * sin2, y: c.y + dx * sin2 - dy * cos2 };
}

const RADIAL_COUNTS: Partial<Record<SymmetryMode, number>> = {
  radial2: 2,
  radial3: 3,
  radial4: 4,
  radial6: 6,
  radial8: 8,
};
const KALEIDOSCOPE_COUNTS: Partial<Record<SymmetryMode, number>> = {
  kaleidoscope6: 6,
  kaleidoscope8: 8,
};

/** Every point the brush should ALSO paint at, given one real point — the caller paints the
 * original point itself and additionally paints at each of these. */
export function calculateSymmetricPoints(x: number, y: number, settings: SymmetrySettings): Pt[] {
  const p: Pt = { x, y };
  const c: Pt = { x: settings.centerX, y: settings.centerY };
  const points: Pt[] = [];

  switch (settings.mode) {
    case 'none':
      break;

    case 'mirrorHorizontal':
      points.push({ x: 2 * c.x - p.x, y: p.y });
      break;

    case 'mirrorVertical':
      points.push({ x: p.x, y: 2 * c.y - p.y });
      break;

    case 'mirrorBoth':
      points.push({ x: 2 * c.x - p.x, y: p.y });
      points.push({ x: p.x, y: 2 * c.y - p.y });
      points.push({ x: 2 * c.x - p.x, y: 2 * c.y - p.y });
      break;

    case 'mirrorDiagonal':
      points.push(reflectAcross(p, c, settings.angle));
      break;

    default: {
      const radialN = RADIAL_COUNTS[settings.mode];
      if (radialN) {
        for (let i = 1; i < radialN; i++) points.push(rotateAround(p, c, (360 / radialN) * i));
        break;
      }
      const kN = KALEIDOSCOPE_COUNTS[settings.mode];
      if (kN) {
        // N-fold rotation (skipping i=0, which is just the input point itself — the caller
        // already paints that) PLUS the mirror reflection of each rotated copy, which is what
        // actually makes a kaleidoscope look different from a plain radial pattern. The previous
        // (buggy) version of "kaleidoscope8" only did the rotation half, making it byte-identical
        // to "radial8" despite the different name and intent.
        for (let i = 0; i < kN; i++) {
          const angle = (360 / kN) * i;
          const rotated = i === 0 ? p : rotateAround(p, c, angle);
          if (i > 0) points.push(rotated);
          points.push(reflectAcross(rotated, c, angle / 2));
        }
      }
      break;
    }
  }

  return points;
}

const RADIAL_AXIS_COUNT: Partial<Record<SymmetryMode, number>> = { ...RADIAL_COUNTS, ...KALEIDOSCOPE_COUNTS };

export function drawSymmetryGuidelines(ctx: CanvasRenderingContext2D, settings: SymmetrySettings, width: number, height: number) {
  if (!settings.showGuidelines || settings.mode === 'none') return;

  ctx.save();
  ctx.strokeStyle = settings.guidelineColor;
  ctx.globalAlpha = settings.guidelineOpacity;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  const c = { x: settings.centerX, y: settings.centerY };
  const maxDist = Math.hypot(width, height);

  function axisLine(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad) * maxDist;
    const dy = Math.sin(rad) * maxDist;
    ctx.beginPath();
    ctx.moveTo(c.x - dx, c.y - dy);
    ctx.lineTo(c.x + dx, c.y + dy);
    ctx.stroke();
  }

  // Rays (not full diameters) for the rotational modes: a diameter implies 2-fold symmetry along
  // it, which is wrong to draw for an odd count like radial3.
  function axisRay(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(rad) * maxDist, c.y + Math.sin(rad) * maxDist);
    ctx.stroke();
  }

  switch (settings.mode) {
    case 'mirrorHorizontal':
      axisLine(90);
      break;
    case 'mirrorVertical':
      axisLine(0);
      break;
    case 'mirrorBoth':
      axisLine(0);
      axisLine(90);
      break;
    case 'mirrorDiagonal':
      axisLine(settings.angle);
      break;
    default: {
      const n = RADIAL_AXIS_COUNT[settings.mode];
      if (n) for (let i = 0; i < n; i++) axisRay((360 / n) * i);
    }
  }

  ctx.restore();
}

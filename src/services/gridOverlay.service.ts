export type GridOverlayType = 'ruleOfThirds' | 'goldenRatio' | 'goldenSpiral' | 'diagonals' | 'uniform' | 'perspective1' | 'perspective2';

export const GRID_TYPE_LABELS: Record<GridOverlayType, string> = {
  ruleOfThirds: 'Regla de tercios',
  goldenRatio: 'Proporción áurea',
  goldenSpiral: 'Espiral áurea',
  diagonals: 'Diagonales',
  uniform: 'Grilla uniforme',
  perspective1: 'Perspectiva (1 punto)',
  perspective2: 'Perspectiva (2 puntos)',
};

const PHI = 1.6180339887498949;

export function drawGridOverlay(ctx: CanvasRenderingContext2D, type: GridOverlayType, width: number, height: number, columns: number, rows: number) {
  switch (type) {
    case 'ruleOfThirds':
      drawUniformGrid(ctx, width, height, 3, 3);
      break;
    case 'uniform':
      drawUniformGrid(ctx, width, height, columns, rows);
      break;
    case 'goldenRatio':
      drawGoldenRatio(ctx, width, height);
      break;
    case 'goldenSpiral':
      drawGoldenSpiral(ctx, width, height);
      break;
    case 'diagonals':
      drawDiagonals(ctx, width, height);
      break;
    case 'perspective1':
      drawPerspective1(ctx, width, height);
      break;
    case 'perspective2':
      drawPerspective2(ctx, width, height);
      break;
  }
}

function drawUniformGrid(ctx: CanvasRenderingContext2D, width: number, height: number, cols: number, rows: number) {
  const c = Math.max(1, Math.round(cols));
  const r = Math.max(1, Math.round(rows));
  ctx.beginPath();
  for (let i = 1; i < c; i++) {
    const x = (width / c) * i;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let i = 1; i < r; i++) {
    const y = (height / r) * i;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

/** Two vertical + two horizontal golden-section lines (both directions from each edge) — a
 * single line per axis (as some quick references draw it) is only half the actual grid. */
function drawGoldenRatio(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const x1 = width / PHI;
  const x2 = width - width / PHI;
  const y1 = height / PHI;
  const y2 = height - height / PHI;
  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, height);
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, height);
  ctx.moveTo(0, y1);
  ctx.lineTo(width, y1);
  ctx.moveTo(0, y2);
  ctx.lineTo(width, y2);
  ctx.stroke();
}

/** A true logarithmic spiral whose radius multiplies by φ every quarter turn — the actual
 * defining property of a golden spiral. (A naive radius-grows-linearly-with-angle version is an
 * Archimedean spiral, not a golden one, regardless of what constant you multiply by.) */
function drawGoldenSpiral(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2;
  const b = Math.log(PHI) / (Math.PI / 2);
  const maxAngle = Math.log(maxRadius) / b;

  ctx.beginPath();
  let first = true;
  for (let theta = 0; theta <= maxAngle; theta += 0.05) {
    const radius = Math.exp(b * theta);
    const x = centerX + radius * Math.cos(theta);
    const y = centerY + radius * Math.sin(theta);
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawDiagonals(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();
}

/** One-point perspective: guide lines from the frame's edges/corners converging on a single
 * central vanishing point. */
function drawPerspective1(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vx = width / 2;
  const vy = height / 2;
  const points: [number, number][] = [
    [0, 0], [width / 2, 0], [width, 0],
    [0, height / 2], [width, height / 2],
    [0, height], [width / 2, height], [width, height],
  ];
  ctx.beginPath();
  for (const [x, y] of points) {
    ctx.moveTo(x, y);
    ctx.lineTo(vx, vy);
  }
  ctx.stroke();
}

/** Two-point perspective: guide lines converging toward two off-canvas vanishing points on the
 * horizon, one to each side. */
function drawPerspective2(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const horizonY = height / 2;
  const leftVP = { x: -width * 0.6, y: horizonY };
  const rightVP = { x: width * 1.6, y: horizonY };
  const sampleYs = [0, height * 0.25, height * 0.75, height];

  ctx.beginPath();
  for (const y of sampleYs) {
    ctx.moveTo(0, y);
    ctx.lineTo(rightVP.x, rightVP.y);
    ctx.moveTo(width, y);
    ctx.lineTo(leftVP.x, leftVP.y);
  }
  ctx.stroke();
}

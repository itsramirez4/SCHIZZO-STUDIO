/**
 * Drawing-study guides rendered as canvas overlays: face construction (Loomis-style), figure
 * proportions, ellipse/circle-in-perspective helper and a hand construction scheme. Every
 * guide is described in a unit space where 1 = the guide's full height and (0,0) = the
 * guide's top-centre; the overlay then scales/rotates/flips it into project pixels.
 */

export type StudyGuideKind = 'faceFront' | 'faceSide' | 'figure' | 'ellipse' | 'hand' | 'curvilinear' | 'room' | 'building';

export const STUDY_GUIDE_LABELS: Record<StudyGuideKind, string> = {
  faceFront: 'Rostro de frente (proporciones)',
  faceSide: 'Rostro de perfil (Loomis)',
  figure: 'Figura: proporción en cabezas',
  ellipse: 'Asistente de elipses',
  hand: 'Mano: construcción',
  curvilinear: 'Perspectiva curvilínea (5 puntos)',
  room: 'Generador de habitación (1 punto)',
  building: 'Asistente de edificio (2 puntos)',
};

/** What `StudyGuide.heads` means for each guide that uses it. */
export const GUIDE_COUNT_LABEL: Partial<Record<StudyGuideKind, { label: string; min: number; max: number; step: number }>> = {
  figure: { label: 'Cabezas', min: 6, max: 9, step: 0.5 },
  room: { label: 'Baldosas', min: 3, max: 14, step: 1 },
  building: { label: 'Plantas', min: 1, max: 14, step: 1 },
};

export interface StudyGuide {
  id: string;
  kind: StudyGuideKind;
  x: number;
  y: number;
  /** Full height of the guide, in project pixels. */
  size: number;
  rotation: number;
  opacity: number;
  color: string;
  flipH: boolean;
  /** Ellipse guide only: minor/major axis ratio, 1 = circle, →0 = seen edge-on. */
  ratio: number;
  /** Figure guide only: total figure height in heads (7–9 are the common canons). */
  heads: number;
}

const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const ellipse = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.0005, rx), Math.max(0.0005, ry), 0, 0, Math.PI * 2);
  ctx.stroke();
};

/** Standard face landmarks as fractions of full head height (crown = 0, chin = 1). */
export const FACE_LANDMARKS = {
  hairline: 0.15,
  eyes: 0.5,
  brow: 0.433,
  noseBase: 0.717,
  mouth: 0.81,
  chin: 1,
};

function drawFaceFront(ctx: CanvasRenderingContext2D) {
  const w = 0.72;
  const r = w / 2;
  // Cranium (circle) + tapering jaw.
  ctx.beginPath();
  ctx.moveTo(-r, r);
  ctx.arc(0, r, r, Math.PI, 0);
  ctx.bezierCurveTo(r, 0.68, r * 0.55, 0.92, 0, 1);
  ctx.bezierCurveTo(-r * 0.55, 0.92, -r, 0.68, -r, r);
  ctx.stroke();
  line(ctx, 0, 0, 0, 1);
  const { hairline, brow, eyes, noseBase, mouth, chin } = FACE_LANDMARKS;
  [hairline, brow, eyes, noseBase, mouth, chin].forEach((y) => line(ctx, -r * 1.12, y, r * 1.12, y));
  // Five-eye rule: the face is five eye-widths wide, with one eye-width between the eyes.
  const eyeW = w / 5;
  for (let i = 0; i < 2; i++) {
    const cx = (i === 0 ? -1 : 1) * eyeW;
    ellipse(ctx, cx, eyes, eyeW / 2, eyeW / 5);
  }
  line(ctx, -eyeW / 2, eyes - 0.02, -eyeW / 2, noseBase);
  line(ctx, eyeW / 2, eyes - 0.02, eyeW / 2, noseBase);
  // Ears between brow line and nose base.
  [-1, 1].forEach((sx) => ellipse(ctx, sx * r * 1.04, (brow + noseBase) / 2, 0.03, (noseBase - brow) / 2));
}

function drawFaceSide(ctx: CanvasRenderingContext2D) {
  const r = 0.36;
  ellipse(ctx, 0, r, r, r); // cranial ball
  line(ctx, 0, 0, 0, 1); // vertical through the ear
  const { hairline, brow, noseBase, chin } = FACE_LANDMARKS;
  [hairline, brow, noseBase, chin].forEach((y) => line(ctx, -r * 1.1, y, r * 1.2, y));
  // Face plane: forehead → brow → nose base → chin, sliced off the front of the ball.
  ctx.beginPath();
  ctx.moveTo(r * 0.72, hairline + 0.05);
  ctx.lineTo(r * 0.95, brow);
  ctx.lineTo(r * 1.15, noseBase);
  ctx.lineTo(r * 0.85, chin);
  ctx.stroke();
  // Jaw line from below the ear to the chin, and the ear box.
  line(ctx, -r * 0.05, 0.62, r * 0.85, chin);
  ctx.strokeRect(-r * 0.62, brow, r * 0.55, noseBase - brow);
}

function drawFigure(ctx: CanvasRenderingContext2D, heads: number) {
  const unit = 1 / heads;
  const halfW = 0.2;
  ellipse(ctx, 0, unit / 2, unit * 0.36, unit * 0.5); // head
  line(ctx, 0, 0, 0, 1);
  for (let i = 0; i <= Math.floor(heads); i++) {
    const y = i * unit;
    line(ctx, -halfW * (i === 0 ? 0.6 : 1), y, halfW * (i === 0 ? 0.6 : 1), y);
    if (i > 0) {
      ctx.save();
      ctx.scale(1, 1);
      ctx.font = `${unit * 0.28}px sans-serif`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(String(i), halfW * 1.08, y - unit * 0.05);
      ctx.restore();
    }
  }
  // Canon landmarks (approximate, for an idealised adult figure): shoulders, nipples, navel, crotch.
  const marks: [number, string][] = [
    [0.19, 'hombros'],
    [0.28, 'pezones'],
    [0.375, 'ombligo'],
    [0.5, 'entrepierna'],
  ];
  ctx.save();
  ctx.setLineDash([0.012, 0.012]);
  marks.forEach(([y]) => line(ctx, -halfW * 0.85, y * (heads === 8 ? 1 : 1), halfW * 0.85, y));
  ctx.restore();
}

function drawEllipseGuide(ctx: CanvasRenderingContext2D, ratio: number) {
  const r = 0.5;
  const cy = 0.5;
  ellipse(ctx, 0, cy, r, r * ratio);
  line(ctx, -r, cy, r, cy); // major axis
  line(ctx, 0, cy - r * ratio, 0, cy + r * ratio); // minor axis (always perpendicular to the viewing direction of the circle)
  // Bounding box (the square the circle is inscribed in, foreshortened).
  ctx.save();
  ctx.setLineDash([0.012, 0.012]);
  ctx.strokeRect(-r, cy - r * ratio, r * 2, r * 2 * ratio);
  ctx.restore();
}

function drawHand(ctx: CanvasRenderingContext2D) {
  // Palm as a square block of side ~0.42, fingers ≈ palm length (middle finger), wrist below.
  const palmW = 0.42;
  const palmTop = 0.44;
  const palmBottom = 0.86;
  ctx.strokeRect(-palmW / 2, palmTop, palmW, palmBottom - palmTop);
  const lens = [0.9, 1, 0.94, 0.78]; // index, middle, ring, pinky as a fraction of the middle finger
  const fingerLen = palmBottom - palmTop;
  lens.forEach((f, i) => {
    const x = -palmW / 2 + (palmW / 8) * (1 + i * 2);
    const len = fingerLen * f;
    const seg = [0.5, 0.3, 0.2].map((s) => s * len);
    let y = palmTop;
    line(ctx, x, y, x, y - seg[0]);
    y -= seg[0];
    ctx.strokeRect(x - 0.012, y - 0.005, 0.024, 0.01);
    line(ctx, x, y, x, y - seg[1]);
    y -= seg[1];
    ctx.strokeRect(x - 0.012, y - 0.005, 0.024, 0.01);
    line(ctx, x, y, x, y - seg[2]);
  });
  // Thumb branching from the lower side of the palm.
  line(ctx, palmW / 2, palmBottom - 0.06, palmW / 2 + 0.2, palmBottom - 0.24);
  line(ctx, palmW / 2 + 0.2, palmBottom - 0.24, palmW / 2 + 0.3, palmBottom - 0.36);
  // Wrist
  line(ctx, -palmW * 0.32, palmBottom, -palmW * 0.28, 1);
  line(ctx, palmW * 0.32, palmBottom, palmW * 0.28, 1);
  // Knuckle line
  line(ctx, -palmW / 2, palmTop, palmW / 2, palmTop);
}

/** Five-point (fisheye) curvilinear grid: straight horizon and centre line, everything else arcs
 * through the four vanishing points on the horizon/centre circle. */
function drawCurvilinear(ctx: CanvasRenderingContext2D) {
  const R = 0.5;
  const cy = 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.clip();
  line(ctx, -R, cy, R, cy);
  line(ctx, 0, cy - R, 0, cy + R);
  for (let k = 1; k <= 5; k++) {
    // A circle through (-R,cy) and (R,cy) with its centre k·0.16 above/below the horizon.
    const c = k * 0.16;
    for (const s of [-1, 1]) {
      const rad = Math.hypot(R, c);
      ctx.beginPath();
      ctx.arc(0, cy + s * c, rad, 0, Math.PI * 2);
      ctx.stroke();
      // and the same family through the top/bottom points (verticals)
      ctx.beginPath();
      ctx.arc(s * c, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  [[-R, cy], [R, cy], [0, cy - R], [0, cy + R], [0, cy]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 0.012, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** One-point-perspective interior: back wall, four corner edges and a tiled floor and ceiling. */
function drawRoom(ctx: CanvasRenderingContext2D, tiles: number) {
  const W = 0.75;
  const vp = { x: 0, y: 0.5 };
  const back = 0.3; // scale of the back wall relative to the front frame
  const fb = 0.5; // front half-height
  ctx.strokeRect(-W, vp.y - fb, W * 2, fb * 2); // front frame (picture plane)
  ctx.strokeRect(-W * back, vp.y - fb * back, W * back * 2, fb * back * 2); // back wall
  [[-W, vp.y - fb, -W * back, vp.y - fb * back], [W, vp.y - fb, W * back, vp.y - fb * back], [-W, vp.y + fb, -W * back, vp.y + fb * back], [W, vp.y + fb, W * back, vp.y + fb * back]].forEach(([a, b, c, d]) => line(ctx, a, b, c, d));
  // Floor & ceiling slats: equal steps in DEPTH (z) give perspective-correct spacing.
  const zBack = 1 / back;
  for (let k = 1; k < tiles; k++) {
    const z = 1 + (k * (zBack - 1)) / tiles;
    const s = 1 / z;
    line(ctx, -W * s, vp.y + fb * s, W * s, vp.y + fb * s); // floor
    line(ctx, -W * s, vp.y - fb * s, W * s, vp.y - fb * s); // ceiling
    ctx.save();
    ctx.globalAlpha *= 0.6;
    line(ctx, -W * s, vp.y - fb * s, -W * s, vp.y + fb * s); // left wall depth marks
    line(ctx, W * s, vp.y - fb * s, W * s, vp.y + fb * s);
    ctx.restore();
  }
  // Floor tile lines radiating from the vanishing point (evenly spaced at the front edge).
  for (let j = 1; j < tiles; j++) {
    const x = -W + (j * W * 2) / tiles;
    line(ctx, x, vp.y + fb, vp.x + (x - vp.x) * back, vp.y + fb * back);
  }
  ctx.beginPath();
  ctx.arc(vp.x, vp.y, 0.014, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, -W, vp.y, W, vp.y); // horizon
}

/** Two-point-perspective building: one near vertical edge, two faces receding to VPs on the horizon. */
function drawBuilding(ctx: CanvasRenderingContext2D, floors: number) {
  const hy = 0.5; // horizon
  const vpL = -1.6;
  const vpR = 1.7;
  const x0 = 0; // near edge
  const topN = 0.08;
  const botN = 0.9;
  const xl = -0.55; // far left corner
  const xr = 0.6; // far right corner
  const yAt = (yN: number, vx: number, xEnd: number) => hy + (yN - hy) * ((xEnd - vx) / (x0 - vx));
  line(ctx, -1.15, hy, 1.15, hy);
  // Edges
  line(ctx, x0, topN, x0, botN);
  line(ctx, xl, yAt(topN, vpL, xl), xl, yAt(botN, vpL, xl));
  line(ctx, xr, yAt(topN, vpR, xr), xr, yAt(botN, vpR, xr));
  const face = (vx: number, xf: number) => {
    // Roof/base edges and floor lines
    for (let i = 0; i <= floors; i++) {
      const yN = topN + ((botN - topN) * i) / floors;
      line(ctx, x0, yN, xf, yAt(yN, vx, xf));
    }
    // Perspective-correct column divisions
    const a = Math.abs(xf - vx) / Math.abs(x0 - vx);
    const cols = Math.max(2, Math.round(floors / 2) + 2);
    for (let c = 1; c < cols; c++) {
      const u = c / cols;
      const f = (u * a) / ((1 - u) + u * a);
      const x = x0 + (xf - x0) * f;
      line(ctx, x, yAt(topN, vx, x), x, yAt(botN, vx, x));
    }
  };
  ctx.save();
  ctx.globalAlpha *= 0.55;
  face(vpL, xl);
  face(vpR, xr);
  ctx.restore();
  [vpL, vpR].forEach((vx) => {
    if (Math.abs(vx) <= 1.15) {
      ctx.beginPath();
      ctx.arc(vx, hy, 0.014, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function drawStudyGuide(ctx: CanvasRenderingContext2D, g: StudyGuide, zoom: number) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate((g.rotation * Math.PI) / 180);
  ctx.scale(g.flipH ? -g.size : g.size, g.size);
  ctx.translate(0, -0.5);
  ctx.strokeStyle = g.color;
  ctx.fillStyle = g.color;
  ctx.globalAlpha = g.opacity;
  ctx.lineWidth = 1.5 / (zoom * g.size);
  switch (g.kind) {
    case 'faceFront': drawFaceFront(ctx); break;
    case 'faceSide': drawFaceSide(ctx); break;
    case 'figure': drawFigure(ctx, g.heads); break;
    case 'ellipse': drawEllipseGuide(ctx, g.ratio); break;
    case 'hand': drawHand(ctx); break;
    case 'curvilinear': drawCurvilinear(ctx); break;
    case 'room': drawRoom(ctx, Math.round(g.heads)); break;
    case 'building': drawBuilding(ctx, Math.round(g.heads)); break;
  }
  ctx.restore();
}

export function measureBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Angle measured counter-clockwise from the +X axis with screen Y flipped, i.e. the way people read it.
  let angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  return { distance: Math.hypot(dx, dy), angle, dx, dy };
}

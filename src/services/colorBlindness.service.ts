import { RGBA, ColorBlindnessType } from '@/types/colorTools';

/**
 * Linear RGB approximation of dichromatic color vision (protanopia/deuteranopia/tritanopia)
 * plus full achromatopsia — the same widely-used simplified matrices found in most color-
 * blindness simulators (e.g. Coblis/Colblindor-style tools). Not a full LMS cone-response
 * simulation (which needs a proper RGB→LMS→gamut-clip→RGB pipeline), but a solid, fast
 * approximation good enough for "does this palette still read for a colorblind viewer".
 */
const MATRICES: Record<'protanopia' | 'deuteranopia' | 'tritanopia', number[][]> = {
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
};

function applyMatrix(r: number, g: number, b: number, m: number[][]): [number, number, number] {
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

/** "Anomaly" (weak) types aren't a separate matrix — they're the same dichromatic simulation
 * as their base type (e.g. protanomaly ~ protanopia), blended back toward the original color.
 * 0.6 is the same weight used by most simplified simulators for a "moderate" anomalous
 * trichromacy, since a true severity-parameterized LMS model needs the full cone-response
 * pipeline this module deliberately doesn't implement (see the module-level note above). */
const ANOMALY_BASE: Record<'protanomaly' | 'deuteranomaly' | 'tritanomaly', 'protanopia' | 'deuteranopia' | 'tritanopia'> = {
  protanomaly: 'protanopia',
  deuteranomaly: 'deuteranopia',
  tritanomaly: 'tritanopia',
};
const ANOMALY_SEVERITY = 0.6;

export function simulateColor(color: RGBA, type: ColorBlindnessType): RGBA {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  if (type === 'monochromacy') {
    const gray = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * 255);
    return { r: gray, g: gray, b: gray, a: color.a };
  }

  if (type === 'protanomaly' || type === 'deuteranomaly' || type === 'tritanomaly') {
    const dichromatic = simulateColor(color, ANOMALY_BASE[type]);
    return {
      r: Math.round(color.r * (1 - ANOMALY_SEVERITY) + dichromatic.r * ANOMALY_SEVERITY),
      g: Math.round(color.g * (1 - ANOMALY_SEVERITY) + dichromatic.g * ANOMALY_SEVERITY),
      b: Math.round(color.b * (1 - ANOMALY_SEVERITY) + dichromatic.b * ANOMALY_SEVERITY),
      a: color.a,
    };
  }

  const [rr, rg, rb] = applyMatrix(r, g, b, MATRICES[type]);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return { r: clamp(rr), g: clamp(rg), b: clamp(rb), a: color.a };
}

/** Euclidean RGB distance after simulation — a cheap, standard proxy for "still distinguishable". */
export function areDistinguishable(a: RGBA, b: RGBA, type: ColorBlindnessType): boolean {
  const simA = simulateColor(a, type);
  const simB = simulateColor(b, type);
  const dist = Math.hypot(simA.r - simB.r, simA.g - simB.g, simA.b - simB.b);
  return dist > 30;
}

/** Applies the same simulation to every opaque pixel of a canvas — lets an artist see their
 * actual artwork through a colorblind lens, not just an abstract example swatch. */
export function simulateOnCanvas(canvas: HTMLCanvasElement, type: ColorBlindnessType) {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const simulated = simulateColor({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }, type);
    data[i] = simulated.r;
    data[i + 1] = simulated.g;
    data[i + 2] = simulated.b;
  }

  ctx.putImageData(imageData, 0, 0);
}

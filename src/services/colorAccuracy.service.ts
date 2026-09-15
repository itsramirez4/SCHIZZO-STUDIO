import { LABColor } from '@/types/colorTools';

/** Plain Euclidean distance in LAB space — the original, simpler color-difference formula.
 * Perceptually uneven (a given ΔE76 doesn't mean the same "visible difference" in every part
 * of color space), but simple and still widely quoted. */
export function deltaE76(a: LABColor, b: LABColor): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/** CIEDE2000 — the current standard color-difference formula, correcting for the perceptual
 * unevenness of ΔE76 (weighting lightness/chroma/hue differently depending on where in color
 * space they fall). This is the full, exact formula from the CIE technical report, not a
 * simplification — unlike the colorblindness matrices elsewhere in this app, there's no
 * "widely-used approximation" version of CIEDE2000 worth using instead. */
export function deltaE2000(labA: LABColor, labB: LABColor): number {
  const rad2deg = (r: number) => (r * 180) / Math.PI;
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  const { l: L1, a: a1, b: b1 } = labA;
  const { l: L2, a: a2, b: b2 } = labB;

  const avgLp = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  const hp = (x: number, y: number) => {
    if (x === 0 && y === 0) return 0;
    const h = rad2deg(Math.atan2(y, x));
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);

  let deltahp: number;
  if (C1p === 0 || C2p === 0) {
    deltahp = 0;
  } else if (Math.abs(h1p - h2p) <= 180) {
    deltahp = h2p - h1p;
  } else if (h2p <= h1p) {
    deltahp = h2p - h1p + 360;
  } else {
    deltahp = h2p - h1p - 360;
  }

  const deltaLp = L2 - L1;
  const deltaCp = C2p - C1p;
  const deltaHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(deltahp) / 2);

  let avgHp: number;
  if (C1p === 0 || C2p === 0) {
    avgHp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(avgHp - 30)) +
    0.24 * Math.cos(deg2rad(2 * avgHp)) +
    0.32 * Math.cos(deg2rad(3 * avgHp + 6)) -
    0.2 * Math.cos(deg2rad(4 * avgHp - 63));

  const deltaTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(deg2rad(2 * deltaTheta)) * Rc;

  const kl = 1;
  const kc = 1;
  const kh = 1;

  return Math.sqrt(
    (deltaLp / (kl * Sl)) ** 2 +
      (deltaCp / (kc * Sc)) ** 2 +
      (deltaHp / (kh * Sh)) ** 2 +
      Rt * (deltaCp / (kc * Sc)) * (deltaHp / (kh * Sh))
  );
}

export type DeltaESeverity = 'imperceptible' | 'perceptible' | 'notable' | 'high';

/** Standard, widely-cited interpretation bands for a ΔE2000 value. */
export function describeDeltaE(value: number): DeltaESeverity {
  if (value < 1) return 'imperceptible';
  if (value < 2) return 'perceptible';
  if (value < 10) return 'notable';
  return 'high';
}

export const DELTA_E_LABELS: Record<DeltaESeverity, string> = {
  imperceptible: 'Imperceptible',
  perceptible: 'Perceptible de cerca',
  notable: 'Notable',
  high: 'Muy notable',
};

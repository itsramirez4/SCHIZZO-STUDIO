import { RGBA, HarmonyType } from '@/types/colorTools';
import { hsvToRgba, rgbaToHsv } from '@/utils/colorUtils';
import { generateHarmony } from './colorHarmony.service';

/**
 * Colour-wheel maths. Two wheels are supported:
 *  - 'rgb': the screen wheel (HSV hue), where red's complement is cyan;
 *  - 'ryb': the painter's wheel (red / yellow / blue primaries), where red's complement is green
 *    and blue's is orange — the pairs artists learn. It is a re-spacing of the same hues: the
 *    wheel angle is remapped, the colours themselves stay ordinary screen colours.
 * Angles are measured clockwise with red at the top of the wheel.
 */
export type WheelModel = 'rgb' | 'ryb';

export const WHEEL_MODEL_LABELS: Record<WheelModel, string> = {
  rgb: 'Rueda RGB (pantalla)',
  ryb: 'Rueda de pintor (RYB)',
};

// Painter's wheel: red 0°, orange 60°, yellow 120°, green 180°, blue 240°, violet 300°.
const RYB_KNOTS = [0, 60, 120, 180, 240, 300, 360];
const RGB_KNOTS = [0, 30, 60, 120, 240, 285, 360];

const mod360 = (a: number) => ((a % 360) + 360) % 360;

function interpolate(x: number, from: number[], to: number[]): number {
  for (let i = 0; i < from.length - 1; i++) {
    if (x <= from[i + 1]) {
      const t = (x - from[i]) / (from[i + 1] - from[i]);
      return to[i] + t * (to[i + 1] - to[i]);
    }
  }
  return to[to.length - 1];
}

export const rybAngleToHue = (angle: number) => mod360(interpolate(mod360(angle), RYB_KNOTS, RGB_KNOTS));
export const hueToRybAngle = (hue: number) => mod360(interpolate(mod360(hue), RGB_KNOTS, RYB_KNOTS));

export const hueToWheelAngle = (hue: number, model: WheelModel) => (model === 'ryb' ? hueToRybAngle(hue) : mod360(hue));
export const wheelAngleToHue = (angle: number, model: WheelModel) => (model === 'ryb' ? rybAngleToHue(angle) : mod360(angle));

/** Angular offsets (degrees on the wheel) of the harmonies that are defined by hue distance. */
const HARMONY_ANGLES: Partial<Record<HarmonyType, number[]>> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  tetradic: [0, 60, 180, 240],
  compound: [0, 30, 180, 210],
};

/** The harmony of `base` measured on the chosen wheel (the tonal harmonies don't depend on it). */
export function wheelHarmony(base: RGBA, type: HarmonyType, model: WheelModel): RGBA[] {
  const angles = HARMONY_ANGLES[type];
  if (model === 'rgb' || !angles) return generateHarmony(base, type);
  const hsv = rgbaToHsv(base);
  const origin = hueToRybAngle(hsv.h);
  return angles.map((d) => (d === 0 ? base : hsvToRgba(rybAngleToHue(origin + d), hsv.s, hsv.v)));
}

/** Position of a colour on a wheel of radius `radius` centred on (cx, cy): angle = hue, distance = saturation. */
export function wheelPosition(color: RGBA, model: WheelModel, radius: number, cx: number, cy: number) {
  const hsv = rgbaToHsv(color);
  const theta = ((hueToWheelAngle(hsv.h, model) - 90) * Math.PI) / 180;
  const r = (hsv.s / 100) * radius;
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

/** The hue (on the chosen wheel) and saturation under a point of the wheel. */
export function wheelPick(x: number, y: number, cx: number, cy: number, radius: number, model: WheelModel) {
  const dx = x - cx;
  const dy = y - cy;
  const angle = mod360((Math.atan2(dy, dx) * 180) / Math.PI + 90);
  return { h: wheelAngleToHue(angle, model), s: Math.min(100, (Math.hypot(dx, dy) / radius) * 100) };
}

/** Paints the disc: angle = hue, distance from the centre = saturation, at brightness `v` (0–100). */
export function drawWheel(ctx: CanvasRenderingContext2D, size: number, model: WheelModel, v: number) {
  const img = ctx.createImageData(size, size);
  const c = size / 2;
  const R = c - 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > R + 1) continue;
      const { h, s } = wheelPick(x + 0.5, y + 0.5, c, c, R, model);
      const rgb = hsvToRgba(h, r <= R ? s : 100, v);
      const i = (y * size + x) * 4;
      img.data[i] = rgb.r;
      img.data[i + 1] = rgb.g;
      img.data[i + 2] = rgb.b;
      img.data[i + 3] = r <= R ? 255 : Math.round(255 * Math.max(0, 1 - (r - R)));
    }
  }
  ctx.putImageData(img, 0, 0);
}

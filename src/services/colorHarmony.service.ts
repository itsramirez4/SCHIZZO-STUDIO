import { RGBA, HSLColor, HSVColor, HarmonyType } from '@/types/colorTools';
import { rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb } from './colorSpace.service';

const rotate = (hsv: HSVColor, deg: number): HSVColor => ({ ...hsv, h: (hsv.h + deg + 360) % 360 });

/** Returns the harmony's colors (including the base color as the first entry). */
export function generateHarmony(base: RGBA, type: HarmonyType): RGBA[] {
  const hsv = rgbToHsv(base);
  const hsl = rgbToHsl(base);

  switch (type) {
    case 'complementary':
      return [base, hsvToRgb(rotate(hsv, 180))];
    case 'analogous':
      return [hsvToRgb(rotate(hsv, -30)), base, hsvToRgb(rotate(hsv, 30))];
    case 'triadic':
      return [base, hsvToRgb(rotate(hsv, 120)), hsvToRgb(rotate(hsv, 240))];
    case 'tetradic':
      return [base, hsvToRgb(rotate(hsv, 60)), hsvToRgb(rotate(hsv, 180)), hsvToRgb(rotate(hsv, 240))];
    case 'compound':
      return [base, hsvToRgb(rotate(hsv, 30)), hsvToRgb(rotate(hsv, 180)), hsvToRgb(rotate(hsv, 210))];
    case 'shades':
      return shadesOf(hsl);
    case 'tints':
      return tintsOf(hsl);
    case 'monochromatic':
      return monochromaticOf(hsl);
  }
}

function shadesOf(hsl: HSLColor): RGBA[] {
  return [0, 20, 40, 60].map((d) => hslToRgb({ ...hsl, l: Math.max(0, hsl.l - d) }));
}

function tintsOf(hsl: HSLColor): RGBA[] {
  return [0, 20, 40, 60].map((d) => hslToRgb({ ...hsl, l: Math.min(100, hsl.l + d) }));
}

function monochromaticOf(hsl: HSLColor): RGBA[] {
  return [
    hslToRgb(hsl),
    hslToRgb({ ...hsl, s: Math.max(0, hsl.s - 20), l: Math.max(0, hsl.l - 15) }),
    hslToRgb({ ...hsl, s: Math.max(0, hsl.s - 40) }),
    hslToRgb({ ...hsl, s: Math.max(0, hsl.s - 20), l: Math.min(100, hsl.l + 20) }),
  ];
}

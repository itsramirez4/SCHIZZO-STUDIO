import { MoodTheme } from '@/types/colorTools';
import { hslToRgb, rgbaColorToHex } from '@/services/colorSpace.service';

interface MoodDefinition {
  /** Hue ranges (degrees) the mood draws from — can be negative (wraps mod 360) or span more
   * than one disjoint band (e.g. "sunset" combines warm oranges and pinks/purples). */
  hueRanges: [number, number][];
  saturation: [number, number];
  lightness: [number, number];
}

/**
 * Unlike the naive version of this idea (which just nudges lightness/saturation of whatever hue
 * was already there), a real mood needs to bias the HUE itself — "warm" only means something if
 * it actually lands on reds/oranges/yellows regardless of the seed color. Ranges below are a
 * reasonable, documented color-theory judgment call, not sourced data.
 */
const MOOD_DEFINITIONS: Record<MoodTheme, MoodDefinition> = {
  warm: { hueRanges: [[-30, 60]], saturation: [50, 90], lightness: [45, 65] },
  cool: { hueRanges: [[180, 260]], saturation: [40, 80], lightness: [40, 60] },
  vibrant: { hueRanges: [[0, 360]], saturation: [80, 100], lightness: [45, 60] },
  muted: { hueRanges: [[0, 360]], saturation: [15, 35], lightness: [40, 65] },
  pastel: { hueRanges: [[0, 360]], saturation: [25, 45], lightness: [75, 90] },
  neon: { hueRanges: [[0, 360]], saturation: [95, 100], lightness: [50, 60] },
  dark: { hueRanges: [[0, 360]], saturation: [40, 70], lightness: [15, 30] },
  light: { hueRanges: [[0, 360]], saturation: [30, 60], lightness: [80, 95] },
  earthy: { hueRanges: [[20, 50], [60, 90]], saturation: [25, 55], lightness: [30, 55] },
  ocean: { hueRanges: [[180, 220]], saturation: [40, 75], lightness: [30, 65] },
  sunset: { hueRanges: [[0, 40], [280, 330]], saturation: [55, 90], lightness: [45, 70] },
  forest: { hueRanges: [[90, 150]], saturation: [30, 60], lightness: [20, 45] },
};

/** Generates `count` hex colors for a mood — fully deterministic (no RNG) so the same inputs
 * always produce the same palette. Hues are spread evenly across the mood's range(s); saturation
 * and lightness are varied via two different irrational-step sequences (golden ratio and its
 * complement) so consecutive swatches don't look mechanically identical, without needing chance. */
export function generateMoodPalette(mood: MoodTheme, count: number): string[] {
  const def = MOOD_DEFINITIONS[mood];
  const totalSpan = def.hueRanges.reduce((sum, [a, b]) => sum + (b - a), 0);
  const n = Math.max(1, Math.round(count));
  const colors: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    let target = t * totalSpan;
    let hue = def.hueRanges[0][0];
    for (const [a, b] of def.hueRanges) {
      const span = b - a;
      if (target <= span) {
        hue = a + target;
        break;
      }
      target -= span;
    }
    hue = ((hue % 360) + 360) % 360;

    const satT = (i * 0.6180339887498949) % 1;
    const lightT = (i * 0.4142135623730951) % 1;
    const saturation = def.saturation[0] + (def.saturation[1] - def.saturation[0]) * satT;
    const lightness = def.lightness[0] + (def.lightness[1] - def.lightness[0]) * lightT;

    colors.push(rgbaColorToHex(hslToRgb({ h: hue, s: saturation, l: lightness })));
  }

  return colors;
}

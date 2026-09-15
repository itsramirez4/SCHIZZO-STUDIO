import { NAMED_COLORS } from '@/data/colorNames';
import { hexToRgbaColor, rgbToLab } from '@/services/colorSpace.service';
import { LABColor } from '@/types/colorTools';

export interface ColorNameMatch {
  name: string;
  hex: string;
  distance: number; // CIE76 Delta-E — 0 = exact match, >~20 is a clearly different color
}

const NAMED_LABS: { name: string; hex: string; lab: LABColor }[] = NAMED_COLORS.map((c) => ({
  ...c,
  lab: rgbToLab(hexToRgbaColor(c.hex)),
}));

function deltaE(a: LABColor, b: LABColor): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

/** Finds the closest named color(s) by CIE76 Delta-E in LAB space — perceptually much closer
 * to how a person judges "is this close enough to call it X" than plain RGB distance would be. */
export function findNearestColorNames(hex: string, count = 1): ColorNameMatch[] {
  const targetLab = rgbToLab(hexToRgbaColor(hex));
  return NAMED_LABS.map((c) => ({ name: c.name, hex: c.hex, distance: deltaE(targetLab, c.lab) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, count));
}

export function findNearestColorName(hex: string): ColorNameMatch {
  return findNearestColorNames(hex, 1)[0];
}

/** Plain substring search over the named-color list, sorted alphabetically — independent of any
 * target color, unlike `findNearestColorNames`. */
export function searchColorNames(query: string): { name: string; hex: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return NAMED_COLORS.filter((c) => c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
}

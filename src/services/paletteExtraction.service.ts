import { RGBA } from '@/types/colorTools';
import { rgbToHsl } from './colorSpace.service';

const MAX_SAMPLES = 20000;

/** Every Nth pixel, capped at MAX_SAMPLES — k-means over every pixel of a large canvas
 * (millions of pixels × several iterations × k centroids) is real, avoidable wall time;
 * a bounded random-ish sample gives the same result in practice at a tiny fraction of the cost. */
function samplePixels(data: Uint8ClampedArray): RGBA[] {
  const pixelCount = data.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / MAX_SAMPLES));
  const samples: RGBA[] = [];
  for (let p = 0; p < pixelCount; p += step) {
    const i = p * 4;
    if (data[i + 3] === 0) continue; // skip fully transparent pixels
    samples.push({ r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] });
  }
  return samples;
}

function colorDistance(a: RGBA, b: RGBA): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function averageColor(colors: RGBA[]): RGBA {
  if (colors.length === 0) return { r: 0, g: 0, b: 0, a: 255 };
  const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
  return { r: Math.round(sum.r / colors.length), g: Math.round(sum.g / colors.length), b: Math.round(sum.b / colors.length), a: 255 };
}

/** K-means clustering over a bounded sample of the image's pixels. */
export function extractKMeans(imageData: ImageData, k: number, iterations = 6): RGBA[] {
  const samples = samplePixels(imageData.data);
  if (samples.length === 0) return [];
  if (samples.length <= k) return samples;

  // Deterministic init (evenly spaced through the sample) rather than Math.random() — keeps
  // repeated extractions of the same image stable instead of returning a different palette
  // order/composition on every click.
  const centroids: RGBA[] = Array.from({ length: k }, (_, i) => samples[Math.floor((i / k) * samples.length)]);

  for (let iter = 0; iter < iterations; iter++) {
    const clusters: RGBA[][] = Array.from({ length: k }, () => []);
    for (const pixel of samples) {
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dist = colorDistance(pixel, centroids[c]);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = c;
        }
      }
      clusters[closestIdx].push(pixel);
    }
    for (let c = 0; c < k; c++) {
      if (clusters[c].length > 0) centroids[c] = averageColor(clusters[c]);
    }
  }

  return centroids;
}

/** Simpler/faster alternative: most frequent exact colors (quantized to reduce noise). */
export function extractDominant(imageData: ImageData, k: number): RGBA[] {
  const data = imageData.data;
  const bucket = 16; // quantize each channel so near-identical anti-aliased pixels count together
  const counts = new Map<string, { color: RGBA; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = Math.round(data[i] / bucket) * bucket;
    const g = Math.round(data[i + 1] / bucket) * bucket;
    const b = Math.round(data[i + 2] / bucket) * bucket;
    const key = `${r},${g},${b}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { color: { r, g, b, a: 255 }, count: 1 });
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, k)
    .map((e) => e.color);
}

export function sortColors(colors: RGBA[], sortBy: 'hue' | 'lightness' | 'saturation'): RGBA[] {
  return [...colors].sort((a, b) => {
    const hslA = rgbToHsl(a);
    const hslB = rgbToHsl(b);
    if (sortBy === 'hue') return hslA.h - hslB.h;
    if (sortBy === 'lightness') return hslA.l - hslB.l;
    return hslB.s - hslA.s;
  });
}

// --- Export formats ---
// .ase (Adobe Swatch Exchange) is deliberately not included: it's a binary format, and
// without a copy of Photoshop/Illustrator to actually round-trip a real file through, I
// can't verify a from-scratch encoder actually opens correctly — same reasoning as skipping
// CLIP/XCF import. JSON/CSS/GPL/Tailwind are all plain text, easy to verify structurally.

function toHex({ r, g, b }: RGBA): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function exportAsJson(colors: RGBA[]): string {
  return JSON.stringify(colors.map(toHex), null, 2);
}

export function exportAsCss(colors: RGBA[]): string {
  const lines = colors.map((c, i) => `  --color-${i + 1}: ${toHex(c)};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

export function exportAsTailwind(colors: RGBA[]): string {
  const lines = colors.map((c, i) => `    palette${i + 1}: '${toHex(c)}',`);
  return `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n${lines.join('\n')}\n      },\n    },\n  },\n};`;
}

/** GIMP/Krita .gpl palette format — plain text, documented, widely supported. */
export function exportAsGpl(colors: RGBA[], name: string): string {
  const lines = colors.map((c, i) => `${c.r}\t${c.g}\t${c.b}\tColor ${i + 1}`);
  return `GIMP Palette\nName: ${name}\nColumns: 0\n#\n${lines.join('\n')}\n`;
}

import { RGBA } from '@/types/colorTools';
import { rgbToLab, cmykToRgb, hexToRgbaColor } from '@/services/colorSpace.service';
import { rgbToCmykAdvanced, CmykWorkflowSettings } from '@/services/cmykWorkflow.service';
import { deltaE76 } from '@/services/colorAccuracy.service';

/**
 * A generic CMYK/paper approximation, not real ICC-profile soft-proofing — this app has no
 * real, verifiable ICC profiles to simulate against (see the module note in
 * iccProfile-adjacent code for why that's out of scope), so this shows "what happens when this
 * goes through a generic CMYK conversion and onto slightly-off-white paper", which is the part
 * of soft-proofing that's honestly buildable without real device profiles.
 */

const GAMUT_WARNING_DELTA_E = 6;

/** Round-trips every opaque pixel through RGB → CMYK (with the given ink/GCR settings) → RGB,
 * which is exactly what "this is how it'll look reduced to CMYK ink" means. */
export function simulateCmykRoundTrip(canvas: HTMLCanvasElement, settings: CmykWorkflowSettings) {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const color: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    const cmyk = rgbToCmykAdvanced(color, settings);
    const back = cmykToRgb(cmyk);
    data[i] = back.r;
    data[i + 1] = back.g;
    data[i + 2] = back.b;
  }

  ctx.putImageData(imageData, 0, 0);
}

/** Tints out-of-gamut pixels (large ΔE76 between the original color and its CMYK round-trip)
 * with a flat warning color at 50% — the same visual idea as Photoshop's gamut warning
 * overlay, applied to this app's own conversion pipeline instead of a real ICC profile. */
export function highlightOutOfGamut(canvas: HTMLCanvasElement, settings: CmykWorkflowSettings, warningColor = '#ff00ff') {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const warn = hexToRgbaColor(warningColor);
  let outOfGamutCount = 0;
  let totalOpaque = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    totalOpaque++;
    const color: RGBA = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    const cmyk = rgbToCmykAdvanced(color, settings);
    const back = cmykToRgb(cmyk);
    const diff = deltaE76(rgbToLab(color), rgbToLab(back));

    if (diff > GAMUT_WARNING_DELTA_E) {
      outOfGamutCount++;
      data[i] = Math.round(color.r * 0.5 + warn.r * 0.5);
      data[i + 1] = Math.round(color.g * 0.5 + warn.g * 0.5);
      data[i + 2] = Math.round(color.b * 0.5 + warn.b * 0.5);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { outOfGamutCount, totalOpaque, percent: totalOpaque > 0 ? (outOfGamutCount / totalOpaque) * 100 : 0 };
}

/** Blends a paper color under the whole canvas — including into semi-transparent pixels, since
 * ink on paper doesn't have an alpha channel; this simulates the actual optical mix. */
export function applyPaperTint(canvas: HTMLCanvasElement, paperColorHex: string) {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const paper = hexToRgbaColor(paperColorHex);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    data[i] = Math.round(data[i] * alpha + paper.r * (1 - alpha));
    data[i + 1] = Math.round(data[i + 1] * alpha + paper.g * (1 - alpha));
    data[i + 2] = Math.round(data[i + 2] * alpha + paper.b * (1 - alpha));
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

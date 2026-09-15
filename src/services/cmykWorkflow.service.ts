import { RGBA, CMYKColor } from '@/types/colorTools';

/**
 * A step up from colorSpace.service.ts's plain rgbToCmyk/cmykToRgb (still used by the Espacios
 * de color tab for a quick readout): this adds the actual print-prep controls — total ink
 * limit and GCR (gray component replacement) — that a naive conversion doesn't have any
 * notion of. What's deliberately NOT here: real ink models ("european"/"japanese" dot-gain
 * profiles) — those need published characterization data (real ink/paper measurement curves)
 * this app has no access to, so offering them would mean fabricating numbers dressed up as a
 * real standard. One honest, adjustable ink model is what's actually implementable.
 */

export type BlackGeneration = 'light' | 'medium' | 'heavy' | 'maximum';

export interface CmykWorkflowSettings {
  totalInkLimit: number; // 200-400, e.g. 300 (%) is a common offset-press default
  blackGeneration: BlackGeneration;
  useGCR: boolean;
}

export const DEFAULT_CMYK_WORKFLOW_SETTINGS: CmykWorkflowSettings = {
  totalInkLimit: 300,
  blackGeneration: 'medium',
  useGCR: true,
};

const GCR_AMOUNT: Record<BlackGeneration, number> = {
  light: 0.3,
  medium: 0.6,
  heavy: 0.85,
  maximum: 1,
};

// GCR "off" still removes a small, fixed share of the neutral component (a stand-in for the
// under-color-removal a real separation always does) rather than nothing at all — the honest
// alternative would be a pure C+M+Y-only separation with zero K, which no real press wants
// even for its "no GCR" mode.
const NO_GCR_BASELINE = 0.15;

/** RGB → CMYK with GCR (replacing the gray component shared by C/M/Y with more K, the standard
 * prepress technique for reducing total ink and improving gray/black stability) and a total
 * ink limit (scaling C/M/Y down if C+M+Y+K would exceed it, since real presses can't hold that
 * much wet ink on the sheet).
 *
 * GCR has to start from the undercolor-free complement (c0=1-r etc, generally all three
 * nonzero) rather than a per-channel-K-subtracted base: in the classic single-K formula
 * (k=1-max(r,g,b)), the channel matching the RGB maximum is *always* driven to exactly zero by
 * construction, which makes min(c,m,y) always 0 and any "remove the shared gray" step on top of
 * it a permanent no-op. Starting from the raw complement is what actually gives GCR something
 * real to remove. */
export function rgbToCmykAdvanced(color: RGBA, settings: CmykWorkflowSettings): CMYKColor {
  const c0 = 1 - color.r / 255;
  const m0 = 1 - color.g / 255;
  const y0 = 1 - color.b / 255;

  const grayShared = Math.min(c0, m0, y0);
  const strength = settings.useGCR ? GCR_AMOUNT[settings.blackGeneration] : NO_GCR_BASELINE;
  const k = grayShared * strength;

  // Plain subtraction, not renormalized back up by /(1-k) — renormalizing is what a
  // hue-preserving GCR needs for chromatic colors, but for a neutral (c0=m0=y0) it just
  // inflates every channel straight back to 100% regardless of how much k already removed,
  // making the black-generation setting invisible for grays/blacks specifically.
  const c = Math.max(0, c0 - k);
  const m = Math.max(0, m0 - k);
  const y = Math.max(0, y0 - k);

  let cmykPct = { c: c * 100, m: m * 100, y: y * 100, k: k * 100 };
  const total = cmykPct.c + cmykPct.m + cmykPct.y + cmykPct.k;
  if (total > settings.totalInkLimit) {
    // Scale only C/M/Y down — K stays put, since reducing black first would wash out shadows.
    const inkBudgetForCMY = Math.max(0, settings.totalInkLimit - cmykPct.k);
    const cmySum = cmykPct.c + cmykPct.m + cmykPct.y || 1;
    const scale = inkBudgetForCMY / cmySum;
    cmykPct = { ...cmykPct, c: cmykPct.c * scale, m: cmykPct.m * scale, y: cmykPct.y * scale };
  }

  return {
    c: Math.round(cmykPct.c),
    m: Math.round(cmykPct.m),
    y: Math.round(cmykPct.y),
    k: Math.round(cmykPct.k),
  };
}

export function getTotalInk(cmyk: CMYKColor): number {
  return cmyk.c + cmyk.m + cmyk.y + cmyk.k;
}

export function validateSeparation(cmyk: CMYKColor, settings: CmykWorkflowSettings): string[] {
  const warnings: string[] = [];
  const total = getTotalInk(cmyk);

  if (total > settings.totalInkLimit) {
    warnings.push(`La tinta total (${Math.round(total)}%) supera el límite configurado (${settings.totalInkLimit}%).`);
  }
  if (cmyk.k > 95 && (cmyk.c > 0 || cmyk.m > 0 || cmyk.y > 0)) {
    warnings.push('Negro casi puro con algo de CMY — considerá usar 100% K solo, para texto o líneas finas.');
  }

  return warnings;
}

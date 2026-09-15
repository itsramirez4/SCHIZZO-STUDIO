import { RGBA, ContrastResult, AccessibilityReport, ColorBlindnessType, COLOR_BLINDNESS_LABELS } from '@/types/colorTools';
import { simulateColor } from './colorBlindness.service';

function relativeLuminance({ r, g, b }: RGBA): number {
  const linearize = (c: number) => {
    const cn = c / 255;
    return cn <= 0.03928 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast(ratio: number): ContrastResult {
  const level: ContrastResult['level'] = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail';
  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    largeTextPass: ratio >= 3,
    largeTextAAA: ratio >= 4.5,
    smallTextPass: ratio >= 4.5,
    smallTextAAA: ratio >= 7,
    description:
      level === 'AAA'
        ? `Excelente (${ratio.toFixed(2)}:1) — cumple WCAG AAA para cualquier tamaño de texto.`
        : level === 'AA'
          ? `Aceptable (${ratio.toFixed(2)}:1) — cumple WCAG AA. Para texto chico, AAA pide 7:1.`
          : `Insuficiente (${ratio.toFixed(2)}:1) — no cumple WCAG. Aumentá el contraste.`,
  };
}

const CB_TYPES = Object.keys(COLOR_BLINDNESS_LABELS) as ColorBlindnessType[];

/** Nudges `fg` darker/lighter in fixed steps until it clears 4.5:1 against `bg`, if possible. */
function findAlternatives(bg: RGBA, fg: RGBA): RGBA[] {
  const alternatives: RGBA[] = [];
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 4; step++) {
      const candidate: RGBA = {
        r: Math.max(0, Math.min(255, fg.r + dir * step * 45)),
        g: Math.max(0, Math.min(255, fg.g + dir * step * 45)),
        b: Math.max(0, Math.min(255, fg.b + dir * step * 45)),
        a: fg.a,
      };
      if (contrastRatio(bg, candidate) >= 4.5) {
        alternatives.push(candidate);
        break;
      }
    }
  }
  return alternatives;
}

export function generateAccessibilityReport(background: RGBA, foreground: RGBA): AccessibilityReport {
  const ratio = contrastRatio(background, foreground);
  const contrast = checkContrast(ratio);

  const colorBlindDistinguishable = {} as Record<ColorBlindnessType, boolean>;
  for (const type of CB_TYPES) {
    const simBg = simulateColor(background, type);
    const simFg = simulateColor(foreground, type);
    colorBlindDistinguishable[type] = Math.hypot(simBg.r - simFg.r, simBg.g - simFg.g, simBg.b - simFg.b) > 30;
  }

  const recommendations: string[] = [];
  if (contrast.level === 'fail') recommendations.push('El contraste es insuficiente — probá con colores más alejados en luminosidad.');
  if (!colorBlindDistinguishable.protanopia) recommendations.push('Difícil de distinguir para protanopia (ceguera al rojo).');
  if (!colorBlindDistinguishable.deuteranopia) recommendations.push('Difícil de distinguir para deuteranopia (ceguera al verde).');
  if (!colorBlindDistinguishable.tritanopia) recommendations.push('Difícil de distinguir para tritanopia (ceguera al azul).');
  if (contrast.level !== 'fail' && Object.values(colorBlindDistinguishable).every(Boolean)) {
    recommendations.push('Buena accesibilidad: pasa WCAG y se distingue en todos los tipos de daltonismo simulados.');
  }

  return {
    contrast,
    colorBlindDistinguishable,
    recommendations,
    alternativeColors: contrast.level === 'fail' ? findAlternatives(background, foreground) : [],
  };
}

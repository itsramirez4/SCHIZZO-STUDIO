import type { MoodTheme } from '@/types/colorTools';
import { generateMoodPalette } from '../paletteMood.service';
import { extractKMeans } from '../paletteExtraction.service';
import { hslToRgb, rgbToHsl } from '../colorSpace.service';
import { rgbaToHex, hexToRgba } from '@/utils/colorUtils';
import { normalize } from './textToPose.service';

/** Palette ideas from a description ("atardecer melancólico") or from the colours already in the drawing. */

export interface PaletteIdea {
  name: string;
  colors: string[];
  why: string;
}

const THEMES: { words: string[]; theme: MoodTheme; label: string }[] = [
  { words: ['atardecer', 'ocaso', 'amanecer', 'crepusculo', 'puesta de sol'], theme: 'sunset', label: 'atardecer' },
  { words: ['mar', 'oceano', 'agua', 'submarino', 'playa', 'costa'], theme: 'ocean', label: 'mar' },
  { words: ['bosque', 'selva', 'naturaleza', 'hojas', 'jungla', 'campo', 'primavera'], theme: 'forest', label: 'bosque' },
  { words: ['otono', 'tierra', 'desierto', 'arena', 'rustico', 'madera', 'terroso', 'terrosa'], theme: 'earthy', label: 'tonos tierra' },
  { words: ['noche', 'nocturno', 'nocturna', 'oscuro', 'oscura', 'sombrio', 'misterioso', 'misteriosa', 'terror', 'gotico', 'gotica'], theme: 'dark', label: 'noche / oscuro' },
  { words: ['pastel', 'suave', 'dulce', 'tierno', 'tierna', 'delicado', 'delicada', 'kawaii'], theme: 'pastel', label: 'pastel' },
  { words: ['neon', 'cyberpunk', 'futurista', 'electrico', 'electrica', 'sintetico', 'retro futurista'], theme: 'neon', label: 'neón' },
  { words: ['melancolico', 'melancolica', 'triste', 'nostalgico', 'nostalgica', 'apagado', 'apagada', 'gris', 'sobrio', 'sobria', 'invierno'], theme: 'muted', label: 'apagado / melancólico' },
  { words: ['alegre', 'vibrante', 'energico', 'energica', 'festivo', 'divertido', 'divertida', 'verano', 'tropical', 'colorido', 'colorida'], theme: 'vibrant', label: 'vibrante' },
  { words: ['luminoso', 'luminosa', 'claro', 'clara', 'limpio', 'limpia', 'aireado', 'minimalista'], theme: 'light', label: 'claro / luminoso' },
  { words: ['calido', 'calida', 'acogedor', 'acogedora', 'fuego', 'cocina', 'hogar'], theme: 'warm', label: 'cálido' },
  { words: ['frio', 'fria', 'hielo', 'helado', 'helada', 'nieve', 'polar', 'lunar'], theme: 'cool', label: 'frío' },
];
const HUES: [string[], number, string][] = [
  [['rojo', 'roja', 'carmesi', 'escarlata'], 5, 'rojo'], [['naranja', 'anaranjado'], 28, 'naranja'], [['amarillo', 'amarilla', 'dorado', 'dorada', 'oro'], 50, 'amarillo'],
  [['verde', 'esmeralda', 'lima'], 130, 'verde'], [['turquesa', 'cian', 'aguamarina'], 178, 'turquesa'], [['azul', 'cobalto', 'marino'], 218, 'azul'],
  [['violeta', 'morado', 'morada', 'purpura', 'lila'], 272, 'violeta'], [['rosa', 'rosado', 'fucsia', 'magenta'], 328, 'rosa'],
];

const hexToHsl = (hex: string) => rgbToHsl(hexToRgba(hex));
const hslToHex = (h: number, s: number, l: number) => rgbaToHex(hslToRgb({ h: ((h % 360) + 360) % 360, s: Math.max(0, Math.min(100, s)), l: Math.max(0, Math.min(100, l)) }));

/** Up to three palettes for a description: the mood itself, a version pulled toward a named colour, and a calmer one. */
export function paletteFromText(text: string, count = 5): { ideas: PaletteIdea[]; understood: string[] } {
  const t = normalize(text);
  const words = t.split(' ');
  const understood: string[] = [];
  const theme = THEMES.find((th) => th.words.some((w) => words.includes(w) || t.includes(w)));
  const hue = HUES.find(([ws]) => ws.some((w) => words.includes(w)));
  if (theme) understood.push(theme.label);
  if (hue) understood.push(hue[2]);
  const base = generateMoodPalette(theme?.theme ?? 'vibrant', count);
  const ideas: PaletteIdea[] = [{ name: theme ? `Paleta «${theme.label}»` : 'Paleta variada', colors: base, why: theme ? `Colores típicos de un ambiente ${theme.label}.` : 'No reconocí un ambiente en la descripción: paleta equilibrada de partida.' }];
  if (hue) {
    const pulled = base.map((c) => {
      const { h, s, l } = hexToHsl(c);
      const d = ((hue[1] - h + 540) % 360) - 180;
      return hslToHex(h + d * 0.7, s, l);
    });
    ideas.push({ name: `Inclinada hacia el ${hue[2]}`, colors: pulled, why: `La misma paleta con sus tonos acercados al ${hue[2]} que pediste (conserva luminosidad y saturación).` });
  }
  const calm = base.map((c) => {
    const { h, s, l } = hexToHsl(c);
    return hslToHex(h, s * 0.6, l + (50 - l) * 0.15);
  });
  ideas.push({ name: 'Más apagada', colors: calm, why: 'Menos saturación: deja que un solo color destaque y el resto acompañe.' });
  return { ideas, understood };
}

/** Ideas built from the colours the drawing already uses. */
export function paletteFromImage(canvas: HTMLCanvasElement): { ideas: PaletteIdea[]; current: string[] } {
  const w = Math.min(160, canvas.width);
  const h = Math.max(1, Math.round((canvas.height * w) / canvas.width));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  const cols = extractKMeans(c.getContext('2d')!.getImageData(0, 0, w, h), 5).map(rgbaToHex);
  const hsl = cols.map(hexToHsl);
  // the "main" colour: the most saturated of the frequent ones (grey paper must not decide)
  const main = hsl.reduce((best, x) => (x.s * (1 - Math.abs(x.l - 50) / 60) > best.s * (1 - Math.abs(best.l - 50) / 60) ? x : best), hsl[0]);
  const ideas: PaletteIdea[] = [];
  const accent = [hslToHex(main.h + 180, Math.max(55, main.s), 52), hslToHex(main.h + 180, Math.max(45, main.s * 0.8), 34), hslToHex(main.h + 180, Math.max(45, main.s * 0.8), 72)];
  ideas.push({ name: 'Añadir un acento complementario', colors: [...cols, ...accent.slice(0, 1)], why: 'El color opuesto al principal hace resaltar lo importante. Úsalo en poca cantidad, en el punto donde quieras la mirada.' });
  ideas.push({ name: 'Armonizada (análoga)', colors: hsl.map((x) => hslToHex(x.h + (((main.h - x.h + 540) % 360) - 180) * 0.45, x.s, x.l)), why: 'Acerca todos los tonos al principal: el dibujo gana unidad y sensación de una sola atmósfera.' });
  const ls = hsl.map((x) => x.l);
  const lo = Math.min(...ls);
  const hi = Math.max(...ls);
  ideas.push({ name: 'Más contraste de valor', colors: hsl.map((x) => hslToHex(x.h, x.s, hi === lo ? x.l : 12 + ((x.l - lo) / (hi - lo)) * 76)), why: 'Estira la escala de claros a oscuros: la lectura en blanco y negro mejora y el foco se distingue antes.' });
  ideas.push({ name: 'Triádica alrededor del principal', colors: [hslToHex(main.h, main.s, main.l), hslToHex(main.h + 120, main.s * 0.85, main.l), hslToHex(main.h + 240, main.s * 0.85, main.l), hslToHex(main.h, main.s * 0.4, 90), hslToHex(main.h, main.s * 0.5, 18)], why: 'Tres tonos equidistantes más un claro y un oscuro neutros: variedad controlada.' });
  return { ideas, current: cols };
}

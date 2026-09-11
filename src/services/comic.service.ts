import { SelectionRect } from '@/types';
import { withClip } from './canvas.service';

// ===== Screentones =====
// Manga halftone tones. Drawn directly across the target region in one continuous
// coordinate space (rotated around the region's center) rather than via a small repeating
// tile — a rotated dot/line grid doesn't tile seamlessly at arbitrary angles, so tiling it
// would leave visible seams; computing it in one pass avoids that entirely.

export type ScreentoneType = 'dot' | 'line';

export function fillWithScreentone(
  canvas: HTMLCanvasElement,
  type: ScreentoneType,
  frequency: number,
  angle: number,
  weight: number,
  color: string,
  bounds?: SelectionRect
) {
  const ctx = canvas.getContext('2d')!;
  const region = bounds ?? { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const spacing = Math.max(2, 100 / frequency);

  withClip(ctx, bounds, () => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const diag = Math.hypot(region.w, region.h) + spacing * 2;
    const cx = region.x + region.w / 2;
    const cy = region.y + region.h / 2;

    if (type === 'dot') {
      const radius = (spacing / 2) * Math.max(0.05, Math.min(1, weight));
      for (let v = -diag; v < diag; v += spacing) {
        for (let u = -diag; u < diag; u += spacing) {
          const x = cx + u * cos - v * sin;
          const y = cy + u * sin + v * cos;
          if (x < region.x - spacing || x > region.x + region.w + spacing) continue;
          if (y < region.y - spacing || y > region.y + region.h + spacing) continue;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      ctx.lineWidth = spacing * Math.max(0.05, Math.min(1, weight));
      for (let v = -diag; v < diag; v += spacing) {
        ctx.beginPath();
        ctx.moveTo(cx - diag * cos - v * sin, cy - diag * sin + v * cos);
        ctx.lineTo(cx + diag * cos - v * sin, cy + diag * sin + v * cos);
        ctx.stroke();
      }
    }
  });
}

// ===== Panels (viñetas) =====

export interface PanelStyle {
  borderWidth: number;
  borderStyle: 'solid' | 'double' | 'dashed';
  borderColor: string;
  fillColor?: string;
}

export function drawPanelBorder(canvas: HTMLCanvasElement, rect: SelectionRect, style: PanelStyle) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.strokeStyle = style.borderColor;
  ctx.lineWidth = style.borderWidth;

  if (style.borderStyle === 'double') {
    const gap = style.borderWidth * 1.5;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x + gap, rect.y + gap, rect.w - gap * 2, rect.h - gap * 2);
  } else {
    if (style.borderStyle === 'dashed') ctx.setLineDash([style.borderWidth * 3, style.borderWidth * 2]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

export type PanelTemplate = '4-grid' | '6-grid' | 'full-page' | 'title-page' | 'spread';

export const PANEL_TEMPLATE_LABELS: Record<PanelTemplate, string> = {
  '4-grid': 'Grilla 2×2',
  '6-grid': 'Grilla 2×3',
  'full-page': 'Página completa',
  'title-page': 'Página de título',
  spread: 'Doble página',
};

const PANEL_TEMPLATES: Record<PanelTemplate, SelectionRect[]> = {
  '4-grid': [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  '6-grid': [
    { x: 0, y: 0, w: 0.5, h: 0.333 },
    { x: 0.5, y: 0, w: 0.5, h: 0.333 },
    { x: 0, y: 0.333, w: 0.5, h: 0.334 },
    { x: 0.5, y: 0.333, w: 0.5, h: 0.334 },
    { x: 0, y: 0.667, w: 0.5, h: 0.333 },
    { x: 0.5, y: 0.667, w: 0.5, h: 0.333 },
  ],
  'full-page': [{ x: 0, y: 0, w: 1, h: 1 }],
  'title-page': [
    { x: 0, y: 0, w: 1, h: 0.4 },
    { x: 0, y: 0.4, w: 1, h: 0.6 },
  ],
  spread: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
};

/** Lays out `template`'s panels across the whole canvas, with a small gutter between them. */
export function applyPanelTemplate(canvas: HTMLCanvasElement, template: PanelTemplate, style: PanelStyle, margin = 8) {
  const { width, height } = canvas;
  for (const r of PANEL_TEMPLATES[template]) {
    drawPanelBorder(
      canvas,
      { x: r.x * width + margin, y: r.y * height + margin, w: r.w * width - margin * 2, h: r.h * height - margin * 2 },
      style
    );
  }
}

// ===== Speed lines (líneas de velocidad) =====

export interface SpeedLineStyle {
  count: number;
  thickness: number;
  color: string;
  /** 0-1: fraction of the radius left empty at the center — radial mode only. */
  hollow: number;
}

/** Emanata-style burst radiating from a focal point — classic shock/impact/focus effect. */
export function drawSpeedLinesRadial(canvas: HTMLCanvasElement, cx: number, cy: number, radius: number, style: SpeedLineStyle) {
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.thickness;
  ctx.lineCap = 'round';
  const innerR = radius * Math.max(0, Math.min(0.9, style.hollow));
  for (let i = 0; i < style.count; i++) {
    const angle = (i / style.count) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cx + dx * innerR, cy + dy * innerR);
    ctx.lineTo(cx + dx * radius, cy + dy * radius);
    ctx.stroke();
  }
  ctx.restore();
}

/** Directional motion streaks: N copies of the same segment, evenly offset perpendicular to it. */
export function drawSpeedLinesParallel(
  canvas: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: SpeedLineStyle & { spacing: number }
) {
  const ctx = canvas.getContext('2d')!;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;

  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.thickness;
  ctx.lineCap = 'round';
  const n = Math.max(1, style.count);
  for (let i = 0; i < n; i++) {
    const offset = (i - (n - 1) / 2) * style.spacing;
    ctx.beginPath();
    ctx.moveTo(x1 + perpX * offset, y1 + perpY * offset);
    ctx.lineTo(x2 + perpX * offset, y2 + perpY * offset);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== Speech bubbles (globos de diálogo) =====

export type BubbleType = 'speech' | 'thought' | 'shout' | 'whisper' | 'narrative';

export const BUBBLE_TYPE_LABELS: Record<BubbleType, string> = {
  speech: 'Diálogo',
  thought: 'Pensamiento',
  shout: 'Grito',
  whisper: 'Susurro',
  narrative: 'Narración',
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  text.split('\n').forEach((paragraph) => {
    const words = paragraph.split(' ');
    let current = '';
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    lines.push(current);
  });
  return lines;
}

function drawBubbleText(ctx: CanvasRenderingContext2D, rect: SelectionRect, text: string, fontSize: number) {
  if (!text.trim()) return;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, Math.max(10, rect.w - 24));
  const lineHeight = fontSize * 1.25;
  const startY = rect.y + rect.h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, rect.x + rect.w / 2, startY + i * lineHeight));
  ctx.restore();
}

function drawSpeechShape(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const { x, y, w, h } = rect;
  const radius = Math.min(18, w / 5, h / 5);
  const tailSize = Math.min(22, w / 6);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + w / 2 + tailSize, y + h);
  ctx.lineTo(x + w / 2, y + h + tailSize);
  ctx.lineTo(x + w / 2 - tailSize, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawThoughtShape(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const sizes = [Math.min(14, h / 5), Math.min(10, h / 7), Math.min(6, h / 10)];
  let px = cx - sizes[0];
  let py = y + h + sizes[0];
  sizes.forEach((size) => {
    ctx.beginPath();
    ctx.arc(px, py, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    px += size * 1.3;
    py += size * 1.1;
  });
}

function drawShoutShape(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.max(w, h) / 2;
  const innerR = outerR * 0.65;
  const points = 12;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r * (w / (w + h)) * 2;
    const py = cy + Math.sin(angle) * r * (h / (w + h)) * 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawWhisperShape(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const { x, y, w, h } = rect;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawNarrativeShape(ctx: CanvasRenderingContext2D, rect: SelectionRect) {
  const { x, y, w, h } = rect;
  const radius = 6;
  ctx.fillStyle = 'rgba(255,230,150,0.85)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

export function drawSpeechBubble(canvas: HTMLCanvasElement, rect: SelectionRect, text: string, type: BubbleType, fontSize: number) {
  const ctx = canvas.getContext('2d')!;
  switch (type) {
    case 'speech':
      drawSpeechShape(ctx, rect);
      break;
    case 'thought':
      drawThoughtShape(ctx, rect);
      break;
    case 'shout':
      drawShoutShape(ctx, rect);
      break;
    case 'whisper':
      drawWhisperShape(ctx, rect);
      break;
    case 'narrative':
      drawNarrativeShape(ctx, rect);
      break;
  }
  drawBubbleText(ctx, rect, text, fontSize);
}

/**
 * Composition assistant: finds where the eye will go (a saliency map from contrast, edges and colour that
 * differs from the paper), then compares it with the classic layouts and says what it sees and why it
 * might matter. It only advises; nothing on the canvas changes.
 */

export interface CompositionTip {
  id: string;
  severity: 'good' | 'info' | 'warning';
  title: string;
  why: string;
  suggestion: string;
  /** Something the app can switch on to help check it. */
  action?: { id: 'thirds' | 'center' | 'golden'; label: string };
}

export interface CompositionResult {
  /** Where the attention concentrates, 0–1 in both axes. */
  focus: { x: number; y: number };
  /** Share of the visual weight on each side: 0 = all on the left/top, 1 = all on the right/bottom. */
  balance: { x: number; y: number };
  /** Fraction of the picture that carries content (0–1). */
  coverage: number;
  nearestPowerPoint: { x: number; y: number; distance: number };
  tips: CompositionTip[];
  /** Attention map, for showing. */
  heat: HTMLCanvasElement;
  /** A crop of the same shape that would put the focus on the nearest power point. */
  suggestedCrop: { x: number; y: number; w: number; h: number } | null;
}

const G = 64;

function paperColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const votes = new Map<number, { n: number; c: [number, number, number] }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const v = votes.get(k);
    if (v) v.n++;
    else votes.set(k, { n: 1, c: [d[i], d[i + 1], d[i + 2]] });
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  let best: { n: number; c: [number, number, number] } | null = null;
  for (const v of votes.values()) if (!best || v.n > best.n) best = v;
  return best!.c;
}

export function analyzeComposition(source: HTMLCanvasElement): CompositionResult {
  const w = G;
  const h = Math.max(8, Math.round((G * source.height) / source.width));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const paper = paperColor(d, w, h);
  const luma = new Float32Array(w * h);
  const diff = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    luma[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    diff[i] = Math.max(Math.abs(d[i * 4] - paper[0]), Math.abs(d[i * 4 + 1] - paper[1]), Math.abs(d[i * 4 + 2] - paper[2])) / 255;
  }
  // saliency: how different a cell is from its surroundings + how much the picture changes there
  const sal = new Float32Array(w * h);
  let max = 1e-6;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let around = 0;
      for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) around += luma[Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))];
      around /= 9;
      const gx = luma[i + 1] - luma[i - 1];
      const gy = luma[i + w] - luma[i - w];
      const s = Math.abs(luma[i] - around) * 1.2 + Math.hypot(gx, gy) * 2 + diff[i] * 0.9;
      sal[i] = s;
      if (s > max) max = s;
    }
  }
  let total = 0;
  let fx = 0;
  let fy = 0;
  let left = 0;
  let top = 0;
  let content = 0;
  const thr = 0.18 * max;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = sal[y * w + x];
      const v = s * s; // emphasise the strong regions so a faint texture does not drag the focus
      total += v;
      fx += v * x;
      fy += v * y;
      if (x < w / 2) left += v;
      if (y < h / 2) top += v;
      if (s > thr) content++;
    }
  }
  total = total || 1;
  const focus = { x: fx / total / w, y: fy / total / h };
  const balance = { x: 1 - left / total, y: 1 - top / total };
  const coverage = content / (w * h);

  const points = [[1 / 3, 1 / 3], [2 / 3, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 2 / 3]];
  let nearest = { x: points[0][0], y: points[0][1], distance: 9 };
  for (const [px, py] of points) {
    const dist = Math.hypot((focus.x - px) * (source.width / source.height), focus.y - py);
    if (dist < nearest.distance) nearest = { x: px, y: py, distance: dist };
  }
  const fromCenter = Math.hypot((focus.x - 0.5) * (source.width / source.height), focus.y - 0.5);

  // bounding box of the content, to see whether it is tiny or jammed against an edge
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sal[y * w + x] > thr) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const bw = x1 >= 0 ? (x1 - x0 + 1) / w : 0;
  const bh = y1 >= 0 ? (y1 - y0 + 1) / h : 0;

  const tips: CompositionTip[] = [];
  if (coverage < 0.005) {
    tips.push({ id: 'empty', severity: 'info', title: 'Casi no hay contenido que analizar', why: 'El lienzo está prácticamente vacío o es un solo color.', suggestion: 'Dibuja las formas principales y vuelve a analizar: el asistente mira dónde se concentra el peso visual.' });
  } else {
    if (nearest.distance < 0.09) {
      tips.push({ id: 'thirds-ok', severity: 'good', title: 'El foco cae cerca de un punto de tercios', why: 'Colocar lo importante en una intersección de la regla de los tercios suele dar más dinamismo que centrarlo.', suggestion: 'Refuerza ese punto (contraste, detalle o color) para que la mirada llegue sin dudar.', action: { id: 'thirds', label: 'Ver la cuadrícula de tercios' } });
    } else if (fromCenter < 0.08) {
      tips.push({ id: 'centered', severity: 'info', title: 'El foco está en el centro', why: 'Un centro exacto se lee estable pero estático, y suele dejar el resto del cuadro sin función.', suggestion: `Prueba a desplazar el elemento principal hacia ${nearest.x < 0.5 ? 'la izquierda' : 'la derecha'} y ${nearest.y < 0.5 ? 'arriba' : 'abajo'}, hacia un punto de tercios, o compensa con un elemento secundario al lado contrario.`, action: { id: 'thirds', label: 'Ver la cuadrícula de tercios' } });
    } else {
      tips.push({ id: 'focus-off', severity: 'info', title: 'El foco no coincide con un punto clásico', why: 'No es un error: solo comprueba si es una decisión tuya. Un foco a medio camino entre el centro y un tercio suele leerse indeciso.', suggestion: 'Acércalo a un punto de tercios o al centro para que se note que es intencionado.', action: { id: 'thirds', label: 'Ver la cuadrícula de tercios' } });
    }
    if (Math.abs(balance.x - 0.5) > 0.18) {
      const side = balance.x < 0.5 ? 'izquierda' : 'derecha';
      tips.push({ id: 'balance-x', severity: 'warning', title: `El peso visual se acumula a la ${side}`, why: `Aproximadamente el ${Math.round((balance.x < 0.5 ? 1 - balance.x : balance.x) * 100)} % de la atención está en ese lado: el cuadro se siente inclinado.`, suggestion: `Equilibra con algo más pequeño pero contrastado en el lado ${balance.x < 0.5 ? 'derecho' : 'izquierdo'} (un objeto, una sombra, un color), o deja aire a propósito si buscas tensión.` });
    }
    if (Math.abs(balance.y - 0.5) > 0.2) {
      tips.push({ id: 'balance-y', severity: 'info', title: `El peso visual está ${balance.y < 0.5 ? 'arriba' : 'abajo'}`, why: balance.y < 0.5 ? 'Lo más cargado queda en la parte alta: puede parecer que el cuadro "cuelga".' : 'Lo más cargado queda abajo: da estabilidad, pero la parte alta puede quedar vacía.', suggestion: 'Comprueba que la mirada tiene un recorrido: un elemento secundario en el otro extremo ayuda a que recorra el cuadro.' });
    }
    if (bw < 0.35 && bh < 0.35) tips.push({ id: 'small', severity: 'info', title: 'El sujeto ocupa poco espacio', why: `El contenido ocupa aproximadamente ${Math.round(bw * 100)} × ${Math.round(bh * 100)} % del cuadro.`, suggestion: 'Si no buscas sensación de soledad o escala, acerca el encuadre o agranda el sujeto para ganar impacto.' });
    if (x0 <= 1 || y0 <= 1 || x1 >= w - 2 || y1 >= h - 2) tips.push({ id: 'tight', severity: 'info', title: 'El contenido llega hasta el borde', why: 'Un recorte justo en el borde crea tensión: bien usado dirige la mirada, mal usado parece un descuido.', suggestion: 'Decide si el corte es deliberado; si no, deja un margen o corta claramente por una articulación/objeto para que no "corte" a la mitad.' });
  }

  // attention map for display
  const heat = document.createElement('canvas');
  heat.width = w;
  heat.height = h;
  const hctx = heat.getContext('2d')!;
  const img = hctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, sal[i] / max);
    img.data[i * 4] = Math.round(255 * Math.min(1, v * 2));
    img.data[i * 4 + 1] = Math.round(255 * Math.max(0, v * 2 - 1));
    img.data[i * 4 + 2] = Math.round(60 * (1 - v));
    img.data[i * 4 + 3] = Math.round(40 + 190 * v);
  }
  hctx.putImageData(img, 0, 0);

  // a crop (same shape, 85 % size) that lands the focus on the nearest power point
  let suggestedCrop: CompositionResult['suggestedCrop'] = null;
  if (coverage >= 0.005 && nearest.distance >= 0.09) {
    const cw = 0.85;
    const cx = Math.max(0, Math.min(1 - cw, focus.x - nearest.x * cw));
    const cy = Math.max(0, Math.min(1 - cw, focus.y - nearest.y * cw));
    suggestedCrop = { x: cx * source.width, y: cy * source.height, w: cw * source.width, h: cw * source.height };
  }
  return { focus, balance, coverage, nearestPowerPoint: nearest, tips, heat, suggestedCrop };
}

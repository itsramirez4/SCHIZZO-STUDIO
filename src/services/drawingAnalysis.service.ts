/**
 * "Why isn't it working?" — a heuristic analyser for the flattened drawing.
 *
 * What it really measures (pixel statistics on a downsampled copy): value range and grouping,
 * where the visual weight sits, where contrast concentrates, left/right mirror similarity,
 * the dominant edge orientation, and how spread out the hues are.
 * What it does NOT do: recognise subjects, faces, hands or anatomy, or judge whether
 * proportions are "right". Findings are observations with an explanation and a suggestion —
 * the drawing is never modified.
 */

export type FindingSeverity = 'good' | 'info' | 'warning';
export type FindingCategory = 'Valores' | 'Composición' | 'Líneas y perspectiva' | 'Color' | 'Simetría';
export type FindingAction = 'gridThirds' | 'gridUniform' | 'mirrorView' | 'valueView';

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  /** Why this matters / what was measured. */
  why: string;
  suggestion: string;
  /** Question offering an optional visual aid, in the tutor's voice. */
  question?: string;
  action?: { id: FindingAction; label: string };
}

export interface AnalysisResult {
  findings: Finding[];
  /** Coverage of non-background pixels, 0–1. */
  inkCoverage: number;
  /** 4-level posterised value map and flat-area highlight, for previewing in the panel. */
  valueMap: HTMLCanvasElement;
  flatMap: HTMLCanvasElement;
  size: { w: number; h: number };
}

const MAX_SIDE = 256;

interface Grid {
  w: number;
  h: number;
  luma: Float32Array;
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
  ink: Uint8Array;
}

function toGrid(source: HTMLCanvasElement, bg: string): Grid {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(8, Math.round(source.width * scale));
  const h = Math.max(8, Math.round(source.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const n = w * h;
  const luma = new Float32Array(n);
  const r = new Uint8ClampedArray(n);
  const g = new Uint8ClampedArray(n);
  const b = new Uint8ClampedArray(n);
  const counts = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    r[i] = d[i * 4];
    g[i] = d[i * 4 + 1];
    b[i] = d[i * 4 + 2];
    luma[i] = (0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i]) / 255;
    const q = ((r[i] >> 4) << 8) | ((g[i] >> 4) << 4) | (b[i] >> 4);
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  // Background = the dominant colour, only if it really dominates (a fully painted canvas has none).
  let modeKey = 0;
  let modeCount = 0;
  counts.forEach((v, k) => {
    if (v > modeCount) {
      modeCount = v;
      modeKey = k;
    }
  });
  const hasBg = modeCount / n >= 0.15;
  const bgR = ((modeKey >> 8) & 15) * 16 + 8;
  const bgG = ((modeKey >> 4) & 15) * 16 + 8;
  const bgB = (modeKey & 15) * 16 + 8;
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    ink[i] = !hasBg || Math.max(Math.abs(r[i] - bgR), Math.abs(g[i] - bgG), Math.abs(b[i] - bgB)) > 28 ? 1 : 0;
  }
  return { w, h, luma, r, g, b, ink };
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

function sobel(grid: Grid): { gx: Float32Array; gy: Float32Array; mag: Float32Array } {
  const { w, h, luma } = grid;
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = luma[i - w - 1], b = luma[i - w], c = luma[i - w + 1];
      const d = luma[i - 1], f = luma[i + 1];
      const g = luma[i + w - 1], hh = luma[i + w], k = luma[i + w + 1];
      const sx = c + 2 * f + k - (a + 2 * d + g);
      const sy = g + 2 * hh + k - (a + 2 * b + c);
      gx[i] = sx;
      gy[i] = sy;
      mag[i] = Math.hypot(sx, sy);
    }
  }
  return { gx, gy, mag };
}

function makeCanvas(w: number, h: number, paint: (img: ImageData) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  paint(img);
  ctx.putImageData(img, 0, 0);
  return c;
}

export function analyzeDrawing(source: HTMLCanvasElement, background: string): AnalysisResult {
  const grid = toGrid(source, background);
  const { w, h, luma, ink } = grid;
  const n = w * h;
  const findings: Finding[] = [];

  let inkCount = 0;
  for (let i = 0; i < n; i++) inkCount += ink[i];
  const inkCoverage = inkCount / n;

  // ---- preview maps
  const valueMap = makeCanvas(w, h, (img) => {
    for (let i = 0; i < n; i++) {
      const level = Math.min(3, Math.floor(luma[i] * 4));
      const v = Math.round((level / 3) * 255);
      img.data.set([v, v, v, 255], i * 4);
    }
  });

  const { gx, gy, mag } = sobel(grid);

  // Flat areas: inked pixels whose 5×5 neighbourhood has almost no value variation.
  const flat = new Uint8Array(n);
  let flatCount = 0;
  const R = 2;
  for (let y = R; y < h - R; y++) {
    for (let x = R; x < w - R; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      let lo = 1, hi = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const l = luma[i + dy * w + dx];
        if (l < lo) lo = l;
        if (l > hi) hi = l;
      }
      if (hi - lo < 0.025) {
        flat[i] = 1;
        flatCount++;
      }
    }
  }
  const flatMap = makeCanvas(w, h, (img) => {
    for (let i = 0; i < n; i++) {
      const v = Math.round(luma[i] * 255 * 0.55 + 60);
      if (flat[i]) img.data.set([255, 140, 40, 255], i * 4);
      else img.data.set([v, v, v, 255], i * 4);
    }
  });

  if (inkCoverage < 0.005) {
    return {
      findings: [{ id: 'empty', category: 'Composición', severity: 'info', title: 'Todavía hay muy poco dibujo', why: 'Menos del 0,5 % del lienzo tiene contenido distinto del fondo.', suggestion: 'Vuelve a analizar cuando tengas un boceto o unas masas de valor más definidas.' }],
      inkCoverage, valueMap, flatMap, size: { w, h },
    };
  }

  // ---- values
  const lo = percentile(luma, 0.01);
  const hi = percentile(luma, 0.99);
  const range = hi - lo;
  const bandShare = [0, 0, 0, 0, 0];
  let mid = 0;
  for (let i = 0; i < n; i++) {
    if (!ink[i]) continue;
    bandShare[Math.min(4, Math.floor(luma[i] * 5))]++;
    if (luma[i] >= 0.3 && luma[i] <= 0.7) mid++;
  }
  const occupied = bandShare.filter((c) => c / inkCount >= 0.05).length;
  const filled = inkCoverage > 0.15;

  if (range < 0.4) {
    findings.push({
      id: 'low-contrast', category: 'Valores', severity: 'warning',
      title: 'Poco contraste de valores',
      why: `Entre lo más oscuro y lo más claro solo hay un ${(range * 100).toFixed(0)} % de la escala tonal. Con poco rango, las formas se funden y el dibujo se lee plano, sobre todo a distancia o en pequeño.`,
      suggestion: 'Decide dónde quieres el tono más oscuro y el más claro y reserva el máximo contraste para tu punto de interés. Si el resto queda en medios tonos, el foco destacará solo.',
      question: '¿Quieres ver tu dibujo reducido a 4 valores para comprobar si las masas se leen?',
      action: { id: 'valueView', label: 'Ver mapa de valores' },
    });
  } else if (filled && mid / inkCount > 0.8) {
    findings.push({
      id: 'midtones', category: 'Valores', severity: 'warning',
      title: 'Casi todo está en medios tonos',
      why: `El ${((mid / inkCount) * 100).toFixed(0)} % del contenido está entre el 30 % y el 70 % de luminosidad: faltan luces claras y sombras profundas que den volumen y profundidad.`,
      suggestion: 'Oscurece las sombras de contacto y las zonas más alejadas de la luz, y deja 1 o 2 acentos de luz máxima en lo importante.',
      action: { id: 'valueView', label: 'Ver mapa de valores' },
    });
  } else if (filled && occupied <= 2) {
    findings.push({
      id: 'few-values', category: 'Valores', severity: 'info',
      title: `Solo ${occupied} grupo(s) de valor`,
      why: 'Un dibujo que "lee" bien suele agrupar sus valores en 3–5 masas (luz, medios, sombra). Aquí hay menos, así que las formas dependen solo del contorno.',
      suggestion: 'Añade un valor intermedio entre luz y sombra para describir el giro de las formas.',
      action: { id: 'valueView', label: 'Ver mapa de valores' },
    });
  } else if (range >= 0.6 && (!filled || occupied >= 3)) {
    findings.push({
      id: 'good-values', category: 'Valores', severity: 'good',
      title: 'Buen rango de valores',
      why: `Cubres un ${(range * 100).toFixed(0)} % de la escala tonal${filled ? ` en ${occupied} grupos de valor` : ''}.`,
      suggestion: 'Comprueba que el mayor contraste coincide con tu punto de interés.',
    });
  }

  const flatShare = inkCount > 0 ? flatCount / inkCount : 0;
  if (filled && flatShare > 0.55) {
    findings.push({
      id: 'flat-areas', category: 'Valores', severity: 'info',
      title: 'Grandes zonas sin variación de valor',
      why: `El ${(flatShare * 100).toFixed(0)} % del contenido es de un tono uniforme (5×5 px sin variación apreciable). Una superficie plana se lee como un recorte, no como una forma con volumen.`,
      suggestion: 'En esas zonas piensa hacia dónde gira la superficie y sugiere un degradado suave de luz a sombra. La vista "zonas planas" las marca en naranja.',
    });
  }

  // ---- composition
  let mass = 0, cx = 0, cy = 0, left = 0, right = 0;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let borderInk = 0, borderTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (onBorder) { borderTotal++; if (ink[i]) borderInk++; }
      if (!ink[i]) continue;
      // Darker and more contrasted marks carry more visual weight.
      const wgt = 0.25 + (1 - luma[i]) * 0.75;
      mass += wgt;
      cx += x * wgt;
      cy += y * wgt;
      if (x < w / 2) left += wgt; else right += wgt;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  cx = cx / mass / w;
  cy = cy / mass / h;
  const bboxArea = ((maxX - minX + 1) * (maxY - minY + 1)) / n;
  const balance = Math.max(left, right) / Math.max(1e-6, Math.min(left, right));

  if (bboxArea < 0.1 && inkCoverage < 0.08) {
    findings.push({
      id: 'small-subject', category: 'Composición', severity: 'info',
      title: 'El contenido ocupa muy poco espacio',
      why: `Todo lo dibujado cabe en el ${(bboxArea * 100).toFixed(0)} % del lienzo; el resto está vacío.`,
      suggestion: 'Si es intencionado (espacio negativo), refuérzalo con un foco claro. Si no, prueba a acercar el encuadre o a aumentar el tamaño del sujeto.',
    });
  }
  if (balance > 2.4 && mass > 0) {
    const heavy = left > right ? 'izquierda' : 'derecha';
    findings.push({
      id: 'unbalanced', category: 'Composición', severity: 'info',
      title: `El peso visual se concentra a la ${heavy}`,
      why: `La mitad ${heavy} acumula ${balance > 12 ? 'muchísimo más' : `${balance.toFixed(1)}× más`} peso visual (masa oscura y contenido) que la otra. Sin un contrapeso, el ojo tiende a "caerse" hacia ese lado.`,
      suggestion: 'Puedes equilibrarlo con un elemento pequeño pero contrastado en el lado ligero, o dejando aire hacia donde mira/se mueve el sujeto.',
      question: '¿Activo una cuadrícula de tercios para colocar los pesos?',
      action: { id: 'gridThirds', label: 'Mostrar regla de tercios' },
    });
  }
  if (Math.abs(cx - 0.5) < 0.04 && Math.abs(cy - 0.5) < 0.04 && inkCoverage < 0.6) {
    findings.push({
      id: 'centered', category: 'Composición', severity: 'info',
      title: 'El centro de masas está casi exactamente en el centro',
      why: 'Una composición centrada es estable y estática. Es una decisión válida (retrato frontal, símbolo), pero suele ser menos dinámica que descentrar el foco.',
      suggestion: 'Prueba a mover el punto de interés hacia una intersección de tercios y compara.',
      action: { id: 'gridThirds', label: 'Mostrar regla de tercios' },
    });
  }
  if (borderTotal > 0 && borderInk / borderTotal > 0.03 && (minX <= 1 || maxX >= w - 2 || minY <= 1 || maxY >= h - 2) && inkCoverage < 0.7) {
    findings.push({
      id: 'edge-touch', category: 'Composición', severity: 'info',
      title: 'Hay elementos que tocan el borde del lienzo',
      why: `El ${((borderInk / borderTotal) * 100).toFixed(0)} % del perímetro contiene dibujo. Un recorte que corta justo por una articulación o roza el borde crea tensión o "tangencias" accidentales.`,
      suggestion: 'Decide si el recorte es intencionado: o bien deja respirar al sujeto, o bien recorta con decisión (por la mitad de un miembro, no por su extremo).',
    });
  }

  // Focal contrast: where does edge energy concentrate on a 6×6 grid?
  const cells = 6;
  const energy = new Float32Array(cells * cells);
  let totalEnergy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = mag[y * w + x];
    energy[Math.min(cells - 1, Math.floor((y / h) * cells)) * cells + Math.min(cells - 1, Math.floor((x / w) * cells))] += e;
    totalEnergy += e;
  }
  if (totalEnergy > 0) {
    let best = 0;
    for (let i = 1; i < energy.length; i++) if (energy[i] > energy[best]) best = i;
    const fx = ((best % cells) + 0.5) / cells;
    const fy = (Math.floor(best / cells) + 0.5) / cells;
    const share = energy[best] / totalEnergy;
    const nearThirds = [1 / 3, 2 / 3].some((tx) => Math.abs(fx - tx) < 0.13) && [1 / 3, 2 / 3].some((ty) => Math.abs(fy - ty) < 0.13);
    if (share > 0.14) {
      findings.push({
        id: 'focal', category: 'Composición', severity: nearThirds ? 'good' : 'info',
        title: nearThirds ? 'El mayor contraste cae cerca de un punto de tercios' : 'Dónde se concentra el contraste',
        why: `La zona con más contraste de bordes (${(share * 100).toFixed(0)} % del total) está a ~${(fx * 100).toFixed(0)} % del ancho y ~${(fy * 100).toFixed(0)} % del alto: es donde tenderá a ir la mirada.`,
        suggestion: nearThirds ? 'Buena ubicación. Asegúrate de que ahí está lo más importante del dibujo.' : 'Comprueba que esa es realmente tu zona de interés; si no, baja el contraste allí o súbelo donde quieras el foco.',
      });
    }
  }

  // ---- symmetry
  let agree = 0, compared = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) {
    const a = y * w + x;
    const b = y * w + (w - 1 - x);
    if (!ink[a] && !ink[b]) continue;
    compared++;
    if (Math.abs(luma[a] - luma[b]) < 0.08) agree++;
  }
  if (compared > n * 0.01) {
    const sym = agree / compared;
    if (sym > 0.8) {
      findings.push({
        id: 'symmetry', category: 'Simetría', severity: 'info',
        title: `Simetría bilateral alta (${(sym * 100).toFixed(0)} %)`,
        why: 'Comparada con su reflejo respecto al eje vertical central, la imagen coincide en casi todos los puntos con contenido. La simetría perfecta transmite orden y solemnidad, pero en figuras orgánicas suele verse rígida.',
        suggestion: 'Si no buscabas esa rigidez, rompe la simetría con la pose, la iluminación o pequeños detalles asimétricos.',
      });
    }
  }

  // ---- dominant line orientation (tilt)
  const bins = new Float32Array(180);
  let magTotal = 0;
  for (let i = 0; i < n; i++) {
    if (mag[i] < 0.25) continue;
    // Edge direction = perpendicular to the gradient; folded into [0,180).
    let deg = (Math.atan2(gy[i], gx[i]) * 180) / Math.PI + 90;
    deg = ((deg % 180) + 180) % 180;
    bins[Math.floor(deg) % 180] += mag[i];
    magTotal += mag[i];
  }
  if (magTotal > 0) {
    const smooth = (deg: number) => {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += bins[(((Math.round(deg) + k) % 180) + 180) % 180];
      return s;
    };
    let bestDeg = 0, bestVal = 0;
    // Search near the two axes only: vertical (90°) and horizontal (0°/180°).
    for (let d = 78; d <= 102; d++) { const v = smooth(d); if (v > bestVal) { bestVal = v; bestDeg = d; } }
    for (let d = -12; d <= 12; d++) { const v = smooth(d); if (v > bestVal) { bestVal = v; bestDeg = d < 0 ? d + 180 : d; } }
    const vertical = bestDeg >= 60 && bestDeg <= 120;
    // The ±2° smoothing window makes a sharp peak a flat plateau, so `bestDeg` alone is biased
    // toward the plateau's edge. Refine it with the magnitude-weighted mean angle around it.
    let wsum = 0, ksum = 0;
    for (let k = -6; k <= 6; k++) {
      const wgt = bins[(((Math.round(bestDeg) + k) % 180) + 180) % 180];
      wsum += wgt;
      ksum += wgt * k;
    }
    const refined = wsum > 0 ? bestDeg + ksum / wsum : bestDeg;
    const offset = Math.round((vertical ? refined - 90 : refined > 90 ? refined - 180 : refined) * 10) / 10;
    if (bestVal / magTotal > 0.08 && Math.abs(offset) >= 2 && Math.abs(offset) <= 10) {
      const off = Math.round(Math.abs(offset));
      const dir = vertical
        ? offset < 0 ? 'se inclinan hacia la izquierda por arriba' : 'se inclinan hacia la derecha por arriba'
        : offset > 0 ? 'descienden hacia la derecha' : 'ascienden hacia la derecha';
      findings.push({
        id: 'tilt', category: 'Líneas y perspectiva', severity: 'info',
        title: `Las líneas ${vertical ? 'verticales' : 'horizontales'} dominantes ${dir} (~${off}°)`,
        why: `El ${((bestVal / magTotal) * 100).toFixed(0)} % de la energía de bordes se alinea casi con el eje ${vertical ? 'vertical' : 'horizontal'}, pero desviada unos ${off}°. Una leve inclinación que parece un error (no una decisión) suele leerse como descuido, y en perspectiva las verticales que convergen sin querer delatan un punto de fuga no planificado.`,
        suggestion: 'Comprueba con una guía si la inclinación es intencionada. Si no, gira ligeramente el lienzo o corrige el trazo; si sí, exagérala un poco para que se lea como decisión.',
        question: '¿Quieres activar una cuadrícula para comprobar la inclinación?',
        action: { id: 'gridUniform', label: 'Mostrar cuadrícula de comprobación' },
      });
    }
  }

  // ---- colour
  const hueBins = new Float32Array(12);
  let satSum = 0, colored = 0;
  for (let i = 0; i < n; i++) {
    if (!ink[i]) continue;
    const mx = Math.max(grid.r[i], grid.g[i], grid.b[i]);
    const mn = Math.min(grid.r[i], grid.g[i], grid.b[i]);
    if (mx === 0) continue;
    const sat = (mx - mn) / mx;
    satSum += sat;
    if (sat < 0.18 || mx < 40) continue;
    colored++;
    const d = mx - mn;
    let hue: number;
    if (mx === grid.r[i]) hue = ((grid.g[i] - grid.b[i]) / d) % 6;
    else if (mx === grid.g[i]) hue = (grid.b[i] - grid.r[i]) / d + 2;
    else hue = (grid.r[i] - grid.g[i]) / d + 4;
    hueBins[Math.floor((((hue * 60) + 360) % 360) / 30) % 12]++;
  }
  if (colored > inkCount * 0.1 && inkCount > 0) {
    const sectors = hueBins.filter((c) => c / colored >= 0.08).length;
    const meanSat = satSum / inkCount;
    if (sectors >= 6) {
      findings.push({
        id: 'wide-palette', category: 'Color', severity: 'info',
        title: `Paleta muy dispersa (${sectors} de 12 matices con presencia)`,
        why: 'Cuando casi todos los matices compiten a la vez, el color deja de organizar la imagen y cuesta ver cuál manda.',
        suggestion: 'Elige un color dominante y uno o dos de apoyo (por ejemplo una armonía análoga o complementaria) y usa los demás solo como acentos pequeños.',
      });
    } else if (sectors <= 3) {
      findings.push({
        id: 'tight-palette', category: 'Color', severity: 'good',
        title: 'Paleta cohesionada',
        why: `Solo ${sectors} zona(s) de matiz concentran el color, lo que da unidad a la imagen.`,
        suggestion: 'Un acento de un matiz contrario en el punto de interés puede reforzar el foco.',
      });
    }
    if (meanSat > 0.75) {
      findings.push({
        id: 'high-saturation', category: 'Color', severity: 'info',
        title: 'Saturación alta en casi toda la imagen',
        why: `La saturación media del contenido es del ${(meanSat * 100).toFixed(0)} %. Si todo grita, nada destaca: la saturación necesita zonas de descanso para funcionar.`,
        suggestion: 'Baja la saturación del fondo y de las zonas secundarias y reserva los colores más intensos para el foco.',
      });
    }
  }

  return { findings, inkCoverage, valueMap, flatMap, size: { w, h } };
}

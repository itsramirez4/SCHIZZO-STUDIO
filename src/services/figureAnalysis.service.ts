import type { Finding } from './drawingAnalysis.service';

/**
 * Proportion and pose checks on a figure described by 14 landmarks (placed by hand or by the pose
 * model). All numbers are measured in the image plane, so they assume a figure seen roughly from
 * the front or back and standing/hanging; strong foreshortening (a limb pointing at the viewer) or
 * a profile view distorts them, and the findings say so. The reference figures are the classical
 * artistic canons — useful yardsticks, not laws: stylised figures break them on purpose.
 */

export type LandmarkName =
  | 'headTop' | 'chin'
  | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR' | 'wristL' | 'wristR'
  | 'hipL' | 'hipR' | 'kneeL' | 'kneeR' | 'ankleL' | 'ankleR';

export type Landmarks = Record<LandmarkName, { x: number; y: number }>;

export const LANDMARK_NAMES: LandmarkName[] = [
  'headTop', 'chin', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
];

export const LANDMARK_LABELS: Record<LandmarkName, string> = {
  headTop: 'Coronilla', chin: 'Barbilla',
  shoulderL: 'Hombro izq.', shoulderR: 'Hombro der.', elbowL: 'Codo izq.', elbowR: 'Codo der.', wristL: 'Muñeca izq.', wristR: 'Muñeca der.',
  hipL: 'Cadera izq.', hipR: 'Cadera der.', kneeL: 'Rodilla izq.', kneeR: 'Rodilla der.', ankleL: 'Tobillo izq.', ankleR: 'Tobillo der.',
};

/** Bones drawn between landmarks (for the overlay). */
export const SKELETON: [LandmarkName, LandmarkName][] = [
  ['headTop', 'chin'], ['shoulderL', 'shoulderR'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'],
  ['shoulderL', 'hipL'], ['shoulderR', 'hipR'], ['hipL', 'hipR'], ['hipL', 'kneeL'], ['kneeL', 'ankleL'], ['hipR', 'kneeR'], ['kneeR', 'ankleR'],
];

export type FigureType = 'adult' | 'heroic' | 'child' | 'stylized';

export const FIGURE_TYPES: Record<FigureType, { label: string; heads: [number, number]; shoulders: [number, number] | null }> = {
  adult: { label: 'Adulto realista', heads: [6.8, 8.6], shoulders: [1.7, 2.7] },
  heroic: { label: 'Cómic / héroe (8-9 cabezas)', heads: [7.8, 9.6], shoulders: [2.4, 3.5] },
  child: { label: 'Niño', heads: [4.8, 6.6], shoulders: [1.4, 2.3] },
  stylized: { label: 'Estilizado / caricatura (sin canon)', heads: [0, 99], shoulders: null },
};

export interface FigureMeasures {
  heads: number;
  headLength: number;
  height: number;
  legFraction: number;
  armFraction: number;
  shoulderWidthHeads: number;
  frontal: boolean;
  headTiltDeg: number;
  shoulderTiltDeg: number;
  hipTiltDeg: number;
}

type P = { x: number; y: number };
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
/** Signed angle in degrees of the line a→b relative to horizontal, positive = b lower (clockwise on screen). */
const angleH = (a: P, b: P) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const norm180 = (d: number) => {
  let x = d % 180;
  if (x > 90) x -= 180;
  if (x < -90) x += 180;
  return x;
};

export function measureFigure(l: Landmarks): FigureMeasures {
  const shoulderMid = mid(l.shoulderL, l.shoulderR);
  const hipMid = mid(l.hipL, l.hipR);
  const ankleMid = mid(l.ankleL, l.ankleR);
  const headLength = Math.max(1e-6, dist(l.headTop, l.chin));
  const height = dist(l.headTop, ankleMid);
  const legL = dist(l.hipL, l.kneeL) + dist(l.kneeL, l.ankleL);
  const legR = dist(l.hipR, l.kneeR) + dist(l.kneeR, l.ankleR);
  const armL = dist(l.shoulderL, l.elbowL) + dist(l.elbowL, l.wristL);
  const armR = dist(l.shoulderR, l.elbowR) + dist(l.elbowR, l.wristR);
  const torso = Math.max(1e-6, dist(shoulderMid, hipMid));
  const shoulderWidth = dist(l.shoulderL, l.shoulderR);
  // Head axis (chin→crown) against the torso axis (hip→shoulder): 0° when the head sits straight on the spine.
  const headAxis = (Math.atan2(l.headTop.y - l.chin.y, l.headTop.x - l.chin.x) * 180) / Math.PI;
  const torsoAxis = (Math.atan2(shoulderMid.y - hipMid.y, shoulderMid.x - hipMid.x) * 180) / Math.PI;
  return {
    heads: height / headLength,
    headLength,
    height,
    legFraction: (legL + legR) / 2 / Math.max(1e-6, height),
    armFraction: (armL + armR) / 2 / Math.max(1e-6, height),
    shoulderWidthHeads: shoulderWidth / headLength,
    // Frontal/back views show a shoulder line about as wide as the torso is long; in profile it collapses.
    frontal: shoulderWidth / torso > 0.6,
    headTiltDeg: norm180(headAxis - torsoAxis),
    shoulderTiltDeg: norm180(angleH(l.shoulderR, l.shoulderL)),
    hipTiltDeg: norm180(angleH(l.hipR, l.hipL)),
  };
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',');

export function analyzeFigure(l: Landmarks, type: FigureType): { findings: Finding[]; measures: FigureMeasures } {
  const m = measureFigure(l);
  const spec = FIGURE_TYPES[type];
  const findings: Finding[] = [];
  const push = (x: Finding) => findings.push(x);
  const H = Math.max(1e-6, m.height);

  // ---- overall proportion in heads
  if (type === 'stylized') {
    push({
      id: 'heads', category: 'Proporciones', severity: 'info',
      title: `La figura mide ${f1(m.heads)} cabezas`,
      why: 'Has elegido un estilo sin canon: solo te muestro la medida, sin juzgarla. Cada estilo tiene el suyo (chibi ≈ 2-3, cómic ≈ 6, héroe ≈ 8-9).',
      suggestion: 'Lo importante es que sea coherente en toda la ilustración.',
    });
  } else if (m.heads < spec.heads[0] || m.heads > spec.heads[1]) {
    const tall = m.heads > spec.heads[1];
    push({
      id: 'heads', category: 'Proporciones', severity: 'warning',
      title: `La figura mide ${f1(m.heads)} cabezas (${spec.label.toLowerCase()}: ${f1(spec.heads[0])}–${f1(spec.heads[1])})`,
      why: `De la coronilla a los pies caben ${f1(m.heads)} cabezas. ${tall ? 'La cabeza resulta pequeña o el cuerpo largo' : 'La cabeza resulta grande o el cuerpo corto'} respecto al canon de ese tipo de figura; ${type === 'adult' ? 'a los adultos se les suele dibujar de 7 a 8 cabezas' : ''}.`,
      suggestion: tall ? 'Comprueba si has alargado torso o piernas, o si la cabeza es más pequeña que el resto.' : 'Comprueba si has acortado piernas o torso, o si la cabeza es demasiado grande.',
      question: '¿Quieres superponer una guía de figura con esa proporción para compararla?',
      action: { id: 'figureGuide', label: 'Superponer guía de figura' },
    });
  } else {
    push({
      id: 'heads', category: 'Proporciones', severity: 'good',
      title: `Altura de ${f1(m.heads)} cabezas: dentro del canon`,
      why: `Entra en el rango habitual de ${spec.label.toLowerCase()} (${f1(spec.heads[0])}–${f1(spec.heads[1])}).`,
      suggestion: 'Comprueba ahora las proporciones internas (piernas, brazos).',
    });
  }

  // ---- legs / arms
  if (type !== 'stylized') {
    // hip→ankle is ~0.46–0.52 of total height in adults; children have shorter legs.
    const [lo, hi] = type === 'child' ? [0.38, 0.48] : [0.42, 0.55];
    if (m.legFraction < lo || m.legFraction > hi) {
      const short = m.legFraction < lo;
      push({
        id: 'legs', category: 'Proporciones', severity: 'warning',
        title: `Piernas ${short ? 'cortas' : 'largas'} respecto a la altura`,
        why: `Cadera→tobillo suma el ${Math.round(m.legFraction * 100)} % de la altura; lo habitual es ${Math.round(lo * 100)}–${Math.round(hi * 100)} %. ${short ? 'La figura queda "de torso largo".' : 'La figura queda "de piernas de jirafa".'}`,
        suggestion: 'La entrepierna suele caer hacia la mitad de la altura total: marca ese punto y compara.',
      });
    }
    const [alo, ahi] = [0.30, 0.42];
    if (m.armFraction < alo || m.armFraction > ahi) {
      push({
        id: 'arms', category: 'Proporciones', severity: 'info',
        title: `Brazos ${m.armFraction < alo ? 'cortos' : 'largos'} respecto a la altura`,
        why: `Hombro→muñeca suma el ${Math.round(m.armFraction * 100)} % de la altura (lo habitual: ${Math.round(alo * 100)}–${Math.round(ahi * 100)} %). Con los brazos caídos, las muñecas quedan hacia la entrepierna.`,
        suggestion: 'Si el brazo apunta hacia la cámara, el escorzo lo acorta aposta; si no, ajusta su longitud.',
      });
    }
  }

  // ---- segment ratios and left/right differences
  const seg = (a: P, b: P) => dist(a, b);
  const upperL = seg(l.shoulderL, l.elbowL), foreL = seg(l.elbowL, l.wristL);
  const upperR = seg(l.shoulderR, l.elbowR), foreR = seg(l.elbowR, l.wristR);
  const armL = upperL + foreL, armR = upperR + foreR;
  const legL = seg(l.hipL, l.kneeL) + seg(l.kneeL, l.ankleL), legR = seg(l.hipR, l.kneeR) + seg(l.kneeR, l.ankleR);
  const asym = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 1e-6);
  if (asym(armL, armR) > 0.22 || asym(legL, legR) > 0.22) {
    const which = asym(armL, armR) > 0.22 ? 'brazos' : 'piernas';
    push({
      id: 'asym', category: 'Proporciones', severity: 'info',
      title: `Los ${which} izquierdo y derecho miden distinto (${Math.round(Math.max(asym(armL, armR), asym(legL, legR)) * 100)} % de diferencia)`,
      why: 'Cuando una extremidad se mide bastante más corta que su gemela, o hay un error, o hay escorzo (apunta hacia la cámara o se aleja).',
      suggestion: 'Si no es un escorzo intencionado, iguala las longitudes; si lo es, comprueba que el escorzo se lee (solapamientos, tamaños de mano/pie).',
    });
  }
  const ratios = [upperL / Math.max(foreL, 1e-6), upperR / Math.max(foreR, 1e-6)];
  if (ratios.some((r) => r > 1.7 || r < 0.75)) {
    push({
      id: 'armRatio', category: 'Anatomía y pose', severity: 'info',
      title: 'Brazo y antebrazo poco proporcionados',
      why: 'El antebrazo suele medir casi lo mismo que el brazo (brazo ≈ 1,1–1,3 veces el antebrazo). Aquí la diferencia es mayor.',
      suggestion: 'Comprueba dónde has puesto el codo: suele quedar a la altura de la cintura cuando el brazo cuelga.',
    });
  }

  // ---- shoulder width (frontal only)
  if (m.frontal && spec.shoulders && (m.shoulderWidthHeads < spec.shoulders[0] || m.shoulderWidthHeads > spec.shoulders[1])) {
    const narrow = m.shoulderWidthHeads < spec.shoulders[0];
    push({
      id: 'shoulders', category: 'Proporciones', severity: 'info',
      title: `Hombros ${narrow ? 'estrechos' : 'anchos'}: ${f1(m.shoulderWidthHeads)} cabezas de ancho`,
      why: `Para ${spec.label.toLowerCase()} lo habitual es ${f1(spec.shoulders[0])}–${f1(spec.shoulders[1])} cabezas entre hombros (las mujeres, hacia el extremo bajo).`,
      suggestion: narrow ? 'Puede dar una silueta débil o infantil; ensancha los hombros si no lo buscas.' : 'Puede dar una silueta muy corpulenta; redúcelos si no lo buscas.',
    });
  }

  // ---- tilts
  if (Math.abs(m.headTiltDeg) >= 4) {
    const dir = m.headTiltDeg > 0 ? 'hacia la izquierda de la imagen' : 'hacia la derecha de la imagen';
    push({
      id: 'headTilt', category: 'Anatomía y pose', severity: 'info',
      title: `La cabeza está inclinada ~${Math.round(Math.abs(m.headTiltDeg))}° ${m.headTiltDeg > 0 ? 'hacia la derecha' : 'hacia la izquierda'} respecto a la columna`,
      why: `El eje barbilla→coronilla no sigue la línea de la columna: se desvía ${Math.round(Math.abs(m.headTiltDeg))}° (${dir}). Una inclinación pequeña que no parece intencionada se lee como un descuido; una clara da actitud.`,
      suggestion: 'Decide si la inclinación es expresiva. Si sí, exagérala un poco; si no, alinea la cabeza con el eje del cuerpo.',
      question: '¿Quieres activar una guía vertical para comprobar la inclinación?',
      action: { id: 'gridUniform', label: 'Mostrar cuadrícula de comprobación' },
    });
  }
  const tiltsOpposed = m.shoulderTiltDeg * m.hipTiltDeg < 0 && Math.abs(m.shoulderTiltDeg) >= 3 && Math.abs(m.hipTiltDeg) >= 3;
  if (tiltsOpposed) {
    push({
      id: 'contrapposto', category: 'Anatomía y pose', severity: 'good',
      title: 'Hombros y caderas se inclinan en sentidos contrarios (contrapposto)',
      why: `Hombros ${Math.round(m.shoulderTiltDeg)}° y caderas ${Math.round(m.hipTiltDeg)}°: el peso se apoya en una pierna y el torso compensa, lo que da naturalidad.`,
      suggestion: 'Comprueba que la pierna de apoyo queda bajo el centro de gravedad.',
    });
  } else if (Math.abs(m.shoulderTiltDeg) < 3 && Math.abs(m.hipTiltDeg) < 3 && m.frontal) {
    push({
      id: 'rigid', category: 'Anatomía y pose', severity: 'info',
      title: 'Hombros y caderas están casi horizontales',
      why: 'Con ambas líneas rectas la pose se ve rígida, como de pie firmes o de catálogo.',
      suggestion: 'Si buscas naturalidad, inclina caderas y hombros en sentidos opuestos (contrapposto) o apoya el peso en una pierna.',
    });
  }

  // ---- balance: does the centre of mass fall over the feet?
  const com = centreOfMass(l);
  const groundLevel = Math.max(l.ankleL.y, l.ankleR.y);
  const bothOnGround = Math.abs(l.ankleL.y - l.ankleR.y) < 0.07 * H;
  if (bothOnGround) {
    const margin = 0.05 * H;
    const left = Math.min(l.ankleL.x, l.ankleR.x) - margin;
    const right = Math.max(l.ankleL.x, l.ankleR.x) + margin;
    if (com.x < left || com.x > right) {
      const off = com.x < left ? left - com.x : com.x - right;
      push({
        id: 'balance', category: 'Anatomía y pose', severity: 'warning',
        title: 'La figura parece perder el equilibrio',
        why: `Con los dos pies en el suelo, el centro de gravedad (≈ ${Math.round(((com.x - (left + right) / 2) / H) * 100)} % de la altura desplazado del centro de los pies) cae ${Math.round((off / H) * 100)} % de la altura fuera de la base de apoyo.`,
        suggestion: 'Traslada un pie bajo el peso, inclina el torso al lado contrario, o convierte la pose en un paso/caída deliberado.',
      });
    }
    void groundLevel;
  }
  return { findings, measures: m };
}

/** Rough segment-weighted centre of mass (standard anthropometric mass fractions). */
export function centreOfMass(l: Landmarks): P {
  const parts: { w: number; p: P }[] = [
    { w: 0.08, p: mid(l.headTop, l.chin) },
    { w: 0.5, p: mid(mid(l.shoulderL, l.shoulderR), mid(l.hipL, l.hipR)) },
    { w: 0.03, p: mid(l.shoulderL, l.elbowL) }, { w: 0.03, p: mid(l.shoulderR, l.elbowR) },
    { w: 0.03, p: mid(l.elbowL, l.wristL) }, { w: 0.03, p: mid(l.elbowR, l.wristR) },
    { w: 0.1, p: mid(l.hipL, l.kneeL) }, { w: 0.1, p: mid(l.hipR, l.kneeR) },
    { w: 0.05, p: mid(l.kneeL, l.ankleL) }, { w: 0.05, p: mid(l.kneeR, l.ankleR) },
  ];
  const total = parts.reduce((s, q) => s + q.w, 0);
  return { x: parts.reduce((s, q) => s + q.p.x * q.w, 0) / total, y: parts.reduce((s, q) => s + q.p.y * q.w, 0) / total };
}

/** A canonical standing figure of `heads` heads, centred at cx, feet at y = groundY (for defaults and tests). */
export function canonicalFigure(cx: number, groundY: number, height: number, heads = 7.5): Landmarks {
  const head = height / heads;
  const top = groundY - height;
  const shoulderY = top + head * 1.55;
  const hipY = groundY - height * 0.5;
  const shoulderHalf = head * 0.95;
  const hipHalf = head * 0.55;
  const armLen = height * 0.35;
  const upper = armLen * 0.53;
  const fore = armLen * 0.47;
  const thigh = (hipY - groundY + height * 0.5 + 0) * 0 + height * 0.25;
  return {
    headTop: { x: cx, y: top }, chin: { x: cx, y: top + head },
    shoulderL: { x: cx + shoulderHalf, y: shoulderY }, shoulderR: { x: cx - shoulderHalf, y: shoulderY },
    elbowL: { x: cx + shoulderHalf + head * 0.1, y: shoulderY + upper }, elbowR: { x: cx - shoulderHalf - head * 0.1, y: shoulderY + upper },
    wristL: { x: cx + shoulderHalf + head * 0.15, y: shoulderY + upper + fore }, wristR: { x: cx - shoulderHalf - head * 0.15, y: shoulderY + upper + fore },
    hipL: { x: cx + hipHalf, y: hipY }, hipR: { x: cx - hipHalf, y: hipY },
    kneeL: { x: cx + hipHalf * 1.05, y: hipY + thigh }, kneeR: { x: cx - hipHalf * 1.05, y: hipY + thigh },
    ankleL: { x: cx + hipHalf * 1.1, y: groundY }, ankleR: { x: cx - hipHalf * 1.1, y: groundY },
  };
}

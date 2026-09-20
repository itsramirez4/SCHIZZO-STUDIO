import { ANIMAL_POSES, BODY_TYPES, BodyTypeId, EXPRESSION_PRESETS, Expression, HUMAN_POSES, SubjectKind, Vec3Deg } from '../mannequin.service';

/**
 * Turns a short Spanish description ("sentado con las piernas cruzadas, mirando a la izquierda") into a
 * mannequin pose or expression. It is a vocabulary of body language, not a language model: it says
 * exactly which words it understood and which it ignored, so the artist always knows what they got.
 */

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (t: string, ...words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(t));

export interface PoseResult {
  kind: SubjectKind;
  pose: Record<string, Vec3Deg>;
  bodyType?: BodyTypeId;
  /** What the description was understood as, in plain words. */
  understood: string[];
  /** Words that did not map to anything (so nothing is silently lost). */
  ignored: string[];
}

type Pose = Record<string, Vec3Deg>;
const humanBase = (id: string): Pose => ({ ...(HUMAN_POSES.find((p) => p.id === id)?.pose ?? {}) });
const add = (pose: Pose, joint: string, v: Vec3Deg) => {
  const cur = pose[joint] ?? [0, 0, 0];
  pose[joint] = [cur[0] + v[0], cur[1] + v[1], cur[2] + v[2]];
};

const BASES: { re: string[]; id: string; label: string }[] = [
  { re: ['corriendo', 'corre', 'correr', 'carrera', 'sprint'], id: 'run', label: 'corriendo' },
  { re: ['caminando', 'camina', 'andando', 'paseando', 'paso'], id: 'walk', label: 'caminando' },
  { re: ['saltando', 'salta', 'salto', 'en el aire'], id: 'jump', label: 'saltando' },
  { re: ['agachado', 'agachada', 'cuclillas', 'en cuclilla'], id: 'squat', label: 'agachado' },
  { re: ['pensativo', 'pensativa', 'pensando', 'reflexionando'], id: 'thinker', label: 'pensativo, sentado' },
  { re: ['sentado', 'sentada', 'sentarse', 'sentandose'], id: 'sit', label: 'sentado' },
  { re: ['luchando', 'pelea', 'combate', 'guardia', 'boxeando', 'boxeo'], id: 'guard', label: 'guardia de combate' },
  { re: ['saludando', 'saluda', 'saludo', 'diciendo adios'], id: 'wave', label: 'saludando' },
  { re: ['senalando', 'senala', 'apuntando', 'apunta'], id: 'point', label: 'señalando' },
  { re: ['alcanzando', 'estirandose', 'estirado hacia arriba'], id: 'reach', label: 'alcanzando arriba' },
  { re: ['contrapposto', 'relajado', 'relajada', 'apoyado en una pierna', 'posando', 'pose de modelo'], id: 'contrapposto', label: 'contrapposto (peso en una pierna)' },
  { re: ['en t', 'pose en t', 'brazos en cruz', 'brazos abiertos', 'en cruz'], id: 'tpose', label: 'pose en T' },
  { re: ['en a', 'pose en a'], id: 'apose', label: 'pose en A' },
  { re: ['de pie', 'parado', 'parada', 'quieto', 'quieta', 'en reposo'], id: 'rest', label: 'de pie' },
];

const ANIMALS: { re: string[]; kind: SubjectKind; label: string }[] = [
  { re: ['perro', 'perra', 'cachorro', 'can'], kind: 'dog', label: 'perro' },
  { re: ['gato', 'gata', 'gatito', 'felino'], kind: 'cat', label: 'gato' },
  { re: ['caballo', 'yegua', 'potro', 'equino'], kind: 'horse', label: 'caballo' },
];
const ANIMAL_BASES: { re: string[]; id: string; label: string }[] = [
  { re: ['galopando', 'galope', 'corriendo', 'corre'], id: 'gallop', label: 'galope' },
  { re: ['caminando', 'camina', 'andando'], id: 'walk', label: 'caminando' },
  { re: ['sentado', 'sentada'], id: 'sit', label: 'sentado' },
  { re: ['alerta', 'atento', 'atenta', 'vigilando'], id: 'alert', label: 'alerta' },
  { re: ['olfateando', 'huele', 'oliendo', 'husmeando'], id: 'sniff', label: 'olfateando' },
  { re: ['de pie', 'parado', 'quieto'], id: 'stand', label: 'de pie' },
];

const BODIES: { re: string[]; id: BodyTypeId; label: string }[] = [
  { re: ['nino', 'nina', 'infantil', 'pequeno'], id: 'child', label: 'niño/a' },
  { re: ['anciano', 'anciana', 'viejo', 'mayor', 'abuelo', 'abuela'], id: 'elderly', label: 'persona mayor' },
  { re: ['musculoso', 'musculosa', 'fornido', 'fuerte', 'atletico', 'atletica', 'deportista'], id: 'athletic', label: 'atlético' },
  { re: ['heroico', 'heroica', 'superheroe', 'imponente'], id: 'heroic', label: 'heroico' },
  { re: ['gordo', 'gorda', 'robusto', 'robusta', 'corpulento', 'corpulenta', 'grande'], id: 'heavy', label: 'corpulento' },
  { re: ['delgado', 'delgada', 'flaco', 'flaca', 'esbelto', 'esbelta'], id: 'slim', label: 'delgado' },
  { re: ['mujer', 'chica', 'femenino', 'femenina'], id: 'female', label: 'femenino' },
  { re: ['hombre', 'chico', 'masculino'], id: 'male', label: 'masculino' },
];

/** Words that carry no pose information — they must not be reported as "ignored". */
const FILLER = new Set('un una el la los las de del con y o en a al su sus se que muy mas menos poco algo como mientras hacia sobre por para pero solo tambien'.split(' '));

export function poseFromText(text: string): PoseResult {
  const t = normalize(text);
  const understood: string[] = [];
  const used = new Set<string>();
  const mark = (...w: string[]) => w.forEach((x) => x.split(' ').forEach((y) => used.add(y)));

  const animal = ANIMALS.find((a) => has(t, ...a.re));
  if (animal) {
    const base = ANIMAL_BASES.find((b) => has(t, ...b.re));
    const pose: Pose = { ...(ANIMAL_POSES.find((p) => p.id === (base?.id ?? 'stand'))?.pose ?? {}) };
    understood.push(animal.label, base?.label ?? 'de pie');
    mark(...animal.re, ...(base?.re ?? []));
    if (has(t, 'mirando arriba', 'cabeza alta')) { add(pose, 'neck', [-25, 0, 0]); understood.push('cabeza alta'); mark('mirando', 'arriba', 'cabeza', 'alta'); }
    if (has(t, 'cabeza baja', 'mirando abajo', 'agachando la cabeza')) { add(pose, 'neck', [35, 0, 0]); understood.push('cabeza baja'); mark('mirando', 'abajo', 'cabeza', 'baja', 'agachando'); }
    if (has(t, 'mirando a la izquierda', 'mira a la izquierda')) { add(pose, 'head', [0, 40, 0]); understood.push('mirando a la izquierda'); mark('mirando', 'izquierda', 'mira'); }
    if (has(t, 'mirando a la derecha', 'mira a la derecha')) { add(pose, 'head', [0, -40, 0]); understood.push('mirando a la derecha'); mark('mirando', 'derecha', 'mira'); }
    return { kind: animal.kind, pose, understood, ignored: ignoredWords(t, used) };
  }

  const bodyMatch = BODIES.find((b) => has(t, ...b.re));
  const base = BASES.find((b) => has(t, ...b.re));
  let pose: Pose = base ? humanBase(base.id) : humanBase('rest');
  if (base) { understood.push(base.label); mark(...base.re); }
  if (bodyMatch) { understood.push('complexión: ' + bodyMatch.label); mark(...bodyMatch.re); }

  // ---- arms
  const armsUp = (side: 'L' | 'R', deg = 165) => { pose[`shoulder${side}`] = [0, 0, side === 'L' ? deg : -deg]; pose[`elbow${side}`] = [-8, 0, 0]; };
  const both = has(t, 'ambos brazos', 'los dos brazos', 'brazos arriba', 'brazos levantados', 'manos arriba', 'manos en alto', 'brazos en alto', 'brazos hacia arriba', 'brazos al aire', 'manos hacia arriba', 'brazos alzados', 'levanta los brazos', 'levantando los brazos');
  if (both) { armsUp('L'); armsUp('R'); understood.push('ambos brazos arriba'); mark('ambos', 'brazos', 'hacia', 'arriba', 'aire', 'alzados', 'levanta', 'levantando', 'levantados', 'manos', 'alto', 'los', 'dos'); }
  else {
    if (has(t, 'brazo derecho arriba', 'brazo derecho levantado', 'levantando el brazo derecho', 'mano derecha arriba', 'levanta la mano derecha')) { armsUp('R'); understood.push('brazo derecho arriba'); mark('brazo', 'derecho', 'arriba', 'levantado', 'levantando', 'mano', 'derecha', 'levanta'); }
    if (has(t, 'brazo izquierdo arriba', 'brazo izquierdo levantado', 'levantando el brazo izquierdo', 'mano izquierda arriba', 'levanta la mano izquierda')) { armsUp('L'); understood.push('brazo izquierdo arriba'); mark('brazo', 'izquierdo', 'arriba', 'levantado', 'levantando', 'mano', 'izquierda', 'levanta'); }
  }
  if (has(t, 'brazos cruzados', 'cruzando los brazos', 'cruza los brazos', 'con los brazos cruzados')) {
    pose.shoulderL = [-35, 55, 12]; pose.elbowL = [-130, 0, 0]; pose.shoulderR = [-35, -55, -12]; pose.elbowR = [-130, 0, 0];
    understood.push('brazos cruzados'); mark('brazos', 'cruzados', 'cruzando', 'cruza');
  }
  if (has(t, 'manos en la cintura', 'manos en las caderas', 'manos en jarras', 'en jarras', 'manos a la cintura')) {
    pose.shoulderL = [0, -10, 30]; pose.elbowL = [-105, 0, 0]; pose.wristL = [0, 25, 0]; pose.shoulderR = [0, 10, -30]; pose.elbowR = [-105, 0, 0]; pose.wristR = [0, -25, 0];
    understood.push('manos en la cintura'); mark('manos', 'cintura', 'caderas', 'jarras');
  }
  if (has(t, 'brazos abiertos', 'brazos extendidos') && !both && base?.id !== 'tpose') { pose.shoulderL = [0, 0, 80]; pose.shoulderR = [0, 0, -80]; understood.push('brazos abiertos'); mark('brazos', 'abiertos', 'extendidos'); }
  if (has(t, 'mano en la cabeza', 'se toca la cabeza', 'mano en la frente', 'saludo militar')) { pose.shoulderR = [-40, 0, -60]; pose.elbowR = [-125, 0, 0]; understood.push('mano en la cabeza'); mark('mano', 'cabeza', 'toca', 'frente', 'saludo', 'militar'); }
  if (has(t, 'brazos atras', 'manos a la espalda', 'manos en la espalda')) { pose.shoulderL = [30, 0, 8]; pose.elbowL = [-70, 0, 0]; pose.shoulderR = [30, 0, -8]; pose.elbowR = [-70, 0, 0]; understood.push('manos a la espalda'); mark('brazos', 'atras', 'manos', 'espalda'); }

  // ---- head and gaze
  const look = (deg: number, label: string) => { add(pose, 'head', [0, deg, 0]); add(pose, 'neck', [0, deg * 0.4, 0]); understood.push(label); };
  if (has(t, 'mirando a la izquierda', 'mira a la izquierda', 'mirando hacia la izquierda', 'cabeza a la izquierda', 'gira la cabeza a la izquierda')) { look(45, 'mirando a la izquierda'); mark('mirando', 'mira', 'izquierda', 'cabeza', 'gira', 'hacia'); }
  if (has(t, 'mirando a la derecha', 'mira a la derecha', 'mirando hacia la derecha', 'cabeza a la derecha', 'gira la cabeza a la derecha')) { look(-45, 'mirando a la derecha'); mark('mirando', 'mira', 'derecha', 'cabeza', 'gira', 'hacia'); }
  if (has(t, 'mirando arriba', 'mirando hacia arriba', 'mira al cielo', 'cabeza levantada')) { add(pose, 'head', [-25, 0, 0]); add(pose, 'neck', [-15, 0, 0]); understood.push('mirando arriba'); mark('mirando', 'arriba', 'hacia', 'cielo', 'mira', 'cabeza', 'levantada'); }
  if (has(t, 'mirando abajo', 'mirando hacia abajo', 'mira al suelo', 'cabeza baja', 'cabizbajo', 'cabizbaja')) { add(pose, 'head', [28, 0, 0]); add(pose, 'neck', [18, 0, 0]); understood.push('mirando abajo'); mark('mirando', 'abajo', 'hacia', 'suelo', 'mira', 'cabeza', 'baja', 'cabizbajo', 'cabizbaja'); }
  if (has(t, 'ladeando la cabeza', 'cabeza ladeada', 'inclina la cabeza', 'cabeza inclinada', 'curioso', 'curiosa')) { add(pose, 'head', [0, 0, 16]); add(pose, 'neck', [0, 0, 6]); understood.push('cabeza ladeada'); mark('ladeando', 'cabeza', 'ladeada', 'inclina', 'inclinada', 'curioso', 'curiosa'); }

  // ---- torso and legs
  if (has(t, 'encorvado', 'encorvada', 'jorobado', 'cansado', 'cansada', 'abatido', 'abatida')) { add(pose, 'spine', [22, 0, 0]); add(pose, 'chest', [14, 0, 0]); add(pose, 'head', [12, 0, 0]); understood.push('encorvado'); mark('encorvado', 'encorvada', 'jorobado', 'cansado', 'cansada', 'abatido', 'abatida'); }
  if (has(t, 'erguido', 'erguida', 'recto', 'recta', 'orgulloso', 'orgullosa', 'con el pecho fuera')) { add(pose, 'spine', [-8, 0, 0]); add(pose, 'chest', [-8, 0, 0]); understood.push('erguido'); mark('erguido', 'erguida', 'recto', 'recta', 'orgulloso', 'orgullosa', 'pecho', 'fuera'); }
  if (has(t, 'inclinado hacia delante', 'inclinandose hacia delante', 'inclinada hacia delante', 'agachandose', 'recogiendo')) { add(pose, 'spine', [35, 0, 0]); add(pose, 'chest', [15, 0, 0]); understood.push('inclinado hacia delante'); mark('inclinado', 'inclinada', 'inclinandose', 'hacia', 'delante', 'agachandose', 'recogiendo'); }
  if (has(t, 'inclinado hacia atras', 'echandose hacia atras', 'recostado', 'recostada')) { add(pose, 'spine', [-25, 0, 0]); add(pose, 'chest', [-10, 0, 0]); understood.push('inclinado hacia atrás'); mark('inclinado', 'hacia', 'atras', 'echandose', 'recostado', 'recostada'); }
  if (has(t, 'piernas cruzadas', 'con las piernas cruzadas', 'cruza las piernas', 'cruzando las piernas')) {
    if (base?.id === 'sit' || base?.id === 'thinker') { pose.hipL = [-90, -35, 25]; pose.kneeL = [95, 0, 0]; pose.hipR = [-90, 20, 0]; pose.kneeR = [90, 0, 0]; }
    else { pose.hipL = [-8, -18, 8]; pose.hipR = [-4, 14, 4]; pose.kneeR = [18, 0, 0]; }
    understood.push('piernas cruzadas'); mark('piernas', 'cruzadas', 'cruza', 'cruzando');
  }
  if (has(t, 'una pierna adelantada', 'paso adelante', 'da un paso', 'pierna adelante')) { add(pose, 'hipR', [-30, 0, 0]); add(pose, 'kneeR', [10, 0, 0]); add(pose, 'hipL', [12, 0, 0]); understood.push('un paso adelante'); mark('una', 'pierna', 'adelantada', 'paso', 'adelante', 'da'); }
  if (has(t, 'de rodillas', 'arrodillado', 'arrodillada')) { pose.hipL = [-90, 0, 4]; pose.kneeL = [95, 0, 0]; pose.hipR = [-5, 0, -4]; pose.kneeR = [140, 0, 0]; add(pose, 'spine', [-5, 0, 0]); understood.push('de rodillas'); mark('rodillas', 'arrodillado', 'arrodillada'); }
  if (has(t, 'apoyado', 'apoyada', 'reclinado') && !base) { add(pose, 'spine', [0, 0, -10]); add(pose, 'hips', [0, 0, 6]); understood.push('apoyado de lado'); mark('apoyado', 'apoyada', 'reclinado'); }
  if (has(t, 'de espaldas')) understood.push('de espaldas: gira la cámara 180° en el visor');

  // small, natural asymmetry keeps a bare "de pie" from looking like a T-pose test figure
  if (!base && !Object.keys(pose).length) pose = humanBase('rest');
  return { kind: 'human', pose, bodyType: bodyMatch?.id, understood, ignored: ignoredWords(t, used) };
}

function ignoredWords(t: string, used: Set<string>): string[] {
  return t.split(' ').filter((w) => w.length > 2 && !FILLER.has(w) && !used.has(w));
}

// ---------------------------------------------------------------- expressions

export interface ExpressionResult {
  expression: Expression;
  understood: string[];
  ignored: string[];
}

const EXPR_WORDS: { re: string[]; id: string; label: string }[] = [
  { re: ['alegre', 'feliz', 'contento', 'contenta', 'sonriendo', 'sonrie', 'sonriente', 'riendo', 'risa', 'divertido', 'divertida'], id: 'happy', label: 'alegre' },
  { re: ['triste', 'llorando', 'llora', 'apenado', 'apenada', 'melancolico', 'melancolica', 'desolado', 'desolada', 'deprimido'], id: 'sad', label: 'triste' },
  { re: ['enfadado', 'enfadada', 'enojado', 'enojada', 'furioso', 'furiosa', 'rabia', 'ira', 'molesto', 'molesta', 'gruñon', 'gruñona', 'serio y duro'], id: 'angry', label: 'enfadado' },
  { re: ['sorprendido', 'sorprendida', 'asombrado', 'asombrada', 'boquiabierto', 'boquiabierta', 'impactado', 'impactada', 'sorpresa'], id: 'surprised', label: 'sorprendido' },
  { re: ['miedo', 'asustado', 'asustada', 'aterrado', 'aterrada', 'temeroso', 'temerosa', 'preocupado', 'preocupada', 'nervioso', 'nerviosa', 'ansioso', 'ansiosa'], id: 'fear', label: 'miedo' },
  { re: ['somnoliento', 'somnolienta', 'dormido', 'dormida', 'cansado', 'cansada', 'sueno', 'aburrido', 'aburrida', 'agotado', 'agotada', 'adormilado'], id: 'sleepy', label: 'somnoliento' },
  { re: ['burlon', 'burlona', 'sonrisa ladeada', 'picaro', 'picara', 'sarcastico', 'sarcastica', 'arrogante', 'presumido', 'presumida', 'travieso', 'traviesa', 'malicioso', 'maliciosa'], id: 'smirk', label: 'sonrisa ladeada' },
  { re: ['neutra', 'neutro', 'serio', 'seria', 'inexpresivo', 'inexpresiva', 'tranquilo', 'tranquila', 'calmado', 'calmada'], id: 'neutral', label: 'neutra' },
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Blends every emotion found ("alegre pero cansado"), scaled by intensity words ("muy", "ligeramente"). */
export function expressionFromText(text: string): ExpressionResult {
  const t = normalize(text);
  const words = t.split(' ');
  const hits: { id: string; label: string; weight: number }[] = [];
  const used = new Set<string>();
  for (const e of EXPR_WORDS) {
    for (const r of e.re) {
      const rn = normalize(r);
      const idx = rn.includes(' ') ? (t.includes(rn) ? words.findIndex((w) => w === rn.split(' ')[0]) : -1) : words.indexOf(rn);
      if (idx < 0) continue;
      const before = words.slice(Math.max(0, idx - 2), idx).join(' ');
      let weight = 1;
      if (/(muy|mucho|super|extremadamente|totalmente|completamente)/.test(before)) weight = 1.5;
      else if (/(ligeramente|un poco|algo|levemente|apenas|medio)/.test(before)) weight = 0.5;
      if (!hits.some((h) => h.id === e.id)) hits.push({ id: e.id, label: e.label, weight });
      rn.split(' ').forEach((w) => used.add(w));
      break;
    }
  }
  const neutral = EXPRESSION_PRESETS.find((p) => p.id === 'neutral')!.expr;
  if (!hits.length) return { expression: { ...neutral }, understood: [], ignored: words.filter((w) => w.length > 2 && !FILLER.has(w)) };
  const total = hits.reduce((s, h) => s + h.weight, 0);
  const out: Expression = { browRaise: 0, browTilt: 0, eyeOpen: 0, mouthCurve: 0, mouthOpen: 0 };
  for (const h of hits) {
    const p = EXPRESSION_PRESETS.find((x) => x.id === h.id)!.expr;
    // intensity scales the distance from neutral, so "ligeramente triste" is a weaker sad, not a different face
    const k = h.weight / total;
    out.browRaise += k * (neutral.browRaise + (p.browRaise - neutral.browRaise) * h.weight);
    out.browTilt += k * (neutral.browTilt + (p.browTilt - neutral.browTilt) * h.weight);
    out.eyeOpen += k * (neutral.eyeOpen + (p.eyeOpen - neutral.eyeOpen) * h.weight);
    out.mouthCurve += k * (neutral.mouthCurve + (p.mouthCurve - neutral.mouthCurve) * h.weight);
    out.mouthOpen += k * (neutral.mouthOpen + (p.mouthOpen - neutral.mouthOpen) * h.weight);
  }
  const expression: Expression = {
    browRaise: clamp(out.browRaise, -1, 1),
    browTilt: clamp(out.browTilt, -1, 1),
    eyeOpen: clamp(out.eyeOpen, 0, 1),
    mouthCurve: clamp(out.mouthCurve, -1, 1),
    mouthOpen: clamp(out.mouthOpen, 0, 1),
  };
  const understood = hits.map((h) => (h.weight > 1 ? 'muy ' : h.weight < 1 ? 'ligeramente ' : '') + h.label);
  return { expression, understood, ignored: words.filter((w) => w.length > 2 && !FILLER.has(w) && !used.has(w) && !/^(muy|mucho|ligeramente|poco|algo|levemente|apenas|medio|super|pero|cara|expresion|rostro|gesto)$/.test(w)) };
}

export { BODY_TYPES };

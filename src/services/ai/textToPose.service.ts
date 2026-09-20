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
const FILLER = new Set('un una el la los las de del con y o en a al su sus se que muy mas menos poco algo como mientras hacia sobre por para pero solo tambien with the and his her is are he she it looking'.split(' '));

function poseCore(text: string): PoseResult {
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
  if (has(t, 'brazos hacia delante', 'brazos al frente', 'brazos adelante', 'brazos estirados hacia delante', 'zombi')) { pose.shoulderL = [-88, 0, 6]; pose.shoulderR = [-88, 0, -6]; pose.elbowL = [-4, 0, 0]; pose.elbowR = [-4, 0, 0]; understood.push('brazos hacia delante'); mark('brazos', 'hacia', 'delante', 'frente', 'adelante', 'estirados', 'zombi', 'al'); }
  if (has(t, 'brazo izquierdo extendido', 'brazo izquierdo abierto', 'brazo izquierdo a un lado')) { pose.shoulderL = [0, 0, 80]; understood.push('brazo izquierdo extendido'); mark('brazo', 'izquierdo', 'extendido', 'abierto', 'lado', 'un', 'a'); }
  if (has(t, 'brazo derecho extendido', 'brazo derecho abierto', 'brazo derecho a un lado')) { pose.shoulderR = [0, 0, -80]; understood.push('brazo derecho extendido'); mark('brazo', 'derecho', 'extendido', 'abierto', 'lado', 'un', 'a'); }
  if (has(t, 'torso girado a la izquierda', 'girando a la izquierda', 'girado a la izquierda', 'de medio lado a la izquierda')) { add(pose, 'spine', [0, 22, 0]); add(pose, 'chest', [0, 14, 0]); understood.push('torso girado a la izquierda'); mark('torso', 'girado', 'girando', 'izquierda', 'medio', 'lado'); }
  if (has(t, 'torso girado a la derecha', 'girando a la derecha', 'girado a la derecha', 'de medio lado a la derecha')) { add(pose, 'spine', [0, -22, 0]); add(pose, 'chest', [0, -14, 0]); understood.push('torso girado a la derecha'); mark('torso', 'girado', 'girando', 'derecha', 'medio', 'lado'); }
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

/** Emotions the app's presets do not have; blended exactly like the presets. */
const EXTRA_EXPRESSIONS: Record<string, Expression> = {
  disgust: { browRaise: -0.2, browTilt: 0.6, eyeOpen: 0.45, mouthCurve: -0.7, mouthOpen: 0.15 },
  confused: { browRaise: 0.45, browTilt: -0.35, eyeOpen: 0.75, mouthCurve: -0.15, mouthOpen: 0.1 },
  shy: { browRaise: 0.2, browTilt: -0.45, eyeOpen: 0.5, mouthCurve: 0.3, mouthOpen: 0 },
  determined: { browRaise: -0.35, browTilt: 0.55, eyeOpen: 0.75, mouthCurve: -0.1, mouthOpen: 0 },
  laugh: { browRaise: 0.35, browTilt: -0.1, eyeOpen: 0.3, mouthCurve: 1, mouthOpen: 0.85 },
  yell: { browRaise: -0.2, browTilt: 0.7, eyeOpen: 0.7, mouthCurve: -0.2, mouthOpen: 1 },
  pain: { browRaise: 0.25, browTilt: -0.7, eyeOpen: 0.2, mouthCurve: -0.7, mouthOpen: 0.3 },
  suspicious: { browRaise: -0.15, browTilt: 0.45, eyeOpen: 0.4, mouthCurve: -0.15, mouthOpen: 0 },
  love: { browRaise: 0.25, browTilt: -0.25, eyeOpen: 0.55, mouthCurve: 0.65, mouthOpen: 0.05 },
};
const presetExpression = (id: string): Expression => EXTRA_EXPRESSIONS[id] ?? EXPRESSION_PRESETS.find((p) => p.id === id)!.expr;

const EXPR_WORDS: { re: string[]; id: string; label: string }[] = [
  { re: ['asqueado', 'asqueada', 'asco', 'repugnancia', 'repugnado', 'repugnada'], id: 'disgust', label: 'asco' },
  { re: ['confundido', 'confundida', 'desconcertado', 'desconcertada', 'dudoso', 'dudosa', 'extranado', 'extranada'], id: 'confused', label: 'confundido' },
  { re: ['timido', 'timida', 'avergonzado', 'avergonzada', 'vergonzoso', 'vergonzosa', 'cohibido', 'cohibida'], id: 'shy', label: 'tímido' },
  { re: ['decidido', 'decidida', 'determinado', 'determinada', 'concentrado', 'concentrada', 'resuelto', 'resuelta', 'desafiante', 'firme'], id: 'determined', label: 'decidido' },
  { re: ['carcajada', 'carcajadas', 'riendose', 'partiendose'], id: 'laugh', label: 'carcajada' },
  { re: ['gritando', 'grita', 'grito', 'chillando'], id: 'yell', label: 'gritando' },
  { re: ['dolor', 'sufriendo', 'sufre', 'doliendo', 'agonia'], id: 'pain', label: 'dolor' },
  { re: ['desconfiado', 'desconfiada', 'sospechoso', 'sospechosa', 'recelo', 'receloso', 'recelosa'], id: 'suspicious', label: 'desconfiado' },
  { re: ['enamorado', 'enamorada', 'embelesado', 'embelesada', 'tierno', 'tierna', 'carinoso', 'carinosa'], id: 'love', label: 'enamorado' },
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
function expressionCore(text: string): ExpressionResult {
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
  const neutral = presetExpression('neutral');
  if (!hits.length) return { expression: { ...neutral }, understood: [], ignored: words.filter((w) => w.length > 2 && !FILLER.has(w)) };
  const total = hits.reduce((s, h) => s + h.weight, 0);
  const out: Expression = { browRaise: 0, browTilt: 0, eyeOpen: 0, mouthCurve: 0, mouthOpen: 0 };
  for (const h of hits) {
    const p = presetExpression(h.id);
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


// ---------------------------------------------------------------- wording: English, synonyms, conjugations, negation

const ALIASES: [RegExp, string][] = [
  // English
  [/\b(running|runs|run|sprinting|jogging)\b/g, 'corriendo'], [/\b(walking|walks|walk|strolling)\b/g, 'caminando'], [/\b(jumping|jumps|jump|leaping)\b/g, 'saltando'],
  [/\b(sitting|seated|sits|sit)\b/g, 'sentado'], [/\b(standing|stands|stand)\b/g, 'de pie'], [/\b(kneeling|kneels)\b/g, 'de rodillas'], [/\b(crouching|crouched|squatting)\b/g, 'agachado'],
  [/\b(waving|waves|wave)\b/g, 'saludando'], [/\b(pointing|points)\b/g, 'senalando'], [/\b(fighting|boxing|fight stance)\b/g, 'luchando'], [/\b(thinking|thoughtful)\b/g, 'pensativo'], [/\b(reaching)\b/g, 'alcanzando'],
  [/\barms (up|raised|in the air)\b/g, 'brazos arriba'], [/\b(arms crossed|crossed arms|folded arms)\b/g, 'brazos cruzados'], [/\bhands on (his |her |the )?hips\b/g, 'manos en la cintura'], [/\b(arms (out|open|wide)|outstretched arms)\b/g, 'brazos abiertos'],
  [/\b(hands behind (his |her |the )?back)\b/g, 'manos a la espalda'], [/\b(legs crossed|crossed legs)\b/g, 'piernas cruzadas'], [/\b(looking|looks) (to the )?left\b/g, 'mirando a la izquierda'], [/\b(looking|looks) (to the )?right\b/g, 'mirando a la derecha'],
  [/\b(looking|looks) up\b/g, 'mirando arriba'], [/\b(looking|looks) down\b/g, 'mirando abajo'], [/\bhead tilted\b/g, 'cabeza ladeada'], [/\b(hunched|slouching|slouched)\b/g, 'encorvado'],
  [/\b(woman|girl|lady|female)\b/g, 'mujer'], [/\b(man|boy|guy|male)\b/g, 'hombre'], [/\b(child|kid)\b/g, 'nino'], [/\b(elderly|old (man|woman|person))\b/g, 'anciano'], [/\b(muscular|athletic|strong)\b/g, 'musculoso'], [/\b(skinny|thin|slim)\b/g, 'delgado'],
  [/\bdog\b/g, 'perro'], [/\bcat\b/g, 'gato'], [/\bhorse\b/g, 'caballo'],
  [/\b(happy|smiling|joyful|cheerful)\b/g, 'alegre'], [/\b(sad|crying|unhappy)\b/g, 'triste'], [/\b(angry|furious|mad)\b/g, 'enfadado'], [/\b(surprised|shocked|amazed)\b/g, 'sorprendido'], [/\b(scared|afraid|frightened|worried|nervous)\b/g, 'miedo'],
  [/\b(tired|sleepy|bored|exhausted)\b/g, 'cansado'], [/\b(smirking|smug|cocky)\b/g, 'burlon'], [/\b(neutral|calm|serious)\b/g, 'serio'], [/\b(very)\b/g, 'muy'], [/\b(slightly|a bit|a little)\b/g, 'ligeramente'],
  [/\b(disgusted|disgust)\b/g, 'asqueado'], [/\b(confused|puzzled)\b/g, 'confundido'], [/\b(shy|embarrassed)\b/g, 'timido'], [/\b(determined|resolute)\b/g, 'decidido'], [/\b(laughing|laughs)\b/g, 'carcajada'], [/\b(screaming|yelling|shouting)\b/g, 'gritando'],
  // Spanish synonyms and set phrases
  [/\b(trotando|corretea|correteando|huyendo|escapando|a la carrera|a toda pastilla|a toda velocidad|de carrera|acelerando)\b/g, 'corriendo'],
  [/\b(paseando|avanzando|marchando|desfilando|deambulando|andando)\b/g, 'caminando'],
  [/\b(brincando|dando un salto|pegando un salto|botando|volando)\b/g, 'saltando'],
  [/\b(de cuclillas|en cuclillas|acuclillado|acuclillada)\b/g, 'agachado'], [/\b(cruzado de brazos|cruzada de brazos|con los brazos en el pecho)\b/g, 'brazos cruzados'],
  [/\b(en jarras|brazos en jarras|manos en jarras|manos en las caderas|manos a las caderas|puestas en la cintura)\b/g, 'manos en la cintura'], [/\b(brazos en alto|manos al aire|brazos al cielo|celebrando|victoria)\b/g, 'brazos arriba'],
  [/\b(pose heroica|pose de superheroe|pose de poder)\b/g, 'heroico manos en la cintura'], [/\b(pose de modelo|posando|posando como modelo)\b/g, 'contrapposto'], [/\b(descansando|tranquilamente|sin hacer nada)\b/g, 'de pie'],
  [/\b(asomando|mirando de reojo)\b/g, 'mirando a la izquierda'], [/\b(mirada al cielo)\b/g, 'mirando arriba'], [/\b(mirada baja|cabeza gacha)\b/g, 'mirando abajo'],
  [/\b(feliz|contento|contenta|radiante|eufori[ao]|jubiloso|jubilosa|encantado|encantada)\b/g, 'alegre'], [/\b(apenado|desconsolado|desconsolada|afligido|afligida|abatido|abatida|dolido|dolida|desanimado|desanimada)\b/g, 'triste'],
  [/\b(cabreado|cabreada|indignado|indignada|rabioso|rabiosa|enrabietado|enrabietada|iracundo|iracunda)\b/g, 'enfadado'], [/\b(alucinado|alucinada|perplejo|perpleja|atonito|atonita|flipando)\b/g, 'sorprendido'],
  [/\b(pavor|panico|aterrorizado|aterrorizada|acojonado|acojonada|espantado|espantada|tembloroso|temblorosa)\b/g, 'miedo'], [/\b(molido|molida|hecho polvo|somnoliento|con sueno)\b/g, 'cansado'],
];

const STEMS: [string, string, string][] = [
  ['corr', 'corriendo', '(e|es|en|ia|ian|io|ieron|iendo|er|emos)'], ['salt', 'saltando', '(a|an|as|o|amos|ar|ando|aba|aron)'], ['camin', 'caminando', '(a|an|as|amos|ar|ando|aba|aron)'],
  ['salud', 'saludando', '(a|an|as|o|amos|ar|ando|aba|aron)'], ['senal', 'senalando', '(a|an|as|o|amos|ar|ando|aba|aron)'], ['apunt', 'apuntando', '(a|an|as|o|amos|ar|ando|aba|aron)'],
  ['alcanz', 'alcanzando', '(a|an|as|o|amos|ar|ando|aba|aron)'], ['pens', 'pensando', '(a|an|as|o|amos|ar|ando|aba|aron)'], ['agach', 'agachado', '(a|an|ada|ado|ados|adas|arse|andose|ando)'],
  ['sient', 'sentado', '(a|an)'], ['sent', 'sentado', '(ada|ado|ados|adas|arse|andose|ando)'],
];

/** English, synonyms, verb forms ("corre", "salta") and simple negation ("sin cruzar los brazos"), all folded to the words the interpreter knows. */
export function canonicalWording(text: string): string {
  let t = normalize(text);
  // "sin cruzar los brazos": only a negated BODY phrase is dropped ("sin camisa" says nothing about the pose)
  t = t.replace(/\bsin (?:\w+ ){0,3}\w+/g, (m) => (/(brazo|pierna|cruz|mano|mir|cabeza|levant|inclin)/.test(m) ? ' ' : m));
  t = t.replace(/\bsin \w+/g, ' '); // any other "sin <thing>" (sin camisa, sin gafas) says nothing about the pose
  for (const [re, to] of ALIASES) t = t.replace(re, to);
  for (const [stem, to, ends] of STEMS) t = t.replace(new RegExp(`\\b${stem}${ends}\\b`, 'g'), to);
  return t.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- tolerance for typos

const MODIFIER_WORDS = 'ambos los dos brazos brazo piernas pierna manos mano cabeza cuello espalda pecho arriba abajo alto alta izquierda derecha izquierdo derecho cruzados cruzadas abiertos abiertas levantados levantadas alzados extendidos mirando mira cielo suelo ladeada ladeando inclinada inclinado hacia delante adelante atras cintura caderas espalda encorvado encorvada erguido erguida recto recta apoyado apoyada rodillas arrodillado arrodillada paso adelantada muy ligeramente poco mucho'.split(' ');

function vocabulary(): Set<string> {
  const v = new Set<string>(MODIFIER_WORDS);
  for (const list of [BASES, ANIMALS, ANIMAL_BASES, BODIES, EXPR_WORDS]) for (const e of list) for (const r of e.re) normalize(r).split(' ').forEach((w) => w.length > 3 && v.add(w));
  return v;
}
let vocab: Set<string> | null = null;

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Everyday words that are close to a keyword but mean something else ("camisa" is not "camina"). */
const COMMON_NOUNS = new Set('camisa camiseta pantalon pantalones sombrero gorra gafas ropa vestido falda chaqueta zapatos botas guantes bufanda abrigo mochila espada pelo cabello fondo sombra pelota balon libro telefono movil casa calle arbol coche cuerpo persona personaje figura dibujo pose postura mirada expresion cara rostro'.split(' '));

/** Fixes small typos ("corrindo", "sorprendio") by snapping unknown words to the single closest known word. */
export function correctTypos(text: string): { text: string; fixes: string[] } {
  vocab ??= vocabulary();
  const fixes: string[] = [];
  const out = normalize(text)
    .split(' ')
    .map((w) => {
      if (w.length < 5 || vocab!.has(w) || FILLER.has(w) || COMMON_NOUNS.has(w)) return w;
      const max = w.length > 7 ? 2 : 1;
      let best: string | null = null;
      let bd = max + 1;
      let tie = false;
      for (const k of vocab!) {
        const d = distance(w, k, max);
        if (d < bd) { bd = d; best = k; tie = false; } else if (d === bd && d <= max) tie = true;
      }
      if (best && bd <= max && !tie) {
        fixes.push(`«${w}» → «${best}»`);
        return best;
      }
      return w;
    })
    .join(' ');
  return { text: out, fixes };
}

export function poseFromText(text: string): PoseResult {
  const { text: fixed, fixes } = correctTypos(canonicalWording(text));
  const r = poseCore(fixed);
  if (fixes.length) r.understood.push(`corregí ${fixes.join(', ')}`);
  return r;
}

export function expressionFromText(text: string): ExpressionResult {
  const { text: fixed, fixes } = correctTypos(canonicalWording(text));
  const r = expressionCore(fixed);
  if (fixes.length) r.understood.push(`corregí ${fixes.join(', ')}`);
  return r;
}

/** What the offline interpreter knows, as plain words — given to an optional language model so it can rewrite a free sentence. */
export const POSE_VOCABULARY = [...BASES.map((b) => b.label), ...ANIMALS.map((a) => a.label), ...BODIES.map((b) => b.label), 'brazos arriba', 'brazos cruzados', 'manos en la cintura', 'manos a la espalda', 'mirando a la izquierda', 'mirando a la derecha', 'mirando arriba', 'mirando abajo', 'cabeza ladeada', 'encorvado', 'erguido', 'inclinado hacia delante', 'inclinado hacia atrás', 'piernas cruzadas', 'un paso adelante', 'de rodillas'].join(', ');
export const EXPRESSION_VOCABULARY = [...EXPR_WORDS.map((e) => e.label), 'muy', 'ligeramente'].join(', ');


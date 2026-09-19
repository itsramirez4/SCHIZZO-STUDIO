import * as THREE from 'three';

/**
 * Procedural, fully articulated reference mannequins (human, quadruped animals) and blocked-out
 * props. Everything is assembled from primitives at runtime — no model files are bundled — so
 * the figures are deliberately stylised wooden-mannequin style references for pose, proportion
 * and light studies, NOT anatomically detailed sculpts. No DOM access here on purpose.
 *
 * Conventions: Y up, the figure faces +Z, the figure's LEFT side is +X. Every bone's rotation is
 * Euler XYZ in degrees in the `pose` record. Limbs hang along -Y in the neutral pose, so:
 *   - rotation X  > 0 swings a limb BACKWARD (toward -Z); < 0 swings it forward;
 *   - rotation Z  > 0 swings a limb toward +X (outward for left limbs, inward for right ones).
 */

export type SubjectKind = 'human' | 'dog' | 'cat' | 'horse';
export type Vec3Deg = [number, number, number];

export interface Expression {
  /** -1 (lowered) .. 1 (raised) */
  browRaise: number;
  /** -1 (inner ends up: sad/worried) .. 1 (inner ends down: angry) */
  browTilt: number;
  /** 0 closed .. 1 wide open */
  eyeOpen: number;
  /** -1 frown .. 1 smile */
  mouthCurve: number;
  /** 0 closed .. 1 wide open */
  mouthOpen: number;
}

export interface Outfit {
  shirt: boolean;
  pants: boolean;
  hat: boolean;
  glasses: boolean;
  backpack: boolean;
  cape: boolean;
}

export interface RigState {
  kind: SubjectKind;
  bodyType: BodyTypeId;
  outfit: Outfit;
  skin: string;
  pose: Record<string, Vec3Deg>;
  /** Finger curl per finger [thumb, index, middle, ring, pinky], 0 open .. 1 fully curled. */
  hands: { L: number[]; R: number[] };
  expression: Expression;
  /** Anatomy study view: skin opacity and whether the muscle / skeleton layers are shown (human only). */
  anatomy: AnatomyView;
}

export interface AnatomyView {
  /** 0 (skin hidden) .. 1 (opaque) */
  skin: number;
  muscle: boolean;
  bone: boolean;
}

export const DEFAULT_ANATOMY: AnatomyView = { skin: 1, muscle: false, bone: false };

// ---------------------------------------------------------------- body types

export type BodyTypeId = 'male' | 'female' | 'athletic' | 'heroic' | 'slim' | 'heavy' | 'child' | 'elderly';

interface BodyType {
  label: string;
  /** Total height in metres. */
  height: number;
  /** Head height as a fraction of total height (1/7.5 ≈ 0.133 for an adult). */
  headFrac: number;
  legFrac: number;
  /** Half-distance between the shoulder joints / hip joints, as a fraction of height. */
  shoulder: number;
  hip: number;
  /** Limb thickness multiplier. */
  limb: number;
  /** Torso depth multiplier (belly/chest volume). */
  torso: number;
  /** Extra waist width multiplier. */
  waist: number;
}

export const BODY_TYPES: Record<BodyTypeId, BodyType> = {
  male: { label: 'Hombre adulto', height: 1.78, headFrac: 0.133, legFrac: 0.52, shoulder: 0.115, hip: 0.05, limb: 1, torso: 1, waist: 1 },
  female: { label: 'Mujer adulta', height: 1.65, headFrac: 0.138, legFrac: 0.52, shoulder: 0.1, hip: 0.058, limb: 0.88, torso: 0.9, waist: 0.85 },
  athletic: { label: 'Atlético', height: 1.8, headFrac: 0.13, legFrac: 0.52, shoulder: 0.128, hip: 0.052, limb: 1.25, torso: 1.1, waist: 0.9 },
  heroic: { label: 'Héroe de cómic (8 cabezas)', height: 1.95, headFrac: 0.125, legFrac: 0.53, shoulder: 0.14, hip: 0.055, limb: 1.4, torso: 1.2, waist: 0.85 },
  slim: { label: 'Delgado', height: 1.75, headFrac: 0.135, legFrac: 0.53, shoulder: 0.1, hip: 0.045, limb: 0.72, torso: 0.8, waist: 0.8 },
  heavy: { label: 'Corpulento', height: 1.72, headFrac: 0.135, legFrac: 0.5, shoulder: 0.125, hip: 0.07, limb: 1.5, torso: 1.55, waist: 1.5 },
  child: { label: 'Niño (7-8 años)', height: 1.25, headFrac: 0.18, legFrac: 0.47, shoulder: 0.1, hip: 0.05, limb: 0.85, torso: 0.9, waist: 1 },
  elderly: { label: 'Anciano', height: 1.65, headFrac: 0.14, legFrac: 0.5, shoulder: 0.105, hip: 0.052, limb: 0.85, torso: 1.1, waist: 1.15 },
};

// ---------------------------------------------------------------- joints & limits

export interface JointInfo {
  name: string;
  label: string;
  /** Per-axis [min, max] in degrees — anatomically plausible ranges used for slider limits and random poses. */
  limits: [[number, number], [number, number], [number, number]];
}

const sideLabel = (s: 'L' | 'R') => (s === 'L' ? 'izq.' : 'der.');
const mirrorLimits = (l: JointInfo['limits']): JointInfo['limits'] => [l[0], [-l[1][1], -l[1][0]], [-l[2][1], -l[2][0]]];

function humanJoints(): JointInfo[] {
  const list: JointInfo[] = [
    { name: 'hips', label: 'Pelvis', limits: [[-50, 50], [-80, 80], [-30, 30]] },
    { name: 'spine', label: 'Columna', limits: [[-30, 50], [-40, 40], [-25, 25]] },
    { name: 'chest', label: 'Torso', limits: [[-25, 35], [-40, 40], [-20, 20]] },
    { name: 'neck', label: 'Cuello', limits: [[-40, 45], [-60, 60], [-35, 35]] },
    { name: 'head', label: 'Cabeza', limits: [[-30, 35], [-50, 50], [-30, 30]] },
  ];
  (['L', 'R'] as const).forEach((s) => {
    const m = s === 'R';
    const shoulder: JointInfo['limits'] = [[-170, 60], [-80, 80], [-10, 170]];
    const wrist: JointInfo['limits'] = [[-60, 60], [-70, 70], [-20, 30]];
    const hip: JointInfo['limits'] = [[-120, 25], [-45, 45], [-45, 20]];
    list.push(
      { name: `shoulder${s}`, label: `Hombro ${sideLabel(s)}`, limits: m ? mirrorLimits(shoulder) : shoulder },
      { name: `elbow${s}`, label: `Codo ${sideLabel(s)}`, limits: [[-145, 0], [-10, 10], [0, 0]] },
      { name: `wrist${s}`, label: `Muñeca ${sideLabel(s)}`, limits: m ? mirrorLimits(wrist) : wrist },
      { name: `hip${s}`, label: `Cadera ${sideLabel(s)}`, limits: m ? mirrorLimits(hip) : hip },
      { name: `knee${s}`, label: `Rodilla ${sideLabel(s)}`, limits: [[0, 140], [0, 0], [0, 0]] },
      { name: `ankle${s}`, label: `Tobillo ${sideLabel(s)}`, limits: [[-45, 25], [-20, 20], [-20, 20]] }
    );
  });
  return list;
}

function animalJoints(): JointInfo[] {
  const list: JointInfo[] = [
    { name: 'pelvis', label: 'Pelvis', limits: [[-40, 40], [-40, 40], [-30, 30]] },
    { name: 'chest', label: 'Torso', limits: [[-30, 30], [-40, 40], [-25, 25]] },
    { name: 'neck', label: 'Cuello', limits: [[-60, 60], [-60, 60], [-35, 35]] },
    { name: 'head', label: 'Cabeza', limits: [[-40, 50], [-50, 50], [-30, 30]] },
    { name: 'tail1', label: 'Cola (base)', limits: [[-60, 80], [-60, 60], [-40, 40]] },
    { name: 'tail2', label: 'Cola (punta)', limits: [[-60, 80], [-60, 60], [-40, 40]] },
  ];
  (['FL', 'FR', 'BL', 'BR'] as const).forEach((leg) => {
    const front = leg[0] === 'F';
    const side = leg[1] === 'L' ? 'izq.' : 'der.';
    const fr = front ? 'del.' : 'tras.';
    list.push(
      { name: `upper${leg}`, label: `${front ? 'Hombro' : 'Cadera'} ${fr} ${side}`, limits: [[-80, 80], [-25, 25], [-30, 30]] },
      { name: `lower${leg}`, label: `${front ? 'Codo' : 'Corvejón'} ${fr} ${side}`, limits: front ? [[-10, 130], [0, 0], [0, 0]] : [[-130, 10], [0, 0], [0, 0]] },
      { name: `paw${leg}`, label: `Pata ${fr} ${side}`, limits: [[-50, 50], [0, 0], [0, 0]] }
    );
  });
  return list;
}

export function getJointInfos(kind: SubjectKind): JointInfo[] {
  return kind === 'human' ? humanJoints() : animalJoints();
}

// ---------------------------------------------------------------- poses

export interface PoseDef {
  id: string;
  label: string;
  pose: Record<string, Vec3Deg>;
}

const P = (pose: Record<string, Vec3Deg>): Record<string, Vec3Deg> => pose;

export const HUMAN_POSES: PoseDef[] = [
  { id: 'rest', label: 'Reposo', pose: P({ shoulderL: [0, 0, 6], shoulderR: [0, 0, -6], elbowL: [-8, 0, 0], elbowR: [-8, 0, 0] }) },
  { id: 'tpose', label: 'Pose en T', pose: P({ shoulderL: [0, 0, 90], shoulderR: [0, 0, -90] }) },
  { id: 'apose', label: 'Pose en A', pose: P({ shoulderL: [0, 0, 40], shoulderR: [0, 0, -40] }) },
  {
    id: 'walk',
    label: 'Caminando',
    pose: P({ hipL: [-25, 0, 0], kneeL: [8, 0, 0], hipR: [20, 0, 0], kneeR: [28, 0, 0], shoulderL: [22, 0, 4], shoulderR: [-22, 0, -4], elbowL: [-12, 0, 0], elbowR: [-25, 0, 0], spine: [0, 6, 0], chest: [0, -8, 0] }),
  },
  {
    id: 'run',
    label: 'Corriendo',
    pose: P({ hipL: [-70, 0, 0], kneeL: [95, 0, 0], hipR: [30, 0, 0], kneeR: [45, 0, 0], shoulderL: [45, 0, 8], shoulderR: [-55, 0, -8], elbowL: [-95, 0, 0], elbowR: [-90, 0, 0], spine: [-15, 0, 0], chest: [-8, 8, 0], neck: [10, 0, 0] }),
  },
  {
    id: 'sit',
    label: 'Sentado',
    pose: P({ hipL: [-90, 0, 0], hipR: [-90, 0, 0], kneeL: [90, 0, 0], kneeR: [90, 0, 0], shoulderL: [-25, 0, 8], shoulderR: [-25, 0, -8], elbowL: [-60, 0, 0], elbowR: [-60, 0, 0] }),
  },
  {
    id: 'squat',
    label: 'Agachado',
    pose: P({ hipL: [-115, 0, 12], hipR: [-115, 0, -12], kneeL: [125, 0, 0], kneeR: [125, 0, 0], ankleL: [-25, 0, 0], ankleR: [-25, 0, 0], spine: [-20, 0, 0], shoulderL: [-60, 0, 10], shoulderR: [-60, 0, -10], elbowL: [-40, 0, 0], elbowR: [-40, 0, 0] }),
  },
  { id: 'wave', label: 'Saludando', pose: P({ shoulderR: [0, 0, -155], elbowR: [-30, 0, 0], wristR: [0, 0, 15], shoulderL: [0, 0, 6], elbowL: [-8, 0, 0], head: [0, 0, 5] }) },
  { id: 'point', label: 'Señalando', pose: P({ shoulderR: [-88, 0, -5], elbowR: [-5, 0, 0], shoulderL: [0, 0, 6], chest: [0, -10, 0], head: [0, -10, 0] }) },
  {
    id: 'guard',
    label: 'Guardia de combate',
    pose: P({ hipL: [-40, 20, 12], kneeL: [45, 0, 0], hipR: [25, -10, -14], kneeR: [30, 0, 0], shoulderL: [-70, 0, 15], elbowL: [-115, 0, 0], shoulderR: [-60, 0, -20], elbowR: [-120, 0, 0], spine: [-8, 25, 0], chest: [0, 15, 0], head: [8, -25, 0] }),
  },
  {
    id: 'contrapposto',
    label: 'Contrapposto',
    pose: P({ hips: [0, 6, 7], hipL: [-4, 0, -5], hipR: [-12, 0, 4], kneeR: [22, 0, 0], spine: [0, -4, -6], chest: [0, -6, -4], shoulderL: [0, 0, 8], shoulderR: [0, 0, -4], elbowL: [-15, 0, 0], head: [0, -10, 4] }),
  },
  {
    id: 'jump',
    label: 'Salto',
    pose: P({ hipL: [-80, 0, 15], hipR: [-70, 0, -15], kneeL: [100, 0, 0], kneeR: [90, 0, 0], shoulderL: [0, 0, 150], shoulderR: [0, 0, -150], elbowL: [-20, 0, 0], elbowR: [-20, 0, 0], spine: [-5, 0, 0], head: [-15, 0, 0] }),
  },
  {
    id: 'thinker',
    label: 'Pensativo (sentado)',
    pose: P({ hipL: [-90, 0, 0], hipR: [-90, 0, 0], kneeL: [90, 0, 0], kneeR: [90, 0, 0], spine: [-25, 0, 0], chest: [-10, 0, 0], shoulderR: [-60, 0, -10], elbowR: [-130, 0, 0], shoulderL: [-20, 0, 10], elbowL: [-40, 0, 0], head: [25, 0, 0], neck: [10, 0, 0] }),
  },
  {
    id: 'reach',
    label: 'Alcanzando arriba',
    pose: P({ shoulderR: [-170, 0, -5], elbowR: [-5, 0, 0], shoulderL: [0, 0, 6], spine: [10, 0, 6], hipL: [-5, 0, 0], ankleR: [-35, 0, 0], head: [-25, 0, 0] }),
  },
];

export const ANIMAL_POSES: PoseDef[] = [
  { id: 'stand', label: 'De pie', pose: P({}) },
  {
    id: 'walk',
    label: 'Caminando',
    pose: P({ upperFL: [-25, 0, 0], lowerFL: [10, 0, 0], upperBR: [-25, 0, 0], lowerBR: [-10, 0, 0], upperFR: [25, 0, 0], lowerFR: [55, 0, 0], upperBL: [25, 0, 0], lowerBL: [-55, 0, 0], head: [10, 8, 0] }),
  },
  {
    id: 'gallop',
    label: 'Galope',
    pose: P({ upperFL: [-60, 0, 0], lowerFL: [15, 0, 0], upperFR: [-50, 0, 0], lowerFR: [30, 0, 0], upperBL: [50, 0, 0], lowerBL: [-30, 0, 0], upperBR: [55, 0, 0], lowerBR: [-20, 0, 0], pelvis: [-8, 0, 0], chest: [10, 0, 0], neck: [-15, 0, 0], tail1: [-30, 0, 0] }),
  },
  {
    id: 'sit',
    label: 'Sentado',
    pose: P({ upperBL: [-75, 0, 8], lowerBL: [-110, 0, 0], upperBR: [-75, 0, -8], lowerBR: [-110, 0, 0], pelvis: [-40, 0, 0], chest: [10, 0, 0], neck: [-25, 0, 0] }),
  },
  { id: 'alert', label: 'Alerta', pose: P({ neck: [-30, 0, 0], head: [10, 0, 0], tail1: [-40, 0, 0], tail2: [-20, 0, 0] }) },
  { id: 'sniff', label: 'Olfateando', pose: P({ neck: [50, 0, 0], head: [20, 0, 0], upperFL: [-15, 0, 0], lowerFL: [15, 0, 0], tail1: [-10, 0, 0] }) },
];

export function getPoses(kind: SubjectKind): PoseDef[] {
  return kind === 'human' ? HUMAN_POSES : ANIMAL_POSES;
}

export interface HandPresetDef {
  id: string;
  label: string;
  curls: number[];
}

export const HAND_PRESETS: HandPresetDef[] = [
  { id: 'relaxed', label: 'Relajada', curls: [0.25, 0.25, 0.3, 0.35, 0.4] },
  { id: 'open', label: 'Abierta', curls: [0, 0, 0, 0, 0] },
  { id: 'fist', label: 'Puño', curls: [0.8, 1, 1, 1, 1] },
  { id: 'point', label: 'Señalar', curls: [0.7, 0, 1, 1, 1] },
  { id: 'peace', label: 'Paz / victoria', curls: [0.8, 0, 0, 1, 1] },
  { id: 'grip', label: 'Agarre', curls: [0.5, 0.6, 0.6, 0.6, 0.6] },
  { id: 'pinch', label: 'Pinza', curls: [0.55, 0.55, 0.1, 0.05, 0] },
  { id: 'gun', label: 'Pistola (índice+pulgar)', curls: [0, 0, 1, 1, 1] },
];

export const FINGER_NAMES = ['Pulgar', 'Índice', 'Corazón', 'Anular', 'Meñique'];

export interface ExpressionPreset {
  id: string;
  label: string;
  expr: Expression;
}

export const EXPRESSION_PRESETS: ExpressionPreset[] = [
  { id: 'neutral', label: 'Neutra', expr: { browRaise: 0, browTilt: 0, eyeOpen: 0.8, mouthCurve: 0, mouthOpen: 0 } },
  { id: 'happy', label: 'Alegre', expr: { browRaise: 0.3, browTilt: -0.1, eyeOpen: 0.6, mouthCurve: 0.9, mouthOpen: 0.3 } },
  { id: 'sad', label: 'Triste', expr: { browRaise: 0.1, browTilt: -0.9, eyeOpen: 0.55, mouthCurve: -0.8, mouthOpen: 0 } },
  { id: 'angry', label: 'Enfadado', expr: { browRaise: -0.4, browTilt: 1, eyeOpen: 0.6, mouthCurve: -0.6, mouthOpen: 0.1 } },
  { id: 'surprised', label: 'Sorprendido', expr: { browRaise: 1, browTilt: 0, eyeOpen: 1, mouthCurve: 0, mouthOpen: 0.85 } },
  { id: 'fear', label: 'Miedo', expr: { browRaise: 0.8, browTilt: -0.7, eyeOpen: 1, mouthCurve: -0.3, mouthOpen: 0.5 } },
  { id: 'sleepy', label: 'Somnoliento', expr: { browRaise: -0.2, browTilt: -0.2, eyeOpen: 0.15, mouthCurve: -0.1, mouthOpen: 0.1 } },
  { id: 'smirk', label: 'Sonrisa ladeada', expr: { browRaise: 0.15, browTilt: 0.25, eyeOpen: 0.7, mouthCurve: 0.45, mouthOpen: 0 } },
];

export const DEFAULT_OUTFIT: Outfit = { shirt: false, pants: false, hat: false, glasses: false, backpack: false, cape: false };

export function defaultRigState(kind: SubjectKind = 'human'): RigState {
  return {
    kind,
    bodyType: 'male',
    outfit: { ...DEFAULT_OUTFIT },
    skin: '#d9b99b',
    pose: { ...getPoses(kind)[0].pose },
    hands: { L: [...HAND_PRESETS[0].curls], R: [...HAND_PRESETS[0].curls] },
    expression: { ...EXPRESSION_PRESETS[0].expr },
    anatomy: { ...DEFAULT_ANATOMY },
  };
}

/** A random but anatomically plausible pose: every axis is drawn from its joint's limits. */
export function randomPose(kind: SubjectKind, rand: () => number = Math.random): Record<string, Vec3Deg> {
  const pose: Record<string, Vec3Deg> = {};
  const amount = (name: string) => (/^(hips|spine|chest|neck|head|pelvis)$/.test(name) ? 0.35 : 0.75);
  for (const j of getJointInfos(kind)) {
    const k = amount(j.name);
    pose[j.name] = j.limits.map(([lo, hi]) => {
      if (lo === hi) return lo;
      const mid = (lo + hi) / 2;
      return Math.round(mid + (rand() * 2 - 1) * ((hi - lo) / 2) * k);
    }) as Vec3Deg;
  }
  return pose;
}

// ---------------------------------------------------------------- geometry helpers

const UNIT_SPHERE = new THREE.SphereGeometry(1, 20, 14);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const UNIT_CONE = new THREE.ConeGeometry(1, 1, 18);

const rad = (d: number) => (d * Math.PI) / 180;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function bone(name: string, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}

const std = (color: string | number, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

// ---------------------------------------------------------------- the rig

export class MannequinRig {
  readonly root = new THREE.Group();
  readonly bones = new Map<string, THREE.Bone>();
  height = 1.8;
  state: RigState;

  private materials: THREE.Material[] = [];
  /** Skin + joint materials, faded by the anatomy view. */
  private skinMats: THREE.MeshStandardMaterial[] = [];
  /** Geometries created per rig (glasses lenses) that need disposing, unlike the shared unit primitives. */
  private tubeGeoms: THREE.BufferGeometry[] = [];
  private fingers = new Map<string, THREE.Bone[]>();
  private markers = new Map<string, THREE.Mesh>();
  private tube: THREE.Mesh | null = null;
  private mouthOpenMesh: THREE.Mesh | null = null;
  private brows: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private headH = 0.24;
  private headRz = 0.1;
  private headRx = 0.08;
  private headBone: THREE.Bone | null = null;

  constructor(state: RigState) {
    this.state = state;
    this.root.name = 'mannequin';
    this.build();
  }

  /** Replaces the whole state and rebuilds (needed for body type / outfit / species changes). */
  rebuild(state: RigState) {
    this.state = state;
    this.clear();
    this.build();
  }

  dispose() {
    this.clear();
  }

  private clear() {
    for (const c of [...this.root.children]) this.root.remove(c);
    this.materials.forEach((m) => m.dispose());
    this.tubeGeoms.forEach((g) => g.dispose());
    this.tubeGeoms = [];
    this.tube?.geometry.dispose();
    this.materials = [];
    this.skinMats = [];
    this.bones.clear();
    this.fingers.clear();
    this.markers.clear();
    this.brows = [];
    this.eyes = [];
    this.tube = null;
    this.mouthOpenMesh = null;
    this.headBone = null;
  }

  private mat(color: string | number, roughness = 0.75): THREE.MeshStandardMaterial {
    const m = std(color, roughness);
    this.materials.push(m);
    return m;
  }

  private build() {
    if (this.state.kind === 'human') this.buildHuman();
    else this.buildAnimal();
    this.applyState();
  }

  // ---- state application

  applyState() {
    this.bones.forEach((b, name) => {
      const p = this.state.pose[name] ?? [0, 0, 0];
      b.rotation.set(rad(p[0]), rad(p[1]), rad(p[2]));
    });
    if (this.state.kind === 'human') {
      this.applyFingers('L');
      this.applyFingers('R');
      this.applyExpression();
      this.applyAnatomy();
    }
    this.ground();
  }

  setJoint(name: string, axis: 0 | 1 | 2, deg: number) {
    const p: Vec3Deg = [...(this.state.pose[name] ?? [0, 0, 0])] as Vec3Deg;
    p[axis] = deg;
    this.state.pose[name] = p;
    const b = this.bones.get(name);
    if (b) b.rotation.set(rad(p[0]), rad(p[1]), rad(p[2]));
    this.ground();
  }

  setPose(pose: Record<string, Vec3Deg>) {
    this.state.pose = { ...pose };
    this.applyState();
  }

  setHand(side: 'L' | 'R', curls: number[]) {
    this.state.hands[side] = [...curls];
    this.applyFingers(side);
  }

  setAnatomy(view: AnatomyView) {
    this.state.anatomy = { ...view };
    this.applyAnatomy();
  }

  private applyAnatomy() {
    const a = this.state.anatomy ?? DEFAULT_ANATOMY;
    this.skinMats.forEach((m) => {
      m.transparent = a.skin < 1;
      m.opacity = Math.max(0.02, a.skin);
      m.depthWrite = a.skin >= 0.6;
      m.visible = a.skin > 0.02;
    });
    // Face features (eyes, brows, nose, mouth, ears, hat...) belong to the skin layer.
    const skinShown = a.skin > 0.02;
    this.headBone?.children.forEach((o) => {
      if (o.userData.layer || (o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial) return;
      o.visible = o === this.mouthOpenMesh ? skinShown && this.state.expression.mouthOpen > 0.05 : skinShown;
    });
    this.root.traverse((o) => {
      if (o.userData.layer === 'muscle') o.visible = a.muscle;
      else if (o.userData.layer === 'bone') o.visible = a.bone;
    });
  }

  setExpression(expr: Expression) {
    this.state.expression = { ...expr };
    this.applyExpression();
    this.applyAnatomy();
  }

  /** Keeps the lowest point of the figure on the ground plane (y = 0) whatever the pose. */
  ground() {
    this.root.position.y = 0;
    this.root.updateMatrixWorld(true);
    const markerVisible = new Map<THREE.Mesh, boolean>();
    this.markers.forEach((m) => {
      markerVisible.set(m, m.visible);
      m.visible = false;
    });
    const box = new THREE.Box3().setFromObject(this.root, true);
    this.markers.forEach((m) => (m.visible = markerVisible.get(m) ?? false));
    if (Number.isFinite(box.min.y)) this.root.position.y = -box.min.y;
  }

  highlightJoint(name: string | null) {
    this.markers.forEach((m, n) => (m.visible = n === name));
  }

  jointInfos(): JointInfo[] {
    return getJointInfos(this.state.kind);
  }

  private applyFingers(side: 'L' | 'R') {
    const curls = this.state.hands[side];
    const thumbSide = side === 'L' ? -1 : 1;
    for (let f = 0; f < 5; f++) {
      const phalanges = this.fingers.get(`${side}${f}`);
      if (!phalanges) continue;
      const c = Math.max(0, Math.min(1, curls[f] ?? 0));
      if (f === 0) {
        // Thumb: opposes across the palm (Z) while its joints curl (X).
        phalanges[0].rotation.set(rad(c * 25), 0, rad(thumbSide * (28 - c * 75)));
        phalanges[1].rotation.set(rad(c * 55), 0, 0);
        phalanges[2].rotation.set(rad(c * 45), 0, 0);
      } else {
        phalanges[0].rotation.set(rad(c * 82), 0, rad(thumbSide * -(f - 2) * 2));
        phalanges[1].rotation.set(rad(c * 98), 0, 0);
        phalanges[2].rotation.set(rad(c * 68), 0, 0);
      }
    }
  }

  private applyExpression() {
    if (!this.headBone) return;
    const e = this.state.expression;
    const h = this.headH;
    this.brows.forEach((b, i) => {
      const left = i === 0;
      b.position.y = h * (0.66 + 0.05 * e.browRaise);
      b.rotation.z = (left ? 1 : -1) * e.browTilt * 0.5;
    });
    this.eyes.forEach((eye) => eye.scale.setY(Math.max(0.12, e.eyeOpen) * h * 0.055));

    // Mouth: a quadratic arc whose corners rise (smile) or fall (frown) relative to the centre.
    if (this.tube) {
      this.headBone.remove(this.tube);
      this.tube.geometry.dispose();
    }
    const w = this.headRx * 0.45;
    const y = h * 0.27;
    const z = this.headRz * 0.86;
    const bend = e.mouthCurve * h * 0.06;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, y + bend, z), new THREE.Vector3(0, y - bend, z + 0.004), new THREE.Vector3(w, y + bend, z));
    const geo = new THREE.TubeGeometry(curve, 16, h * 0.011, 6, false);
    const mouthMat = this.materials.find((m) => m.name === 'mouth') as THREE.MeshStandardMaterial;
    this.tube = new THREE.Mesh(geo, mouthMat);
    this.headBone.add(this.tube);

    if (this.mouthOpenMesh) {
      const open = e.mouthOpen;
      this.mouthOpenMesh.visible = open > 0.05;
      this.mouthOpenMesh.scale.set(w * (0.55 + 0.25 * open), Math.max(0.001, open * h * 0.06), 0.006);
      this.mouthOpenMesh.position.set(0, y - open * h * 0.03, z - 0.004);
    }
  }

  // ---- human

  private buildHuman() {
    const s = this.state;
    const bt = BODY_TYPES[s.bodyType];
    const H = bt.height;
    this.height = H;
    const skin = this.mat(s.skin);
    const joint = this.mat(new THREE.Color(s.skin).multiplyScalar(0.8).getHex());
    this.skinMats = [skin, joint];
    const shirtMat = this.mat('#3f6fb5');
    const pantsMat = this.mat('#4a4a55');
    const darkMat = this.mat('#222226', 0.5);
    this.mat('#a33a3a', 0.6).name = 'mouth';

    const legs = bt.legFrac * H;
    const headH = bt.headFrac * H;
    const neckLen = 0.05 * H;
    const torso = H - legs - neckLen - headH;
    const spineOff = torso * 0.1;
    const spineLen = torso * 0.36;
    const chestLen = torso * 0.54;
    const ankleH = 0.04 * H;
    const hipJointY = -0.02 * H;
    const legSpan = legs + hipJointY - ankleH;
    const thigh = legSpan * 0.52;
    const shin = legSpan * 0.48;
    const upperArm = 0.17 * H;
    const foreArm = 0.15 * H;
    const handLen = 0.1 * H;
    const t = bt.limb;
    const shX = bt.shoulder * H;
    const hpX = bt.hip * H;
    const chestW = shX * 1.05;
    const chestD = 0.055 * H * bt.torso;
    const waistW = hpX * 1.45 * bt.waist;

    const hips = this.bone('hips', 0, legs, 0, this.root);
    hips.add(mesh(UNIT_SPHERE, skin, hpX * 1.5, 0.06 * H, chestD * 1.05, 0, 0.005 * H, 0));
    if (s.outfit.pants) hips.add(mesh(UNIT_SPHERE, pantsMat, hpX * 1.62, 0.066 * H, chestD * 1.15, 0, 0.005 * H, 0));

    const spine = this.bone('spine', 0, spineOff, 0, hips);
    spine.add(mesh(UNIT_SPHERE, skin, waistW, spineLen * 0.75, chestD * 0.95, 0, spineLen * 0.5, 0));
    if (s.outfit.shirt) spine.add(mesh(UNIT_SPHERE, shirtMat, waistW * 1.09, spineLen * 0.8, chestD * 1.08, 0, spineLen * 0.5, 0));

    const chest = this.bone('chest', 0, spineLen, 0, spine);
    chest.add(mesh(UNIT_SPHERE, skin, chestW, chestLen * 0.62, chestD * 1.1, 0, chestLen * 0.45, 0));
    if (s.outfit.shirt) chest.add(mesh(UNIT_SPHERE, shirtMat, chestW * 1.08, chestLen * 0.66, chestD * 1.22, 0, chestLen * 0.45, 0));

    const neck = this.bone('neck', 0, chestLen, 0, chest);
    neck.add(mesh(UNIT_CYL, skin, 0.028 * H * t ** 0.5, neckLen * 1.1, 0.03 * H * t ** 0.5, 0, neckLen * 0.5, 0));

    const head = this.bone('head', 0, neckLen, 0, neck);
    this.headBone = head;
    this.headH = headH;
    const hRx = headH * 0.38;
    const hRz = headH * 0.42;
    this.headRx = hRx;
    this.headRz = hRz;
    head.add(mesh(UNIT_SPHERE, skin, hRx, headH / 2, hRz, 0, headH / 2, 0));
    head.add(mesh(UNIT_SPHERE, skin, hRx * 0.72, headH * 0.2, hRz * 0.8, 0, headH * 0.16, hRz * 0.12)); // jaw / chin mass
    head.add(mesh(UNIT_CONE, skin, headH * 0.05, headH * 0.16, headH * 0.05, 0, headH * 0.44, hRz * 0.98).rotateX(Math.PI / 2)); // nose
    [-1, 1].forEach((sx) => {
      const eye = mesh(UNIT_SPHERE, darkMat, headH * 0.05, headH * 0.055, headH * 0.03, sx * hRx * 0.42, headH * 0.55, hRz * 0.88);
      this.eyes.push(eye);
      head.add(eye);
    });
    [1, -1].forEach((sx) => {
      // order: index 0 = left brow (+X), 1 = right brow (-X)
      const brow = mesh(UNIT_BOX, darkMat, headH * 0.17, headH * 0.028, headH * 0.03, sx * hRx * 0.42, headH * 0.66, hRz * 0.85);
      this.brows.push(brow);
      head.add(brow);
    });
    this.mouthOpenMesh = mesh(UNIT_SPHERE, darkMat, 0.02, 0.01, 0.006);
    head.add(this.mouthOpenMesh);
    [-1, 1].forEach((sx) => head.add(mesh(UNIT_SPHERE, skin, headH * 0.03, headH * 0.09, headH * 0.06, sx * hRx * 0.98, headH * 0.5, 0))); // ears

    if (s.outfit.hat) {
      const hatMat = this.mat('#7a4a2a');
      head.add(mesh(UNIT_CYL, hatMat, hRx * 1.75, headH * 0.03, hRx * 1.75, 0, headH * 0.78, 0));
      head.add(mesh(UNIT_CYL, hatMat, hRx * 1.05, headH * 0.32, hRx * 1.05, 0, headH * 0.95, 0));
    }
    if (s.outfit.glasses) {
      const glassMat = this.mat('#111111', 0.3);
      [-1, 1].forEach((sx) => {
        const lens = mesh(new THREE.TorusGeometry(1, 0.12, 6, 20), glassMat, headH * 0.075, headH * 0.075, headH * 0.075, sx * hRx * 0.42, headH * 0.55, hRz * 0.93);
        this.tubeGeoms.push(lens.geometry);
        head.add(lens);
      });
      head.add(mesh(UNIT_BOX, glassMat, hRx * 0.25, headH * 0.012, headH * 0.012, 0, headH * 0.56, hRz * 0.93));
    }

    // Arms — built for both sides; the right side mirrors the left.
    (['L', 'R'] as const).forEach((side) => {
      const sx = side === 'L' ? 1 : -1;
      const shoulder = this.bone(`shoulder${side}`, sx * shX, chestLen * 0.93, 0, chest);
      shoulder.add(mesh(UNIT_SPHERE, joint, 0.034 * H * t ** 0.6, 0.034 * H * t ** 0.6, 0.034 * H * t ** 0.6));
      shoulder.add(mesh(UNIT_SPHERE, skin, 0.03 * H * t ** 0.7, upperArm * 0.52, 0.029 * H * t ** 0.7, 0, -upperArm * 0.5, 0));
      if (s.outfit.shirt) shoulder.add(mesh(UNIT_SPHERE, shirtMat, 0.034 * H * t ** 0.7, upperArm * 0.5, 0.033 * H * t ** 0.7, 0, -upperArm * 0.42, 0));
      const elbow = this.bone(`elbow${side}`, 0, -upperArm, 0, shoulder);
      elbow.add(mesh(UNIT_SPHERE, joint, 0.024 * H * t ** 0.5, 0.024 * H * t ** 0.5, 0.024 * H * t ** 0.5));
      elbow.add(mesh(UNIT_SPHERE, skin, 0.024 * H * t ** 0.6, foreArm * 0.52, 0.023 * H * t ** 0.6, 0, -foreArm * 0.5, 0));
      const wrist = this.bone(`wrist${side}`, 0, -foreArm, 0, elbow);
      this.buildHand(wrist, side, handLen, H, skin, joint, t);
    });

    // Legs
    (['L', 'R'] as const).forEach((side) => {
      const sx = side === 'L' ? 1 : -1;
      const hip = this.bone(`hip${side}`, sx * hpX, hipJointY, 0, hips);
      hip.add(mesh(UNIT_SPHERE, joint, 0.04 * H * t ** 0.5, 0.04 * H * t ** 0.5, 0.04 * H * t ** 0.5));
      hip.add(mesh(UNIT_SPHERE, skin, 0.044 * H * t ** 0.7, thigh * 0.55, 0.043 * H * t ** 0.7, 0, -thigh * 0.5, 0));
      if (s.outfit.pants) hip.add(mesh(UNIT_SPHERE, pantsMat, 0.049 * H * t ** 0.7, thigh * 0.56, 0.048 * H * t ** 0.7, 0, -thigh * 0.5, 0));
      const knee = this.bone(`knee${side}`, 0, -thigh, 0, hip);
      knee.add(mesh(UNIT_SPHERE, joint, 0.03 * H * t ** 0.5, 0.03 * H * t ** 0.5, 0.03 * H * t ** 0.5));
      knee.add(mesh(UNIT_SPHERE, skin, 0.032 * H * t ** 0.7, shin * 0.55, 0.031 * H * t ** 0.7, 0, -shin * 0.5, 0));
      if (s.outfit.pants) knee.add(mesh(UNIT_SPHERE, pantsMat, 0.036 * H * t ** 0.7, shin * 0.55, 0.035 * H * t ** 0.7, 0, -shin * 0.5, 0));
      const ankle = this.bone(`ankle${side}`, 0, -shin, 0, knee);
      ankle.add(mesh(UNIT_SPHERE, joint, 0.022 * H, 0.022 * H, 0.022 * H));
      ankle.add(mesh(UNIT_BOX, skin, 0.034 * H, ankleH * 0.9, 0.12 * H, 0, -ankleH * 0.55, 0.035 * H));
      ankle.add(mesh(UNIT_SPHERE, skin, 0.034 * H, ankleH * 0.5, 0.03 * H, 0, -ankleH * 0.6, 0.1 * H)); // toe box
    });

    if (s.outfit.backpack) {
      const bagMat = this.mat('#8a5a2b');
      chest.add(mesh(UNIT_BOX, bagMat, chestW * 1.35, chestLen * 0.85, chestD * 1.6, 0, chestLen * 0.45, -chestD * 2.05));
    }
    if (s.outfit.cape) {
      const capeMat = this.mat('#8b1d2c');
      capeMat.side = THREE.DoubleSide;
      chest.add(mesh(UNIT_BOX, capeMat, chestW * 2.5, (chestLen + spineLen + thigh * 0.9) * 1.0, 0.008 * H, 0, chestLen * 0.85 - (chestLen + spineLen + thigh * 0.9) / 2, -chestD * 1.35));
    }


    // --- Anatomy study layers (hidden until enabled): a simplified skeleton and the major
    // muscle groups, built from ellipsoids/cylinders. Approximate masses for orientation, not
    // a medical model.
    const boneMat = this.mat('#e6dfc8', 0.6);
    const muscleMat = this.mat('#a8403c', 0.55);
    const tag = (m: THREE.Mesh, layer: 'bone' | 'muscle'): THREE.Mesh => {
      m.userData.layer = layer;
      m.visible = false;
      return m;
    };
    const B = (parent: THREE.Object3D | undefined, ...a: [THREE.BufferGeometry, THREE.Material, number, number, number, number?, number?, number?]) => parent?.add(tag(mesh(...a), 'bone'));
    const M = (parent: THREE.Object3D | undefined, ...a: [THREE.BufferGeometry, THREE.Material, number, number, number, number?, number?, number?]) => parent?.add(tag(mesh(...a), 'muscle'));
    const bar = (parent: THREE.Object3D | undefined, r: number, len: number, x = 0, z = 0) => B(parent, UNIT_CYL, boneMat, r, len / 2, r, x, -len / 2, z);
    const tp = t ** 0.6;

    // Skeleton
    B(head, UNIT_SPHERE, boneMat, hRx * 0.86, headH * 0.44, hRz * 0.84, 0, headH * 0.56, -hRz * 0.05); // skull
    B(head, UNIT_SPHERE, boneMat, hRx * 0.55, headH * 0.14, hRz * 0.55, 0, headH * 0.17, hRz * 0.28); // jaw
    B(neck, UNIT_CYL, boneMat, 0.012 * H, neckLen * 0.6, 0.012 * H, 0, neckLen * 0.5, 0); // cervical spine
    B(spine, UNIT_CYL, boneMat, 0.013 * H, spineLen * 0.5, 0.013 * H, 0, spineLen * 0.5, -chestD * 0.5); // lumbar spine
    B(chest, UNIT_CYL, boneMat, 0.012 * H, chestLen * 0.5, 0.012 * H, 0, chestLen * 0.5, -chestD * 0.55); // thoracic spine
    B(chest, UNIT_SPHERE, boneMat, chestW * 0.8, chestLen * 0.5, chestD * 0.8, 0, chestLen * 0.5, 0); // ribcage
    B(chest, UNIT_BOX, boneMat, 0.012 * H, chestLen * 0.3, 0.006 * H, 0, chestLen * 0.5, chestD * 0.82); // sternum
    [-1, 1].forEach((sx) => B(chest, UNIT_BOX, boneMat, shX * 0.5, 0.005 * H, 0.006 * H, sx * shX * 0.5, chestLen * 0.93, chestD * 0.5)); // clavicles
    B(hips, UNIT_SPHERE, boneMat, hpX * 1.45, 0.04 * H, chestD * 0.8, 0, 0.005 * H, -chestD * 0.1); // pelvis
    (['L', 'R'] as const).forEach((side) => {
      const sh = this.bones.get(`shoulder${side}`);
      const el = this.bones.get(`elbow${side}`);
      const wr = this.bones.get(`wrist${side}`);
      const hp = this.bones.get(`hip${side}`);
      const kn = this.bones.get(`knee${side}`);
      const an = this.bones.get(`ankle${side}`);
      bar(sh, 0.009 * H, upperArm); // humerus
      bar(el, 0.007 * H, foreArm); // radius + ulna
      B(wr, UNIT_BOX, boneMat, 0.02 * H, handLen * 0.3, 0.008 * H, 0, -handLen * 0.3, 0); // hand bones
      bar(hp, 0.013 * H, thigh); // femur
      bar(kn, 0.01 * H, shin); // tibia
      B(an, UNIT_BOX, boneMat, 0.02 * H, ankleH * 0.4, 0.05 * H, 0, -ankleH * 0.5, 0.03 * H); // foot
    });

    // Muscles
    M(chest, UNIT_SPHERE, muscleMat, chestW * 0.42, chestLen * 0.22, chestD * 0.5, -chestW * 0.42, chestLen * 0.62, chestD * 0.7); // pectorals
    M(chest, UNIT_SPHERE, muscleMat, chestW * 0.42, chestLen * 0.22, chestD * 0.5, chestW * 0.42, chestLen * 0.62, chestD * 0.7);
    M(chest, UNIT_SPHERE, muscleMat, chestW * 0.62, chestLen * 0.22, chestD * 0.5, 0, chestLen * 0.88, -chestD * 0.55); // trapezius
    [-1, 1].forEach((sx) => M(chest, UNIT_SPHERE, muscleMat, chestW * 0.3, chestLen * 0.4, chestD * 0.4, sx * chestW * 0.62, chestLen * 0.4, -chestD * 0.6)); // latissimus
    M(spine, UNIT_SPHERE, muscleMat, waistW * 0.5, spineLen * 0.6, chestD * 0.35, 0, spineLen * 0.5, chestD * 0.7); // abdominals
    [-1, 1].forEach((sx) => M(hips, UNIT_SPHERE, muscleMat, hpX * 0.7, 0.05 * H, chestD * 0.6, sx * hpX * 0.6, -0.02 * H, -chestD * 0.7)); // gluteals
    (['L', 'R'] as const).forEach((side) => {
      const sh = this.bones.get(`shoulder${side}`);
      const el = this.bones.get(`elbow${side}`);
      const hp = this.bones.get(`hip${side}`);
      const kn = this.bones.get(`knee${side}`);
      M(sh, UNIT_SPHERE, muscleMat, 0.032 * H * tp, 0.035 * H * tp, 0.032 * H * tp, 0, -0.02 * H, 0); // deltoid
      M(sh, UNIT_SPHERE, muscleMat, 0.021 * H * tp, upperArm * 0.3, 0.02 * H * tp, 0, -upperArm * 0.5, 0.012 * H); // biceps
      M(sh, UNIT_SPHERE, muscleMat, 0.02 * H * tp, upperArm * 0.3, 0.02 * H * tp, 0, -upperArm * 0.5, -0.012 * H); // triceps
      M(el, UNIT_SPHERE, muscleMat, 0.021 * H * tp, foreArm * 0.32, 0.02 * H * tp, 0, -foreArm * 0.3, 0); // forearm
      M(hp, UNIT_SPHERE, muscleMat, 0.036 * H * tp, thigh * 0.42, 0.034 * H * tp, 0, -thigh * 0.45, 0.012 * H); // quadriceps
      M(hp, UNIT_SPHERE, muscleMat, 0.032 * H * tp, thigh * 0.4, 0.03 * H * tp, 0, -thigh * 0.45, -0.014 * H); // hamstrings
      M(kn, UNIT_SPHERE, muscleMat, 0.026 * H * tp, shin * 0.3, 0.025 * H * tp, 0, -shin * 0.3, -0.008 * H); // calf
    });
    [-1, 1].forEach((sx) => M(neck, UNIT_SPHERE, muscleMat, 0.008 * H, neckLen * 0.5, 0.01 * H, sx * 0.02 * H, neckLen * 0.5, 0.005 * H)); // neck muscles

    this.addMarkers(0.018 * H);
  }

  private bone(name: string, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Bone {
    const b = bone(name, x, y, z, parent);
    this.bones.set(name, b);
    return b;
  }

  private buildHand(wrist: THREE.Bone, side: 'L' | 'R', handLen: number, H: number, skin: THREE.Material, joint: THREE.Material, t: number) {
    // The hand root turns so the palm faces the thigh in the neutral pose (see conventions).
    const handRoot = new THREE.Group();
    handRoot.rotation.y = side === 'L' ? Math.PI / 2 : -Math.PI / 2;
    wrist.add(handRoot);
    const palmLen = handLen * 0.5;
    const palmW = 0.045 * H * (0.85 + 0.15 * t);
    handRoot.add(mesh(UNIT_SPHERE, joint, 0.016 * H, 0.016 * H, 0.016 * H));
    handRoot.add(mesh(UNIT_BOX, skin, palmW / 2, palmLen / 2, 0.012 * H, 0, -palmLen / 2, 0));

    const thumbSide = side === 'L' ? -1 : 1;
    const fingerLens: number[][] = [
      [0.4, 0.3, 0.26], // thumb
      [0.42, 0.26, 0.2], // index
      [0.46, 0.29, 0.21], // middle
      [0.43, 0.27, 0.2], // ring
      [0.34, 0.2, 0.17], // pinky
    ];
    for (let f = 0; f < 5; f++) {
      const isThumb = f === 0;
      const x = isThumb ? thumbSide * palmW * 0.55 : thumbSide * (-palmW * 0.42 + (f - 1) * palmW * 0.28) * -1;
      const y = isThumb ? -palmLen * 0.25 : -palmLen;
      const phalanges: THREE.Bone[] = [];
      let parent: THREE.Object3D = handRoot;
      let px = x;
      let py = y;
      fingerLens[f].forEach((frac, i) => {
        const len = palmLen * frac * 1.5;
        const b = bone(`${side}${f}_${i}`, px, py, 0, parent);
        const r = (isThumb ? 0.0085 : 0.0075) * H * (1 - i * 0.12);
        b.add(mesh(UNIT_SPHERE, skin, r, len * 0.56, r, 0, -len / 2, 0));
        phalanges.push(b);
        parent = b;
        px = 0;
        py = -len;
      });
      this.fingers.set(`${side}${f}`, phalanges);
      // Phalange bones are deliberately NOT registered in `this.bones` (not shown as pose joints).
    }
  }

  // ---- animal

  private buildAnimal() {
    const s = this.state;
    const spec = ANIMAL_SPECS[s.kind === 'human' ? 'dog' : s.kind];
    const H = spec.shoulderHeight;
    this.height = H * spec.heightFactor;
    const body = this.mat(s.skin);
    const dark = this.mat('#222226', 0.5);
    this.mat('#a33a3a', 0.6).name = 'mouth';
    const legLen = H * 0.98;
    const upper = legLen * 0.46;
    const lower = legLen * 0.34;
    const paw = legLen * 0.2;
    const r = spec.bodyR;

    const pelvis = this.bone('pelvis', 0, legLen * 0.98, -spec.bodyLen / 2, this.root);
    pelvis.add(mesh(UNIT_SPHERE, body, r * 1.05, r * 1.05, r * 1.15));
    const chest = this.bone('chest', 0, 0, spec.bodyLen, pelvis);
    chest.add(mesh(UNIT_SPHERE, body, r * 1.12, r * 1.18, r * 1.3));
    pelvis.add(mesh(UNIT_SPHERE, body, r * 1.05, r * 1.05, spec.bodyLen * 0.62, 0, 0, spec.bodyLen * 0.5)); // barrel between the two masses

    const neck = this.bone('neck', 0, r * 0.35, r * 0.9, chest);
    neck.add(mesh(UNIT_SPHERE, body, r * 0.55, r * 0.55, spec.neckLen * 0.62, 0, spec.neckLen * 0.22, spec.neckLen * 0.4).rotateX(-0.55 * spec.neckUp));
    const head = this.bone('head', 0, spec.neckLen * 0.5 * spec.neckUp, spec.neckLen * 0.85, neck);
    head.add(mesh(UNIT_SPHERE, body, spec.headR, spec.headR * 0.9, spec.headR * 1.1 * spec.headLen, 0, 0, spec.headR * 0.2 * spec.headLen));
    head.add(mesh(UNIT_SPHERE, body, spec.headR * spec.snout, spec.headR * spec.snout * 0.85, spec.headR * 1.25 * spec.headLen, 0, -spec.headR * 0.15, spec.headR * 1.25 * spec.headLen)); // muzzle
    head.add(mesh(UNIT_SPHERE, dark, spec.headR * 0.22, spec.headR * 0.2, spec.headR * 0.2, 0, -spec.headR * 0.1, spec.headR * (1.1 + 1.3 * spec.headLen))); // nose
    [-1, 1].forEach((sx) => {
      head.add(mesh(UNIT_SPHERE, dark, spec.headR * 0.12, spec.headR * 0.12, spec.headR * 0.08, sx * spec.headR * 0.5, spec.headR * 0.28, spec.headR * 0.95));
      const ear = mesh(UNIT_CONE, body, spec.headR * 0.32, spec.headR * spec.ear, spec.headR * 0.14, sx * spec.headR * 0.55, spec.headR * (0.8 + spec.ear * 0.3), spec.headR * 0.0);
      ear.rotation.z = -sx * 0.25;
      head.add(ear);
    });

    const tail1 = this.bone('tail1', 0, r * 0.4, -r * 0.9, pelvis);
    tail1.rotation.x = 0;
    tail1.add(mesh(UNIT_SPHERE, body, r * 0.2, r * 0.2, spec.tail * 0.32, 0, 0, -spec.tail * 0.3));
    const tail2 = this.bone('tail2', 0, 0, -spec.tail * 0.6, tail1);
    tail2.add(mesh(UNIT_SPHERE, body, r * 0.15, r * 0.15, spec.tail * 0.3, 0, 0, -spec.tail * 0.25));

    // Animal limbs hang along -Y just like human ones, so the same rotation conventions apply.
    (['FL', 'FR', 'BL', 'BR'] as const).forEach((leg) => {
      const front = leg[0] === 'F';
      const sx = leg[1] === 'L' ? 1 : -1;
      const parent = front ? chest : pelvis;
      const up = this.bone(`upper${leg}`, sx * r * 0.62, -r * 0.35, front ? r * 0.35 : -r * 0.1, parent);
      up.add(mesh(UNIT_SPHERE, body, r * 0.36 * spec.legR, upper * 0.55, r * 0.36 * spec.legR, 0, -upper * 0.5, 0));
      const low = this.bone(`lower${leg}`, 0, -upper, 0, up);
      low.add(mesh(UNIT_SPHERE, body, r * 0.24 * spec.legR, lower * 0.55, r * 0.24 * spec.legR, 0, -lower * 0.5, 0));
      const p = this.bone(`paw${leg}`, 0, -lower, 0, low);
      p.add(mesh(UNIT_SPHERE, dark, r * 0.26, paw * 0.5, r * 0.32, 0, -paw * 0.4, r * 0.08));
    });

    this.addMarkers(r * 0.3);
  }

  private addMarkers(radius: number) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, depthTest: false, transparent: true, opacity: 0.9 });
    this.materials.push(mat);
    this.bones.forEach((b, name) => {
      const m = new THREE.Mesh(UNIT_SPHERE, mat);
      m.scale.setScalar(radius);
      m.renderOrder = 20;
      m.visible = false;
      b.add(m);
      this.markers.set(name, m);
    });
  }
}

interface AnimalSpec {
  shoulderHeight: number;
  heightFactor: number;
  bodyLen: number;
  bodyR: number;
  neckLen: number;
  neckUp: number;
  headR: number;
  snout: number;
  ear: number;
  tail: number;
  /** Leg thickness relative to the body radius (horses have long, slim legs). */
  legR: number;
  /** Head length multiplier (a horse's head is long). */
  headLen: number;
}

const ANIMAL_SPECS: Record<'dog' | 'cat' | 'horse', AnimalSpec> = {
  dog: { shoulderHeight: 0.55, heightFactor: 1.5, bodyLen: 0.38, bodyR: 0.12, neckLen: 0.16, neckUp: 0.6, headR: 0.08, snout: 0.55, ear: 1.1, tail: 0.28, legR: 1, headLen: 1 },
  cat: { shoulderHeight: 0.25, heightFactor: 1.7, bodyLen: 0.24, bodyR: 0.06, neckLen: 0.07, neckUp: 0.5, headR: 0.048, snout: 0.5, ear: 1.3, tail: 0.24, legR: 1, headLen: 1 },
  horse: { shoulderHeight: 1.5, heightFactor: 1.4, bodyLen: 1.05, bodyR: 0.27, neckLen: 0.85, neckUp: 1, headR: 0.13, snout: 0.75, ear: 0.7, tail: 0.6, legR: 0.55, headLen: 1.7 },
};

// ---------------------------------------------------------------- props

export type PropKind =
  | 'cube' | 'sphere' | 'cylinder' | 'cone'
  | 'stairs' | 'chair' | 'table' | 'sofa' | 'bed'
  | 'car' | 'house' | 'tower' | 'tree'
  | 'sword' | 'shield' | 'bow'
  | 'guitar' | 'piano' | 'drum';

export const PROP_CATALOG: { id: PropKind; label: string; group: string }[] = [
  { id: 'cube', label: 'Cubo', group: 'Formas básicas' },
  { id: 'sphere', label: 'Esfera', group: 'Formas básicas' },
  { id: 'cylinder', label: 'Cilindro', group: 'Formas básicas' },
  { id: 'cone', label: 'Cono', group: 'Formas básicas' },
  { id: 'stairs', label: 'Escalera', group: 'Arquitectura' },
  { id: 'house', label: 'Casa', group: 'Arquitectura' },
  { id: 'tower', label: 'Torre', group: 'Arquitectura' },
  { id: 'tree', label: 'Árbol', group: 'Arquitectura' },
  { id: 'chair', label: 'Silla', group: 'Muebles' },
  { id: 'table', label: 'Mesa', group: 'Muebles' },
  { id: 'sofa', label: 'Sofá', group: 'Muebles' },
  { id: 'bed', label: 'Cama', group: 'Muebles' },
  { id: 'car', label: 'Coche', group: 'Vehículos' },
  { id: 'sword', label: 'Espada', group: 'Armas' },
  { id: 'shield', label: 'Escudo', group: 'Armas' },
  { id: 'bow', label: 'Arco', group: 'Armas' },
  { id: 'guitar', label: 'Guitarra', group: 'Instrumentos' },
  { id: 'piano', label: 'Piano', group: 'Instrumentos' },
  { id: 'drum', label: 'Tambor', group: 'Instrumentos' },
];

/** Blocked-out prop in metres, sitting on y = 0. Returns the group plus its disposable resources. */
export function buildProp(kind: PropKind): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = `prop:${kind}`;
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const m = (color: string, roughness = 0.7) => {
    const x = std(color, roughness);
    mats.push(x);
    return x;
  };
  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => group.add(mesh(UNIT_BOX, mat, w, h, d, x, y, z));
  const cyl = (mat: THREE.Material, r: number, h: number, x: number, y: number, z: number) => group.add(mesh(UNIT_CYL, mat, r, h, r, x, y, z));
  const wood = m('#9a6b3f');
  const gray = m('#aaaaaa');
  const dark = m('#2b2b30', 0.5);

  switch (kind) {
    case 'cube': box(gray, 1, 1, 1, 0, 0.5, 0); break;
    case 'sphere': group.add(mesh(UNIT_SPHERE, gray, 0.5, 0.5, 0.5, 0, 0.5, 0)); break;
    case 'cylinder': cyl(gray, 0.5, 1, 0, 0.5, 0); break;
    case 'cone': group.add(mesh(UNIT_CONE, gray, 0.5, 1, 0.5, 0, 0.5, 0)); break;
    case 'stairs': for (let i = 0; i < 8; i++) box(gray, 1.2, 0.18 * (i + 1), 0.28, 0, (0.18 * (i + 1)) / 2, -1 + i * 0.28); break;
    case 'house': {
      box(m('#d8c9a8'), 3, 2.2, 2.6, 0, 1.1, 0);
      const roof = mesh(UNIT_CONE, m('#8a3b2a'), 2.6, 1.4, 2.6, 0, 2.9, 0);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
      box(wood, 0.55, 1.2, 0.05, 0, 0.6, 1.31);
      [-1, 1].forEach((sx) => box(m('#8fb4d9', 0.3), 0.5, 0.5, 0.05, sx * 0.95, 1.3, 1.31));
      break;
    }
    case 'tower': cyl(m('#b9b2a5'), 0.9, 5, 0, 2.5, 0); group.add(mesh(UNIT_CONE, m('#6d3a3a'), 1.1, 1.6, 1.1, 0, 5.8, 0)); break;
    case 'tree': cyl(m('#6b4a2b'), 0.18, 1.6, 0, 0.8, 0); group.add(mesh(UNIT_SPHERE, m('#3f7a3a'), 1.1, 1.0, 1.1, 0, 2.3, 0)); break;
    case 'chair':
      box(wood, 0.45, 0.05, 0.45, 0, 0.45, 0);
      box(wood, 0.45, 0.5, 0.04, 0, 0.72, -0.2);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(wood, 0.04, 0.45, 0.04, sx * 0.19, 0.225, sz * 0.19));
      break;
    case 'table':
      box(wood, 1.4, 0.06, 0.8, 0, 0.75, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(wood, 0.07, 0.72, 0.07, sx * 0.62, 0.36, sz * 0.32));
      break;
    case 'sofa': {
      const fab = m('#7a5c8a');
      box(fab, 2, 0.4, 0.9, 0, 0.3, 0);
      box(fab, 2, 0.55, 0.22, 0, 0.7, -0.34);
      [-1, 1].forEach((sx) => box(fab, 0.22, 0.55, 0.9, sx * 0.95, 0.5, 0));
      break;
    }
    case 'bed': box(wood, 2, 0.3, 1.5, 0, 0.25, 0); box(m('#e8e4dc'), 1.9, 0.18, 1.4, 0, 0.5, 0); box(wood, 0.08, 0.8, 1.5, 0, 0.55, -1.0); break;
    case 'car': {
      const paint = m('#b02a2a', 0.35);
      box(paint, 4.2, 0.6, 1.8, 0, 0.65, 0);
      box(m('#9ab7c9', 0.2), 2.1, 0.55, 1.6, -0.2, 1.2, 0);
      [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]].forEach(([x, z]) => {
        const wheel = mesh(UNIT_CYL, dark, 0.36, 0.25, 0.36, x, 0.36, z);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);
      });
      break;
    }
    case 'sword': {
      const blade = m('#c8ccd2', 0.25);
      box(blade, 0.06, 1.0, 0.012, 0, 1.0, 0);
      group.add(mesh(UNIT_CONE, blade, 0.03, 0.12, 0.006, 0, 1.56, 0));
      box(m('#c9a227', 0.4), 0.32, 0.04, 0.05, 0, 0.5, 0);
      cyl(m('#4a2f1b'), 0.02, 0.22, 0, 0.38, 0);
      break;
    }
    case 'shield': {
      const s = mesh(UNIT_CYL, m('#5a6b8a'), 0.42, 0.05, 0.42, 0, 0.6, 0);
      s.rotation.x = Math.PI / 2;
      group.add(s);
      group.add(mesh(UNIT_SPHERE, m('#c9a227', 0.3), 0.09, 0.09, 0.05, 0, 0.6, 0.04));
      break;
    }
    case 'bow': {
      const torus = new THREE.TorusGeometry(0.6, 0.015, 6, 24, Math.PI);
      geos.push(torus);
      const arc = new THREE.Mesh(torus, wood);
      arc.position.y = 0.8;
      arc.rotation.z = -Math.PI / 2;
      group.add(arc);
      box(dark, 0.005, 1.2, 0.005, 0.0, 0.8, 0);
      break;
    }
    case 'guitar': {
      const body = m('#b06a2a', 0.4);
      group.add(mesh(UNIT_SPHERE, body, 0.19, 0.24, 0.05, 0, 0.3, 0));
      group.add(mesh(UNIT_SPHERE, body, 0.15, 0.18, 0.05, 0, 0.62, 0));
      box(m('#3a2a1b'), 0.05, 0.75, 0.03, 0, 1.05, 0);
      box(m('#3a2a1b'), 0.09, 0.2, 0.03, 0, 1.48, 0);
      break;
    }
    case 'piano': {
      box(dark, 1.5, 0.9, 0.6, 0, 0.65, 0);
      box(m('#f4f1ea'), 1.4, 0.04, 0.18, 0, 1.12, 0.36);
      [-0.55, -0.35, 0, 0.2, 0.55].forEach((x) => box(dark, 0.04, 0.03, 0.09, x, 1.15, 0.32));
      [[-0.7, -0.25], [0.7, -0.25]].forEach(([x, z]) => box(dark, 0.06, 0.2, 0.06, x, 0.1, z));
      break;
    }
    case 'drum': {
      cyl(m('#c0392b'), 0.32, 0.4, 0, 0.55, 0);
      cyl(m('#efe8d8'), 0.33, 0.02, 0, 0.76, 0);
      [-1, 1].forEach((sx) => box(gray, 0.03, 0.4, 0.03, sx * 0.25, 0.2, 0));
      break;
    }
  }

  return {
    group,
    dispose: () => {
      mats.forEach((x) => x.dispose());
      geos.forEach((g) => g.dispose());
    },
  };
}

/** Correlated colour temperature (Kelvin) → sRGB, Tanner Helland's approximation (1000–12000 K). */
export function kelvinToColor(kelvin: number): THREE.Color {
  const t = Math.max(1000, Math.min(12000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

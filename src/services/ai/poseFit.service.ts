import * as THREE from 'three';
import { MannequinRig, defaultRigState, getJointInfos, Vec3Deg } from '../mannequin.service';
import type { Landmarks } from '../figureAnalysis.service';

/**
 * Image → 3D reference: finds the mannequin pose whose front view best matches 14 landmarks found on a
 * drawing or photo. It is a fit, not a guess: the mannequin's own skeleton is posed thousands of times and
 * the pose that lands each elbow, wrist, knee and ankle where the picture has it wins. Depth cannot be
 * read from a flat picture, so the result is the pose as seen from the front — a starting reference the
 * artist can turn and refine in the 3D window.
 */

const rad = THREE.MathUtils.degToRad;
type P2 = { x: number; y: number };
const sub = (a: P2, b: P2): P2 => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: P2) => Math.hypot(a.x, a.y);

export interface FitResult {
  pose: Record<string, Vec3Deg>;
  /** Mean landmark error of the fitted front view, as a fraction of the torso length (0 = exact). */
  error: number;
}

function rng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function fitMannequinPose(lm: Landmarks): FitResult {
  const rig = new MannequinRig(defaultRigState('human'));
  const limits = new Map(getJointInfos('human').map((j) => [j.name, j.limits]));
  const bone = (n: string) => rig.bones.get(n)!;
  const setBone = (n: string, v: Vec3Deg) => bone(n).rotation.set(rad(v[0]), rad(v[1]), rad(v[2]));
  const tmp = new THREE.Vector3();
  const world = (n: string): THREE.Vector3 => {
    bone(n).getWorldPosition(tmp);
    return tmp.clone();
  };
  const settle = () => rig.root.updateMatrixWorld(true);
  const resetAll = () => rig.bones.forEach((b) => b.rotation.set(0, 0, 0));

  resetAll();
  settle();
  const mid = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b).multiplyScalar(0.5);
  const rigTorso = mid(world('shoulderL'), world('shoulderR')).distanceTo(mid(world('hipL'), world('hipR')));
  const imgShoulderMid: P2 = { x: (lm.shoulderL.x + lm.shoulderR.x) / 2, y: (lm.shoulderL.y + lm.shoulderR.y) / 2 };
  const imgHipMid: P2 = { x: (lm.hipL.x + lm.hipR.x) / 2, y: (lm.hipL.y + lm.hipR.y) / 2 };
  const imgTorso = len(sub(imgShoulderMid, imgHipMid));
  if (imgTorso < 8) throw new Error('El torso de la figura es demasiado pequeño para ajustar una pose.');
  const scale = rigTorso / imgTorso;

  // Which way is "right" on screen: keeps the subject's left where the mannequin's left is.
  const rigLeftX = world('shoulderL').x - world('shoulderR').x;
  const imgLeftX = lm.shoulderL.x - lm.shoulderR.x;
  const flipX = Math.sign(rigLeftX || 1) * (Math.abs(imgLeftX) < 1e-6 ? 1 : Math.sign(imgLeftX));
  /** image displacement → world displacement in the front plane */
  const toWorld = (d: P2): P2 => ({ x: flipX * d.x * scale, y: -d.y * scale });

  const pose: Record<string, Vec3Deg> = {};
  const apply = (name: string, v: Vec3Deg) => {
    pose[name] = v;
    setBone(name, v);
  };
  const clampJ = (name: string, axis: 0 | 1 | 2, v: number) => {
    const l = limits.get(name)?.[axis];
    return l ? Math.max(l[0], Math.min(l[1], v)) : v;
  };

  // ---- torso lean: spine + chest share the angle between hips and shoulders
  const imgAxis = toWorld(sub(imgShoulderMid, imgHipMid));
  const axisAngle = (v: { x: number; y: number }) => (Math.atan2(v.x, v.y) * 180) / Math.PI; // 0 = straight up
  const targetLean = axisAngle(imgAxis);
  let bestLean = 0;
  let bestErr = Infinity;
  for (let z = -45; z <= 45; z += 1) {
    setBone('spine', [0, 0, z / 2]);
    setBone('chest', [0, 0, z / 2]);
    settle();
    const a = mid(world('shoulderL'), world('shoulderR')).sub(mid(world('hipL'), world('hipR')));
    const err = Math.abs(axisAngle({ x: a.x, y: a.y }) - targetLean);
    if (err < bestErr) {
      bestErr = err;
      bestLean = z;
    }
  }
  if (Math.abs(bestLean) > 0.5) {
    apply('spine', [0, 0, clampJ('spine', 2, bestLean / 2)]);
    apply('chest', [0, 0, clampJ('chest', 2, bestLean / 2)]);
  } else {
    setBone('spine', [0, 0, 0]);
    setBone('chest', [0, 0, 0]);
  }
  settle();

  // ---- head roll relative to the torso
  const headAxis = toWorld(sub(lm.headTop, lm.chin));
  const roll = axisAngle(headAxis) - (Math.abs(bestLean) > 0.5 ? axisAngle({ x: mid(world('shoulderL'), world('shoulderR')).x - mid(world('hipL'), world('hipR')).x, y: mid(world('shoulderL'), world('shoulderR')).y - mid(world('hipL'), world('hipR')).y }) : 0);
  if (Math.abs(roll) > 3 && Math.abs(roll) < 60) {
    apply('neck', [0, 0, clampJ('neck', 2, -roll * 0.4)]);
    apply('head', [0, 0, clampJ('head', 2, -roll * 0.6)]);
  }
  settle();

  // ---- limbs: pattern search over the joint angles, several starts, on the front-view error
  const rand = rng();
  const fitChain = (root: string, mids: string, tip: string, targetMid: P2, targetTip: P2, params: { joint: string; axis: 0 | 1 | 2 }[]) => {
    const values = params.map(() => 0);
    const evalCost = (vals: number[]) => {
      // all the axes of one joint go into ONE rotation (setting them one by one would keep only the last)
      const perJoint = new Map<string, Vec3Deg>();
      params.forEach((p, i) => {
        const cur = perJoint.get(p.joint) ?? ([...(pose[p.joint] ?? [0, 0, 0])] as Vec3Deg);
        cur[p.axis] = vals[i];
        perJoint.set(p.joint, cur);
      });
      perJoint.forEach((v, j) => setBone(j, v));
      settle();
      const r = world(root);
      const m = world(mids);
      const t = world(tip);
      const dm = { x: m.x - r.x - targetMid.x, y: m.y - r.y - targetMid.y };
      const dt = { x: t.x - r.x - targetTip.x, y: t.y - r.y - targetTip.y };
      // a whisper of regularisation keeps limbs from twisting when the picture cannot tell
      return dm.x * dm.x + dm.y * dm.y + dt.x * dt.x + dt.y * dt.y + 1e-7 * vals.reduce((s, v) => s + v * v, 0);
    };
    const bounds = params.map((p) => limits.get(p.joint)![p.axis]);
    let best = { v: values.slice(), c: Infinity };
    const starts: number[][] = [values.slice()];
    // analytic starts: raise the arm/leg toward the target direction
    const ang = (Math.atan2(targetMid.x, -targetMid.y) * 180) / Math.PI;
    for (const sgn of [1, -1]) starts.push(params.map((p, i) => (p.axis === 2 ? Math.max(bounds[i][0], Math.min(bounds[i][1], sgn * ang)) : 0)));
    for (let k = 0; k < 3; k++) starts.push(bounds.map((b) => b[0] + (b[1] - b[0]) * rand()));
    // coarse sweep of the whole joint range: pictures with foreshortened limbs (sitting, crouching) have
    // several look-alike answers, and a local search alone settles on the wrong one
    const axes = bounds.map((b) => {
      const n = b[1] - b[0] < 1 ? 1 : 7;
      return Array.from({ length: n }, (_, i) => (n === 1 ? b[0] : b[0] + ((b[1] - b[0]) * i) / (n - 1)));
    });
    const scored: { v: number[]; c: number }[] = [];
    const walk = (i: number, cur: number[]) => {
      if (i === axes.length) {
        scored.push({ v: cur.slice(), c: evalCost(cur) });
        return;
      }
      for (const a of axes[i]) walk(i + 1, [...cur, a]);
    };
    walk(0, []);
    scored.sort((a, b) => a.c - b.c);
    for (const sc of scored.slice(0, 5)) starts.push(sc.v);
    for (const start of starts) {
      let cur = start.map((v, i) => Math.max(bounds[i][0], Math.min(bounds[i][1], v)));
      let c = evalCost(cur);
      for (const step of [32, 16, 8, 4, 2, 1, 0.5]) {
        let improved = true;
        let guard = 0;
        while (improved && guard++ < 12) {
          improved = false;
          for (let i = 0; i < cur.length; i++) {
            for (const d of [step, -step]) {
              const trial = cur.slice();
              trial[i] = Math.max(bounds[i][0], Math.min(bounds[i][1], trial[i] + d));
              if (trial[i] === cur[i]) continue;
              const tc = evalCost(trial);
              if (tc < c - 1e-12) {
                cur = trial;
                c = tc;
                improved = true;
              }
            }
          }
        }
      }
      if (c < best.c) best = { v: cur, c };
    }
    const final = new Map<string, Vec3Deg>();
    params.forEach((p, i) => {
      const cur = final.get(p.joint) ?? ([...(pose[p.joint] ?? [0, 0, 0])] as Vec3Deg);
      cur[p.axis] = Math.round(best.v[i] * 10) / 10;
      final.set(p.joint, cur);
    });
    final.forEach((v, j) => apply(j, v));
    settle();
    return best.c;
  };

  for (const S of ['L', 'R'] as const) {
    const sh = lm[`shoulder${S}`];
    fitChain(`shoulder${S}`, `elbow${S}`, `wrist${S}`, toWorld(sub(lm[`elbow${S}`], sh)), toWorld(sub(lm[`wrist${S}`], sh)), [
      { joint: `shoulder${S}`, axis: 0 }, { joint: `shoulder${S}`, axis: 1 }, { joint: `shoulder${S}`, axis: 2 }, { joint: `elbow${S}`, axis: 0 },
    ]);
    const hp = lm[`hip${S}`];
    fitChain(`hip${S}`, `knee${S}`, `ankle${S}`, toWorld(sub(lm[`knee${S}`], hp)), toWorld(sub(lm[`ankle${S}`], hp)), [
      { joint: `hip${S}`, axis: 0 }, { joint: `hip${S}`, axis: 1 }, { joint: `hip${S}`, axis: 2 }, { joint: `knee${S}`, axis: 0 },
    ]);
  }

  // ---- report how well the front view now matches
  settle();
  const pairs: [string, keyof Landmarks][] = [['elbowL', 'elbowL'], ['elbowR', 'elbowR'], ['wristL', 'wristL'], ['wristR', 'wristR'], ['kneeL', 'kneeL'], ['kneeR', 'kneeR'], ['ankleL', 'ankleL'], ['ankleR', 'ankleR']];
  const origin = world('hips');
  const imgOrigin = imgHipMid;
  let sum = 0;
  for (const [b, l] of pairs) {
    const w = world(b);
    const t = toWorld(sub(lm[l], imgOrigin));
    sum += Math.hypot(w.x - origin.x - t.x, w.y - origin.y - t.y);
  }
  const clean: Record<string, Vec3Deg> = {};
  for (const [k, v] of Object.entries(pose)) if (v.some((x) => Math.abs(x) > 0.4)) clean[k] = v;
  rig.dispose();
  return { pose: clean, error: sum / pairs.length / rigTorso };
}

/** Front-view landmarks of a posed mannequin — used to test the fit, and to preview what it found. */
export function projectRig(pose: Record<string, Vec3Deg>, origin: P2 = { x: 400, y: 300 }, pxPerMetre = 200): Landmarks {
  const rig = new MannequinRig({ ...defaultRigState('human'), pose });
  rig.bones.forEach((b, name) => {
    const p = pose[name] ?? [0, 0, 0];
    b.rotation.set(rad(p[0]), rad(p[1]), rad(p[2]));
  });
  rig.root.updateMatrixWorld(true);
  const w = (n: string) => rig.bones.get(n)!.getWorldPosition(new THREE.Vector3());
  const hips = w('hips');
  const px = (n: string): P2 => {
    const v = w(n);
    return { x: origin.x + (v.x - hips.x) * pxPerMetre, y: origin.y - (v.y - hips.y) * pxPerMetre };
  };
  const head = px('head');
  const lm = {
    headTop: { x: head.x, y: head.y - 0.14 * pxPerMetre },
    chin: head,
    shoulderL: px('shoulderL'), shoulderR: px('shoulderR'), elbowL: px('elbowL'), elbowR: px('elbowR'), wristL: px('wristL'), wristR: px('wristR'),
    hipL: px('hipL'), hipR: px('hipR'), kneeL: px('kneeL'), kneeR: px('kneeR'), ankleL: px('ankleL'), ankleR: px('ankleR'),
  } as Landmarks;
  rig.dispose();
  return lm;
}

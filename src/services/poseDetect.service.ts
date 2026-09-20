import { isElectron } from '@/utils/fileUtils';
import type { Landmarks } from './figureAnalysis.service';
import { buildLineArtCandidates } from './poseLineArt.service';
import { assertAiEnabled } from '@/store/aiStore';

/**
 * Optional automatic placement of the figure landmarks with MoveNet (TensorFlow.js).
 *
 * MoveNet is trained on photographs, so line art is first converted into photo-like versions (see
 * poseLineArt.service) and the most confident reading wins. The result still carries a confidence
 * score and callers must fall back to manual placement when it is low.
 * The 12 MB model is downloaded once by the main process and cached on disk (works offline after).
 */

export interface DetectionResult {
  landmarks: Landmarks | null;
  /** Mean confidence (0–1) of the 12 body joints. */
  confidence: number;
  reason?: string;
  /** How the figure was found when the drawing had to be converted first (e.g. «silueta sombreada»). */
  method?: string;
  /** True when the reading is shaky: the points are a starting guess to correct, not a measurement. */
  uncertain?: boolean;
}

let detectorPromise: Promise<any> | null = null;

async function loadDetector() {
  if (!isElectron()) throw new Error('La detección automática solo está disponible en la app de escritorio (descarga y guarda el modelo en tu equipo).');
  const res = await window.electronAPI.getPoseModel();
  if (!res.ok || !res.modelJson || !res.weights) throw new Error(res.error ?? 'No se pudo obtener el modelo de detección (¿sin conexión la primera vez?).');
  const tf = await import('@tensorflow/tfjs-core');
  await import('@tensorflow/tfjs-backend-webgl');
  await import('@tensorflow/tfjs-converter');
  const pd = await import('@tensorflow-models/pose-detection');
  await tf.setBackend('webgl');
  await tf.ready();
  const mj = JSON.parse(res.modelJson);
  const weightData = res.weights.buffer.slice(res.weights.byteOffset, res.weights.byteOffset + res.weights.byteLength) as ArrayBuffer;
  tf.io.registerLoadRouter((url: string | string[]) =>
    typeof url === 'string' && url.startsWith('schizzo-model://')
      ? tf.io.fromMemory({
          modelTopology: mj.modelTopology,
          format: mj.format,
          generatedBy: mj.generatedBy,
          convertedBy: mj.convertedBy,
          weightSpecs: mj.weightsManifest.flatMap((g: { weights: unknown[] }) => g.weights),
          weightData,
          signature: mj.signature,
          userDefinedMetadata: mj.userDefinedMetadata,
        } as never)
      : (null as never)
  );
  return pd.createDetector(pd.SupportedModels.MoveNet, { modelType: pd.movenet.modelType.SINGLEPOSE_THUNDER, modelUrl: 'schizzo-model://movenet-thunder' });
}

/** A head found in the picture (a portrait or bust has no hips or knees, but a face MoveNet can still read). */
export interface FaceReading {
  /** Eyes ordered as seen on screen: `eyeA` is the one further left. */
  eyeA: { x: number; y: number };
  eyeB: { x: number; y: number };
  nose: { x: number; y: number };
  /** Middle of the head and its size, for placing a construction guide. */
  center: { x: number; y: number };
  headHeight: number;
  headWidth: number;
  /** Head roll in degrees, clockwise positive (the right-hand eye lower than the left-hand one). */
  rollDeg: number;
  confidence: number;
  method?: string;
  uncertain: boolean;
}

export interface PoseReading {
  body: DetectionResult;
  face: FaceReading | null;
}

export async function detectLandmarks(source: HTMLCanvasElement, background = '#ffffff'): Promise<DetectionResult> {
  return (await detectPose(source, background)).body;
}

export async function detectPose(source: HTMLCanvasElement, background = '#ffffff'): Promise<PoseReading> {
  assertAiEnabled();
  detectorPromise ??= loadDetector().catch((e) => {
    detectorPromise = null; // allow retrying after a failure
    throw e;
  });
  const detector = await detectorPromise;

  // The model expects a normal opaque picture: flatten over the paper colour.
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0);

  type Kp = { name: string; x: number; y: number; score?: number };
  const BODY = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
  /** Runs the detector on one picture; `map` sends its keypoints back to source-canvas pixels. */
  const run = async (img: HTMLCanvasElement, map: (x: number, y: number) => { x: number; y: number }, label = 'original') => {
    detector.reset?.(); // MoveNet tracks between frames; these are unrelated pictures
    const poses = await detector.estimatePoses(img, { flipHorizontal: false });
    const kps: Kp[] = (poses[0]?.keypoints ?? []).map((k: Kp) => ({ ...k, ...map(k.x, k.y) }));
    const scores = BODY.map((n) => kps.find((k) => k.name === n)?.score ?? 0);
    const confidence = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const sc = (n: string) => kps.find((k) => k.name === n)?.score ?? 0;
    const faceConf = (sc('nose') + sc('left_eye') + sc('right_eye')) / 3;
    const faceMin = Math.min(sc('nose'), sc('left_eye'), sc('right_eye'));
    // A body reading must also make anatomical sense: shoulders above hips above knees above ankles,
    // hips roughly under the shoulders. Drawings with no legs at all give scattered, confident-looking junk.
    const at = (n: string) => kps.find((k) => k.name === n);
    const mid = (a: string, b: string) => ({ x: ((at(a)?.x ?? 0) + (at(b)?.x ?? 0)) / 2, y: ((at(a)?.y ?? 0) + (at(b)?.y ?? 0)) / 2 });
    const sh = mid('left_shoulder', 'right_shoulder'), hp = mid('left_hip', 'right_hip'), kn = mid('left_knee', 'right_knee'), an = mid('left_ankle', 'right_ankle');
    const shoulderW = Math.hypot((at('left_shoulder')?.x ?? 0) - (at('right_shoulder')?.x ?? 0), (at('left_shoulder')?.y ?? 0) - (at('right_shoulder')?.y ?? 0));
    const plausible = sh.y < hp.y - shoulderW * 0.3 && hp.y < kn.y - shoulderW * 0.3 && kn.y < an.y - shoulderW * 0.3 && Math.abs(hp.x - sh.x) < shoulderW * 1.2;
    return {
      kps, confidence, ok: plausible && confidence >= 0.35 && min >= 0.15, loose: plausible && confidence >= 0.3 && min >= 0.05,
      faceConf, faceOk: faceConf >= 0.4 && faceMin >= 0.25, faceLoose: faceConf >= 0.3 && faceMin >= 0.15, label,
    };
  };

  let best = await run(c, (x, y) => ({ x, y }));
  let bestFace = best;
  let method: string | undefined;
  let faceMethod: string | undefined;
  if (!best.ok) {
    // Line art: try photo-like versions of the drawing (cropped to the figure, outline filled and
    // shaded, lines thickened) and keep the most confident readings — one for the whole body, one for the face.
    const cands = buildLineArtCandidates(c);
    for (const cand of cands ?? []) {
      const k = cand.crop.size / cand.side;
      const r = await run(cand.canvas, (x, y) => ({ x: cand.crop.x + x * k, y: cand.crop.y + y * k }), cand.name);
      if (r.confidence > best.confidence || (r.ok && !best.ok)) {
        best = r;
        method = cand.name;
      }
      if (r.faceConf > bestFace.faceConf) {
        bestFace = r;
        faceMethod = cand.name;
      }
      if ((r.ok && r.confidence > 0.55) || (r.faceOk && r.faceConf > 0.7)) break; // good enough
    }
  }
  const face = faceFrom(bestFace, faceMethod);
  const { kps, confidence } = best;
  const get = (n: string) => kps.find((k) => k.name === n);
  // A converted drawing rarely reads as cleanly as a photo: a shaky but plausible reading is still
  // worth showing (flagged, for the artist to correct) — better than placing 14 points from scratch.
  const usable = best.ok || (!!method && best.loose);
  if (!usable) {
    return {
      face,
      body: {
      landmarks: null,
      confidence,
      reason: 'No he reconocido una figura humana con seguridad, ni siquiera convirtiendo el dibujo a una versión más parecida a una foto. Suele fallar con bocetos muy simples, figuras incompletas o poses raras: coloca los puntos a mano.',
      },
    };
  }
  const p = (n: string) => ({ x: get(n)!.x, y: get(n)!.y });

  // Head: MoveNet gives eyes/ears/nose, not the crown and chin. Estimate the head length from the
  // ear distance (≈0.72 of head length) or the eye–nose distance, along the face's vertical axis.
  const eL = get('left_eye'), eR = get('right_eye'), aL = get('left_ear'), aR = get('right_ear'), nose = get('nose');
  let headTop = { x: 0, y: 0 };
  let chin = { x: 0, y: 0 };
  if (eL && eR && (eL.score ?? 0) > 0.25 && (eR.score ?? 0) > 0.25) {
    const eyeMid = { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2 };
    let ex = eL.x - eR.x;
    let ey = eL.y - eR.y;
    if (ex < 0) { ex = -ex; ey = -ey; }
    const el = Math.hypot(ex, ey) || 1;
    const axis = { x: -ey / el, y: ex / el }; // perpendicular to the eye line, pointing down
    let headLen: number;
    if (aL && aR && (aL.score ?? 0) > 0.25 && (aR.score ?? 0) > 0.25) headLen = Math.hypot(aL.x - aR.x, aL.y - aR.y) / 0.72;
    else if (nose && (nose.score ?? 0) > 0.25) headLen = Math.hypot(nose.x - eyeMid.x, nose.y - eyeMid.y) * 6.2;
    else headLen = el * 3.4;
    headTop = { x: eyeMid.x - axis.x * headLen * 0.5, y: eyeMid.y - axis.y * headLen * 0.5 };
    chin = { x: eyeMid.x + axis.x * headLen * 0.5, y: eyeMid.y + axis.y * headLen * 0.5 };
  } else {
    // Face not visible (back view / turned): estimate from the shoulders.
    const sm = { x: (p('left_shoulder').x + p('right_shoulder').x) / 2, y: (p('left_shoulder').y + p('right_shoulder').y) / 2 };
    const sw = Math.hypot(p('left_shoulder').x - p('right_shoulder').x, p('left_shoulder').y - p('right_shoulder').y);
    chin = { x: sm.x, y: sm.y - sw * 0.12 };
    headTop = { x: sm.x, y: chin.y - sw * 0.55 };
  }

  return {
    face,
    body: {
    confidence,
    method,
    uncertain: !best.ok,
    landmarks: {
      headTop, chin,
      shoulderL: p('left_shoulder'), shoulderR: p('right_shoulder'),
      elbowL: p('left_elbow'), elbowR: p('right_elbow'),
      wristL: p('left_wrist'), wristR: p('right_wrist'),
      hipL: p('left_hip'), hipR: p('right_hip'),
      kneeL: p('left_knee'), kneeR: p('right_knee'),
      ankleL: p('left_ankle'), ankleR: p('right_ankle'),
    },
    },
  };
}

type RunLike = { kps: { name: string; x: number; y: number; score?: number }[]; faceConf: number; faceOk: boolean; faceLoose: boolean };

/** Turns the eyes / nose / ears of the best run into a head position, size and roll. */
function faceFrom(r: RunLike, method?: string): FaceReading | null {
  if (!(r.faceOk || r.faceLoose)) return null;
  const get = (n: string) => r.kps.find((k) => k.name === n);
  const e1 = get('left_eye'), e2 = get('right_eye'), nose = get('nose'), a1 = get('left_ear'), a2 = get('right_ear');
  if (!e1 || !e2 || !nose) return null;
  const [eyeA, eyeB] = e1.x <= e2.x ? [e1, e2] : [e2, e1];
  const eyeDist = Math.hypot(eyeB.x - eyeA.x, eyeB.y - eyeA.y);
  if (eyeDist < 4) return null;
  const rollDeg = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI;
  const eyeMid = { x: (eyeA.x + eyeB.x) / 2, y: (eyeA.y + eyeB.y) / 2 };
  const earsOk = a1 && a2 && (a1.score ?? 0) > 0.25 && (a2.score ?? 0) > 0.25;
  // Head width from the ears when they are read, else from the eye spacing (eyes ≈ 0.43 of the head width).
  const headWidth = earsOk ? Math.hypot(a1!.x - a2!.x, a1!.y - a2!.y) : eyeDist / 0.43;
  const headHeight = headWidth * 1.3;
  // Eyes sit about half-way down the head; the head's own vertical axis is perpendicular to the eye line.
  const a = (rollDeg * Math.PI) / 180;
  const axis = { x: -Math.sin(a), y: Math.cos(a) };
  const center = { x: eyeMid.x + axis.x * headHeight * 0.02, y: eyeMid.y + axis.y * headHeight * 0.02 };
  return {
    eyeA: { x: eyeA.x, y: eyeA.y }, eyeB: { x: eyeB.x, y: eyeB.y }, nose: { x: nose.x, y: nose.y },
    center, headHeight, headWidth, rollDeg, confidence: r.faceConf, method, uncertain: !r.faceOk,
  };
}

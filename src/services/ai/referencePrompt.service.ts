import { normalize } from './textToPose.service';

/**
 * Turns a plain request ("mujer corriendo bajo la lluvia") into a prompt for an image provider, aimed at a
 * REFERENCE (a study of pose, light, form) rather than finished art. The user always sees and can edit
 * the final prompt before anything is sent.
 */

export type ReferenceGoal = 'pose' | 'expression' | 'light' | 'object' | 'scene';

const GOALS: Record<ReferenceGoal, { label: string; style: string }> = {
  pose: { label: 'Pose', style: 'full body figure reference, clear silhouette, neutral plain background, even studio lighting, anatomically correct, drawing reference photo' },
  expression: { label: 'Expresión', style: 'close-up face reference, facing the camera, neutral plain background, even soft lighting, drawing reference photo' },
  light: { label: 'Iluminación', style: 'simple forms (sphere, cube, head bust) to study light and shadow, single clear light source, plain background, grayscale' },
  object: { label: 'Objeto', style: 'single object reference, three-quarter view, plain neutral background, soft studio lighting' },
  scene: { label: 'Escena', style: 'composition reference, clear foreground middle ground and background, strong readable values' },
};

const TRANSLATE: [RegExp, string][] = [
  [/\bmujer\b/, 'woman'], [/\bhombre\b/, 'man'], [/\bnino\b|\bnina\b/, 'child'], [/\banciano\b|\banciana\b/, 'elderly person'],
  [/\bcorriendo\b/, 'running'], [/\bsaltando\b/, 'jumping'], [/\bsentad[oa]\b/, 'sitting'], [/\bde pie\b/, 'standing'], [/\bcaminando\b/, 'walking'],
  [/\bperro\b/, 'dog'], [/\bgato\b/, 'cat'], [/\bcaballo\b/, 'horse'], [/\blobo\b/, 'wolf'], [/\bleon\b/, 'lion'], [/\boso\b/, 'bear'],
  [/\bciervo\b|\bvenado\b/, 'deer'], [/\bvaca\b|\btoro\b/, 'cow'], [/\bcerdo\b/, 'pig'], [/\bconejo\b/, 'rabbit'], [/\belefante\b/, 'elephant'], [/\bjirafa\b/, 'giraffe'],
  [/\balegre\b/, 'happy'], [/\btriste\b/, 'sad'], [/\benfadad[oa]\b/, 'angry'], [/\bsorprendid[oa]\b/, 'surprised'],
  [/\blluvia\b/, 'rain'], [/\bnoche\b/, 'night'], [/\batardecer\b/, 'sunset'], [/\bbosque\b/, 'forest'],
];

export function buildReferencePrompt(request: string, goal: ReferenceGoal): { prompt: string; negative: string; translated: string[] } {
  const t = normalize(request);
  const translated: string[] = [];
  for (const [re, en] of TRANSLATE) if (re.test(t)) translated.push(en);
  // the user's own words go first and untouched (providers understand many languages); the translated hints follow
  const subject = [request.trim(), ...translated].filter(Boolean).join(', ');
  return {
    prompt: `${subject}, ${GOALS[goal].style}`,
    negative: 'text, watermark, signature, extra limbs, extra fingers, deformed, blurry, low quality',
    translated,
  };
}

export const REFERENCE_GOALS = Object.entries(GOALS).map(([id, g]) => ({ id: id as ReferenceGoal, label: g.label }));

import { EXERCISES, Exercise, MODULES, VARIATIONS } from '@/content/academy';

/**
 * Pure planning logic for the Academy. Nothing here grades a drawing: the artist rates each
 * exercise themselves (easy / fair / hard) and that self-assessment is the only signal used to
 * adapt difficulty.
 */

export type Rating = 'easy' | 'fair' | 'hard';

export interface HistoryEntry {
  exerciseId: string;
  module: string;
  /** ISO date-time. */
  date: string;
  minutes: number;
  rating: Rating;
}

export interface StudyPlan {
  id: string;
  module: string;
  /** Length of the plan in study days (sessions). */
  sessions: number;
  minutesPerSession: number;
  /** Starting level chosen by the artist (1–5). */
  startLevel: number;
  createdAt: string;
  /** Sessions the artist has marked as completed. */
  completed: number;
}

export interface SessionPlan {
  index: number;
  /** A twist applied to the session's exercises so a long plan doesn't repeat itself verbatim. */
  variation: string;
  warmup: Exercise | null;
  main: Exercise[];
  review: string;
  totalMinutes: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Skill in a module: starts at `startLevel`, moves up when the last 3 exercises were easy,
 * down when they were hard. Half-steps so a single rating never swings the level. */
export function skillFor(module: string, history: HistoryEntry[], startLevel = 1): number {
  let skill = startLevel;
  const all = history.filter((h) => h.module === module);
  for (let i = 0; i < all.length; i++) {
    const window = all.slice(Math.max(0, i - 2), i + 1);
    if (window.length < 3) continue;
    const easy = window.filter((h) => h.rating === 'easy').length;
    const hard = window.filter((h) => h.rating === 'hard').length;
    if (easy === 3) skill += 0.5;
    else if (hard >= 2) skill -= 0.5;
  }
  return clamp(skill, 1, 5);
}

/** A small deterministic hash so "today's" picks are stable through the day. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function exercisesOf(module: string): Exercise[] {
  return EXERCISES.filter((e) => e.module === module);
}

/** Picks the exercise in `pool` closest to the target difficulty, avoiding repeats when possible. */
function pickClosest(pool: Exercise[], target: number, seed: number, avoid: Set<string>): Exercise | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((e) => !avoid.has(e.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  const best = Math.min(...candidates.map((e) => Math.abs(e.difficulty - target)));
  const closest = candidates.filter((e) => Math.abs(e.difficulty - target) === best);
  return closest[seed % closest.length];
}

/** The exercise of the day, spread across modules and matched to the artist's overall level. */
export function dailyExercise(history: HistoryEntry[], date = new Date()): Exercise {
  const key = todayKey(date);
  const seed = hashString(key);
  const module = MODULES[seed % MODULES.length];
  const target = Math.round(skillFor(module.id, history));
  const done = new Set(history.map((h) => h.exerciseId));
  return pickClosest(exercisesOf(module.id), target, seed >>> 3, done) ?? EXERCISES[0];
}

/**
 * Builds session `index` (0-based) of a plan. Difficulty ramps up across the plan on top of the
 * artist's current skill, and the session is filled to the requested time with a gesture warm-up
 * first. Deterministic for a given (plan, history, index), so reopening it shows the same session.
 */
export function buildSession(plan: StudyPlan, history: HistoryEntry[], index: number): SessionPlan {
  const pool = exercisesOf(plan.module);
  const skill = skillFor(plan.module, history, plan.startLevel);
  const progress = plan.sessions <= 1 ? 0 : index / (plan.sessions - 1);
  const target = clamp(Math.round(skill + progress * 1.5), 1, 5);
  const seed = hashString(`${plan.id}:${index}`);

  const warmupPool = EXERCISES.filter((e) => e.kind === 'gesture' && e.minutes <= 10);
  const warmup = plan.minutesPerSession >= 25 ? pickClosest(warmupPool, Math.min(2, target), seed, new Set()) : null;
  let remaining = plan.minutesPerSession - (warmup?.minutes ?? 0);

  // Closest to the target difficulty first; ties are shuffled per session so consecutive
  // sessions at the same level don't always start with the same exercise.
  const ordered = [...pool].sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) || hashString(`${a.id}:${seed}`) - hashString(`${b.id}:${seed}`));
  const main: Exercise[] = [];
  for (const e of ordered) {
    if (e.minutes <= remaining || main.length === 0) {
      main.push(e);
      remaining -= e.minutes;
      if (remaining < 10) break;
    }
  }

  const variations = VARIATIONS[plan.module] ?? [];
  return {
    index,
    variation: variations.length ? variations[(hashString(plan.id) + index) % variations.length] : '',
    warmup,
    main,
    review: 'Al terminar, analiza tu dibujo en la pestaña Analizar y anota una cosa que mejoró y una que aún falla.',
    totalMinutes: (warmup?.minutes ?? 0) + main.reduce((s, e) => s + e.minutes, 0),
  };
}

export interface ProgressSummary {
  totalMinutes: number;
  totalExercises: number;
  daysPracticed: number;
  minutesLast7Days: number;
  perModule: { module: string; title: string; completed: number; skill: number }[];
}

export function summarize(history: HistoryEntry[], now = new Date()): ProgressSummary {
  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const days = new Set(history.map((h) => h.date.slice(0, 10)));
  return {
    totalMinutes: history.reduce((s, h) => s + h.minutes, 0),
    totalExercises: history.length,
    daysPracticed: days.size,
    minutesLast7Days: history.filter((h) => new Date(h.date).getTime() >= weekAgo).reduce((s, h) => s + h.minutes, 0),
    perModule: MODULES.map((m) => ({
      module: m.id,
      title: m.title,
      completed: history.filter((h) => h.module === m.id).length,
      skill: skillFor(m.id, history),
    })),
  };
}

/** Parses a free-text goal like "quiero aprender retrato durante este mes" into a plan request. */
export function parseStudyGoal(text: string): { module: string | null; days: number | null; minutes: number | null } {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const keywords: Record<string, string[]> = {
    anatomia: ['anatomia', 'figura', 'cuerpo', 'gesto', 'pose'],
    perspectiva: ['perspectiva', 'punto de fuga', 'habitacion'],
    luz: ['luz', 'sombra', 'iluminacion', 'valores'],
    color: ['color', 'paleta', 'pigmento'],
    composicion: ['composicion', 'encuadre'],
    retrato: ['retrato', 'rostro', 'cara', 'cabeza', 'expresion'],
    manos: ['mano', 'manos', 'pies', 'dedos'],
    ropa: ['ropa', 'tela', 'pliegue', 'ropaje'],
    fondos: ['fondo', 'entorno', 'paisaje', 'arquitectura', 'escenario'],
    teoria: ['teoria', 'fundamentos', 'estilo'],
  };
  let module: string | null = null;
  for (const [id, words] of Object.entries(keywords)) {
    if (words.some((w) => t.includes(w))) {
      module = id;
      break;
    }
  }
  let days: number | null = null;
  if (/semana/.test(t)) days = 7;
  if (/quincena|15 dias/.test(t)) days = 15;
  if (/\bmes\b/.test(t)) days = 30;
  const explicit = t.match(/(\d+)\s*(dias|dia)/);
  if (explicit) days = clamp(parseInt(explicit[1], 10), 3, 90);
  const mins = t.match(/(\d+)\s*(min|minutos)/);
  const minutes = mins ? clamp(parseInt(mins[1], 10), 10, 90) : null;
  return { module, days, minutes };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CHALLENGES, Challenge, EXERCISES, Exercise, MODULES } from '@/content/academy';
import { useAcademyStore } from '@/store/academyStore';
import { usePoseSessionStore } from '@/store/poseSessionStore';
import { useUIStore } from '@/store/uiStore';
import { Rating, buildSession, dailyExercise, parseStudyGoal, skillFor, summarize } from '@/services/academy.service';

type Sub = 'today' | 'plan' | 'poses' | 'challenges' | 'progress';
export type StudyTabId = 'guides' | 'analyze' | 'figure' | 'academy' | 'styles' | 'modes';

const SUBS: { id: Sub; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'plan', label: 'Plan' },
  { id: 'poses', label: 'Poses' },
  { id: 'challenges', label: 'Retos' },
  { id: 'progress', label: 'Progreso' },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** A simple pausable countdown. Returns the seconds left and controls. */
function useCountdown(totalSeconds: number) {
  const [left, setLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (left === 0 && running) {
      setRunning(false);
      toast('Tiempo terminado', { icon: '⏱️' });
    }
  }, [left, running]);
  return { left, running, toggle: () => setRunning((r) => !r), reset: () => { setRunning(false); setLeft(totalSeconds); } };
}

function ExerciseCard({ exercise, variation, goTab }: { exercise: Exercise; variation?: string; goTab: (t: StudyTabId) => void }) {
  const log = useAcademyStore((s) => s.logExercise);
  const [done, setDone] = useState(false);
  const timer = useCountdown(exercise.minutes * 60);
  const ui = useUIStore();

  function openTool() {
    switch (exercise.tool) {
      case 'model3d': if (!ui.showReference3DPanel) ui.toggleReference3DPanel(); break;
      case 'guides': goTab('guides'); break;
      case 'analyze': goTab('analyze'); break;
      case 'references': if (!ui.showReferencesPanel) ui.toggleReferencesPanel(); break;
      case 'color': if (!ui.showColorToolsPanel) ui.toggleColorToolsPanel(); break;
    }
  }
  const toolLabel = { model3d: 'Abrir referencia 3D', guides: 'Abrir guías', analyze: 'Abrir análisis', references: 'Abrir referencias', color: 'Abrir herramientas de color' } as const;

  return (
    <div className="border border-border rounded p-2 space-y-1.5">
      <div className="flex items-start gap-1">
        <div className="flex-1">
          <div className="text-[11px] font-medium leading-snug">{exercise.title}</div>
          <div className="text-[9px] text-textDim">
            {exercise.minutes} min · dificultad {'★'.repeat(exercise.difficulty)}{'☆'.repeat(5 - exercise.difficulty)} · {MODULES.find((m) => m.id === exercise.module)?.title}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-textDim"><b className="text-text">Objetivo: </b>{exercise.goal}</p>
      {variation && <p className="text-[10px] text-amber-300/90"><b>Variante de hoy: </b>{variation}</p>}
      <ol className="list-decimal list-inside space-y-0.5">
        {exercise.steps.map((s) => (
          <li key={s} className="text-[10px] text-textDim leading-relaxed">{s}</li>
        ))}
      </ol>
      <div className="flex gap-1">
        <button onClick={timer.toggle} className="flex-1 bg-panelLight text-[10px] rounded py-1 tabular-nums">
          {timer.running ? '⏸' : '▶'} {fmt(timer.left)}
        </button>
        {timer.left !== exercise.minutes * 60 && (
          <button onClick={timer.reset} className="bg-panelLight text-[10px] rounded px-2" title="Reiniciar">↺</button>
        )}
        {exercise.tool && (
          <button onClick={openTool} className="flex-1 bg-panelLight text-[10px] rounded py-1">{toolLabel[exercise.tool]}</button>
        )}
      </div>
      {done ? (
        <p className="text-[10px] text-green-400">Registrado. ¡Buen trabajo!</p>
      ) : (
        <div className="space-y-1">
          <div className="text-[10px] text-textDim">Al terminar, ¿cómo te resultó?</div>
          <div className="flex gap-1">
            {([['easy', 'Fácil'], ['fair', 'Justo'], ['hard', 'Difícil']] as [Rating, string][]).map(([r, label]) => (
              <button key={r} onClick={() => { log(exercise, r); setDone(true); }} className="flex-1 bg-panelLight hover:bg-border text-[10px] rounded py-1">{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodayView({ goTab }: { goTab: (t: StudyTabId) => void }) {
  const history = useAcademyStore((s) => s.history);
  const exercise = useMemo(() => dailyExercise(history), [history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-textDim">Ejercicio del día, elegido según tu nivel en cada módulo.</p>
      <ExerciseCard key={exercise.id} exercise={exercise} goTab={goTab} />
    </div>
  );
}

function PlanView({ goTab }: { goTab: (t: StudyTabId) => void }) {
  const plan = useAcademyStore((s) => s.plan);
  const history = useAcademyStore((s) => s.history);
  const createPlan = useAcademyStore((s) => s.createPlan);
  const completeSession = useAcademyStore((s) => s.completeSession);
  const clearPlan = useAcademyStore((s) => s.clearPlan);
  const [goal, setGoal] = useState('');
  const [module, setModule] = useState(MODULES[5].id);
  const [days, setDays] = useState(30);
  const [minutes, setMinutes] = useState(30);
  const [level, setLevel] = useState(1);

  function interpret() {
    const parsed = parseStudyGoal(goal);
    if (!parsed.module && !parsed.days && !parsed.minutes) {
      toast('No he reconocido un tema: elige uno abajo.', { icon: '🤔' });
      return;
    }
    if (parsed.module) setModule(parsed.module);
    if (parsed.days) setDays(parsed.days);
    if (parsed.minutes) setMinutes(parsed.minutes);
    toast.success('He rellenado el plan; ajústalo y créalo.');
  }

  if (!plan) {
    return (
      <div className="space-y-2">
        <div className="rounded bg-panelLight p-2 space-y-1.5">
          <div className="text-[11px] font-medium">Asistente de estudio</div>
          <p className="text-[10px] text-textDim">Cuéntame qué quieres aprender, por ejemplo: «quiero aprender retrato durante este mes, 30 minutos al día».</p>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="w-full bg-panel border border-border rounded px-2 py-1 text-[11px]" placeholder="Quiero aprender…" />
          <button onClick={interpret} className="w-full bg-panel border border-border text-[10px] rounded py-1">Interpretar</button>
        </div>
        <label className="block text-[10px] text-textDim">Tema
          <select value={module} onChange={(e) => setModule(e.target.value)} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1 mt-0.5">
            {MODULES.map((m) => <option key={m.id} value={m.id}>{m.order}. {m.title}</option>)}
          </select>
        </label>
        <label className="block text-[10px] text-textDim">Duración: {days} días
          <input type="range" min={3} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full" />
        </label>
        <label className="block text-[10px] text-textDim">Tiempo por sesión: {minutes} min
          <input type="range" min={15} max={60} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full" />
        </label>
        <label className="block text-[10px] text-textDim">Tu nivel en este tema
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-full bg-panel border border-border rounded text-[11px] px-1.5 py-1 mt-0.5">
            <option value={1}>Principiante</option>
            <option value={2}>Básico</option>
            <option value={3}>Intermedio</option>
            <option value={4}>Avanzado</option>
          </select>
        </label>
        <button onClick={() => createPlan(module, days, minutes, level)} className="w-full bg-accent text-white text-[11px] rounded py-2">Crear plan</button>
        <p className="text-[9px] text-textDim">Las sesiones de 15–60 min suben de dificultad poco a poco y se ajustan a cómo valores cada ejercicio (fácil / justo / difícil).</p>
      </div>
    );
  }

  const moduleInfo = MODULES.find((m) => m.id === plan.module);
  const finished = plan.completed >= plan.sessions;
  const session = buildSession(plan, history, Math.min(plan.completed, plan.sessions - 1));
  const skill = skillFor(plan.module, history, plan.startLevel);

  return (
    <div className="space-y-2">
      <div className="rounded bg-panelLight p-2 space-y-1">
        <div className="text-[11px] font-medium">Plan: {moduleInfo?.title}</div>
        <div className="h-1.5 bg-panel rounded overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(plan.completed / plan.sessions) * 100}%` }} /></div>
        <div className="text-[10px] text-textDim">Sesión {Math.min(plan.completed + 1, plan.sessions)} de {plan.sessions} · {plan.minutesPerSession} min · nivel actual ≈ {skill.toFixed(1)}/5</div>
      </div>

      {finished ? (
        <p className="text-[11px] text-green-400">¡Plan completado! Revisa tu progreso y crea uno nuevo cuando quieras.</p>
      ) : (
        <>
          <div className="text-[10px] text-textDim">Sesión de hoy ({session.totalMinutes} min){session.variation && <> · <span className="text-amber-300/90">Variante: {session.variation}</span></>}</div>
          {session.warmup && (<><div className="text-[10px] uppercase tracking-wide text-textDim">Calentamiento</div><ExerciseCard key={`w-${session.index}-${session.warmup.id}`} exercise={session.warmup} goTab={goTab} /></>)}
          <div className="text-[10px] uppercase tracking-wide text-textDim">Ejercicio principal</div>
          {session.main.map((e) => <ExerciseCard key={`${session.index}-${e.id}`} exercise={e} variation={session.variation} goTab={goTab} />)}
          <p className="text-[10px] text-textDim">{session.review}</p>
          <button onClick={completeSession} className="w-full bg-accent text-white text-[11px] rounded py-1.5">Marcar sesión como completada</button>
        </>
      )}
      <button onClick={() => { if (window.confirm('¿Eliminar el plan actual?')) clearPlan(); }} className="w-full text-[10px] text-textDim hover:text-text">Eliminar plan</button>
    </div>
  );
}

function PosesView() {
  const s = usePoseSessionStore();
  const [duration, setDuration] = useState(60);
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-textDim">Genera poses aleatorias (siempre dentro de los límites reales de cada articulación) en la ventana de referencia 3D, con temporizador.</p>
      <div className="grid grid-cols-4 gap-1">
        {[[30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min']].map(([sec, label]) => (
          <button key={sec} onClick={() => setDuration(sec as number)} className={`text-[10px] rounded py-1 ${duration === sec ? 'bg-accent text-white' : 'bg-panelLight text-textDim'}`}>{label}</button>
        ))}
      </div>
      {s.phase === 'off' ? (
        <div className="space-y-1">
          <button onClick={() => s.start('random', duration)} className="w-full bg-accent text-white text-[11px] rounded py-2">Pose aleatoria cada {fmt(duration)}</button>
          <button onClick={() => s.start('memory', duration)} className="w-full bg-panelLight text-[11px] rounded py-2">Memoria visual (observas 20 s, dibujas {fmt(duration)})</button>
        </div>
      ) : (
        <div className="rounded bg-panelLight p-2 space-y-1 text-center">
          <div className="text-[10px] text-textDim">{{ pose: 'Dibuja esta pose', observe: 'Observa con atención', hidden: 'Dibuja de memoria', reveal: 'Compara con el modelo', off: '' }[s.phase]}</div>
          <div className="text-2xl tabular-nums">{fmt(s.remaining)}</div>
          <div className="text-[10px] text-textDim">Poses completadas: {s.posesDone}</div>
          <div className="flex gap-1">
            <button onClick={s.skip} className="flex-1 bg-panel text-[10px] rounded py-1">Siguiente</button>
            <button onClick={s.stop} className="flex-1 bg-panel text-[10px] rounded py-1">Detener</button>
          </div>
        </div>
      )}
      <p className="text-[9px] text-textDim">Cada pose usa un tipo de cuerpo y posición de manos al azar. Puedes ajustar la iluminación en el panel de la referencia 3D.</p>
    </div>
  );
}

function ChallengeRunner({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const logChallenge = useAcademyStore((s) => s.logChallenge);
  const timer = useCountdown(challenge.minutes * 60);
  const [done, setDone] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) { started.current = true; timer.toggle(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function finish() {
    logChallenge({ challengeId: challenge.id, done, target: challenge.count, secondsUsed: challenge.minutes * 60 - timer.left });
    toast.success(`Reto registrado: ${done}/${challenge.count} ${challenge.unit}`);
    onClose();
  }
  return (
    <div className="rounded bg-panelLight p-2 space-y-2 text-center">
      <div className="text-[11px] font-medium">{challenge.title}</div>
      <div className="text-2xl tabular-nums">{fmt(timer.left)}</div>
      <div className="text-[11px]">{done} / {challenge.count} {challenge.unit}</div>
      <div className="flex gap-1">
        <button onClick={() => setDone((d) => Math.min(challenge.count, d + 1))} className="flex-1 bg-accent text-white text-[11px] rounded py-1.5">+1 hecho</button>
        <button onClick={() => setDone((d) => Math.max(0, d - 1))} className="bg-panel text-[11px] rounded px-3">−1</button>
      </div>
      <div className="flex gap-1">
        <button onClick={timer.toggle} className="flex-1 bg-panel text-[10px] rounded py-1">{timer.running ? 'Pausar' : 'Reanudar'}</button>
        <button onClick={finish} className="flex-1 bg-panel text-[10px] rounded py-1">Terminar y guardar</button>
      </div>
    </div>
  );
}

function ChallengesView() {
  const results = useAcademyStore((s) => s.challenges);
  const [active, setActive] = useState<Challenge | null>(null);
  if (active) return <ChallengeRunner challenge={active} onClose={() => setActive(null)} />;
  return (
    <div className="space-y-2">
      {CHALLENGES.map((c) => {
        const mine = results.filter((r) => r.challengeId === c.id);
        const best = mine.reduce((m, r) => Math.max(m, r.done), 0);
        return (
          <div key={c.id} className="border border-border rounded p-2 space-y-1">
            <div className="text-[11px] font-medium">{c.title}</div>
            <p className="text-[10px] text-textDim">{c.description}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setActive(c)} className="flex-1 bg-panelLight hover:bg-border text-[10px] rounded py-1">Empezar ({c.minutes} min)</button>
              {mine.length > 0 && <span className="text-[9px] text-textDim">{mine.length}× · mejor {best}/{c.count}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressView() {
  const history = useAcademyStore((s) => s.history);
  const challenges = useAcademyStore((s) => s.challenges);
  const reset = useAcademyStore((s) => s.resetProgress);
  const sum = summarize(history);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {[[`${sum.minutesLast7Days} min`, 'últimos 7 días'], [String(sum.daysPracticed), 'días practicados'], [String(sum.totalExercises), 'ejercicios'], [String(challenges.length), 'retos hechos']].map(([v, l]) => (
          <div key={l} className="bg-panelLight rounded p-2 text-center"><div className="text-sm font-medium">{v}</div><div className="text-[9px] text-textDim">{l}</div></div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-textDim">Nivel estimado por módulo</div>
        {sum.perModule.map((m) => (
          <div key={m.module} className="space-y-0.5">
            <div className="flex justify-between text-[10px]"><span>{m.title}</span><span className="text-textDim">{m.completed} ej. · {m.skill.toFixed(1)}/5</span></div>
            <div className="h-1 bg-panelLight rounded overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(m.skill / 5) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-textDim">El nivel sale de tus propias valoraciones (fácil / justo / difícil): la app no puntúa tus dibujos. Se guarda solo en este equipo.</p>
      <button onClick={() => { if (window.confirm('¿Borrar todo tu historial de práctica?')) reset(); }} className="w-full text-[10px] text-textDim hover:text-text">Borrar historial</button>
      {EXERCISES.length > 0 && <p className="text-[9px] text-textDim text-center">{EXERCISES.length} ejercicios · {MODULES.length} módulos</p>}
    </div>
  );
}

export default function AcademyTab({ goTab }: { goTab: (t: StudyTabId) => void }) {
  const [sub, setSub] = useState<Sub>('today');
  return (
    <div className="space-y-3">
      <div className="flex border-b border-border">
        {SUBS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)} className={`flex-1 text-[10px] py-1.5 border-b-2 -mb-px ${sub === t.id ? 'border-accent text-text' : 'border-transparent text-textDim hover:text-text'}`}>{t.label}</button>
        ))}
      </div>
      {sub === 'today' && <TodayView goTab={goTab} />}
      {sub === 'plan' && <PlanView goTab={goTab} />}
      {sub === 'poses' && <PosesView />}
      {sub === 'challenges' && <ChallengesView />}
      {sub === 'progress' && <ProgressView />}
    </div>
  );
}

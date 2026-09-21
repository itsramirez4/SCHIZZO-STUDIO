import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Play, Pause, SkipBack, SkipForward, StepBack, StepForward, Trash2, Film } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { ReplayFrame, clearReplay, exportReplayAsWebm, loadReplay } from '@/services/replay.service';

const RATES = [1, 2, 5, 10, 20, 40];

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Plays back how the drawing was made, one recorded step at a time. */
export default function ReplayDialog() {
  const show = useUIStore((s) => s.showReplayDialog);
  const close = useUIStore((s) => s.closeReplayDialog);
  const project = useAppStore((s) => s.project);
  const [frames, setFrames] = useState<ReplayFrame[] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(5);
  const [exporting, setExporting] = useState<number | null>(null);
  const projectId = project?.id;

  // Load the recorded steps every time the dialog opens, and start on the latest one.
  useEffect(() => {
    if (!show || !projectId) return;
    let cancelled = false;
    setFrames(null);
    setPlaying(false);
    loadReplay(projectId)
      .then((r) => {
        if (cancelled) return;
        setFrames(r.frames);
        setIndex(Math.max(0, r.frames.length - 1));
      })
      .catch(() => !cancelled && setFrames([]));
    return () => {
      cancelled = true;
    };
  }, [show, projectId]);

  const n = frames?.length ?? 0;

  // Playback timer.
  useEffect(() => {
    if (!playing || n === 0) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i + 1 >= n) {
          setPlaying(false);
          return n - 1;
        }
        return i + 1;
      });
    }, 1000 / rate);
    return () => clearInterval(timer);
  }, [playing, rate, n]);

  const stateRef = useRef({ n, playing, index });
  stateRef.current = { n, playing, index };

  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') return;
      if (e.key === 'Escape') close();
      else if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      } else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  function step(d: number) {
    setPlaying(false);
    setIndex((i) => Math.max(0, Math.min(stateRef.current.n - 1, i + d)));
  }

  function togglePlay() {
    const { n: total, playing: isPlaying, index: i } = stateRef.current;
    if (total === 0) return;
    if (!isPlaying && i >= total - 1) setIndex(0);
    setPlaying(!isPlaying);
  }

  async function exportVideo() {
    if (!frames || frames.length === 0 || !project) return;
    setPlaying(false);
    setExporting(0);
    try {
      const r = await exportReplayAsWebm(frames, { name: project.name, stepsPerSecond: rate, onProgress: (p) => setExporting(Math.round(p)) });
      if (!r.canceled) toast.success('Timelapse exportado');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo exportar el timelapse');
    } finally {
      setExporting(null);
    }
  }

  async function wipe() {
    if (!projectId || !window.confirm('¿Vaciar el registro del proceso de este proyecto? El dibujo no se toca; solo se borran los pasos guardados para la reproducción.')) return;
    await clearReplay(projectId);
    setFrames([]);
    setIndex(0);
    setPlaying(false);
  }

  const frame = frames?.[Math.min(index, Math.max(0, n - 1))];
  const btn = 'p-1.5 rounded bg-panelLight hover:bg-border text-text disabled:opacity-40';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={close} data-testid="replay-dialog">
      <div className="bg-panel border border-border rounded-lg w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Film size={16} className="text-accent" />
          <span className="text-sm font-semibold">Reproducir el dibujo paso a paso</span>
          <span className="text-[11px] text-textDim">{project?.name}</span>
          <button onClick={close} className="ml-auto text-textDim hover:text-text" title="Cerrar (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3 flex items-center justify-center checkerboard" style={{ minHeight: 240 }}>
          {frames === null && <span className="text-xs text-textDim bg-panel/80 px-2 py-1 rounded">Cargando los pasos…</span>}
          {frames !== null && n === 0 && (
            <p className="text-xs text-text bg-panel/90 px-3 py-2 rounded max-w-md text-center">
              Aún no hay pasos guardados de este proyecto. A partir de ahora cada trazo, relleno, filtro o cambio de capa queda registrado y podrás reproducirlo aquí, también después de cerrar y volver a abrir el proyecto.
            </p>
          )}
          {frame && <img src={frame.jpg} alt={`Paso ${index + 1}`} className="max-h-[62vh] max-w-full bg-white block" draggable={false} data-testid="replay-image" />}
        </div>

        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span data-testid="replay-step" className="font-medium">
              Paso {n === 0 ? 0 : index + 1} de {n}
            </span>
            <span className="text-textDim truncate" data-testid="replay-action">
              {frame ? `— ${frame.action}` : ''}
            </span>
            <span className="ml-auto text-textDim" data-testid="replay-time">
              {frame && frames ? `tiempo ${fmtElapsed(frame.t - frames[0].t)} / ${fmtElapsed(frames[n - 1].t - frames[0].t)}` : ''}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            value={Math.min(index, Math.max(0, n - 1))}
            disabled={n === 0}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            className="w-full"
            data-testid="replay-scrubber"
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            <button className={btn} disabled={n === 0} onClick={() => { setPlaying(false); setIndex(0); }} title="Al principio">
              <SkipBack size={14} />
            </button>
            <button className={btn} disabled={n === 0} onClick={() => step(-1)} title="Paso anterior (←)" data-testid="replay-prev">
              <StepBack size={14} />
            </button>
            <button className={`${btn} bg-accent text-white hover:bg-accent`} disabled={n === 0} onClick={togglePlay} title="Reproducir / pausa (Espacio)" data-testid="replay-play">
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button className={btn} disabled={n === 0} onClick={() => step(1)} title="Paso siguiente (→)" data-testid="replay-next">
              <StepForward size={14} />
            </button>
            <button className={btn} disabled={n === 0} onClick={() => { setPlaying(false); setIndex(n - 1); }} title="Al final">
              <SkipForward size={14} />
            </button>

            <label className="flex items-center gap-1.5 text-[11px] text-textDim ml-2">
              Velocidad
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="bg-panelLight border border-border rounded px-1 py-0.5 text-[11px] text-text" data-testid="replay-rate">
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r} {r === 1 ? 'paso' : 'pasos'}/s
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={exportVideo}
              disabled={n === 0 || exporting !== null}
              className="ml-auto text-[11px] bg-panelLight hover:bg-border rounded px-2.5 py-1.5 disabled:opacity-40"
              title="Guarda la reproducción a la velocidad elegida como vídeo WebM"
              data-testid="replay-export"
            >
              {exporting === null ? 'Exportar timelapse (WebM)' : `Exportando… ${exporting}%`}
            </button>
            <button onClick={wipe} disabled={n === 0} className="text-textDim hover:text-red-400 disabled:opacity-40 p-1.5" title="Vaciar el registro de pasos de este proyecto">
              <Trash2 size={14} />
            </button>
          </div>
          <p className="text-[9px] text-textDim">Cada paso es un punto del historial (trazo, relleno, filtro, capa…). Los pasos se guardan en este equipo con el proyecto, así que la reproducción sigue ahí al volver a abrirlo. Si la sesión es muy larga se conservan solo algunos pasos intermedios.</p>
        </div>
      </div>
    </div>
  );
}

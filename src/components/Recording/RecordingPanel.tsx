import { useState } from 'react';
import toast from 'react-hot-toast';
import { Circle, Pause, Play, Square } from 'lucide-react';
import { useRecordingStore } from '@/store/recordingStore';
import { reencodeRecording } from '@/services/recordingReencode.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';
import { useAppStore } from '@/store/appStore';

const SPEEDS = [1, 2, 4, 8, 16];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecordingPanel() {
  const status = useRecordingStore((s) => s.status);
  const fps = useRecordingStore((s) => s.fps);
  const setFps = useRecordingStore((s) => s.setFps);
  const micEnabled = useRecordingStore((s) => s.micEnabled);
  const setMicEnabled = useRecordingStore((s) => s.setMicEnabled);
  const watermark = useRecordingStore((s) => s.watermark);
  const setWatermark = useRecordingStore((s) => s.setWatermark);
  const elapsedSeconds = useRecordingStore((s) => s.elapsedSeconds);
  const resultBlob = useRecordingStore((s) => s.resultBlob);
  const resultUrl = useRecordingStore((s) => s.resultUrl);
  const startRecording = useRecordingStore((s) => s.startRecording);
  const pauseRecording = useRecordingStore((s) => s.pauseRecording);
  const resumeRecording = useRecordingStore((s) => s.resumeRecording);
  const stopRecording = useRecordingStore((s) => s.stopRecording);
  const discardResult = useRecordingStore((s) => s.discardResult);
  const project = useAppStore((s) => s.project);

  const [speed, setSpeed] = useState(1);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleStart() {
    try {
      await startRecording();
    } catch (err) {
      toast.error('No se pudo iniciar la grabación');
      console.error(err);
    }
  }

  async function handleExport() {
    if (!resultBlob) return;
    setExporting(true);
    try {
      const start = trimStart.trim() ? Number(trimStart) : undefined;
      const end = trimEnd.trim() ? Number(trimEnd) : undefined;
      const needsReencode = speed !== 1 || start !== undefined || end !== undefined;
      const finalBlob = needsReencode ? await reencodeRecording(resultBlob, { speed, startSec: start, endSec: end }) : resultBlob;

      const filename = sanitizeFilename(project?.name ?? 'grabacion');
      if (isElectron()) {
        const base64 = uint8ToBase64(new Uint8Array(await finalBlob.arrayBuffer()));
        const result = await window.electronAPI.exportImage(`data:video/webm;base64,${base64}`, 'webm', filename);
        if (!result.canceled) toast.success('Grabación exportada');
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(finalBlob);
        link.download = `${filename}.webm`;
        link.click();
      }
    } catch (err) {
      toast.error('No se pudo exportar la grabación');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-xs font-semibold text-textDim uppercase tracking-wide">Grabación de sesión</h3>

      {status === 'idle' && !resultBlob && (
        <p className="text-[10px] text-textDim">
          Graba tu lienzo mientras dibujás, en tiempo real, y después generá un timelapse acelerado o un recorte para exportar como WebM.
        </p>
      )}

      {(status === 'idle' && !resultBlob) && (
        <div className="space-y-2 border border-border rounded p-2">
          <div className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">FPS</span>
            <input type="range" min={4} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right">{fps}</span>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)} />
            Grabar audio del micrófono
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={watermark.enabled} onChange={(e) => setWatermark({ enabled: e.target.checked })} />
            Marca de agua de texto
          </label>
          {watermark.enabled && (
            <div className="flex items-center gap-1.5">
              <input
                value={watermark.text}
                onChange={(e) => setWatermark({ text: e.target.value })}
                placeholder="Tu nombre o usuario"
                className="flex-1 bg-panel border border-border rounded px-2 py-1 text-[11px]"
              />
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={watermark.opacity}
                onChange={(e) => setWatermark({ opacity: Number(e.target.value) })}
                className="w-16"
                title="Opacidad"
              />
            </div>
          )}
        </div>
      )}

      {!resultBlob && (
        <div className="flex items-center gap-1.5">
          {status === 'idle' && (
            <button onClick={handleStart} disabled={!project} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
              <Circle size={12} className="fill-white" /> Grabar
            </button>
          )}
          {status === 'recording' && (
            <>
              <button onClick={pauseRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5">
                <Pause size={12} /> Pausar
              </button>
              <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 text-white text-xs rounded py-1.5">
                <Square size={12} /> Detener
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button onClick={resumeRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5">
                <Play size={12} /> Reanudar
              </button>
              <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 text-white text-xs rounded py-1.5">
                <Square size={12} /> Detener
              </button>
            </>
          )}
          {status === 'processing' && (
            <button disabled className="flex-1 bg-panelLight text-xs rounded py-1.5 opacity-50">
              Procesando…
            </button>
          )}
        </div>
      )}

      {(status === 'recording' || status === 'paused') && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono">{formatTime(elapsedSeconds)}</span>
          <span className="text-textDim">{status === 'recording' ? 'Grabando…' : 'Pausado'}</span>
        </div>
      )}

      {resultBlob && resultUrl && (
        <div className="space-y-2 border border-border rounded p-2">
          <video src={resultUrl} controls className="w-full rounded bg-black" style={{ maxHeight: 160 }} />

          <div className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">Velocidad</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 bg-panel border border-border rounded text-[10px] px-1 py-0.5">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? 'Normal' : `${s}× timelapse`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={trimStart}
              onChange={(e) => setTrimStart(e.target.value)}
              placeholder="Inicio (s)"
              className="w-1/2 bg-panel border border-border rounded px-2 py-1 text-[10px]"
            />
            <input
              value={trimEnd}
              onChange={(e) => setTrimEnd(e.target.value)}
              placeholder="Fin (s)"
              className="w-1/2 bg-panel border border-border rounded px-2 py-1 text-[10px]"
            />
          </div>
          <p className="text-[9px] text-textDim">Dejá los campos vacíos para usar la grabación completa.</p>

          <div className="flex gap-1.5">
            <button onClick={discardResult} disabled={exporting} className="flex-1 bg-panelLight text-[11px] rounded py-1.5 disabled:opacity-40">
              Descartar
            </button>
            <button onClick={handleExport} disabled={exporting} className="flex-1 bg-accent text-white text-[11px] rounded py-1.5 disabled:opacity-40">
              {exporting ? 'Generando…' : 'Exportar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

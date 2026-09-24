import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Circle, Pause, Play, Square } from 'lucide-react';
import { useRecordingStore } from '@/store/recordingStore';
import { reencodeRecording } from '@/services/recordingReencode.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';
import { useAppStore } from '@/store/appStore';
import { useUIStore } from '@/store/uiStore';

const SPEEDS = [1, 2, 4, 8, 16];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecordingPanel() {
  const { t } = useTranslation('panelsProduction');
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
      toast.error(t('recording.startErrorToast'));
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

      const filename = sanitizeFilename(project?.name ?? t('recording.defaultFilename'));
      if (isElectron()) {
        const base64 = uint8ToBase64(new Uint8Array(await finalBlob.arrayBuffer()));
        const result = await window.electronAPI.exportImage(`data:video/webm;base64,${base64}`, 'webm', filename);
        if (!result.canceled) toast.success(t('recording.exportedToast'));
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(finalBlob);
        link.download = `${filename}.webm`;
        link.click();
      }
    } catch (err) {
      toast.error(t('recording.exportErrorToast'));
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-xs font-semibold text-textDim uppercase tracking-wide">{t('recording.title')}</h3>

      <button
        onClick={() => useUIStore.getState().openReplayDialog()}
        className="w-full text-[11px] bg-panelLight hover:bg-border rounded py-1.5"
        title={t('recording.replayButtonTitle')}
        data-testid="open-replay-from-recording"
      >
        {t('recording.replayButton')}
      </button>

      {status === 'idle' && !resultBlob && (
        <p className="text-[10px] text-textDim">
          {t('recording.idleHint')}
        </p>
      )}

      {(status === 'idle' && !resultBlob) && (
        <div className="space-y-2 border border-border rounded p-2">
          <div className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">{t('recording.fps')}</span>
            <input type="range" min={4} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right">{fps}</span>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)} />
            {t('recording.micCheckbox')}
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-textDim">
            <input type="checkbox" checked={watermark.enabled} onChange={(e) => setWatermark({ enabled: e.target.checked })} />
            {t('recording.watermarkCheckbox')}
          </label>
          {watermark.enabled && (
            <div className="flex items-center gap-1.5">
              <input
                value={watermark.text}
                onChange={(e) => setWatermark({ text: e.target.value })}
                placeholder={t('recording.watermarkPlaceholder')}
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
                title={t('recording.watermarkOpacityTitle')}
              />
            </div>
          )}
        </div>
      )}

      {!resultBlob && (
        <div className="flex items-center gap-1.5">
          {status === 'idle' && (
            <button onClick={handleStart} disabled={!project} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-white text-xs rounded py-1.5 disabled:opacity-40">
              <Circle size={12} className="fill-white" /> {t('recording.startButton')}
            </button>
          )}
          {status === 'recording' && (
            <>
              <button onClick={pauseRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5">
                <Pause size={12} /> {t('recording.pauseButton')}
              </button>
              <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 text-white text-xs rounded py-1.5">
                <Square size={12} /> {t('recording.stopButton')}
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button onClick={resumeRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-panelLight text-xs rounded py-1.5">
                <Play size={12} /> {t('recording.resumeButton')}
              </button>
              <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/80 text-white text-xs rounded py-1.5">
                <Square size={12} /> {t('recording.stopButton')}
              </button>
            </>
          )}
          {status === 'processing' && (
            <button disabled className="flex-1 bg-panelLight text-xs rounded py-1.5 opacity-50">
              {t('recording.processingButton')}
            </button>
          )}
        </div>
      )}

      {(status === 'recording' || status === 'paused') && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-mono">{formatTime(elapsedSeconds)}</span>
          <span className="text-textDim">{status === 'recording' ? t('recording.recordingStatus') : t('recording.pausedStatus')}</span>
        </div>
      )}

      {resultBlob && resultUrl && (
        <div className="space-y-2 border border-border rounded p-2">
          <video src={resultUrl} controls className="w-full rounded bg-black" style={{ maxHeight: 160 }} />

          <div className="flex items-center gap-1.5 text-[10px] text-textDim">
            <span className="w-16 shrink-0">{t('recording.speed')}</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 bg-panel border border-border rounded text-[10px] px-1 py-0.5">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? t('recording.speedNormal') : t('recording.speedTimelapse', { speed: s })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={trimStart}
              onChange={(e) => setTrimStart(e.target.value)}
              placeholder={t('recording.trimStartPlaceholder')}
              className="w-1/2 bg-panel border border-border rounded px-2 py-1 text-[10px]"
            />
            <input
              value={trimEnd}
              onChange={(e) => setTrimEnd(e.target.value)}
              placeholder={t('recording.trimEndPlaceholder')}
              className="w-1/2 bg-panel border border-border rounded px-2 py-1 text-[10px]"
            />
          </div>
          <p className="text-[9px] text-textDim">{t('recording.trimHint')}</p>

          <div className="flex gap-1.5">
            <button onClick={discardResult} disabled={exporting} className="flex-1 bg-panelLight text-[11px] rounded py-1.5 disabled:opacity-40">
              {t('recording.discardButton')}
            </button>
            <button onClick={handleExport} disabled={exporting} className="flex-1 bg-accent text-white text-[11px] rounded py-1.5 disabled:opacity-40">
              {exporting ? t('recording.generatingButton') : t('recording.exportButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

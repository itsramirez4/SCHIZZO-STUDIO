import { create } from 'zustand';
import { useAppStore } from '@/store/appStore';
import { RecordingStatus, WatermarkSettings } from '@/types/recording';
import { SessionRecorder } from '@/services/sessionRecorder.service';

let recorder: SessionRecorder | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;

interface RecordingStore {
  status: RecordingStatus;
  fps: number;
  micEnabled: boolean;
  watermark: WatermarkSettings;
  elapsedSeconds: number;
  resultBlob: Blob | null;
  resultUrl: string | null;

  setFps: (fps: number) => void;
  setMicEnabled: (enabled: boolean) => void;
  setWatermark: (patch: Partial<WatermarkSettings>) => void;

  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
  setResult: (blob: Blob) => void;
  discardResult: () => void;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  status: 'idle',
  fps: 15,
  micEnabled: false,
  watermark: { enabled: false, text: '', opacity: 0.7 },
  elapsedSeconds: 0,
  resultBlob: null,
  resultUrl: null,

  setFps: (fps) => set({ fps: Math.max(4, Math.min(30, fps)) }),
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setWatermark: (patch) => set((s) => ({ watermark: { ...s.watermark, ...patch } })),

  startRecording: async () => {
    const { fps, watermark, micEnabled } = get();
    recorder = new SessionRecorder(() => useAppStore.getState().project, fps, watermark);
    await recorder.start(micEnabled);
    set({ status: 'recording', elapsedSeconds: 0, resultBlob: null, resultUrl: null });

    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => {
      if (recorder) set({ elapsedSeconds: recorder.getElapsedSeconds() });
    }, 500);
  },

  pauseRecording: () => {
    recorder?.pause();
    set({ status: 'paused' });
  },

  resumeRecording: () => {
    recorder?.resume();
    set({ status: 'recording' });
  },

  stopRecording: async () => {
    if (!recorder) return;
    set({ status: 'processing' });
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    const blob = await recorder.stop();
    recorder = null;
    get().setResult(blob);
    set({ status: 'idle' });
  },

  setResult: (blob) => {
    const prevUrl = get().resultUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({ resultBlob: blob, resultUrl: URL.createObjectURL(blob) });
  },

  discardResult: () => {
    const prevUrl = get().resultUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({ resultBlob: null, resultUrl: null });
  },
}));

import { Project } from '@/types';
import { flattenLayers } from '@/services/layer.service';
import { WatermarkSettings } from '@/types/recording';

/**
 * Records the live, fully-composited canvas — not a single layer's raw <canvas> element,
 * which is what a naive `document.querySelector('canvas')` would grab in a layered editor
 * like this one. Each tick re-flattens the CURRENT project state (read via `getProject`, not
 * a snapshot captured at construction time) onto a dedicated compositor canvas, which is what
 * MediaRecorder actually captures — the same real technique as `videoExport.service.ts`'s
 * `exportAnimationAsWebm`, just running continuously instead of over a fixed frame list.
 */
export class SessionRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private intervalId: number | null = null;
  private micStream: MediaStream | null = null;
  private getProject: () => Project | null;
  private fps: number;
  private watermark: WatermarkSettings;
  private startedAt = 0;
  private elapsedBeforePause = 0;

  constructor(getProject: () => Project | null, fps: number, watermark: WatermarkSettings) {
    this.getProject = getProject;
    this.fps = fps;
    this.watermark = watermark;
    const project = getProject();
    this.canvas = document.createElement('canvas');
    this.canvas.width = project?.width ?? 800;
    this.canvas.height = project?.height ?? 600;
    this.ctx = this.canvas.getContext('2d')!;
  }

  private drawFrame() {
    const project = this.getProject();
    if (!project) return;
    const flat = flattenLayers(project.layers, project.width, project.height);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(flat, 0, 0, this.canvas.width, this.canvas.height);

    if (this.watermark.enabled && this.watermark.text.trim()) {
      this.ctx.save();
      this.ctx.globalAlpha = this.watermark.opacity;
      const fontSize = Math.max(12, Math.round(this.canvas.width * 0.03));
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      this.ctx.lineWidth = Math.max(1, fontSize * 0.08);
      this.ctx.textBaseline = 'bottom';
      this.ctx.textAlign = 'right';
      const pad = Math.max(6, fontSize * 0.4);
      const x = this.canvas.width - pad;
      const y = this.canvas.height - pad;
      this.ctx.strokeText(this.watermark.text, x, y);
      this.ctx.fillText(this.watermark.text, x, y);
      this.ctx.restore();
    }
  }

  /** Mic audio only — Electron's desktop/system-audio capture (`desktopCapturer` with audio)
   * is inconsistent across platforms, so it's left out rather than shipping something that
   * silently doesn't work on half of them. */
  async start(withMic: boolean): Promise<void> {
    this.drawFrame();
    const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

    const videoStream = this.canvas.captureStream(this.fps);
    let tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (withMic) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tracks = [...tracks, ...this.micStream.getAudioTracks()];
      } catch (err) {
        console.error('No se pudo acceder al micrófono', err);
      }
    }

    const combined = new MediaStream(tracks);
    this.recorder = new MediaRecorder(combined, { mimeType });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.start(1000);
    await new Promise((r) => setTimeout(r, 100));

    this.intervalId = window.setInterval(() => this.drawFrame(), 1000 / this.fps);
    this.startedAt = Date.now();
  }

  pause() {
    this.recorder?.pause();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.elapsedBeforePause += Date.now() - this.startedAt;
  }

  resume() {
    this.recorder?.resume();
    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => this.drawFrame(), 1000 / this.fps);
    }
    this.startedAt = Date.now();
  }

  getElapsedSeconds(): number {
    const running = this.intervalId !== null ? Date.now() - this.startedAt : 0;
    return (this.elapsedBeforePause + running) / 1000;
  }

  async stop(): Promise<Blob> {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (!this.recorder) return new Blob([], { type: 'video/webm' });

    const stopped = new Promise<Blob>((resolve) => {
      this.recorder!.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }));
    });
    await new Promise((r) => setTimeout(r, 150));
    this.recorder.stop();
    this.micStream?.getTracks().forEach((t) => t.stop());
    return stopped;
  }
}

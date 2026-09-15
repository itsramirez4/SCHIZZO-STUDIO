import { Project } from '@/types';
import { getFrameLayers } from '@/store/appStore';
import { flattenLayers } from '@/services/layer.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';
import { createCanvas } from '@/utils/canvasUtils';

/**
 * Real WebM export via MediaRecorder + canvas.captureStream — both are standard Chromium/
 * Electron APIs, no extra dependency needed. MP4 is deliberately NOT offered: Chromium's
 * MediaRecorder can't mux into an MP4 container, only WebM (vp8/vp9/av1) — getting MP4 out
 * would mean bundling ffmpeg.wasm (~30MB), which is a size/complexity tradeoff for the user to
 * decide, not something to fake with an empty placeholder Blob.
 *
 * This is inherently a REAL-TIME recording (the browser captures the canvas as it's actually
 * redrawn over wall-clock time) — exporting a 5-second animation takes ~5 real seconds, there's
 * no way to render it instantly like the GIF/APNG encoders do.
 */
export async function exportAnimationAsWebm(
  project: Project,
  onProgress?: (pct: number) => void
): Promise<{ canceled: boolean; filePath?: string }> {
  const animation = project.animation;
  if (!animation || animation.frames.length === 0) return { canceled: true };

  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d')!;

  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

  // Draw the first frame before starting capture, so the stream has real content from frame 0
  // rather than a blank canvas. Continuous auto-capture (captureStream(fps)) proved far more
  // reliable here than the "manual" captureStream(0) + track.requestFrame() mode: on a short
  // animation, manual mode produced a 0-byte recording — the encoder never got frames it
  // considered valid to flush. A short warm-up delay after recorder.start(), and another
  // after the last frame before stop(), give the encoder time to actually capture something
  // at both ends instead of racing them.
  const firstFlat = flattenLayers(getFrameLayers(project, 0), project.width, project.height);
  ctx.drawImage(firstFlat, 0, 0);

  const stream = canvas.captureStream(Math.max(1, Math.min(60, animation.fps)));
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  recorder.start(100);
  await new Promise((r) => setTimeout(r, 100));

  for (let i = 0; i < animation.frames.length; i++) {
    const layers = getFrameLayers(project, i);
    const flat = flattenLayers(layers, project.width, project.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(flat, 0, 0);
    onProgress?.((i / animation.frames.length) * 100);
    await new Promise((r) => setTimeout(r, animation.frames[i].durationMs));
  }
  await new Promise((r) => setTimeout(r, 150));
  recorder.stop();
  const blob = await stopped;
  onProgress?.(100);

  const base64 = uint8ToBase64(new Uint8Array(await blob.arrayBuffer()));
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(`data:video/webm;base64,${base64}`, 'webm', filename);
  }
  const link = document.createElement('a');
  link.href = `data:video/webm;base64,${base64}`;
  link.download = `${filename}.webm`;
  link.click();
  return { canceled: false };
}

/** Tiles every frame into one grid image, sized to fit `frames.length` in as square a grid
 * as possible — unlike a fixed guess at rows/cols, this always fits every frame exactly once. */
export async function exportAnimationAsSpritesheet(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const animation = project.animation;
  if (!animation || animation.frames.length === 0) return { canceled: true };

  const n = animation.frames.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const canvas = createCanvas(cols * project.width, rows * project.height);
  const ctx = canvas.getContext('2d')!;

  animation.frames.forEach((_, i) => {
    const layers = getFrameLayers(project, i);
    const flat = flattenLayers(layers, project.width, project.height);
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(flat, col * project.width, row * project.height);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(dataUrl, 'png', `${filename}_spritesheet`);
  }
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}_spritesheet.png`;
  link.click();
  return { canceled: false };
}

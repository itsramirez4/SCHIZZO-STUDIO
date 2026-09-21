import { Project } from '@/types';
import { IdbStore } from '@/utils/idbStore';
import { flattenLayers } from './layer.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';

/**
 * Step-by-step replay of how a drawing was made. Every step that goes into the undo history (a
 * stroke, a fill, a filter, a layer change...) also stores a small JPEG of the flattened artwork, in
 * IndexedDB keyed by the project id — so, unlike the undo stack, the process survives closing the app
 * and reopening the project. The replay dialog steps through those frames or plays them back, and
 * can export them as a WebM timelapse.
 *
 * At most MAX_FRAMES are kept per project: past that, every second frame is dropped (the first and
 * the last are always kept), so a very long session keeps a thinner but complete record instead of
 * losing its beginning.
 */

export interface ReplayFrame {
  id: number;
  /** Wall-clock time of the step (ms since epoch). */
  t: number;
  action: string;
  /** JPEG data URL of the flattened artwork, scaled down to `FRAME_MAX_SIDE`. */
  jpg: string;
}

interface ReplayMeta {
  projectId: string;
  width: number;
  height: number;
  ids: number[];
  nextId: number;
}

const store = new IdbStore('schizzo-replay');
export const MAX_REPLAY_FRAMES = 600;
const FRAME_MAX_SIDE = 800;

const metaKey = (projectId: string) => `${projectId}:meta`;
const frameKey = (projectId: string, id: number) => `${projectId}:f:${id}`;

// Writes for one project are serialised, so rapid steps never overwrite each other's bookkeeping.
const queues = new Map<string, Promise<void>>();
function enqueue(projectId: string, job: () => Promise<void>) {
  const next = (queues.get(projectId) ?? Promise.resolve()).then(job).catch((err) => {
    console.warn('No se pudo guardar un paso del proceso', err);
  });
  queues.set(projectId, next);
  return next;
}

/** Waits until every step captured so far has been written (used by tests and by the dialog). */
export function replayIdle(projectId: string): Promise<void> {
  return queues.get(projectId) ?? Promise.resolve();
}

/** The flattened artwork scaled to fit `FRAME_MAX_SIDE`, on paper white, as a JPEG data URL. */
function snapshot(project: Project): { jpg: string; width: number; height: number } {
  const flat = flattenLayers(project.layers, project.width, project.height);
  const k = Math.min(1, FRAME_MAX_SIDE / Math.max(project.width, project.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(project.width * k));
  c.height = Math.max(1, Math.round(project.height * k));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = project.settings?.transparentBg === false && project.settings.backgroundColor ? project.settings.backgroundColor : '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(flat, 0, 0, c.width, c.height);
  return { jpg: c.toDataURL('image/jpeg', 0.72), width: c.width, height: c.height };
}

/**
 * Records the current state of the artwork as a new step. The pixels are read right now (the layer
 * canvases can change or be swapped a moment later); only the storage is asynchronous.
 */
export function captureReplayFrame(project: Project, action: string) {
  if (!project.id || typeof indexedDB === 'undefined') return;
  let snap: ReturnType<typeof snapshot>;
  try {
    snap = snapshot(project);
  } catch (err) {
    console.warn('No se pudo capturar el paso del proceso', err);
    return;
  }
  const t = Date.now();
  const projectId = project.id;
  void enqueue(projectId, async () => {
    const meta = (await store.get<ReplayMeta>(metaKey(projectId))) ?? { projectId, width: snap.width, height: snap.height, ids: [], nextId: 0 };
    meta.width = snap.width;
    meta.height = snap.height;
    const id = meta.nextId++;
    meta.ids.push(id);
    await store.set(frameKey(projectId, id), { id, t, action, jpg: snap.jpg } satisfies ReplayFrame);
    if (meta.ids.length > MAX_REPLAY_FRAMES) {
      const keep: number[] = [];
      const drop: number[] = [];
      meta.ids.forEach((fid, i) => (i === 0 || i === meta.ids.length - 1 || i % 2 === 0 ? keep : drop).push(fid));
      meta.ids = keep;
      await Promise.all(drop.map((fid) => store.delete(frameKey(projectId, fid))));
    }
    await store.set(metaKey(projectId), meta);
  });
}

/** All recorded steps of a project, oldest first (empty when nothing was recorded yet). */
export async function loadReplay(projectId: string): Promise<{ width: number; height: number; frames: ReplayFrame[] }> {
  await replayIdle(projectId);
  const meta = await store.get<ReplayMeta>(metaKey(projectId));
  if (!meta) return { width: 0, height: 0, frames: [] };
  const frames = (await Promise.all(meta.ids.map((id) => store.get<ReplayFrame>(frameKey(projectId, id))))).filter((f): f is ReplayFrame => !!f);
  return { width: meta.width, height: meta.height, frames };
}

export async function clearReplay(projectId: string): Promise<void> {
  await replayIdle(projectId);
  const meta = await store.get<ReplayMeta>(metaKey(projectId));
  if (meta) await Promise.all(meta.ids.map((id) => store.delete(frameKey(projectId, id))));
  await store.delete(metaKey(projectId));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Timelapse as a WebM, played in real time through MediaRecorder (same technique as the animation
 * export): `stepsPerSecond` steps per second, and the last step is held for a moment.
 */
export async function exportReplayAsWebm(
  frames: ReplayFrame[],
  opts: { name: string; stepsPerSecond: number; onProgress?: (pct: number) => void }
): Promise<{ canceled: boolean; filePath?: string }> {
  if (frames.length === 0) return { canceled: true };
  const first = await loadImage(frames[0].jpg);
  const canvas = document.createElement('canvas');
  canvas.width = first.naturalWidth;
  canvas.height = first.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(first, 0, 0);

  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const stream = canvas.captureStream(Math.max(1, Math.min(60, Math.round(opts.stepsPerSecond))));
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });
  recorder.start(100);
  await new Promise((r) => setTimeout(r, 100));

  const stepMs = 1000 / Math.max(0.5, opts.stepsPerSecond);
  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(frames[i].jpg);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    opts.onProgress?.((i / frames.length) * 100);
    await new Promise((r) => setTimeout(r, i === frames.length - 1 ? Math.max(stepMs, 1200) : stepMs));
  }
  await new Promise((r) => setTimeout(r, 150));
  recorder.stop();
  const blob = await stopped;
  opts.onProgress?.(100);

  const base64 = uint8ToBase64(new Uint8Array(await blob.arrayBuffer()));
  const filename = `${sanitizeFilename(opts.name)}-proceso`;
  if (isElectron()) return window.electronAPI.exportImage(`data:video/webm;base64,${base64}`, 'webm', filename);
  const link = document.createElement('a');
  link.href = `data:video/webm;base64,${base64}`;
  link.download = `${filename}.webm`;
  link.click();
  return { canceled: false };
}

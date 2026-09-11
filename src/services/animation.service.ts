import { Project } from '@/types';
import { getFrameLayers } from '@/store/appStore';
import { flattenLayers } from '@/services/layer.service';
import { encodeApng, ApngFrameInput } from '@/services/apng.service';
import { isElectron, sanitizeFilename } from '@/utils/fileUtils';
import { uint8ToBase64 } from '@/utils/binaryUtils';

interface WorkerFrameInput {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  delayMs: number;
}

/**
 * Runs the GIF encoder in a Web Worker instead of blocking the main thread — median-cut
 * quantization + LZW over every frame of a large animation can take real wall time, and
 * doing it inline would freeze the UI for the duration. Pixel buffers are transferred
 * (zero-copy), not structured-cloned, and the encoded bytes are transferred back the
 * same way. The worker is spun up fresh per export and terminated right after — this is a
 * one-shot, infrequent operation, not worth keeping a persistent worker alive for.
 */
function encodeGifInWorker(frames: WorkerFrameInput[], loop: boolean): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/gifEncoder.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ bytes?: Uint8Array; error?: string }>) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.bytes!);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e.error ?? new Error(e.message));
    };
    const transfer = frames.map((f) => f.data.buffer);
    worker.postMessage({ frames, loop }, transfer);
  });
}

function flattenFrame(project: Project, index: number, durationMs: number): WorkerFrameInput {
  const canvas = flattenLayers(getFrameLayers(project, index), project.width, project.height);
  const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: imageData.width, height: imageData.height, delayMs: durationMs };
}

export async function exportAnimationAsGif(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const animation = project.animation;
  if (!animation || animation.frames.length === 0) return { canceled: true };

  const frames = animation.frames.map((frame, i) => flattenFrame(project, i, frame.durationMs));
  const bytes = await encodeGifInWorker(frames, animation.loop);
  const base64 = uint8ToBase64(bytes);
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportGif(base64, filename);
  }

  const link = document.createElement('a');
  link.href = `data:image/gif;base64,${base64}`;
  link.download = `${filename}.gif`;
  link.click();
  return { canceled: false };
}

/**
 * Exports every frame as a numbered PNG (frame_01.png, frame_02.png, ...) instead of a
 * single GIF — useful when the target needs individually addressable frames (a game engine,
 * a video editor, further per-frame touch-up in another app) rather than a looping preview.
 */
export async function exportAnimationAsPngSequence(project: Project): Promise<{ canceled: boolean; folderPath?: string }> {
  const animation = project.animation;
  if (!animation || animation.frames.length === 0) return { canceled: true };

  const filename = sanitizeFilename(project.name);
  const pad = Math.max(2, String(animation.frames.length).length);
  const pngs = animation.frames.map((_, i) => {
    const canvas = flattenLayers(getFrameLayers(project, i), project.width, project.height);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  });

  if (isElectron()) {
    return window.electronAPI.exportPngSequence(pngs, filename);
  }

  // No folder picker outside Electron — fall back to one browser download per frame.
  animation.frames.forEach((_, i) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${pngs[i]}`;
    link.download = `${filename}_${String(i + 1).padStart(pad, '0')}.png`;
    link.click();
  });
  return { canceled: false };
}

/**
 * Exports as an animated PNG (APNG) instead of a GIF — same frames, but full 32-bit RGBA
 * per pixel (no 256-color palette ceiling, no dithering needed for smooth gradients).
 */
export async function exportAnimationAsApng(project: Project): Promise<{ canceled: boolean; filePath?: string }> {
  const animation = project.animation;
  if (!animation || animation.frames.length === 0) return { canceled: true };

  const frames: ApngFrameInput[] = animation.frames.map((frame, i) => ({
    canvas: flattenLayers(getFrameLayers(project, i), project.width, project.height),
    delayMs: frame.durationMs,
  }));

  const bytes = await encodeApng(frames, animation.loop);
  const base64 = uint8ToBase64(bytes);
  const filename = sanitizeFilename(project.name);

  if (isElectron()) {
    return window.electronAPI.exportImage(`data:image/apng;base64,${base64}`, 'apng', filename);
  }

  const link = document.createElement('a');
  link.href = `data:image/apng;base64,${base64}`;
  link.download = `${filename}.apng`;
  link.click();
  return { canceled: false };
}

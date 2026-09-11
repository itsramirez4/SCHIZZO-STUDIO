/// <reference lib="webworker" />
export {};
declare const self: DedicatedWorkerGlobalScope;

import { encodeGif, GifFrameInput } from '@/services/gifEncoder';

interface WorkerFrameInput {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  delayMs: number;
}

interface EncodeRequest {
  frames: WorkerFrameInput[];
  loop: boolean;
}

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { frames, loop } = e.data;
  const gifFrames: GifFrameInput[] = frames.map((f) => ({
    // TS's ImageData constructor narrows Uint8ClampedArray to an ArrayBuffer (not
    // ArrayBufferLike) backing store; a transferred buffer is structurally identical
    // at runtime, so this is a safe cast, not a real type mismatch.
    imageData: new ImageData(f.data as unknown as Uint8ClampedArray<ArrayBuffer>, f.width, f.height),
    delayMs: f.delayMs,
  }));

  try {
    const bytes = encodeGif(gifFrames, loop);
    self.postMessage({ bytes }, [bytes.buffer]);
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};

/// <reference lib="webworker" />
// Encodes bitmaps to PNG/JPEG off the main thread (the main thread only hands the bitmap over).
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<{ id: number; bitmap: ImageBitmap; type: string; quality?: number }>) => {
  const { id, bitmap, type, quality } = e.data;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap);
    const blob = await canvas.convertToBlob({ type, quality });
    ctx.postMessage({ id, blob });
  } catch (err) {
    ctx.postMessage({ id, error: String(err) });
  }
};

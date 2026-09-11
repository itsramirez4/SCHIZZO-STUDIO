export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const clone = createCanvas(source.width, source.height);
  const ctx = clone.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  return clone;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, type = 'image/png', quality = 1): string {
  return canvas.toDataURL(type, quality);
}

export function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function dataUrlToCanvas(dataUrl: string, width?: number, height?: number): Promise<HTMLCanvasElement> {
  const img = await dataUrlToImage(dataUrl);
  const canvas = createCanvas(width ?? img.width, height ?? img.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function getPointerPos(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

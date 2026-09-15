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

/** Extracts the `x,y,w,h` region of `source` into a new, correctly-sized canvas — used for
 * copy/cut (clipboard content shouldn't carry the whole layer, just the selected region). */
export function cropCanvas(source: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const out = createCanvas(w, h);
  out.getContext('2d')!.drawImage(source, -x, -y);
  return out;
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

/**
 * Screen (clientX/clientY) -> project-pixel coordinates, given the stage's current zoom
 * and rotation. Deliberately does NOT take pan, or the viewport's rect, as input: a
 * rotated stage's own `getBoundingClientRect()` is just its axis-aligned bounding box, not
 * its true rotated rect — but that box's CENTER is still exactly the stage's true on-screen
 * center regardless of rotation angle (rotating a rect around its own center can't move
 * that center). Reading the center straight from the live DOM like this also sidesteps
 * needing to separately account for the viewport's own flexbox-centering of the stage,
 * which pan alone doesn't capture. `stageRect` is `stageRef.current.getBoundingClientRect()`.
 */
export function screenToProjectPoint(
  clientX: number,
  clientY: number,
  stageRect: { left: number; top: number; width: number; height: number },
  zoom: number,
  rotationDeg: number,
  projectWidth: number,
  projectHeight: number,
  flipX = false
): { x: number; y: number } {
  const centerX = stageRect.left + stageRect.width / 2;
  const centerY = stageRect.top + stageRect.height / 2;
  const dxScreen = clientX - centerX;
  const dyScreen = clientY - centerY;

  let dxUnrot = dxScreen;
  let dyUnrot = dyScreen;
  if (rotationDeg !== 0) {
    const rad = (-rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    dxUnrot = dxScreen * cos - dyScreen * sin;
    dyUnrot = dxScreen * sin + dyScreen * cos;
  }

  // The view-mirror flip is applied INSIDE the rotation in the stage's CSS transform (mirror
  // first, then rotate — see Canvas2D's stageRef style), so undoing it here has to happen in
  // reverse order: undo rotation above, THEN undo the flip. scaleX(-1) is its own inverse.
  if (flipX) dxUnrot = -dxUnrot;

  return {
    x: dxUnrot / zoom + projectWidth / 2,
    y: dyUnrot / zoom + projectHeight / 2,
  };
}

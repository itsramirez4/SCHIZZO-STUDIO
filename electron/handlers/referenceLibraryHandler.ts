import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Same persistence pattern as the Asset Library — a separate file, not folded into
 * asset-library.json, since reference photos can be a few MB each as base64 and would bloat
 * every autosave of the (much smaller) patterns/gradients/textures/palettes file otherwise. */
function libraryPath(): string {
  return path.join(app.getPath('userData'), 'reference-library.json');
}

const MAX_FETCH_BYTES = 20 * 1024 * 1024; // 20MB

export function registerReferenceLibraryHandlers() {
  ipcMain.handle('referenceLibrary:load', async () => {
    try {
      const raw = fs.readFileSync(libraryPath(), 'utf-8');
      return { json: raw };
    } catch {
      return { json: null };
    }
  });

  ipcMain.handle('referenceLibrary:save', async (_e, json: string) => {
    fs.writeFileSync(libraryPath(), json, 'utf-8');
    return { ok: true };
  });

  // Runs in the main process specifically to avoid the renderer's CORS restrictions — a plain
  // fetch() from the page would be blocked from reading most image hosts' response bodies back
  // (only *displaying* an <img> is CORS-exempt; reading the bytes to cache them locally is not).
  // Node's fetch here has no such restriction, since it isn't a browser security boundary.
  ipcMain.handle('reference:fetchUrl', async (_e, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, error: 'Solo se admiten URLs http/https' };
      }

      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) return { ok: false, error: 'La URL no apunta a una imagen' };

      const declaredLength = Number(response.headers.get('content-length') || '0');
      if (declaredLength > MAX_FETCH_BYTES) return { ok: false, error: 'Imagen demasiado grande (máx. 20MB)' };

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_FETCH_BYTES) return { ok: false, error: 'Imagen demasiado grande (máx. 20MB)' };

      const base64 = Buffer.from(buffer).toString('base64');
      return { ok: true, dataUrl: `data:${contentType};base64,${base64}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  });
}

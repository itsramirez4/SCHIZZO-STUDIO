import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Every other persistence mechanism in this app (projects, brushes) is an explicit,
 * user-triggered file dialog — there's no precedent for a silently auto-saved global store.
 * The Asset Library is the first thing that needs one (a cross-project, cross-session library,
 * same idea as Adobe CC Libraries), so it gets a small JSON file in Electron's userData
 * directory instead of introducing browser-only IndexedDB, which would be invisible and
 * non-portable in a local-first app where everything else is a plain, inspectable file. */
function libraryPath(): string {
  return path.join(app.getPath('userData'), 'asset-library.json');
}

export function registerAssetLibraryHandlers() {
  ipcMain.handle('assetLibrary:load', async () => {
    try {
      const raw = fs.readFileSync(libraryPath(), 'utf-8');
      return { json: raw };
    } catch {
      return { json: null };
    }
  });

  ipcMain.handle('assetLibrary:save', async (_e, json: string) => {
    fs.writeFileSync(libraryPath(), json, 'utf-8');
    return { ok: true };
  });
}

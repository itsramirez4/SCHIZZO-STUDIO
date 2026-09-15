import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Presets are global, cross-project configuration (a "1-point interior" grid you'd reuse across
 * many different drawings) — same small-JSON-file-in-userData pattern as customization.json,
 * deliberately NOT stored inside the .drawing project file (unlike the grid/guides/symmetry
 * that ARE part of a given project's own perspective setup). */
function presetsPath(): string {
  return path.join(app.getPath('userData'), 'perspective-presets.json');
}

export function registerPerspectivePresetsHandlers() {
  ipcMain.handle('perspectivePresets:load', async () => {
    try {
      const raw = fs.readFileSync(presetsPath(), 'utf-8');
      return { json: raw };
    } catch {
      return { json: null };
    }
  });

  ipcMain.handle('perspectivePresets:save', async (_e, json: string) => {
    fs.writeFileSync(presetsPath(), json, 'utf-8');
    return { ok: true };
  });
}

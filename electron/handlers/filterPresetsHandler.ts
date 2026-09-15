import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Same global, cross-project JSON-in-userData pattern as perspective-presets.json — a saved
 * filter preset (e.g. "strong twirl") is something you'd reuse across many drawings, not
 * something that belongs to one project file. */
function presetsPath(): string {
  return path.join(app.getPath('userData'), 'filter-presets.json');
}

export function registerFilterPresetsHandlers() {
  ipcMain.handle('filterPresets:load', async () => {
    try {
      const raw = fs.readFileSync(presetsPath(), 'utf-8');
      return { json: raw };
    } catch {
      return { json: null };
    }
  });

  ipcMain.handle('filterPresets:save', async (_e, json: string) => {
    fs.writeFileSync(presetsPath(), json, 'utf-8');
    return { ok: true };
  });
}

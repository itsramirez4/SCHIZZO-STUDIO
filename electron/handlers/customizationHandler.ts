import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Same small-JSON-file-in-userData pattern as the Asset/Reference libraries — shortcut
 * overrides, saved profiles, and recorded macros are cross-project, cross-session user
 * configuration, not something that belongs in a single project file. */
function customizationPath(): string {
  return path.join(app.getPath('userData'), 'customization.json');
}

export function registerCustomizationHandlers() {
  ipcMain.handle('customization:load', async () => {
    try {
      const raw = fs.readFileSync(customizationPath(), 'utf-8');
      return { json: raw };
    } catch {
      return { json: null };
    }
  });

  ipcMain.handle('customization:save', async (_e, json: string) => {
    fs.writeFileSync(customizationPath(), json, 'utf-8');
    return { ok: true };
  });
}

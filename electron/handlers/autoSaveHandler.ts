import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

/** Real backups written to disk under userData/autosave — separate from the user's own
 * .drawing file so an autosave tick never silently overwrites (or races) an explicit
 * Ctrl+S save. A manifest.json alongside the backups tracks project name/timestamp/size
 * per entry, since backup filenames themselves only need to be unique. */
const MAX_PER_PROJECT = 5;

function autoSaveDir(): string {
  const dir = path.join(app.getPath('userData'), 'autosave');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function manifestPath(): string {
  return path.join(autoSaveDir(), 'manifest.json');
}

interface AutoSaveEntry {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  timestamp: string;
  size: number;
}

function readManifest(): AutoSaveEntry[] {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function writeManifest(entries: AutoSaveEntry[]) {
  fs.writeFileSync(manifestPath(), JSON.stringify(entries, null, 2), 'utf-8');
}

export function registerAutoSaveHandlers() {
  ipcMain.handle('autosave:write', async (_e, json: string, projectId: string, projectName: string) => {
    const dir = autoSaveDir();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${id}.drawing`;
    fs.writeFileSync(path.join(dir, fileName), json, 'utf-8');

    const entry: AutoSaveEntry = {
      id,
      projectId,
      projectName,
      fileName,
      timestamp: new Date().toISOString(),
      size: Buffer.byteLength(json, 'utf-8'),
    };

    let entries = readManifest();
    entries.push(entry);

    // Prune old backups for THIS project beyond the cap; other projects' entries untouched.
    const forProject = entries
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const toRemove = forProject.slice(MAX_PER_PROJECT);
    for (const stale of toRemove) {
      try {
        fs.unlinkSync(path.join(dir, stale.fileName));
      } catch {
        // already gone — fine
      }
    }
    const removeIds = new Set(toRemove.map((e) => e.id));
    entries = entries.filter((e) => !removeIds.has(e.id));

    writeManifest(entries);
    return { ok: true, timestamp: entry.timestamp, size: entry.size };
  });

  ipcMain.handle('autosave:list', async () => {
    const dir = autoSaveDir();
    const entries = readManifest().filter((e) => fs.existsSync(path.join(dir, e.fileName)));
    writeManifest(entries); // drop dangling entries whose files vanished (e.g. manual cleanup)
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  });

  ipcMain.handle('autosave:read', async (_e, id: string) => {
    const entry = readManifest().find((e) => e.id === id);
    if (!entry) return { canceled: true };
    try {
      const json = fs.readFileSync(path.join(autoSaveDir(), entry.fileName), 'utf-8');
      return { canceled: false, json, projectName: entry.projectName };
    } catch {
      return { canceled: true };
    }
  });

  ipcMain.handle('autosave:delete', async (_e, id: string) => {
    const dir = autoSaveDir();
    const entries = readManifest();
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      try {
        fs.unlinkSync(path.join(dir, entry.fileName));
      } catch {
        // already gone
      }
    }
    writeManifest(entries.filter((e) => e.id !== id));
    return { ok: true };
  });
}

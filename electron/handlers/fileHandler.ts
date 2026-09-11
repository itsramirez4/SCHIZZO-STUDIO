import { dialog, ipcMain, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';

const RECENT_FILE = path.join(app.getPath('userData'), 'recent-projects.json');
const PROJECT_FILTERS = [{ name: 'SCHIZZO Drawing', extensions: ['drawing'] }];

function readRecent(): string[] {
  try {
    return JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function pushRecent(filePath: string) {
  const list = readRecent().filter((p) => p !== filePath);
  list.unshift(filePath);
  fs.writeFileSync(RECENT_FILE, JSON.stringify(list.slice(0, 10), null, 2));
}

export function registerFileHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('project:save', async (_e, json: string, existingPath?: string) => {
    let filePath = existingPath;
    if (!filePath) {
      const win = getWindow();
      const result = await dialog.showSaveDialog(win!, {
        title: 'Guardar proyecto',
        defaultPath: 'proyecto.drawing',
        filters: PROJECT_FILTERS,
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      filePath = result.filePath;
    }
    fs.writeFileSync(filePath, json, 'utf-8');
    pushRecent(filePath);
    return { canceled: false, filePath };
  });

  ipcMain.handle('project:save-as', async (_e, json: string) => {
    const win = getWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Guardar proyecto como',
      defaultPath: 'proyecto.drawing',
      filters: PROJECT_FILTERS,
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, json, 'utf-8');
    pushRecent(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('project:open', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Abrir proyecto',
      filters: PROJECT_FILTERS,
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    const json = fs.readFileSync(filePath, 'utf-8');
    pushRecent(filePath);
    return { canceled: false, filePath, json };
  });

  ipcMain.handle('project:open-path', async (_e, filePath: string) => {
    if (!fs.existsSync(filePath)) return { canceled: true };
    const json = fs.readFileSync(filePath, 'utf-8');
    pushRecent(filePath);
    return { canceled: false, filePath, json };
  });

  ipcMain.handle('project:get-recent', async () => {
    return readRecent().filter((p) => fs.existsSync(p));
  });

  ipcMain.handle('image:import', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importar imagen',
      filters: [{ name: 'Imágenes', extensions: ['png', 'apng', 'jpg', 'jpeg', 'webp', 'avif', 'bmp', 'gif', 'svg', 'tiff', 'tif'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return { canceled: true, files: [] };
    const files = result.filePaths.map((p) => {
      const ext = path.extname(p).slice(1).toLowerCase();
      // A couple of extensions don't map onto their real MIME subtype 1:1 — the browser's
      // <img> decoder is picky about svg+xml specifically, jpg/tif are just aliases it accepts.
      const mimeSubtype = ext === 'svg' ? 'svg+xml' : ext;
      return {
        name: path.basename(p),
        dataUrl: `data:image/${mimeSubtype};base64,${fs.readFileSync(p).toString('base64')}`,
      };
    });
    return { canceled: false, files };
  });

  ipcMain.handle('kra:import', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importar archivo de Krita',
      filters: [{ name: 'Krita', extensions: ['kra'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    return {
      canceled: false,
      name: path.basename(filePath),
      base64: fs.readFileSync(filePath).toString('base64'),
    };
  });
}

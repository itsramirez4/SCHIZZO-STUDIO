import { dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export function registerExportHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    'export:image',
    async (_e, dataUrl: string, format: string, defaultName: string) => {
      const win = getWindow();
      const result = await dialog.showSaveDialog(win!, {
        title: 'Exportar imagen',
        defaultPath: `${defaultName}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      // \w+ doesn't match a MIME subtype containing "+" (e.g. "image/svg+xml"), so it failed
      // to strip the "data:...;base64," prefix for SVG exports specifically — the whole data
      // URL string, prefix included, was getting base64-decoded as if it were the payload,
      // producing a corrupt file. Match up to the first ";base64," instead, any MIME type.
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
      return { canceled: false, filePath: result.filePath };
    }
  );

  ipcMain.handle('export:gif', async (_e, base64: string, defaultName: string) => {
    const win = getWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Exportar animación',
      defaultPath: `${defaultName}.gif`,
      filters: [{ name: 'GIF', extensions: ['gif'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('export:batch', async (_e, files: { name: string; dataUrl: string }[], folderName: string) => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Elegir carpeta de destino',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };

    // Same reasoning as export:png-sequence: land in their own subfolder rather than loose
    // in whatever directory was picked.
    const dir = path.join(result.filePaths[0], folderName);
    fs.mkdirSync(dir, { recursive: true });
    files.forEach((f) => {
      const base64 = f.dataUrl.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(path.join(dir, f.name), Buffer.from(base64, 'base64'));
    });
    return { canceled: false, folderPath: dir };
  });

  ipcMain.handle('export:png-sequence', async (_e, frames: string[], defaultName: string) => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Elegir carpeta de destino',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };

    // Frames land in their own subfolder rather than loose in whatever directory was
    // picked (often the Desktop or a project folder shared with other files).
    const dir = path.join(result.filePaths[0], defaultName);
    fs.mkdirSync(dir, { recursive: true });
    const pad = Math.max(2, String(frames.length).length);
    frames.forEach((base64, i) => {
      const num = String(i + 1).padStart(pad, '0');
      fs.writeFileSync(path.join(dir, `frame_${num}.png`), Buffer.from(base64, 'base64'));
    });
    return { canceled: false, folderPath: dir };
  });
}

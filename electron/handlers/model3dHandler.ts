import { dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const MODEL_FILTERS = [{ name: 'Modelos 3D', extensions: ['glb', 'gltf'] }];

export function registerModel3DHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('model3d:import', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importar modelo 3D',
      filters: MODEL_FILTERS,
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'glb' ? 'model/gltf-binary' : 'model/gltf+json';
    const dataUrl = `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
    return { canceled: false, name: path.basename(filePath), dataUrl };
  });
}

import { dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';

const BRUSH_FILTERS = [{ name: 'SCHIZZO Brush', extensions: ['brush'] }];

export function registerBrushHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('brush:export', async (_e, json: string, defaultName: string) => {
    const win = getWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Exportar pincel',
      defaultPath: `${defaultName}.brush`,
      filters: BRUSH_FILTERS,
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, json, 'utf-8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('brush:import', async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Importar pincel',
      filters: BRUSH_FILTERS,
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true, brushes: [] };
    const brushes = result.filePaths.map((p) => fs.readFileSync(p, 'utf-8'));
    return { canceled: false, brushes };
  });
}

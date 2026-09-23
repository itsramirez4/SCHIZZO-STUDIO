import { dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';

export function registerFeedbackHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('feedback:save', async (_e, content: string, defaultName: string) => {
    const win = getWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Guardar comentario',
      defaultPath: defaultName,
      filters: [{ name: 'Texto', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { canceled: false, filePath: result.filePath };
  });
}

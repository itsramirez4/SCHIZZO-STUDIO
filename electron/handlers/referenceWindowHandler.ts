import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import crypto from 'crypto';

interface PendingWindowData {
  dataUrl: string;
  title: string;
}

/**
 * Real floating reference windows — separate OS-level `BrowserWindow`s (draggable to a second
 * monitor, native resize/close chrome), not CSS-positioned divs confined to the main window.
 * Each loads the SAME renderer bundle with a `?refWindow=<id>` query param; `main.tsx` reads
 * that to render a minimal viewer instead of the full app shell (see ReferenceWindowView.tsx).
 * The image data itself is handed off via a small in-memory map keyed by that id rather than
 * through the URL (data URLs for real photos can be megabytes — far past a safe URL length).
 */
const pendingData = new Map<string, PendingWindowData>();
const openWindows = new Map<string, BrowserWindow>();

export function registerReferenceWindowHandlers(isDev: boolean) {
  ipcMain.handle('referenceWindow:open', async (_e, dataUrl: string, title: string) => {
    const id = crypto.randomUUID();
    pendingData.set(id, { dataUrl, title });

    const win = new BrowserWindow({
      width: 420,
      height: 520,
      minWidth: 200,
      minHeight: 200,
      title: title || 'Referencia',
      backgroundColor: '#1e1e1e',
      webPreferences: {
        // This file compiles to dist-electron/handlers/, one level below preload.js — unlike
        // main.ts (which sits next to it and can just use `__dirname`).
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    if (isDev) {
      win.loadURL(`http://localhost:5173/?refWindow=${id}`);
    } else {
      win.loadFile(path.join(__dirname, '../../dist/index.html'), { search: `refWindow=${id}` });
    }

    win.on('closed', () => {
      openWindows.delete(id);
      pendingData.delete(id);
    });

    openWindows.set(id, win);
    return { id };
  });

  ipcMain.handle('referenceWindow:getData', async (_e, id: string) => {
    return pendingData.get(id) ?? null;
  });

  ipcMain.handle('referenceWindow:setAlwaysOnTop', async (_e, id: string, value: boolean) => {
    openWindows.get(id)?.setAlwaysOnTop(value);
    return { ok: true };
  });
}

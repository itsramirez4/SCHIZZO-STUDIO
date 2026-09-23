import { BrowserWindow, ipcMain, app } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Checks the GitHub release electron-builder just published to (see electron-builder.yml's
 * `publish` block and scripts/release.cjs) for a newer version, downloads it in the background,
 * and lets the renderer offer "restart to update" once it's ready. The repo is public, so this
 * needs no token to read — only publishing a new release does.
 *
 * Only runs in a packaged build: in dev there's no dist-electron/app.asar for it to compare
 * against, and `npm run dev` isn't the thing anyone would be "updating" anyway.
 */
export function registerAutoUpdateHandlers(getWindow: () => BrowserWindow | null) {
  // scripts/check/electron-entry.cjs forces isPackaged=true (so the app loads dist/index.html
  // like a real build) without actually being one — SCHIZZO_CHECK_DIR is set only there, so this
  // is the one thing that tells the two apart. Without this, every check run would hit the real
  // GitHub release, and a real "install" could fire when the harness kills the process.
  if (!app.isPackaged || process.env.SCHIZZO_CHECK_DIR) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel: string, ...args: unknown[]) => getWindow()?.webContents.send(channel, ...args);

  autoUpdater.on('update-available', (info) => send('update:available', info.version));
  autoUpdater.on('update-not-available', () => send('update:not-available'));
  autoUpdater.on('download-progress', (p) => send('update:progress', Math.round(p.percent)));
  autoUpdater.on('update-downloaded', (info) => send('update:downloaded', info.version));
  autoUpdater.on('error', (err) => send('update:error', err.message));

  ipcMain.handle('update:check', () => autoUpdater.checkForUpdates().catch(() => null));
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

  // A few seconds after launch, not competing with the app's own startup — and only once per
  // run; the renderer's manual "Buscar actualizaciones" button covers checking again later.
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => null), 5000);
}

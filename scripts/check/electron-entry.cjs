// Entry point used ONLY by `npm run check`: runs the built app as if it were packaged and answers
// the native open/save dialogs from a scratch folder, so the checks can run unattended.
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const dir = process.env.SCHIZZO_CHECK_DIR;
if (!dir) throw new Error('SCHIZZO_CHECK_DIR no está definido');
const outDir = path.join(dir, 'out');
fs.mkdirSync(outDir, { recursive: true });

// The check runs headless-ish (no one brings the window to the foreground), so Chromium's
// occlusion tracking treats it as backgrounded and throttles requestAnimationFrame to ~1 Hz —
// that made the `rendimiento` group measure the test environment instead of the app (a stroke
// "stalling" for ~1000 ms was really just one rAF callback per second). These switches disable
// that throttling for this process only; the shipped app keeps normal background throttling.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// The app's UI language now follows the OS locale by default — pin it to Spanish here so the
// check battery's ~30 Spanish-text locators keep working regardless of the machine's real locale.
app.commandLine.appendSwitch('lang', 'es');

Object.defineProperty(app, 'isPackaged', { value: true }); // load dist/index.html, like the real build

const pick = (a, b) => (b === undefined ? a : b) || {};

dialog.showSaveDialog = async (...args) => {
  const opts = pick(...args);
  const name = path.basename(opts.defaultPath || 'salida');
  return { canceled: false, filePath: path.join(outDir, name) };
};

dialog.showOpenDialog = async () => {
  const file = path.join(dir, 'next-open.txt');
  if (!fs.existsSync(file)) return { canceled: true, filePaths: [] };
  return { canceled: false, filePaths: [fs.readFileSync(file, 'utf-8').trim()] };
};

require(path.join(__dirname, '..', '..', 'dist-electron', 'main.js'));

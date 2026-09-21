// Entry point used ONLY by `npm run check`: runs the built app as if it were packaged and answers
// the native open/save dialogs from a scratch folder, so the checks can run unattended.
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const dir = process.env.SCHIZZO_CHECK_DIR;
if (!dir) throw new Error('SCHIZZO_CHECK_DIR no está definido');
const outDir = path.join(dir, 'out');
fs.mkdirSync(outDir, { recursive: true });

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

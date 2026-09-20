import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { registerFileHandlers } from './handlers/fileHandler';
import { registerBrushHandlers } from './handlers/brushHandler';
import { registerExportHandlers } from './handlers/exportHandler';
import { registerModel3DHandlers } from './handlers/model3dHandler';
import { registerPoseModelHandlers } from './handlers/poseModelHandler';
import { registerAssetLibraryHandlers } from './handlers/assetLibraryHandler';
import { registerReferenceLibraryHandlers } from './handlers/referenceLibraryHandler';
import { registerReferenceWindowHandlers } from './handlers/referenceWindowHandler';
import { registerCloudSyncHandlers } from './handlers/cloudSyncHandler';
import { registerCustomizationHandlers } from './handlers/customizationHandler';
import { registerPerspectivePresetsHandlers } from './handlers/perspectivePresetsHandler';
import { registerFilterPresetsHandlers } from './handlers/filterPresetsHandler';
import { registerAutoSaveHandlers } from './handlers/autoSaveHandler';
import { registerAiHandlers } from './handlers/aiHandler';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1e1e1e',
    // Packaged builds get their icon embedded in the .exe by electron-builder; this covers
    // `npm run dev`, where there's no embedded icon and the taskbar would show Electron's default.
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function send(channel: string) {
  mainWindow?.webContents.send(channel);
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo proyecto', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-project') },
        { label: 'Abrir proyecto', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open-project') },
        { type: 'separator' },
        { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { label: 'Guardar como', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save-as') },
        { type: 'separator' },
        { label: 'Importar imagen', click: () => send('menu:import-image') },
        { label: 'Insertar modelo 3D', click: () => send('menu:import-model3d') },
        { label: 'Exportar', accelerator: 'CmdOrCtrl+E', click: () => send('menu:export') },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Rehacer', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('menu:redo') },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Capas', click: () => send('menu:toggle-layers') },
        { label: 'Pinceles', click: () => send('menu:toggle-brushes') },
        { label: 'Filtros', click: () => send('menu:toggle-filters') },
        { label: 'Historial', click: () => send('menu:toggle-history') },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de SCHIZZO STUDIO',
          click: () => send('menu:about'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  buildMenu();
  registerFileHandlers(() => mainWindow);
  registerBrushHandlers(() => mainWindow);
  registerExportHandlers(() => mainWindow);
  registerModel3DHandlers(() => mainWindow);
  registerPoseModelHandlers();
  registerAssetLibraryHandlers();
  registerReferenceLibraryHandlers();
  registerReferenceWindowHandlers(isDev);
  registerCloudSyncHandlers();
  registerCustomizationHandlers();
  registerPerspectivePresetsHandlers();
  registerFilterPresetsHandlers();
  registerAutoSaveHandlers();
  registerAiHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

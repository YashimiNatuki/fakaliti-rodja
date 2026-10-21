import { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store({ name: 'fakaliti-v421', encryptionKey: 'fakaliti-rodja-secure-2026' });

let rodjaWin = null;
let graveyardWin = null;
let tray = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (rodjaWin) {
      if (rodjaWin.isMinimized()) rodjaWin.restore();
      rodjaWin.show();
      rodjaWin.focus();
    }
  });
}

function createRodja() {
  if (rodjaWin) {
    rodjaWin.show();
    rodjaWin.focus();
    return;
  }
  rodjaWin = new BrowserWindow({
    width: 310,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  const isDev = !!process.env.VITE_DEV;
  const url = isDev
    ? 'http://localhost:5173/#rodja'
    : `file://${path.join(__dirname, '../dist/index.html')}#rodja`;

  rodjaWin.loadURL(url);
  rodjaWin.on('closed', () => { rodjaWin = null; });
}

function createGraveyard() {
  if (graveyardWin) {
    graveyardWin.focus();
    return;
  }
  graveyardWin = new BrowserWindow({
    width: 1540,
    height: 940,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  const isDev = !!process.env.VITE_DEV;
  const url = isDev
    ? 'http://localhost:5173/#graveyard'
    : `file://${path.join(__dirname, '../dist/index.html')}#graveyard`;

  graveyardWin.loadURL(url);
  graveyardWin.on('closed', () => { graveyardWin = null; });
}

app.whenReady().then(() => {
  createRodja();

  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzAwZmZjYyIvPjx0ZXh0IHg9IjE2IiB5PSIyMSIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCI+UjwvdGV4dD48L3N2Zz4='
  );
  tray = new Tray(icon);
  tray.setToolTip('Fakaliti Rodja v4.2.1');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Prikaži Rođu', click: () => createRodja() },
    { label: 'Graveyard 3D', click: () => createGraveyard() },
    { type: 'separator' },
    { label: 'Izađi', click: () => app.quit() }
  ]));
});

ipcMain.handle('chat:get', () => store.get('messages', []));
ipcMain.handle('chat:save', (_e, data) => {
  store.set('messages', data);
  return true;
});

ipcMain.handle('ollama:chat', async (_e, payload) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: false }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      message: {
        content: `Ollama offline/timeout.\nPokreni: ollama serve && ollama pull llama3.2:latest\n\n${String(err.message || err)}`
      }
    };
  }
});

ipcMain.handle('shell:open', (_e, url) => shell.openExternal(url));
ipcMain.on('ui:graveyard', () => createGraveyard());
ipcMain.on('ui:rodja', () => createRodja());

app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => createRodja());

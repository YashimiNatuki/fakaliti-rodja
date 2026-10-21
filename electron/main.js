import { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store({ name: 'fakaliti-v43', encryptionKey: 'fakaliti-rodja-secure-2026' });

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
    width: 340,
    height: 560,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 300,
    minHeight: 400,
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
    width: 1600,
    height: 960,
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
  tray.setToolTip('Fakaliti Rodja v4.3');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Prikaži Rođu', click: () => createRodja() },
    { label: 'Graveyard 3D', click: () => createGraveyard() },
    { type: 'separator' },
    { label: 'Izađi', click: () => app.quit() }
  ]));
});

// Chat persistence
ipcMain.handle('chat:get', () => store.get('messages', []));
ipcMain.handle('chat:save', (_e, data) => {
  store.set('messages', data);
  return true;
});

// Ollama
ipcMain.handle('ollama:chat', async (_e, payload) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
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

// Real shell exec (safe whitelist + free form)
ipcMain.handle('shell:exec', async (_e, cmd) => {
  return new Promise((resolve) => {
    const safe = String(cmd || '').trim();
    if (!safe) return resolve({ ok: false, out: 'empty command' });

    // block dangerous patterns
    const blocked = /(rm\s+-rf|format|mkfs|dd\s+if=|shutdown|reboot|passwd|chmod\s+777|curl.*\|.*sh)/i;
    if (blocked.test(safe)) {
      return resolve({ ok: false, out: 'BLOCKED: dangerous command pattern' });
    }

    const child = spawn(safe, {
      shell: true,
      env: { ...process.env, TERM: 'xterm-256color' },
      timeout: 30000
    });

    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      resolve({ ok: code === 0, out: (out + err).slice(0, 12000), code });
    });
    child.on('error', (e) => {
      resolve({ ok: false, out: e.message });
    });
  });
});

// System info algorithm
ipcMain.handle('system:info', () => {
  const cpus = os.cpus();
  const load = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: Math.floor(os.uptime()),
    cpus: cpus.length,
    model: cpus[0]?.model || 'unknown',
    load1: load[0]?.toFixed(2),
    load5: load[1]?.toFixed(2),
    memTotal: Math.round(totalMem / 1024 / 1024),
    memFree: Math.round(freeMem / 1024 / 1024),
    memUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    homedir: os.homedir(),
    tmpdir: os.tmpdir()
  };
});

ipcMain.handle('shell:open', (_e, url) => shell.openExternal(url));
ipcMain.on('ui:graveyard', () => createGraveyard());
ipcMain.on('ui:rodja', () => createRodja());

app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => createRodja());

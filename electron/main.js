import { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage, safeStorage, session } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import net from 'net';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- store key: random per install, sealed by the OS keychain when available ----
function loadStoreKey() {
  const f = path.join(app.getPath('userData'), 'store.key');
  try {
    const raw = fs.readFileSync(f);
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
  } catch { /* first run */ }
  const key = crypto.randomBytes(32).toString('hex');
  const out = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, out, { mode: 0o600 });
  return key;
}

let store = null;
function initStore() {
  store = new Store({ name: 'fakaliti-v5', encryptionKey: loadStoreKey() });
  // one-time migration from v4.3, which used a key hardcoded in the (public) repo
  if (!store.has('messages')) {
    try {
      const old = new Store({ name: 'fakaliti-v43', encryptionKey: 'fakaliti-rodja-secure-2026' });
      const msgs = old.get('messages');
      if (Array.isArray(msgs) && msgs.length) store.set('messages', msgs);
    } catch { /* nothing to migrate */ }
  }
}

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

const isHttp = (u) => {
  try { const p = new URL(u).protocol; return p === 'http:' || p === 'https:'; } catch { return false; }
};

function hardenWindow(win) {
  // never let a link/markdown/result navigate the app window; open http(s) in the OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const cur = win.webContents.getURL().split('#')[0];
    if (url.split('#')[0] !== cur) {
      e.preventDefault();
      if (isHttp(url)) shell.openExternal(url);
    }
  });
}

const webPreferences = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  backgroundThrottling: false
};

function createRodja() {
  if (rodjaWin) {
    rodjaWin.show();
    rodjaWin.focus();
    return;
  }
  rodjaWin = new BrowserWindow({
    width: 400,
    height: 700,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minWidth: 340,
    minHeight: 480,
    hasShadow: false,
    webPreferences
  });
  hardenWindow(rodjaWin);

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
    webPreferences
  });
  hardenWindow(graveyardWin);

  const isDev = !!process.env.VITE_DEV;
  const url = isDev
    ? 'http://localhost:5173/#graveyard'
    : `file://${path.join(__dirname, '../dist/index.html')}#graveyard`;

  graveyardWin.loadURL(url);
  graveyardWin.on('closed', () => { graveyardWin = null; });
}

app.whenReady().then(() => {
  initStore();
  createRodja();

  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzAwZmZjYyIvPjx0ZXh0IHg9IjE2IiB5PSIyMSIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwMCI+UjwvdGV4dD48L3N2Zz4='
  );
  tray = new Tray(icon);
  tray.setToolTip('Fakaliti Rodja v5.0');
  tray.on('click', () => createRodja());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Prikaži Rođu', click: () => createRodja() },
    { label: 'Graveyard 3D', click: () => createGraveyard() },
    { type: 'separator' },
    { label: 'Izađi', click: () => app.quit() }
  ]));
});

// ---- Chat persistence ----
ipcMain.handle('chat:get', () => (store ? store.get('messages', []) : []));
ipcMain.handle('chat:save', (_e, data) => {
  if (store && Array.isArray(data)) store.set('messages', data.slice(-500));
  return true;
});

// ---- Ollama ----
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

// ---- Real shell exec (blocklist is a speed bump, not a sandbox: this is the owner's own box) ----
ipcMain.handle('shell:exec', async (_e, cmd) => {
  return new Promise((resolve) => {
    const safe = String(cmd || '').trim();
    if (!safe) return resolve({ ok: false, out: 'empty command' });

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

// ---- System info (+ real CPU% from cpu time deltas, works on Windows where loadavg is 0) ----
let prevCpu = null;
function cpuPercent() {
  const cur = os.cpus().reduce((a, c) => {
    const t = c.times;
    a.idle += t.idle;
    a.total += t.user + t.nice + t.sys + t.idle + t.irq;
    return a;
  }, { idle: 0, total: 0 });
  let pct = 0;
  if (prevCpu) {
    const dTotal = cur.total - prevCpu.total;
    const dIdle = cur.idle - prevCpu.idle;
    pct = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 1000) / 10 : 0;
  }
  prevCpu = cur;
  return pct;
}

cpuPercent(); // prime the counter so the first real sample is a true delta, not 0

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
    cpuPct: cpuPercent(),
    memTotal: Math.round(totalMem / 1024 / 1024),
    memFree: Math.round(freeMem / 1024 / 1024),
    memUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
    homedir: os.homedir(),
    tmpdir: os.tmpdir()
  };
});

// only http(s): shell.openExternal on arbitrary schemes (file:, ms-*:, custom) is a known RCE vector
ipcMain.handle('shell:open', (_e, url) => {
  if (!isHttp(url)) return false;
  return shell.openExternal(url).then(() => true);
});
ipcMain.on('ui:graveyard', () => createGraveyard());

// ---- window controls (frameless windows have none) ----
const winOf = (e) => BrowserWindow.fromWebContents(e.sender);
ipcMain.on('win:hide', (e) => winOf(e)?.hide());
ipcMain.on('win:close', (e) => winOf(e)?.close());
ipcMain.handle('win:pin', (e, toggle) => {
  const w = winOf(e);
  if (!w) return false;
  if (toggle) w.setAlwaysOnTop(!w.isAlwaysOnTop());
  return w.isAlwaysOnTop();
});

ipcMain.handle('ollama:status', async () => {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('http://127.0.0.1:11434/api/tags', { signal: ctl.signal });
    clearTimeout(t);
    return { up: r.ok };
  } catch {
    return { up: false };
  }
});
ipcMain.on('ui:rodja', () => createRodja());

// ---- Tor (YappinaTor): the user's own local Tor daemon / Tor Browser SOCKS5 ----
const TOR_HOST = '127.0.0.1';
const TOR_PORTS = [9050, 9150]; // tor daemon, Tor Browser
let torPort = null;

function probe(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: TOR_HOST, port, timeout: 1500 });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(false));
  });
}

async function findTor() {
  for (const p of TOR_PORTS) if (await probe(p)) return (torPort = p);
  return (torPort = null);
}

ipcMain.handle('tor:status', async () => {
  const port = await findTor();
  return { up: port !== null, port };
});

ipcMain.handle('tor:fetch', async (_e, url) => {
  if (!isHttp(url) || String(url).length > 2048) return { ok: false, status: 0, body: 'bad url' };
  const port = torPort ?? (await findTor());
  if (!port) return { ok: false, status: 0, body: 'Tor nije pokrenut (nema SOCKS5 na 127.0.0.1:9050/9150). Pokreni tor ili Tor Browser.' };

  // Dedicated session. A single socks5 rule means NO fallback to a direct connection,
  // and Chromium hands the hostname to the proxy (remote DNS), so .onion resolves and nothing leaks.
  const ses = session.fromPartition('persist:tor');
  await ses.setProxy({ proxyRules: `socks5://${TOR_HOST}:${port}` });

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await ses.fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0' }
    });
    const body = (await res.text()).slice(0, 1_500_000);
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: `Tor fetch fail: ${String(err.message || err)}` };
  } finally {
    clearTimeout(t);
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('activate', () => createRodja());

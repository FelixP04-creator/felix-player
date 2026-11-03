// felix Player – Electron-Hauptprozess (Windows).
//
// Lädt die gebaute Web-App (dist/) über einen lokalen HTTP-Server und fängt
// den Spotify-OAuth-Callback (Authorization Code Flow + PKCE) ab. Der Server
// läuft auf http://localhost:5173/ – exakt die Redirect-URI, die im Spotify
// Developer Dashboard bereits für die Web-App registriert ist. Damit braucht
// die Windows-Version keinen einzigen neuen Eintrag und keine Custom-URI.
//
// Ablauf:
//   1. App-Start → HTTP-Server auf Port 5173 (bedient dist/ + Callback).
//   2. Login-Klick → Renderer ruft openExternal(loginUrl) → System-Browser.
//   3. Nach „Zustimmen" leitet Spotify auf http://localhost:5173/?code=… um.
//   4. Server sieht den ?code=-Parameter → sendet die URL an den Renderer
//      (IPC) und zeigt dem Browser eine Abschluss-Seite.
//   5. Renderer tauscht den Code gegen Access- + Refresh-Token und lädt neu.

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { URL } = require('node:url');

const PORT = 5173; // wiederverwendete, registrierte Redirect-URI
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const DONE_PAGE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>felix – Anmeldung</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#120F14; color:#F5EFE6; font-family:'Space Grotesk',system-ui,-apple-system,sans-serif; }
  .card { text-align:center; padding:48px 32px; max-width:360px; }
  .mark { width:64px;height:64px;border-radius:18px;background:#1E1720;
    display:flex;align-items:center;justify-content:center;margin:0 auto 20px; }
  .mark svg { width:30px;height:30px; }
  h1 { font-size:22px; margin:0 0 10px; font-weight:600; }
  p { color:#B8AFA3; font-size:15px; margin:0; line-height:1.6; }
</style></head>
<body><div class="card">
  <div class="mark"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 5.5v13a.6.6 0 0 0 .92.5l10.2-6.5a.6.6 0 0 0 0-1L8.92 5a.6.6 0 0 0-.92.5z" fill="#FFB23E"/>
  </svg></div>
  <h1>Anmeldung erfolgreich</h1>
  <p>Spotify wurde verbunden. Du kannst diesen Tab jetzt schließen –
  die <strong>felix Player</strong>-App holt den Rest von allein.</p>
</div></body></html>`;

let win = null;
let httpServer = null;
let pendingCallback = null; // wird gemerkt, falls der Renderer noch nicht lauscht

// ---------- Einzelinstanz: nur ein Callback-Server auf Port 5173 ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  boot();
}

function boot() {
  app.whenReady().then(() => {
    startServer();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 850,
    minWidth: 400,
    minHeight: 640,
    show: false,
    backgroundColor: '#120F14',
    title: 'felix Player',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    win = null;
  });

  // Externe Links (z. B. Spotify) immer im System-Browser öffnen.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // App über den lokalen HTTP-Server laden → echter Origin (keine CORS-Falle).
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadURL('http://localhost:' + PORT + '/');
  }
}

// ---------- HTTP-Server: dist/ bedienen + OAuth-Callback fangen ----------
function startServer() {
  httpServer = http.createServer((req, res) => {
    let u;
    try {
      u = new URL(req.url, 'http://localhost:' + PORT);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }

    // Spotify leitet nach der Zustimmung hierher um: ?code=… (oder ?error=…).
    const code = u.searchParams.get('code');
    const error = u.searchParams.get('error');
    if (code || error) {
      pendingCallback = u.toString();
      if (win && !win.isDestroyed()) {
        win.webContents.send('spotify-callback', u.toString());
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(DONE_PAGE);
      return;
    }

    // Statik aus dist/ (mit SPA-Fallback auf index.html).
    let file = path.normalize(path.join(DIST, u.pathname === '/' ? 'index.html' : u.pathname));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  httpServer.on('error', (e) => {
    // EADDRINUSE: z. B. Vite-Dev-Server belegt 5173. Deutlich melden.
    if (e.code === 'EADDRINUSE') {
      console.error('[felix] Port ' + PORT + ' ist belegt (Vite-Dev-Server?). ' +
        'Für die .exe den Dev-Server stoppen und neu starten.');
    } else {
      console.error('[felix] Server-Fehler:', e.message);
    }
  });

  httpServer.listen(PORT, () => {
    console.log('[felix] bereit auf http://localhost:' + PORT);
  });
}

// ---------- IPC: sichere Brücke zum Renderer ----------
ipcMain.handle('open-external', async (_e, url) => {
  if (typeof url === 'string' && /^https?:/i.test(url)) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('spotify-callback-pending', () => pendingCallback);

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  app.quit();
});

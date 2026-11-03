// felix Player – Electron-Preload (Renderer-Brücke).
// contextIsolation + sandbox: der Renderer bekommt nur genau die drei Funktionen,
// die er für den Login-Flow braucht. Kein direkter Node- oder Fenster-Zugriff.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('felixDesktop', {
  // Ist-Flag: Renderer erkennt damit, dass er in der Windows-App läuft.
  isDesktop: true,

  // Externen Link (Login) im System-Browser öffnen.
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Auf den Spotify-Callback warten (Warm-Start: Callback kommt, App läuft schon).
  onSpotifyCallback: (cb) => {
    const listener = (_e, url) => cb(url);
    ipcRenderer.on('spotify-callback', listener);
    return () => ipcRenderer.removeListener('spotify-callback', listener);
  },

  // Cold-Start: Callback könnte schon angekommen sein, bevor der Renderer lauscht.
  getPendingCallback: () => ipcRenderer.invoke('spotify-callback-pending'),
});

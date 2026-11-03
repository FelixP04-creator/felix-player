import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { App } from './App';
import './styles.css';
import { isCapacitor, tokenFromAuthUrl } from './lib/spotify';

// Boot: OAuth-Code-Callback aufnehmen (Authorization Code Flow + PKCE).
// - Web:  http://localhost:5173/?code=...  (direkter Redirect)
// - App:  spotifyapp://callback?code=...   (Deep Link – beim Cold Start
//         über App.startupData.url oder als appUrlOpened-Event).
// Danach Reload, damit App den frischen Token sieht.
if (isCapacitor) {
  const handleAuth = async (url: string | undefined) => {
    if (!url || !url.startsWith('spotifyapp://callback')) return;
    try {
      const handled = await tokenFromAuthUrl(url);
      if (handled) window.location.reload();
    } catch (e) {
      console.error('Auth-URL:', e);
      window.location.reload();
    }
  };

  const app = CapApp as unknown as {
    startupData?: { url?: string };
    addListener: (ev: 'appUrlOpened', cb: (e: { url: string }) => void) => Promise<unknown>;
  };
  if (app.startupData?.url) {
    void handleAuth(app.startupData.url);
  } else {
    app.addListener('appUrlOpened', (e) => void handleAuth(e.url)).catch(() => {});
  }
} else {
  // Web: Redirect-URL mit ?code=… prüfen, Hash-Varianten tolerieren.
  const q = new URLSearchParams(window.location.search);
  const h = window.location.hash.startsWith('#') ? new URLSearchParams(window.location.hash.slice(1)) : null;
  const code = q.get('code') ?? h?.get('code') ?? null;
  if (code) {
    tokenFromAuthUrl(window.location.href)
      .then((handled) => {
        history.replaceState(null, '', window.location.pathname);
        if (handled) window.location.reload();
      })
      .catch((e) => console.error('Auth-Code:', e));
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

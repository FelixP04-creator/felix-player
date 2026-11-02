import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { App } from './App';
import './styles.css';
import { isCapacitor, tokenFromUrl, tokenFromAuthUrl } from './lib/spotify';

// Boot: OAuth-Callback aufnehmen.
// - Web:  Token im URL-Hash (accounts.spotify.com → redirect_uri)
// - App:  Deep Link spotifyapp://callback – entweder beim Cold Start
//         (App.startupData.url) oder als appUrlOpened-Event, falls die App
//         im Hintergrund war. Danach Reload, damit App den Token sieht.
if (isCapacitor) {
  const handleAuth = (url: string | undefined) => {
    if (!url || !url.startsWith('spotifyapp://callback')) return;
    try {
      tokenFromAuthUrl(url);
      window.location.reload();
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
    handleAuth(app.startupData.url);
  } else {
    app.addListener('appUrlOpened', (e) => handleAuth(e.url)).catch(() => {});
  }
} else {
  tokenFromUrl();
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { App } from './App';
import './styles.css';
import { isCapacitor, tokenFromAuthUrl, debugTrace } from './lib/spotify';

// Boot: OAuth-Code-Callback aufnehmen (Authorization Code Flow + PKCE).
// - Web:  http://localhost:5173/?code=...  (direkter Redirect)
// - App:  spotifyapp://callback?code=...   (Deep Link – Cold Start über
//         App.getLaunchUrl(), Warm Start über das Event 'appUrlOpen').
// Danach Reload, damit App den frischen Token sieht.
if (isCapacitor) {
  const handleAuth = async (url: string | undefined, via: string) => {
    if (!url) {
      debugTrace('Deep Link ' + via + ': keine URL erhalten');
      return;
    }
    debugTrace('Deep Link ' + via + ': ' + url.slice(0, 120));
    if (!url.startsWith('spotifyapp://callback')) {
      debugTrace('… aber nicht spotifyapp://callback – ignoriert');
      return;
    }
    try {
      const handled = await tokenFromAuthUrl(url);
      debugTrace('Token-Exchange: ' + (handled ? 'OK, lade neu' : 'kein Code in URL'));
      if (handled) window.location.reload();
    } catch (e) {
      debugTrace('Token-Exchange FEHLER: ' + String((e as Error).message ?? e));
      window.location.reload();
    }
  };

  // Warm Start: App läuft schon, Deep Link kommt als Event (Name: appUrlOpen!).
  CapApp.addListener('appUrlOpen', (e) => void handleAuth(e.url, 'Event')).then(
    () => debugTrace('Deep-Link-Listener aktiv (appUrlOpen)'),
    (e) => debugTrace('Deep-Link-Listener FEHLER: ' + String(e)),
  );

  // Cold Start: App wurde vom Deep Link gestartet (z. B. Browser hatte sie
  // noch nicht offen) – die Start-URL kommt über getLaunchUrl().
  CapApp.getLaunchUrl().then(
    (lu) => {
      if (lu) void handleAuth(lu.url, 'Cold-Start');
      else debugTrace('Cold-Start: keine Launch-URL');
    },
    (e) => debugTrace('getLaunchUrl FEHLER: ' + String(e)),
  );
} else {
  // Web: Redirect-URL mit ?code=… prüfen, Hash-Varianten tolerieren.
  debugTrace('Boot Web, URL: ' + window.location.href);
  const q = new URLSearchParams(window.location.search);
  const h = window.location.hash.startsWith('#') ? new URLSearchParams(window.location.hash.slice(1)) : null;
  const code = q.get('code') ?? h?.get('code') ?? null;
  if (code) {
    debugTrace('Code erhalten, tausche ein…');
    tokenFromAuthUrl(window.location.href)
      .then((handled) => {
        debugTrace('Token-Exchange: ' + (handled ? 'OK, lade neu' : 'nicht behandelt'));
        history.replaceState(null, '', window.location.pathname);
        if (handled) window.location.reload();
      })
      .catch((e) => debugTrace('Token-Exchange FEHLER: ' + String((e as Error).message ?? e)));
  } else {
    debugTrace('Kein Code in URL – Login-Screen.');
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

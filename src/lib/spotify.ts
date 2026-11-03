// Spotify-Anbindung: OAuth (Implicit Grant, wie im offiziellen Web-Playback-SDK-Flow
// dokumentiert), Web API und Web Playback SDK. Kein Server, kein Client-Secret.

// Wichtig: !!(window).Capacitor reicht NICHT – im Browser registriert
// @capacitor/core beim Import einen Web-Shim, der die Eigenschaft auch setzt.
// Die native WebView erkennt man nur über isNativePlatform().
export const isCapacitor: boolean =
  !!(window as any).Capacitor?.isNativePlatform?.();

// Windows-Desktop (Electron): der Preload setzt window.felixDesktop.
// Wichtig: in Electron läuft die App über einen lokalen HTTP-Server auf
// http://localhost:5173/ – genau die im Spotify-Dashboard registrierte
// Redirect-URI. Daher braucht isElectron KEINE eigene Custom-URI.
export const isElectron: boolean = !!(window as any).felixDesktop;

export const REDIRECT_URI = isCapacitor
  ? 'spotifyapp://callback'
  : window.location.origin + window.location.pathname;

export const CLIENT_ID: string =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '';

const SCOPES = [
  // Wiedergabe (Web Playback SDK, Premium)
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Top-Tracks (Home) – ohne diesen Scope liefert Spotify /me/top/tracks 403
  'user-top-read',
  // Bibliothek: gelistete Titel lesen + Herzchen toggeln
  'user-library-read',
  'user-library-modify',
  // Playlists lesen + verändern (für späteres Erstellen/Beitreten)
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
  // Profil
  'user-read-email',
  'user-read-private',
].join(' ');

export interface Track {
  uri: string;
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
}

export interface Me {
  id: string;
  display_name: string;
  images: { url: string }[];
  product: string;
}

// Spotify hat den Implicit Grant (response_type=token) abgeschaltet –
// deshalb Authorization Code Flow mit PKCE. Läuft komplett ohne Server und
// liefert einen Refresh-Token → das Konto bleibt dauerhaft verbunden.

const LS = {
  token: 'sp_token',
  refresh: 'sp_refresh',
  expires: 'sp_expires',
  verifier: 'sp_code_verifier',
  authError: 'sp_auth_error',
} as const;

function getToken(): string {
  return localStorage.getItem(LS.token) ?? '';
}

export function getMeToken(): string {
  return getToken();
}

export function saveSession(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(LS.token, accessToken);
  if (refreshToken) localStorage.setItem(LS.refresh, refreshToken);
  localStorage.setItem(LS.expires, String(Date.now() + 3600_000));
}

export function clearSession(): void {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.refresh);
  localStorage.removeItem(LS.expires);
  localStorage.removeItem(LS.verifier);
}

export function consumeAuthError(): string | null {
  const e = localStorage.getItem(LS.authError);
  if (e) localStorage.removeItem(LS.authError);
  return e;
}

// Sichtbare OAuth-Diagnose für den Login-Screen (nur so sieht man, wo der
// Flow abbricht, ohne WebView-Console). Letze Zeilen bleiben erhalten.
export function debugTrace(msg: string): void {
  let lines: string[] = [];
  try {
    lines = JSON.parse(localStorage.getItem('sp_debug') ?? '[]');
  } catch {
    lines = [];
  }
  lines.push('[' + new Date().toLocaleTimeString() + '] ' + msg);
  if (lines.length > 14) lines = lines.slice(-14);
  localStorage.setItem('sp_debug', JSON.stringify(lines));
}
export function readDebug(): string[] {
  try {
    return JSON.parse(localStorage.getItem('sp_debug') ?? '[]');
  } catch {
    return [];
  }
}
export function clearDebug(): void {
  localStorage.removeItem('sp_debug');
}

/** PKCE: Verifier erzeugen, Challenge (S256) für die authorize-URL. */
function base64url(buf: ArrayBuffer): string {
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkce(): Promise<string> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)).buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  localStorage.setItem(LS.verifier, verifier);
  return base64url(digest);
}

export async function loginUrl(): Promise<string> {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID fehlt (.env)');
  const challenge = await generatePkce();
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'felix-player',
  });
  return 'https://accounts.spotify.com/authorize?' + p.toString();
}

/**
 * Login starten: Web → direkter Redirect; App → System-Browser öffnen,
 * Callback kommt per Deep Link (spotifyapp://callback) zurück.
 */
export async function startLogin(): Promise<void> {
  clearDebug();
  const url = await loginUrl();
  debugTrace('Login-Start: ' + (isCapacitor ? 'System-Browser' : isElectron ? 'System-Browser (Desktop)' : 'Web-Redirect'));
  debugTrace('Redirect-URI: ' + REDIRECT_URI);
  if (isCapacitor) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else if (isElectron) {
    // Windows: Login im System-Browser öffnen; Callback kommt über den
    // lokalen Server zurück (IPC 'spotify-callback').
    await (window as any).felixDesktop.openExternal(url);
  } else {
    window.location.href = url;
  }
}

interface TokenResp {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResp> {
  debugTrace('Token-Request (' + params.grant_type + ')…');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  let data: TokenResp;
  try {
    data = (await res.json()) as TokenResp;
  } catch {
    data = { error: 'kein JSON', error_description: res.status + ' ' + (await res.text().catch(() => '')) };
  }
  if (!res.ok || !data.access_token) {
    const msg = 'Spotify-Auth: ' + (data.error_description ?? data.error ?? String(res.status));
    localStorage.setItem(LS.authError, msg);
    debugTrace('Token-Request FEHLER: ' + msg);
    throw new Error(msg);
  }
  debugTrace('Token-Request OK' + (data.refresh_token ? ' (mit Refresh-Token)' : ' (OHNE Refresh-Token!)'));
  return data;
}

/** Autorisierungs-Code gegen Access- + Refresh-Token eintauschen. */
async function exchangeCode(code: string): Promise<void> {
  const verifier = localStorage.getItem(LS.verifier);
  if (!verifier) throw new Error('PKCE-Verifier fehlt – bitte erneut verbinden.');
  const data = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  localStorage.removeItem(LS.verifier);
  saveSession(data.access_token as string, data.refresh_token ?? '');
}

/** Access-Token über den Refresh-Token verlängern (ein Request-Flight). */
let refreshing: Promise<void> | null = null;
export function refreshSession(): Promise<void> {
  if (!refreshing) {
    const rt = localStorage.getItem(LS.refresh) ?? '';
    refreshing = rt
      ? tokenRequest({
          grant_type: 'refresh_token',
          refresh_token: rt,
          client_id: CLIENT_ID,
        }).then((d) => saveSession(d.access_token as string, d.refresh_token ?? rt))
      : Promise.reject(new Error('Kein Refresh-Token – bitte erneut verbinden.'));
    refreshing.finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * OAuth-Callback verarbeiten (Code Flow, `?code=...` in der Query):
 * Web:  http://localhost:5173/?code=...&state=...
 * App:  spotifyapp://callback?code=...&state=...  (ankommende Deep-Link-URL)
 * Liefert true, wenn ein neuer Token gespeichert wurde (→ Reload).
 */
export async function tokenFromAuthUrl(rawUrl: string): Promise<boolean> {
  const u = new URL(rawUrl);
  const err = u.searchParams.get('error');
  if (err) {
    localStorage.setItem(LS.authError, 'Spotify-Login fehlgeschlagen: ' + err);
    throw new Error('Spotify-Login fehlgeschlagen: ' + err);
  }
  const code = u.searchParams.get('code');
  if (!code) return false;
  await exchangeCode(code);
  return true;
}

export async function api<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const doFetch = () =>
    fetch('https://api.spotify.com/v1' + path, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + getToken(),
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  let res = await doFetch();
  if (res.status === 401 && !retried) {
    // Token abgelaufen → Refresh-Token nutzen und einmal neu versuchen.
    try {
      await refreshSession();
      res = await doFetch();
    } catch {
      // kein gültiger Refresh-Token
    }
  }
  if (res.status === 401) {
    clearSession();
    throw new Error('Session abgelaufen – bitte Spotify erneut verbinden.');
  }
  if (!res.ok) throw new Error('Spotify API ' + res.status + ': ' + path);
  return res.json() as Promise<T>;
}

/* ---------- Web API-Wrapper ---------- */

interface RawTrack {
  uri: string;
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

function mapTrack(t: RawTrack): Track {
  const img = (t.album?.images ?? []).filter((i) => i.url);
  return {
    uri: t.uri,
    id: t.id,
    name: t.name,
    artists: t.artists ?? [],
    album: { name: t.album?.name ?? '', images: img },
    duration_ms: t.duration_ms,
  };
}

export function coverOf(t: Track | null | undefined, size = 'mid'): string | null {
  if (!t) return null;
  const imgs = t.album.images ?? [];
  if (size === 'small') return imgs.length > 1 ? imgs[1].url : imgs[0]?.url ?? null;
  if (size === 'large') return imgs[0]?.url ?? null;
  return imgs.length > 2 ? imgs[1].url : imgs[imgs.length - 1]?.url ?? null;
}

export const fetchMe = () => api<Me>('/me');
export const fetchTopTracks = (limit = 30) =>
  api<{ items: RawTrack[] }>(`/me/top/tracks?limit=${limit}`).then((r) => r.items.map(mapTrack));
export const fetchPlaylists = (limit = 20) =>
  api<{ items: any[] }>(`/me/playlists?limit=${limit}`).then((r) => r.items);
export const searchTracks = (q: string, limit = 20) =>
  api<{ tracks: { items: RawTrack[] } }>(
    '/search?q=' + encodeURIComponent(q) + '&type=track&limit=' + limit,
  ).then((r) => r.tracks.items.map(mapTrack));
export const isLiked = async (id: string) => {
  const r = await api<{ is_saved: boolean }>(`/me/tracks/contains?ids=${id}`);
  return r.is_saved;
};
export const setLiked = (id: string, liked: boolean) =>
  api<void>(liked ? `/me/tracks?ids=${id}` : `/me/tracks?ids=${id}`, {
    method: liked ? 'PUT' : 'DELETE',
  });

/* ---------- Web Playback SDK ---------- */

let player: any = null;
let sdkReady: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SDK-Timeout')), 15000);
    (window as any).onSpotifySDKReady = () => {
      clearTimeout(timeout);
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('SDK-Load fehlgeschlagen'));
    };
    document.head.appendChild(s);
  });
  return sdkReady;
}

export interface PlayerEvents {
  onReady: (deviceId: string) => void;
  onState: (state: any) => void;
}

export async function initPlayer(ev: PlayerEvents): Promise<void> {
  if (player) return;
  await loadSdk();
  player = new (window as any).Spotify.Player({
    name: 'felix Player',
    getOAuthToken: (cb: (t: string) => void) => cb(getToken()),
    volume: 0.8,
  });
  player.on('ready', ({ device_id }: { device_id: string }) => ev.onReady(device_id));
  player.on('not_ready', () => {});
  player.on('player_state_changed', (s: any) => ev.onState(s));
  player.on('initialization_error', ({ message }: any) => console.error('SDK init:', message));
  player.on('authentication_error', ({ message }: any) => console.error('SDK auth:', message));
  player.connect();
}

export function disposePlayer(): void {
  if (player) {
    player.disconnect();
    player = null;
    sdkReady = null;
  }
}

export const sdkSetShuffle = (v: boolean) => player?.setShuffle?.(v);
export const sdkSetRepeat = (v: 'off' | 'context' | 'track') => player?.setRepeat?.(v);
export const sdkSetVolume = (v: number) => player?.setVolume?.(v);
export const sdkTogglePlay = () => player?.togglePlay?.();

export function playUri(uri: string, positionMs = 0): Promise<void> {
  return api<void>(`/me/player/play?device_id=${getDeviceId()}`, {
    method: 'PUT',
    body: JSON.stringify({ device_id: getDeviceId(), uris: [uri], position_ms: positionMs }),
  });
}

export function pausePlayback(): Promise<void> {
  return api<void>(`/me/player/pause?device_id=${getDeviceId()}`, { method: 'PUT' });
}

let deviceId = '';
export function setDeviceId(id: string) {
  deviceId = id;
}
export function getDeviceId() {
  return deviceId;
}

export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Spotify-Anbindung: OAuth (Implicit Grant, wie im offiziellen Web-Playback-SDK-Flow
// dokumentiert), Web API und Web Playback SDK. Kein Server, kein Client-Secret.

export const isCapacitor = !!(window as any).Capacitor;

export const REDIRECT_URI = isCapacitor
  ? 'spotifyapp://callback'
  : window.location.origin + window.location.pathname;

export const CLIENT_ID: string =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '';

const SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
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

// localStorage (nicht sessionStorage): Das Spotify-Konto bleibt dauerhaft
// in der App verbunden – kein erneutes Anmelden bei jedem Start.
function getToken(): string {
  return localStorage.getItem('sp_token') ?? '';
}

export function getMeToken(): string {
  return getToken();
}

export function saveToken(token: string): void {
  localStorage.setItem('sp_token', token);
}

export function clearSession(): void {
  localStorage.removeItem('sp_token');
  localStorage.removeItem('sp_token_type');
}

/** Token aus dem OAuth-Callback-Hash lesen (response_type=token). */
export function tokenFromUrl(): string | null {
  const h = window.location.hash;
  if (!h.startsWith('#')) return null;
  const params = new URLSearchParams(h.slice(1));
  const err = params.get('error');
  if (err) throw new Error('Spotify-Login fehlgeschlagen: ' + err);
  const token = params.get('access_token');
  if (token) {
    saveToken(token);
    sessionStorage.setItem('sp_token_type', params.get('token_type') ?? 'Bearer');
    // Hash entfernen, damit kein Token im Browser-History/Back-Stack klebt.
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return token;
}

/**
 * Token aus einer OAuth-Callback-URL lesen.
 * Web:  http://localhost:5173/#access_token=...
 * App:  spotifyapp://callback#access_token=...  (ankommende Deep-Link-URL)
 */
export function tokenFromAuthUrl(rawUrl: string): string | null {
  const h = rawUrl.includes('#') ? rawUrl.slice(rawUrl.indexOf('#')) : '';
  const params = new URLSearchParams(h.slice(1));
  const err = params.get('error');
  if (err) throw new Error('Spotify-Login fehlgeschlagen: ' + err);
  const token = params.get('access_token');
  if (token) {
    saveToken(token);
    sessionStorage.setItem('sp_token_type', params.get('token_type') ?? 'Bearer');
  }
  return token;
}

/**
 * Login starten: Web → direkter Redirect; App → System-Browser öffnen,
 * Callback kommt per Deep Link (spotifyapp://callback) zurück.
 */
export async function startLogin(): Promise<void> {
  if (isCapacitor) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: loginUrl() });
  } else {
    window.location.href = loginUrl();
  }
}

export function loginUrl(): string {
  if (!CLIENT_ID) throw new Error('VITE_SPOTIFY_CLIENT_ID fehlt (.env)');
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: 'false',
    state: 'felix-player',
  });
  return 'https://accounts.spotify.com/authorize?' + p.toString();
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch('https://api.spotify.com/v1' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearSession();
    throw new Error('Session abgelaufen – bitte erneut anmelden.');
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

import { create } from 'zustand';
import {
  type Track, type Device,
  isLiked,
  setLiked,
  pausePlayback,
  playUri,
  sdkSetRepeat,
  sdkSetShuffle,
  sdkSetVolume,
  setDeviceId,
  fetchDevices,
  transferPlayback,
  webPlay,
  webPause,
  webNext,
  webPrev,
  webSeek,
  webShuffle,
  webRepeat,
  webVolume,
  fetchPlaybackState,
} from './spotify';

export type TabId = 'home' | 'search' | 'library' | 'podcasts';

interface NowPlaying {
  track: Track;
  uri: string;
  context: Track[]; // Queue, Index = aktuelle Position
  index: number;
  contextUri?: string; // z. B. playlist/album/artist – für externe Geräte
}

interface State {
  ready: boolean;
  loading: boolean;
  /** Eingebauter Player (SDK) – seine eigene device_id. */
  sdkDeviceId: string;
  /** Gewähltes Wiedergabeziel. Ist es ≠ sdkDeviceId → extern (Web-API). */
  deviceId: string;
  devices: Device[];
  isExternal: boolean;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  shuffle: boolean;
  repeat: 'off' | 'context' | 'track';
  volume: number;
  liked: Set<string>;
  np: NowPlaying | null;
  active: Track | null;
  sheetOpen: boolean;
  tab: TabId;
  searchQuery: string;
  /** Fehlermeldung des Wiedergabe-SDKs (sichtbar + „Erneut versuchen"). */
  sdkError: string | null;
  detail: { type: 'artist' | 'album' | 'playlist' | 'show'; id: string } | null;
  // Actions
  onReady: (id: string) => void;
  onState: (s: any) => void;
  refreshDevices: () => Promise<void>;
  switchDevice: (id: string) => Promise<void>;
  playTrack: (track: Track, context?: Track[], contextUri?: string) => Promise<void>;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  like: (track: Track) => void;
  setSheetOpen: (v: boolean) => void;
  setTab: (t: TabId) => void;
  setSearchQuery: (q: string) => void;
  setSdkError: (m: string | null) => void;
  setDetail: (d: { type: 'artist' | 'album' | 'playlist' | 'show'; id: string } | null) => void;
}

// Polling für externe Geräte: /me/player alle 1 s, solange ein externes Ziel
// gewählt ist und das Sheet/Mini-Player sichtbar relevant sind.
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    const s = useStore.getState();
    if (!s.isExternal) return;
    fetchPlaybackState()
      .then((ps) => {
        if (!ps) return;
        const cur = ps.track;
        const patch: Partial<State> = {
          isPlaying: !ps.paused,
          progressMs: ps.position_ms,
          durationMs: ps.duration_ms,
          shuffle: ps.shuffle,
          repeat: ps.repeat_mode,
          volume: (ps.volume_percent ?? 0) / 100,
        };
        if (cur?.uri && cur.uri !== s.active?.uri) {
          patch.active = cur;
          const np = s.np;
          if (np) {
            const idx = np.context.findIndex((t) => t.uri === cur.uri);
            if (idx >= 0) patch.np = { ...np, index: idx, track: cur };
          } else {
            patch.np = { track: cur, uri: cur.uri, context: [cur], index: 0 };
          }
        }
        useStore.setState(patch);
        if (cur) s.like(cur);
      })
      .catch(() => {});
  }, 1000);
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  loading: false,
  sdkDeviceId: '',
  deviceId: '',
  devices: [],
  isExternal: false,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  liked: new Set(),
  np: null,
  active: null,
  sheetOpen: false,
  tab: 'home',
  searchQuery: '',
  sdkError: null,
  detail: null,

  onReady: (id) => {
    setDeviceId(id);
    set((s) => ({
      ready: true,
      sdkDeviceId: id,
      // Standardziel = eingebauter Player, bis der Nutzer umschaltet.
      deviceId: s.deviceId || id,
      sdkError: null,
    }));
    get().refreshDevices();
  },

  onState: (s) => {
    // SDK-Events gelten NUR für den eingebauten Player.
    if (get().deviceId !== get().sdkDeviceId) return;
    if (!s) {
      set({ isPlaying: false });
      return;
    }
    const pos = s.position ?? 0;
    const dur = s.duration ?? 0;
    const cur = s.track_window?.current_track;
    const patch: Partial<State> = {
      isPlaying: !s.paused,
      progressMs: pos,
      durationMs: dur,
    };
    if (cur?.uri && cur.uri !== get().active?.uri) {
      const np = get().np;
      if (np) {
        const idx = np.context.findIndex((t) => t.uri === cur.uri);
        if (idx >= 0) {
          patch.np = { ...np, index: idx };
          patch.active = np.context[idx];
        }
      }
    }
    set(patch);
    const curTrack = cur?.uri ? (get().np?.context.find((t) => t.uri === cur.uri) ?? null) : null;
    if (curTrack) get().like(curTrack);
  },

  refreshDevices: async () => {
    const list = await fetchDevices();
    // Eingebauten Player als Fallback sicherstellen (SDK ist aktiv, aber
    // erscheint manchmal erst verzögert in der Geräte-Liste).
    const sdkId = get().sdkDeviceId;
    const merged = [...list];
    if (sdkId && !merged.some((d) => d.id === sdkId)) {
      merged.push({ id: sdkId, name: 'Diese App', is_active: true, type: 'App', volume_percent: Math.round(get().volume * 100) });
    }
    // Aktives Gerät der API als Fallback, falls das gewählte Ziel verschwunden ist.
    const activeDev = merged.find((d) => d.is_active);
    if (!get().deviceId && sdkId) set({ deviceId: sdkId });
    else if (!merged.some((d) => d.id === get().deviceId) && activeDev) {
      set({ deviceId: activeDev.id });
    }
    // isExternal wird aus deviceId abgeleitet – eine Quelle, kein Desync.
    const isExternal = !!get().deviceId && get().deviceId !== sdkId;
    set({ devices: merged, isExternal });
    // Polling nur für externe Ziele starten/stoppen.
    if (isExternal && get().ready) startPolling();
    else stopPolling();
  },

  switchDevice: async (id) => {
    const { sdkDeviceId } = get();
    const isExternal = id !== sdkDeviceId;
    if (!isExternal) {
      // Zurück zum eingebauten Player: Wiedergabe zurückholen.
      stopPolling();
      set({ deviceId: id, isExternal: false });
      await get().refreshDevices();
      return;
    }
    // Auf externes Gerät übertragen (übernimmt laufende Wiedergabe).
    try {
      await transferPlayback(id);
      set({ deviceId: id, isExternal: true });
      if (get().ready) startPolling();
      // Fortschritt/Zustand sofort holen.
      const ps = await fetchPlaybackState();
      if (ps) {
        set({
          isPlaying: !ps.paused,
          progressMs: ps.position_ms,
          durationMs: ps.duration_ms,
          shuffle: ps.shuffle,
          repeat: ps.repeat_mode,
          volume: (ps.volume_percent ?? 0) / 100,
        });
        if (ps.track) {
          const cur = ps.track;
          set({
            active: cur,
            np: { track: cur, uri: cur.uri, context: [cur], index: 0 },
          });
        }
      }
      await get().refreshDevices();
    } catch (e) {
      console.warn('Geräte-Umschaltung fehlgeschlagen:', e);
    }
  },

  playTrack: async (track, context, contextUri) => {
    const ctx = context ?? [track];
    const idx = Math.max(0, ctx.findIndex((t) => t.uri === track.uri));
    set({ np: { track, uri: track.uri, context: ctx, index: idx, contextUri }, active: track, sheetOpen: true });
    const { deviceId, sdkDeviceId } = get();
    if (deviceId === sdkDeviceId) {
      playUri(track.uri).catch((e) => console.warn('playUri:', e));
    } else {
      await webPlay(deviceId, [track.uri], contextUri).catch((e) => console.warn('webPlay:', e));
    }
  },

  togglePlay: () => {
    const { deviceId, sdkDeviceId, np } = get();
    if (!np) return;
    if (deviceId === sdkDeviceId) {
      if (get().isPlaying) pausePlayback().catch(() => {});
      else playUri(np.uri).catch(() => {});
    } else {
      if (get().isPlaying) webPause(deviceId).catch(() => {});
      else webPlay(deviceId, [np.uri], np.contextUri).catch(() => {});
    }
  },

  next: () => {
    const { np, deviceId, sdkDeviceId } = get();
    if (!np) return;
    if (deviceId !== sdkDeviceId) {
      webNext(deviceId).catch(() => {});
      return;
    }
    if (get().shuffle) {
      const pool = np.context.filter((_, i) => i !== np.index);
      if (pool.length === 0) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      get().playTrack(pick, np.context, np.contextUri);
      return;
    }
    const i = np.index + 1;
    if (i >= np.context.length) {
      if (get().repeat === 'context') get().playTrack(np.context[0], np.context, np.contextUri);
      return;
    }
    get().playTrack(np.context[i], np.context, np.contextUri);
  },

  prev: () => {
    const { np, deviceId, sdkDeviceId, progressMs } = get();
    if (!np) return;
    if (deviceId !== sdkDeviceId) {
      if (progressMs > 5000) get().seek(0);
      else webPrev(deviceId).catch(() => {});
      return;
    }
    if (progressMs > 5000) {
      get().seek(0);
      return;
    }
    const i = np.index - 1;
    if (i < 0) return;
    get().playTrack(np.context[i], np.context, np.contextUri);
  },

  seek: (ms) => {
    const { np, deviceId, sdkDeviceId } = get();
    if (!np) return;
    if (deviceId === sdkDeviceId) {
      playUri(np.uri, ms).catch(() => {});
    } else {
      webSeek(deviceId, ms).catch(() => {});
    }
    set({ progressMs: ms });
  },

  toggleShuffle: () => {
    const v = !get().shuffle;
    const { deviceId, sdkDeviceId } = get();
    if (deviceId === sdkDeviceId) sdkSetShuffle(v);
    else webShuffle(deviceId, v).catch(() => {});
    set({ shuffle: v });
  },

  cycleRepeat: () => {
    const order: State['repeat'][] = ['off', 'context', 'track'];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    const { deviceId, sdkDeviceId } = get();
    if (deviceId === sdkDeviceId) sdkSetRepeat(next);
    else webRepeat(deviceId, next).catch(() => {});
    set({ repeat: next });
  },

  setVolume: (v) => {
    const { deviceId, sdkDeviceId } = get();
    if (deviceId === sdkDeviceId) sdkSetVolume(v);
    else webVolume(deviceId, v).catch(() => {});
    set({ volume: v });
  },

  like: async (track) => {
    const id = track.id;
    if (get().liked.has(id)) return;
    try {
      const l = await isLiked(id);
      const liked = new Set(get().liked);
      if (l) liked.add(id);
      set({ liked });
    } catch {
      /* nicht kritisch */
    }
  },

  setSheetOpen: (v) => set({ sheetOpen: v }),
  setTab: (t) => set({ tab: t }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSdkError: (m) => set({ sdkError: m }),
  setDetail: (d) => set({ detail: d }),
}));

// Beim Beenden nicht hängen lassen (Cleanup für HMR/Reload).
if (import.meta.hot) {
  import.meta.hot.dispose(() => stopPolling());
}

/** Like/Unlike mit Optimistic Update. */
export async function toggleLiked(track: Track) {
  const s = useStore.getState();
  const wasLiked = s.liked.has(track.id);
  const liked = new Set(s.liked);
  if (wasLiked) liked.delete(track.id);
  else liked.add(track.id);
  useStore.setState({ liked });
  try {
    await setLiked(track.id, !wasLiked);
  } catch (e) {
    console.warn('Like fehlgeschlagen:', e);
  }
}

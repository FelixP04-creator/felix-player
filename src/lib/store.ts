import { create } from 'zustand';
import {
  type Track,
  isLiked,
  setLiked,
  pausePlayback,
  playUri,
  sdkSetRepeat,
  sdkSetShuffle,
  sdkSetVolume,
  setDeviceId,
} from './spotify';

export type TabId = 'home' | 'search' | 'library';

interface NowPlaying {
  track: Track;
  uri: string;
  context: Track[]; // Queue, Index = aktuelle Position
  index: number;
}

interface State {
  ready: boolean;
  loading: boolean;
  deviceId: string;
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
  // Actions
  onReady: (id: string) => void;
  onState: (s: any) => void;
  playTrack: (track: Track, context?: Track[]) => void;
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
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  loading: false,
  deviceId: '',
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

  onReady: (id) => {
    setDeviceId(id);
    set({ ready: true, deviceId: id });
  },

  onState: (s) => {
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
      // Track aus SDK-Fenster mappen (Metadaten sind hier reduziert)
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

  playTrack: (track, context) => {
    const ctx = context ?? [track];
    const idx = Math.max(0, ctx.findIndex((t) => t.uri === track.uri));
    set({ np: { track, uri: track.uri, context: ctx, index: idx }, active: track, sheetOpen: true });
    playUri(track.uri).catch((e) => console.warn('playUri:', e));
  },

  togglePlay: () => {
    const { np } = get();
    if (!np) return;
    if (get().isPlaying) pausePlayback().catch(() => {});
    else playUri(np.uri).catch(() => {});
  },

  next: () => {
    const { np } = get();
    if (!np) return;
    if (get().shuffle) {
      const pool = np.context.filter((_, i) => i !== np.index);
      if (pool.length === 0) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      get().playTrack(pick, np.context);
      return;
    }
    const i = np.index + 1;
    if (i >= np.context.length) {
      if (get().repeat === 'context') get().playTrack(np.context[0], np.context);
      return;
    }
    get().playTrack(np.context[i], np.context);
  },

  prev: () => {
    const { np } = get();
    if (!np) return;
    if (get().progressMs > 5000) {
      get().seek(0);
      return;
    }
    const i = np.index - 1;
    if (i < 0) return;
    get().playTrack(np.context[i], np.context);
  },

  seek: (ms) => {
    const { np } = get();
    if (!np) return;
    playUri(np.uri, ms).catch(() => {});
    set({ progressMs: ms });
  },

  toggleShuffle: () => {
    const v = !get().shuffle;
    sdkSetShuffle(v);
    set({ shuffle: v });
  },

  cycleRepeat: () => {
    const order: State['repeat'][] = ['off', 'context', 'track'];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    sdkSetRepeat(next);
    set({ repeat: next });
  },

  setVolume: (v) => {
    sdkSetVolume(v);
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
}));

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

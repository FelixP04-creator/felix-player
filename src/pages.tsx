// Seiten: Login, Home (Top Tracks), Suche, Bibliothek (Playlists + Liked).
import { useEffect, useState } from 'react';
import {
  type Track, type Me, fetchTopTracks, fetchPlaylists, searchTracks,
  isCapacitor, startLogin, REDIRECT_URI, CLIENT_ID, readDebug,
} from './lib/spotify';
import { useStore } from './lib/store';
import { TrackRow } from './components/TrackRow';
import { IconPlay, IconSearch } from './components/icons';

/* ---------- Login ---------- */

export const LoginPage = ({ me }: { me: Me | null }) => (
  <div className="login">
    <div className="login-card">
      <div className="login-mark" aria-hidden>
        <IconPlay size={26} />
      </div>
      <h1 className="login-title">felix</h1>
      <p className="login-sub">
        Dein Spotify, deine Hülle. Melde dich einmal an – der Account bleibt dauerhaft
        in der App verbunden.
      </p>
      <button className="btn-primary" onClick={startLogin}>
        Mit Spotify verbinden
      </button>
      <p className="login-note">
        {me?.product === 'premium'
          ? 'Premium erkannt – Wiedergabe verfügbar.'
          : 'Hinweis: Wiedergabe (Streaming) erfordert ein Spotify-Premium-Abo.'}
        {me && (
          <span className="login-user">
            Angemeldet als {me.display_name || me.id}
          </span>
        )}
      </p>
      {!CLIENT_ID && (
        <p className="login-error">
          Es fehlt die Spotify Client-ID. Lege eine App im Spotify Developer Dashboard an,
          registriere die Redirect-URI <code>{isCapacitor ? 'spotifyapp://callback' : REDIRECT_URI}</code>
          und trage die Client-ID in <code>.env</code> als <code>VITE_SPOTIFY_CLIENT_ID</code> ein.
        </p>
      )}
      {isCapacitor && <DebugLog />}
    </div>
  </div>
);

/** Verbindungs-Protokoll: zeigt, wo der OAuth-Flow gerade steht/abbricht. */
const DebugLog = () => {
  const [lines, setLines] = useState<string[]>(readDebug());
  useEffect(() => {
    const t = setInterval(() => setLines(readDebug()), 700);
    return () => clearInterval(t);
  }, []);
  if (lines.length === 0) return null;
  return (
    <details className="login-debug">
      <summary>Verbindungs-Protokoll ({lines.length})</summary>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </details>
  );
};

/* ---------- Home ---------- */

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
};

export const HomePage = () => {
  const { playTrack } = useStore();
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTopTracks(30).then(setTracks).catch((e) => setErr(String(e.message ?? e)));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{greeting()}, {''}</h1>
        <p className="page-sub">Deine meistgespielten Titel – direkt los, ohne zu suchen.</p>
      </header>

      {err && (
        <div className="notice" role="alert">
          <span>{err}</span>
          <button onClick={() => window.location.reload()}>Neu laden</button>
        </div>
      )}

      {!tracks && !err && <div className="skeleton-list" aria-label="Lädt">{[0, 1, 2, 3, 4, 5].map((_, i) => <div key={i} className="sk-row" />)}</div>}

      {tracks && (
        <div className="track-list">
          {tracks.map((t) => (
            <TrackRow key={t.uri} track={t} context={tracks} />
          ))}
        </div>
      )}

      {tracks && (
        <div className="hero-play">
          <button className="btn-primary" onClick={() => playTrack(tracks[0], tracks)}>
            <IconPlay size={16} /> Top-Liste abspielen
          </button>
        </div>
      )}
    </div>
  );
};

/* ---------- Suche ---------- */

export const SearchPage = () => {
  const { searchQuery, setSearchQuery } = useStore();
  const [results, setResults] = useState<Track[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      searchTracks(q, 25)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Suche</h1>
        <div className="search-box">
          <IconSearch size={18} />
          <input
            type="search"
            placeholder="Titel, Künstler, Album"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Spotify suchen"
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Suche leeren">
              ×
            </button>
          )}
        </div>
      </header>

      {busy && <p className="hint">Suche läuft …</p>}
      {!busy && results === null && (
        <p className="hint">Gib mindestens zwei Zeichen ein – z. B. „Bohemian Rhapsody".</p>
      )}
      {results && results.length === 0 && <p className="hint">Nichts gefunden. Andere Schreibweise probieren.</p>}
      {results && results.length > 0 && (
        <div className="track-list">
          {results.map((t) => (
            <TrackRow key={t.uri} track={t} context={results} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- Bibliothek ---------- */

interface Pl {
  id: string;
  name: string;
  images: { url: string }[];
  owner: { display_name: string };
}

const playlistItems = (pl: Pl): Promise<Track[]> =>
  import('./lib/spotify').then(({ api }) =>
    api<{ items: { track: any }[] }>(`/playlists/${pl.id}/tracks?limit=50`)
      .then((r) => r.items.map((it) => it.track)),
  );

export const LibraryPage = () => {
  const [pls, setPls] = useState<Pl[] | null>(null);
  const [openPl, setOpenPl] = useState<Pl | null>(null);
  const [plTracks, setPlTracks] = useState<Track[] | null>(null);
  const [likedTracks, setLikedTracks] = useState<Track[] | null>(null);
  const [meName, setMeName] = useState('');
  const { playTrack } = useStore();

  useEffect(() => {
    fetchPlaylists(20).then((r) => setPls(r as Pl[])).catch(() => setPls([]));
    fetchLiked().then(setLikedTracks).catch(() => setLikedTracks([]));
    import('./lib/spotify').then(({ fetchMe }) => fetchMe().then((m) => setMeName(m.display_name ?? '')));
  }, []);

  const open = (pl: Pl | null) => {
    if (!pl || openPl?.id === pl.id) {
      setOpenPl(null);
      setPlTracks(null);
      return;
    }
    setOpenPl(pl);
    setPlTracks(null);
    playlistItems(pl).then(setPlTracks).catch(() => setPlTracks([]));
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Bibliothek</h1>
        <p className="page-sub">Deine Playlists und gelistete Titel.</p>
      </header>

      <div className="pl-grid">
        <button className="pl-card" onClick={() => open(null)} aria-label="Gefällt mir öffnen">
          <span className="pl-cover-like" aria-hidden>♥</span>
          <span className="pl-name">Gefällt mir</span>
          <span className="pl-meta">{likedTracks ? likedTracks.length + ' Titel' : 'Lädt …'}</span>
        </button>
        {(pls ?? []).map((pl) => (
          <button key={pl.id} className={'pl-card' + (openPl?.id === pl.id ? ' open' : '')} onClick={() => open(pl)}>
            {pl.images?.length ? (
              <img className="pl-cover" src={pl.images[pl.images.length - 1].url} alt="" loading="lazy" />
            ) : (
              <span className="pl-cover-empty" aria-hidden />
            )}
            <span className="pl-name">{pl.name}</span>
            <span className="pl-meta">{pl.owner?.display_name === meName ? 'Deine Playlist' : 'Playlist'}</span>
          </button>
        ))}
      </div>

      {openPl && (
        <div className="pl-detail">
          <h3 className="pl-detail-title">{openPl.name}</h3>
          {plTracks === null && <p className="hint">Lädt …</p>}
          {plTracks && plTracks.length === 0 && <p className="hint">Leere Playlist.</p>}
          {plTracks && plTracks.length > 0 && (
            <>
              <div className="hero-play">
                <button className="btn-primary" onClick={() => playTrack(plTracks[0], plTracks)}>
                  <IconPlay size={16} /> Play
                </button>
              </div>
              <div className="track-list">
                {plTracks.map((t) => (
                  <TrackRow key={t.uri} track={t} context={plTracks} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {likedTracks && likedTracks.length > 0 && !openPl && (
        <div className="pl-detail">
          <h3 className="pl-detail-title">Gefällt mir</h3>
          <div className="track-list">
            {likedTracks.map((t) => (
              <TrackRow key={t.uri} track={t} context={likedTracks} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

async function fetchLiked(): Promise<Track[]> {
  const { api } = await import('./lib/spotify');
  const r = await api<{ items: { track: any }[] }>('/me/tracks?limit=50');
  return r.items.map((it) => it.track);
}

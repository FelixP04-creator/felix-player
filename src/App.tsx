import { useEffect, useState } from 'react';
import { useStore } from './lib/store';
import { type Me, initPlayer, disposePlayer, startLogin, getMeToken, consumeAuthError, fetchMe, clearSession } from './lib/spotify';
import { HomePage, SearchPage, LibraryPage, LoginPage } from './pages';
import { DetailPage } from './pages/DetailPage';
import { PodcastsPage } from './pages/PodcastsPage';
import { MiniPlayer, BottomNav } from './components/PlayerBar';
import { PlayerSheet } from './components/PlayerSheet';
import { IconLogout } from './components/icons';

export function App() {
  const [token, setToken] = useState<string>(getMeToken());
  const [me, setMe] = useState<Me | null>(null);
  const [authError, setAuthError] = useState<string | null>(() => consumeAuthError());
  const { tab, active, ready, detail, sdkError } = useStore();

  // Session validieren + Player-SDK initialisieren, sobald Token vorliegt.
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setAuthError(null);
        initPlayer({
          onReady: (id) => useStore.getState().onReady(id),
          onState: (s) => useStore.getState().onState(s),
          onSdkError: (m) => useStore.getState().setSdkError(m),
        }).catch((e) => setAuthError('Wiedergabe-SDK: ' + (e.message ?? e)));
      })
      .catch((e) => {
        if (cancelled) return;
        clearSession();
        setMe(null);
        setToken('');
        setAuthError(e.message ?? String(e));
      });
    return () => {
      cancelled = true;
      disposePlayer();
    };
  }, [token]);

  const logout = () => {
    clearSession();
    setMe(null);
    setToken('');
  };

  if (!token || !me) {
    return (
      <div className="app">
        <main className="content-login">
          <LoginPage me={me} />
        </main>
        {authError && (
          <div className="login-errorbox" role="alert">
            {authError}{' '}
            <button onClick={() => startLogin().catch((e) => setAuthError(String(e)))}>Erneut verbinden</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>♪</span>
          <span className="brand-name">felix</span>
        </div>
        <div className="topbar-user">
          {me.images?.[0] && <img className="avatar" src={me.images[me.images.length - 1].url} alt="" />}
          <span className="user-name">{me.display_name || me.id}</span>
          <button className="icon-btn" onClick={logout} aria-label="Abmelden">
            <IconLogout size={18} />
          </button>
        </div>
      </header>

      <main className="content" key={tab + (detail ? ':' + detail.type + detail.id : '')}>
        {tab === 'home' && <HomePage />}
        {tab === 'search' && <SearchPage />}
        {tab === 'library' && <LibraryPage />}
        {tab === 'podcasts' && <PodcastsPage />}
        {detail && <DetailPage />}
      </main>

      <div className="deck">
        <MiniPlayer />
        <BottomNav />
      </div>

      <PlayerSheet />

      {!ready && active && !sdkError && (
        <div className="ready-hint" role="status">
          Geräte-Registrierung läuft – Wiedergabe startet gleich.
        </div>
      )}
      {sdkError && (
        <div className="ready-hint sdk-error" role="alert">
          <span>{sdkError}</span>
          <button onClick={() => window.location.reload()}>Erneut versuchen</button>
        </div>
      )}
    </div>
  );
}

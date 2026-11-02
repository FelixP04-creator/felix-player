// Mini-Player (immer sichtbar) + Bottom-Nav.
import type { ReactNode } from 'react';
import { useStore, type TabId } from '../lib/store';
import { CoverImg } from './TrackRow';
import { IconHome, IconSearch, IconLibrary, IconPlay, IconPause } from './icons';

export const BottomNav = () => {
  const { tab, setTab } = useStore();
  const items: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'home', label: 'Start', icon: <IconHome /> },
    { id: 'search', label: 'Suche', icon: <IconSearch /> },
    { id: 'library', label: 'Bibliothek', icon: <IconLibrary /> },
  ];
  return (
    <nav className="bnav" aria-label="Hauptnavigation">
      {items.map((it) => (
        <button
          key={it.id}
          className={'bnav-item' + (tab === it.id ? ' active' : '')}
          onClick={() => setTab(it.id)}
          aria-current={tab === it.id ? 'page' : undefined}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
};

export const MiniPlayer = () => {
  const { active, isPlaying, setSheetOpen } = useStore();
  if (!active) return <div className="mini-none" />;
  return (
    <button className="mini" onClick={() => setSheetOpen(true)} aria-label="Wiedergabe anzeigen">
      <CoverImg track={active} size="small" className="mini-cover" />
      <span className="mini-text">
        <span className="mini-title">{active.name}</span>
        <span className="mini-sub">{active.artists.map((a) => a.name).join(', ')}</span>
      </span>
      <span className="mini-cta">
        {isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
      </span>
    </button>
  );
};

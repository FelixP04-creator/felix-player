// Vollbild-Player: Bottom Sheet mit Cover, Glow, Seek, Transport.
// Öffnen/Schließen: CSS-Transition translateY(100%)→0, ease-drawer 320ms, symmetrisch.
import { useEffect, useRef, useState } from 'react';
import { useStore, toggleLiked } from '../lib/store';
import { fmtTime } from '../lib/spotify';
import { coverOf } from '../lib/spotify';
import { IconPrev, IconNext, IconPlay, IconPause, IconShuffle, IconRepeat, IconHeart, IconChevronDown } from './icons';

export const PlayerSheet = () => {
  const {
    active, isPlaying, sheetOpen, setSheetOpen,
    progressMs, durationMs, seek, togglePlay, next, prev,
    shuffle, toggleShuffle, repeat, cycleRepeat, liked,
  } = useStore();
  const [seeking, setSeeking] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Entschlossen: Sheet bleibt im DOM (Transition in beide Richtungen), Content nur bei aktiver Track.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, setSheetOpen]);

  if (!active) return null;

  const cover = coverOf(active, 'large');
  const pos = seeking ?? progressMs;
  const pct = durationMs ? Math.min(100, (pos / durationMs) * 100) : 0;
  const isLikedNow = liked.has(active.id);

  const seekTo = (clientX: number) => {
    const el = barRef.current;
    if (!el || !durationMs) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setSeeking(Math.round(frac * durationMs));
  };

  return (
    <div className={'sheet-wrap' + (sheetOpen ? ' open' : '')}>
      <div className="sheet-scrim" onClick={() => setSheetOpen(false)} />
      <section
        className={'sheet' + (sheetOpen ? ' open' : '')}
        role="dialog"
        aria-label="Wiedergabe"
        aria-hidden={!sheetOpen}
      >
        <button className="sheet-grab" onClick={() => setSheetOpen(false)} aria-label="Schließen">
          <IconChevronDown size={20} />
        </button>

        <div className={'sheet-cover-wrap' + (isPlaying ? ' playing' : '')}>
          <span className="sheet-glow" aria-hidden />
          <div className="sheet-cover">
            {cover ? (
              <img src={cover} alt="" draggable={false} />
            ) : (
              <span className="cover-empty" />
            )}
          </div>
        </div>

        <div className="sheet-meta">
          <h2 className="sheet-title">{active.name}</h2>
          <p className="sheet-artist">{active.artists.map((a) => a.name).join(', ')}</p>
          <button
            className={'sheet-like' + (isLikedNow ? ' on' : '')}
            onClick={() => toggleLiked(active)}
            aria-label={isLikedNow ? 'Nicht mehr gefällt' : 'Gefällt mir'}
          >
            <IconHeart size={20} filled={isLikedNow} />
          </button>
        </div>

        <div className="sheet-seek">
          <div
            className="seek-bar"
            ref={barRef}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              seekTo(e.clientX);
            }}
            onPointerMove={(e) => seeking != null && seekTo(e.clientX)}
            onPointerUp={() => {
              if (seeking != null) seek(seeking);
              setSeeking(null);
            }}
            role="slider"
            aria-label="Position"
            aria-valuemin={0}
            aria-valuemax={durationMs || 0}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={fmtTime(pos)}
          >
            <span className="seek-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className="sheet-times">
            <span>{fmtTime(pos)}</span>
            <span>{fmtTime(durationMs)}</span>
          </div>
        </div>

        <div className="sheet-transport">
          <button
            className={'tp-btn' + (shuffle ? ' on' : '')}
            onClick={toggleShuffle}
            aria-label="Zufall"
            aria-pressed={shuffle}
          >
            <IconShuffle size={20} />
          </button>
          <button className="tp-btn tp-prev" onClick={prev} aria-label="Vorheriger Titel">
            <IconPrev size={26} />
          </button>
          <button className="tp-play" onClick={togglePlay} aria-label={isPlaying ? 'Pausieren' : 'Abspielen'}>
            {isPlaying ? <IconPause size={30} /> : <IconPlay size={30} />}
          </button>
          <button className="tp-btn tp-next" onClick={next} aria-label="Nächster Titel">
            <IconNext size={26} />
          </button>
          <button
            className={'tp-btn' + (repeat !== 'off' ? ' on' : '')}
            onClick={cycleRepeat}
            aria-label="Wiederholen"
            aria-pressed={repeat !== 'off'}
          >
            <IconRepeat size={20} active={repeat === 'track'} />
          </button>
        </div>
      </section>
    </div>
  );
};

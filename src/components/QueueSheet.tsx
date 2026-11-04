// Queue: zeigt, was jetzt läuft und was als Nächstes kommt.
// Für den eingebauten Player: aus dem aktuellen Kontext (np.context).
// Für externe Geräte: die echte Queue der Spotify-API (/me/player/queue).
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { type Track, fetchQueue } from '../lib/spotify';
import { IconQueue, IconChevronDown, EqBars } from './icons';

export const QueueSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { np, active, isPlaying, playTrack, isExternal } = useStore();
  const [apiQueue, setApiQueue] = useState<{ current: Track | null; queue: Track[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    if (isExternal) {
      fetchQueue()
        .then((q) => live && setApiQueue(q))
        .catch(() => live && setApiQueue(null));
    }
    return () => {
      live = false;
    };
  }, [open, isExternal]);

  // Kontext-Queue: alles ab der aktuellen Position.
  const localUpcoming = np ? np.context.slice(np.index + 1) : [];
  const shownCurrent = isExternal && apiQueue?.current ? apiQueue.current : active;
  const upcoming = isExternal && apiQueue ? apiQueue.queue : localUpcoming;
  const onPlay = (t: Track) => {
    if (np) void playTrack(t, np.context, np.contextUri);
    onClose();
  };

  return (
    <div className={'sheet-wrap' + (open ? ' open' : '')}>
      <div className="sheet-scrim" onClick={onClose} />
      <section
        className={'sheet qsheet' + (open ? ' open' : '')}
        role="dialog"
        aria-label="Warteschlange"
        aria-hidden={!open}
      >
        <button className="sheet-grab" onClick={onClose} aria-label="Schließen">
          <IconChevronDown size={20} />
        </button>
        <div className="qsheet-head">
          <IconQueue size={20} />
          <h2 className="qsheet-title">Warteschlange</h2>
        </div>

        <div className="qsheet-body">
          {shownCurrent && (
            <>
              <p className="qlabel">Gleich gespielt / läuft</p>
              <button className="qrow is-current" onClick={() => onPlay(shownCurrent)}>
                <span className="qrow-t">
                  {isPlaying && <EqBars active size={12} />}
                  {shownCurrent.name}
                </span>
                <span className="qrow-s">{shownCurrent.artists.map((a) => a.name).join(', ')}</span>
              </button>
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <p className="qlabel">Als Nächstes</p>
              {upcoming.map((t, i) => (
                <button key={t.uri + i} className="qrow" onClick={() => onPlay(t)}>
                  <span className="qrow-n">{i + 1}</span>
                  <span className="qrow-t">{t.name}</span>
                  <span className="qrow-s">{t.artists.map((a) => a.name).join(', ')}</span>
                </button>
              ))}
            </>
          )}

          {upcoming.length === 0 && !shownCurrent && <p className="hint">Noch nichts in der Warteschlange.</p>}
        </div>
      </section>
    </div>
  );
};

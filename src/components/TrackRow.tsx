import { Fragment } from 'react';
import { type Track, coverOf, fmtTime } from '../lib/spotify';
import { useStore, toggleLiked } from '../lib/store';
import { IconPlay, IconPause, IconHeart, EqBars } from './icons';

/** Künstler-/Album-Link in der Tr-Sub-Zeile → Detailseite (store.detail). */
const Link = ({ kind, id, children }: { kind: 'artist' | 'album'; id: string; children: string }) => {
  const { setDetail } = useStore();
  if (!id) return <>{children}</>;
  return (
    <button
      className="tr-link"
      onClick={(e) => {
        e.stopPropagation();
        setDetail({ type: kind, id });
      }}
    >
      {children}
    </button>
  );
};

/** Wiedergabe-Zeile: Cover, Titel/Künstler, EQ/Play, Like, Dauer.
 *  Press-Feedback via :active (CSS), kein Hover-Only. */
export const TrackRow = ({
  track,
  context,
  showAlbum = true,
}: {
  track: Track;
  context: Track[];
  showAlbum?: boolean;
}) => {
  const { active, isPlaying, liked, playTrack, togglePlay } = useStore();
  const isCurrent = active?.uri === track.uri;
  const isLikedNow = liked.has(track.id);
  const cover = coverOf(track, 'small');

  return (
    <div className={'track-row' + (isCurrent ? ' is-current' : '')}>
      <button
        className="tr-main"
        onClick={() => (isCurrent ? togglePlay() : playTrack(track, context))}
        aria-label={isCurrent && isPlaying ? 'Pausieren' : 'Abspielen: ' + track.name}
      >
        <span className="tr-cover">
          {cover ? (
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <span className="tr-cover-empty" />
          )}
          <span className="tr-cover-cta" aria-hidden>
            {isCurrent && isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
          </span>
        </span>
        <span className="tr-text">
          <span className={'tr-title' + (isCurrent ? ' accent' : '')}>
            {isCurrent && <EqBars active={isPlaying} size={12} />}
            {track.name}
          </span>
          <span className="tr-sub">
            {track.artists.map((a, i) => (
              <Fragment key={a.id || i}>
                {i > 0 && <span> · </span>}
                <Link kind="artist" id={a.id}>{a.name}</Link>
              </Fragment>
            ))}
            {showAlbum && (
              <>
                {' · '}
                <Link kind="album" id={track.album.id}>{track.album.name}</Link>
              </>
            )}
          </span>
        </span>
      </button>
      <button
        className={'tr-like' + (isLikedNow ? ' on' : '')}
        onClick={() => toggleLiked(track)}
        aria-label={isLikedNow ? 'Nicht mehr gefällt' : 'Gefällt mir'}
      >
        <IconHeart size={16} filled={isLikedNow} />
      </button>
      <span className="tr-time">{fmtTime(track.duration_ms)}</span>
    </div>
  );
};

export const CoverImg = ({ track, size = 'mid', className = '' }: { track: Track | null; size?: 'small' | 'mid' | 'large'; className?: string }) => {
  const url = coverOf(track, size);
  return url ? (
    <img className={className} src={url} alt="" loading="lazy" draggable={false} />
  ) : (
    <span className={'cover-empty ' + className} aria-hidden />
  );
};

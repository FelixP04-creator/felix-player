// Podcast-Episode als Track-Zeile: läuft im normalen Player (Cover/Name/Dauer),
// mit „weiter anhören"-Offset. Gemeinsame Komponente für Podcasts-Tab und
// Show-Detailseite.
import { type Episode } from '../lib/spotify';
import { fmtTime } from '../lib/spotify';
import { useStore } from '../lib/store';
import { IconPlay, IconPause } from './icons';

export function remainingLabel(ms: number, offset?: number): string {
  const left = Math.max(0, ms - (offset ?? 0));
  return fmtTime(left);
}

export const EpisodeRow = ({ ep, context }: { ep: Episode; context: Episode[] }) => {
  const { active, isPlaying, togglePlay, playTrack } = useStore();
  // Eine Episode wird als Track in den Store geschoben (Cover/Name/Dauer).
  const asTrack = (e: Episode) => ({
    uri: e.uri,
    id: e.id,
    name: e.name,
    artists: e.showName ? [{ name: e.showName, id: '' }] : [],
    album: { name: e.showName ?? 'Podcast', id: '', images: e.images },
    duration_ms: e.duration_ms,
  });
  const isCurrent = active?.uri === ep.uri;
  const tr = asTrack(ep);
  const ctx = context.map(asTrack);
  const cover = ep.images[0]?.url ?? null;
  return (
    <button
      className={'track-row' + (isCurrent ? ' is-current' : '')}
      onClick={() => (isCurrent ? togglePlay() : void playTrack(tr, ctx))}
      aria-label={isCurrent && isPlaying ? 'Pausieren' : 'Abspielen: ' + ep.name}
    >
      <span className="tr-cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="tr-cover-empty" />}
        <span className="tr-cover-cta" aria-hidden>
          {isCurrent && isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
        </span>
      </span>
      <span className="tr-text">
        <span className={'tr-title' + (isCurrent ? ' accent' : '')}>{ep.name}</span>
        <span className="tr-sub">{ep.showName ? ep.showName + ' · ' : ''}{remainingLabel(ep.duration_ms, ep.resumeOffset)}</span>
      </span>
      <span className="tr-time">{fmtTime(ep.duration_ms)}</span>
    </button>
  );
};

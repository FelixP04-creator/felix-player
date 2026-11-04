// Podcasts: „Weiter anhören" (kürzlich, mit Fortsetzungs-Offset) + deine
// Folgen, aufklappbar zu den neuesten Episoden.
import { useEffect, useState } from 'react';
import {
  type Show, type Episode,
  fetchShows, fetchShowEpisodes, fetchRecentlyPlayedEpisodes,
  fmtTime,
} from '../lib/spotify';
import { useStore } from '../lib/store';
import { IconPlay, IconPause, IconPodcast } from '../components/icons';

function remaining(ms: number, offset?: number): string {
  const left = Math.max(0, ms - (offset ?? 0));
  return fmtTime(left);
}

const EpisodeRow = ({ ep, context }: { ep: Episode; context: Episode[] }) => {
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
        <span className="tr-sub">{ep.showName ? ep.showName + ' · ' : ''}{remaining(ep.duration_ms, ep.resumeOffset)}</span>
      </span>
      <span className="tr-time">{fmtTime(ep.duration_ms)}</span>
    </button>
  );
};

const ShowCard = ({ show }: { show: Show }) => {
  const [open, setOpen] = useState(false);
  const [eps, setEps] = useState<Episode[] | null>(null);
  const cover = show.images[0]?.url ?? null;

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!eps) {
      try {
        setEps(await fetchShowEpisodes(show.id, 12));
      } catch {
        setEps([]);
      }
    }
  };

  return (
    <div className={'show-card' + (open ? ' open' : '')}>
      <button className="show-head" onClick={toggle} aria-expanded={open}>
        <span className="show-cover">
          {cover ? <img src={cover} alt="" loading="lazy" /> : <IconPodcast size={26} />}
        </span>
        <span className="show-meta">
          <span className="show-name">{show.name}</span>
          <span className="show-pub">{show.publisher}</span>
        </span>
        <span className="show-chev" aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="show-eps">
          {eps === null && <p className="hint">Lädt …</p>}
          {eps && eps.length === 0 && <p className="hint">Keine Episoden geladen.</p>}
          {eps && eps.map((ep) => <EpisodeRow key={ep.uri} ep={{ ...ep, showName: show.name }} context={eps} />)}
        </div>
      )}
    </div>
  );
};

export const PodcastsPage = () => {
  const [continueList, setContinueList] = useState<Episode[] | null>(null);
  const [shows, setShows] = useState<Show[] | null>(null);

  useEffect(() => {
    fetchRecentlyPlayedEpisodes(10).then(setContinueList).catch(() => setContinueList([]));
    fetchShows(20).then(setShows).catch(() => setShows([]));
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Podcasts</h1>
        <p className="page-sub">Weiter anhören und deine Folgen.</p>
      </header>

      <section>
        <h2 className="pl-section-title">Weiter anhören</h2>
        {continueList === null && <p className="hint">Lädt …</p>}
        {continueList && continueList.length === 0 && (
          <p className="hint">Noch nichts angefangen. Wähle unten eine Folge aus und leg los.</p>
        )}
        {continueList && continueList.length > 0 && (
          <div className="track-list">
            {continueList.map((ep) => (
              <EpisodeRow key={ep.uri} ep={ep} context={continueList} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="pl-section-title">Deine Folgen</h2>
        {shows === null && <p className="hint">Lädt …</p>}
        {shows && shows.length === 0 && <p className="hint">Noch keine Folgen abonniert. In der Spotify-App folgen, dann erscheinen sie hier.</p>}
        {shows && shows.length > 0 && (
          <div className="show-list">
            {shows.map((s) => <ShowCard key={s.id} show={s} />)}
          </div>
        )}
      </section>
    </div>
  );
};

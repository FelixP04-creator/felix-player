// Podcasts: „Weiter anhören" (kürzlich, mit Fortsetzungs-Offset) + deine
// Folgen, aufklappbar zu den neuesten Episoden.
import { useEffect, useState } from 'react';
import {
  type Show, type Episode,
  fetchShows, fetchShowEpisodes, fetchRecentlyPlayedEpisodes,
} from '../lib/spotify';
import { useStore } from '../lib/store';
import { EpisodeRow } from '../components/EpisodeRow';
import { IconPodcast } from '../components/icons';

const ShowCard = ({ show }: { show: Show }) => {
  const { setDetail } = useStore();
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
          {eps && eps.length > 0 && (
            <>
              {eps.map((ep) => <EpisodeRow key={ep.uri} ep={{ ...ep, showName: show.name }} context={eps} />)}
              <button className="show-more" onClick={() => setDetail({ type: 'show', id: show.id })}>
                Alle Folgen ansehen
              </button>
            </>
          )}
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

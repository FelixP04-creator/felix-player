// Künstler-Zeile: rundes Cover, Name, Genre-Hinweis. Klick öffnet die
// Künstler-Seite (store.detail) – wie in der echten Spotify-Suche.
import type { Artist } from '../lib/spotify';
import { useStore } from '../lib/store';
import { IconArtist } from './icons';

export const ArtistRow = ({ artist }: { artist: Artist }) => {
  const { setDetail } = useStore();
  const cover = artist.images[0]?.url ?? null;
  return (
    <button
      className="artist-row"
      onClick={() => setDetail({ type: 'artist', id: artist.id })}
      aria-label={'Künstler öffnen: ' + artist.name}
    >
      <span className="artist-cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <IconArtist size={22} />}
      </span>
      <span className="artist-meta">
        <span className="artist-name">{artist.name}</span>
        <span className="artist-genres">{artist.genres?.[0] ? artist.genres[0] : 'Künstler'}</span>
      </span>
    </button>
  );
};

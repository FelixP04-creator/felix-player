// Detailseiten: Künstler, Album, Playlist, Podcast-Show.
// Von der Suche, dem Home-Bereich oder einem Track geöffnet (store.detail).
// Back-Button statt Tab-Umschaltung – wie in der echten Spotify-App.
import { useEffect, useState } from 'react';
import {
  type Artist, type Album, type Track, type Episode,
  fetchArtist, fetchArtistTopTracks, fetchArtistAlbums,
  fetchAlbum, fetchAlbumTracks,
  fetchPlaylist, fetchPlaylistTracks, fetchShow, fetchShowEpisodes,
} from '../lib/spotify';
import { useStore } from '../lib/store';
import { TrackRow } from '../components/TrackRow';
import { EpisodeRow } from '../components/EpisodeRow';
import { IconBack, IconPlay, IconArtist, IconAlbum } from '../components/icons';

const ArtistView = ({ artistId }: { artistId: string }) => {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const { playTrack } = useStore();

  useEffect(() => {
    let live = true;
    fetchArtist(artistId).then((a) => live && setArtist(a)).catch(() => {});
    fetchArtistTopTracks(artistId).then((t) => live && setTracks(t)).catch(() => setTracks([]));
    fetchArtistAlbums(artistId).then((a) => live && setAlbums(a)).catch(() => {});
    return () => { live = false; };
  }, [artistId]);

  const cover = artist?.images[0]?.url ?? null;
  return (
    <>
      <header className="detail-hero">
        <div className="detail-cover">
          {cover ? <img src={cover} alt="" /> : <span className="cover-empty"><IconArtist size={40} /></span>}
        </div>
        <span className="detail-kind">Künstler</span>
        <h1 className="detail-name">{artist?.name ?? '…'}</h1>
        {artist && artist.genres?.length > 0 && (
          <p className="detail-genres">{artist.genres.join(' · ')}</p>
        )}
        {tracks && (
          <div className="hero-play">
            <button className="btn-primary" onClick={() => playTrack(tracks[0], tracks, `spotify:artist:${artistId}`)}>
              <IconPlay size={16} /> Abspielen
            </button>
          </div>
        )}
      </header>

      {tracks && (
        <section>
          <h2 className="pl-section-title">Beliebt</h2>
          <div className="track-list">
            {tracks.map((t) => <TrackRow key={t.uri} track={t} context={tracks} />)}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section>
          <h2 className="pl-section-title">Alben & Singles</h2>
          <div className="album-grid">
            {albums.map((al) => (
              <AlbumTile key={al.id} album={al} />
            ))}
          </div>
        </section>
      )}
    </>
  );
};

const AlbumView = ({ albumId }: { albumId: string }) => {
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const { playTrack } = useStore();

  useEffect(() => {
    let live = true;
    fetchAlbum(albumId).then((a) => live && setAlbum(a)).catch(() => {});
    fetchAlbumTracks(albumId).then((t) => live && setTracks(t)).catch(() => setTracks([]));
    return () => { live = false; };
  }, [albumId]);

  const cover = album?.images[0]?.url ?? null;
  return (
    <>
      <header className="detail-hero">
        <div className="detail-cover">
          {cover ? <img src={cover} alt="" /> : <span className="cover-empty"><IconAlbum size={40} /></span>}
        </div>
        <span className="detail-kind">Album</span>
        <h1 className="detail-name">{album?.name ?? '…'}</h1>
        {album && (
          <p className="detail-subline">
            {album.artists.join(', ')}
            {album.release_date ? ' · ' + album.release_date.slice(0, 4) : ''}
            {album.total_tracks ? ' · ' + album.total_tracks + ' Titel' : ''}
          </p>
        )}
        {tracks && (
          <div className="hero-play">
            <button className="btn-primary" onClick={() => playTrack(tracks[0], tracks, `spotify:album:${albumId}`)}>
              <IconPlay size={16} /> Abspielen
            </button>
          </div>
        )}
      </header>

      {tracks && (
        <div className="track-list">
          {tracks.map((t) => <TrackRow key={t.uri} track={t} context={tracks} />)}
        </div>
      )}
    </>
  );
};

const PlaylistView = ({ playlistId }: { playlistId: string }) => {
  const [pl, setPl] = useState<Awaited<ReturnType<typeof fetchPlaylist>> | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const { playTrack } = useStore();

  useEffect(() => {
    let live = true;
    fetchPlaylist(playlistId).then((p) => live && setPl(p)).catch(() => {});
    fetchPlaylistTracks(playlistId, 100).then((t) => live && setTracks(t)).catch(() => setTracks([]));
    return () => { live = false; };
  }, [playlistId]);

  const cover = pl?.images[0]?.url ?? null;
  return (
    <>
      <header className="detail-hero">
        <div className="detail-cover">
          {cover ? <img src={cover} alt="" /> : <span className="cover-empty"><IconAlbum size={40} /></span>}
        </div>
        <span className="detail-kind">Playlist</span>
        <h1 className="detail-name">{pl?.name ?? '…'}</h1>
        {pl && (pl.owner || pl.description) && (
          <p className="detail-subline">
            {pl.owner ? pl.owner : ''}
            {pl.owner && pl.description ? ' · ' : ''}
            {pl.description.slice(0, 160)}
            {pl.description.length > 160 ? '…' : ''}
          </p>
        )}
        {tracks && tracks.length > 0 && (
          <div className="hero-play">
            <button className="btn-primary" onClick={() => playTrack(tracks[0], tracks, pl?.uri)}>
              <IconPlay size={16} /> Abspielen
            </button>
          </div>
        )}
      </header>

      {tracks && tracks.length > 0 ? (
        <div className="track-list">
          {tracks.map((t) => <TrackRow key={t.uri} track={t} context={tracks} showAlbum />)}
        </div>
      ) : (
        tracks && <p className="hint">Diese Playlist ist leer.</p>
      )}
    </>
  );
};

const ShowView = ({ showId }: { showId: string }) => {
  const [show, setShow] = useState<Awaited<ReturnType<typeof fetchShow>> | null>(null);
  const [eps, setEps] = useState<Episode[] | null>(null);
  const { playTrack } = useStore();

  useEffect(() => {
    let live = true;
    fetchShow(showId).then((s) => live && setShow(s)).catch(() => {});
    fetchShowEpisodes(showId, 20).then((e) => live && setEps(e)).catch(() => setEps([]));
    return () => { live = false; };
  }, [showId]);

  const cover = show?.images[0]?.url ?? null;
  const ctx = (eps ?? []).map((e) => ({ ...e, showName: show?.name }));
  const epAsTrack = (e: Episode): Track => ({
    uri: e.uri,
    id: e.id,
    name: e.name,
    artists: e.showName ? [{ name: e.showName, id: '' }] : [],
    album: { name: e.showName ?? 'Podcast', id: '', images: e.images },
    duration_ms: e.duration_ms,
  });
  return (
    <>
      <header className="detail-hero">
        <div className="detail-cover">
          {cover ? <img src={cover} alt="" /> : <span className="cover-empty"><IconAlbum size={40} /></span>}
        </div>
        <span className="detail-kind">Podcast</span>
        <h1 className="detail-name">{show?.name ?? '…'}</h1>
        {show && (show.publisher || show.description) && (
          <p className="detail-subline">
            {show.publisher}
            {show.publisher && show.description ? ' · ' : ''}
            {show.description.slice(0, 160)}
            {show.description.length > 160 ? '…' : ''}
          </p>
        )}
        {eps && eps.length > 0 && (
          <div className="hero-play">
            <button className="btn-primary" onClick={() => playTrack(epAsTrack(eps[0]), ctx.map(epAsTrack))}>
              <IconPlay size={16} /> Neueste Folge
            </button>
          </div>
        )}
      </header>

      {eps === null && <p className="hint">Lädt …</p>}
      {eps && eps.length === 0 && <p className="hint">Keine Episoden gefunden.</p>}
      {eps && eps.length > 0 && (
        <div className="track-list">
          {ctx.map((ep) => <EpisodeRow key={ep.uri} ep={ep} context={ctx} />)}
        </div>
      )}
    </>
  );
};

/** Alben-Kachel, klickbar zur Album-Seite. */
export const AlbumTile = ({ album }: { album: Album }) => {
  const { setDetail } = useStore();
  const cover = album.images[0]?.url ?? null;
  return (
    <button className="album-tile" onClick={() => setDetail({ type: 'album', id: album.id })} aria-label={'Album öffnen: ' + album.name}>
      <span className="album-tile-cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="cover-empty"><IconAlbum size={22} /></span>}
      </span>
      <span className="album-tile-name">{album.name}</span>
      <span className="album-tile-sub">{album.release_date ? album.release_date.slice(0, 4) : ''}</span>
    </button>
  );
};

export const DetailPage = () => {
  const { detail, setDetail } = useStore();
  if (!detail) return null;
  return (
    <div className="page detail-page">
      <header className="detail-topbar">
        <button className="icon-btn" onClick={() => setDetail(null)} aria-label="Zurück">
          <IconBack size={22} />
        </button>
      </header>
      {detail.type === 'artist' && <ArtistView artistId={detail.id} />}
      {detail.type === 'album' && <AlbumView albumId={detail.id} />}
      {detail.type === 'playlist' && <PlaylistView playlistId={detail.id} />}
      {detail.type === 'show' && <ShowView showId={detail.id} />}
    </div>
  );
};

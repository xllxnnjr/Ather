import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckGlyph,
  ChevronLeftGlyph,
  DownloadGlyph,
  HeartGlyph,
  PauseGlyph,
  PlayGlyph,
  ShuffleGlyph,
} from '../AppIcons';
import { formatDuration } from '../../data/showcaseCatalog';
import { lookupAlbumDetails } from '../../services/musicApi';
import { AlbumItem, ShowcaseTrack } from '../../types/music';
import { ShowcaseArtwork } from '../ShowcaseArtwork';

interface AlbumDetailScreenProps {
  album: AlbumItem;
  currentTrack: ShowcaseTrack | null;
  allTracks?: ShowcaseTrack[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  isPlaying: boolean;
  favoriteIds: Set<string>;
  downloadedIds: Set<string>;
  onBack: () => void;
  onRegisterTracks?: (tracks: ShowcaseTrack[]) => void;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean
  ) => void;
  onSelectAlbumTrack?: (
    tracks: ShowcaseTrack[],
    startIndex: number,
    albumId: string
  ) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: ShowcaseTrack) => void | Promise<void>;
  onShufflePlay: (trackIds: string[]) => void;
  onOpenArtist: (artistName: string) => void;
}

export const AlbumDetailScreen: React.FC<AlbumDetailScreenProps> = ({
  album,
  currentTrack,
  allTracks = [],
  resolveTrack,
  isPlaying,
  favoriteIds,
  downloadedIds,
  onBack,
  onRegisterTracks,
  onSelectTrack,
  onSelectAlbumTrack,
  onTogglePlay,
  onToggleFavorite,
  onToggleDownload,
  onShufflePlay,
  onOpenArtist,
}) => {
  const [fetchedTracks, setFetchedTracks] = useState<ShowcaseTrack[]>([]);
  const [resolvedAlbum, setResolvedAlbum] = useState<AlbumItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fetchedKeyRef = useRef<string | null>(null);

  const initialResolved = useMemo(
    () =>
      album.trackIds
        .map(
          (id) =>
            (resolveTrack ? resolveTrack(id) : undefined) ??
            allTracks.find((t) => t.id === id)
        )
        .filter((t): t is ShowcaseTrack => Boolean(t)),
    [album.trackIds, allTracks, resolveTrack]
  );

  useEffect(() => {
    const albumKey = `${album.id}::${album.collectionId ?? ''}`;
    if (fetchedKeyRef.current === albumKey) {
      return;
    }
    fetchedKeyRef.current = albumKey;
    setFetchedTracks([]);
    setResolvedAlbum(null);

    if (initialResolved.length > 0 && Boolean(album.coverUrl)) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    lookupAlbumDetails(album)
      .then((res) => {
        if (cancelled) return;
        if (res.album) setResolvedAlbum(res.album);
        if (initialResolved.length === 0) {
          setFetchedTracks(res.tracks);
          if (onRegisterTracks && res.tracks.length > 0) {
            onRegisterTracks(res.tracks);
          }
        }
      })
      .catch(() => {
        if (!cancelled && initialResolved.length === 0) setFetchedTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [album.id, album.collectionId, album.coverUrl, initialResolved.length, onRegisterTracks]);

  const tracks = initialResolved.length > 0 ? initialResolved : fetchedTracks;
  const activeAlbum = resolvedAlbum ?? album;
  const heroCoverUrl =
    activeAlbum.coverUrl ??
    tracks.find((t) => Boolean(t.coverUrl))?.coverUrl ??
    tracks[0]?.coverUrl;

  const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);
  const isAlbumActive = currentTrack
    ? tracks.some((t) => t.id === currentTrack.id)
    : false;
  const allDownloaded =
    tracks.length > 0 && tracks.every((t) => downloadedIds.has(t.id));
  const anyFavorited =
    tracks.length > 0 && tracks.some((t) => favoriteIds.has(t.id));

  const handleToggleAlbumDownload = () => {
    if (allDownloaded) {
      tracks.forEach((t) => {
        if (downloadedIds.has(t.id)) void onToggleDownload(t);
      });
    } else {
      tracks.forEach((t) => {
        if (!downloadedIds.has(t.id)) void onToggleDownload(t);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Full & Immersive Edge-to-Edge Album Cover Art Hero */}
      <section aria-label={album.title.toLowerCase()} className="space-y-5">
        <div className="relative ather-hero-bleed h-[340px] sm:h-[500px] overflow-hidden bg-black border-b border-[#242429]">
          <ShowcaseArtwork
            style={album.artwork}
            coverUrl={heroCoverUrl}
            alt={album.title.toLowerCase()}
            preferGradientFallback={Boolean(heroCoverUrl)}
            className="w-full h-full"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/35 pointer-events-none"
          />

          <div className="absolute ather-hero-topbar z-10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="ather-depth-pill inline-flex items-center gap-2 px-3.5 min-h-[44px] rounded-full text-xs font-extrabold text-white active:scale-95 transition-all"
            >
              <ChevronLeftGlyph className="w-4 h-4" />
              <span>back</span>
            </button>

            <span className="ather-depth-pill px-3 py-1.5 rounded-full text-xs font-extrabold text-[#E4E4E7]">
              album{album.year ? ` · ${album.year}` : ''}
            </span>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-5 z-10 space-y-2.5">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
              {album.title.toLowerCase()}
            </h1>

            <p className="text-xs sm:text-sm max-w-xl leading-relaxed text-[#A1A1AA] line-clamp-2">
              {album.description.toLowerCase()}
            </p>

            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                aria-label={`open ${album.artist.toLowerCase()}`}
                onClick={() => onOpenArtist(album.artist)}
                className="w-6 h-6 rounded-full overflow-hidden border border-[#242429] hover:border-white shrink-0 transition-colors"
              >
                <ShowcaseArtwork
                  style={album.artwork}
                  coverUrl={heroCoverUrl}
                  alt={album.artist.toLowerCase()}
                  preferGradientFallback={Boolean(heroCoverUrl)}
                  compact={true}
                  className="w-full h-full"
                />
              </button>
              <button
                type="button"
                onClick={() => onOpenArtist(album.artist)}
                className="text-sm font-bold text-white hover:underline transition-colors text-left"
              >
                {album.artist.toLowerCase()}
              </button>
              <span className="text-[#A1A1AA]" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-semibold tabular-nums text-[#A1A1AA]">
                {album.genre.toLowerCase()}
                {tracks.length > 0
                  ? ` · ${tracks.length} ${
                      tracks.length === 1 ? 'song' : 'songs'
                    } · ${formatDuration(totalDuration)}`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label={
                allDownloaded ? 'remove album downloads' : 'download album'
              }
              onClick={handleToggleAlbumDownload}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 ${
                allDownloaded
                  ? 'ather-acid-btn'
                  : 'ather-depth-btn text-white'
              }`}
            >
              {allDownloaded ? (
                <CheckGlyph className="w-4 h-4" />
              ) : (
                <DownloadGlyph className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label="favorite lead track"
              onClick={() => {
                if (tracks[0]) onToggleFavorite(tracks[0].id);
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 ${
                anyFavorited
                  ? 'ather-acid-btn'
                  : 'ather-depth-btn text-white'
              }`}
            >
              <HeartGlyph className="w-4 h-4" active={anyFavorited} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label="shuffle play album"
              onClick={() => onShufflePlay(tracks.map((t) => t.id))}
              className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-transform active:scale-90"
            >
              <ShuffleGlyph className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label={isAlbumActive && isPlaying ? 'pause album' : 'play album'}
              onClick={() => {
                if (isAlbumActive) {
                  onTogglePlay();
                } else if (tracks.length > 0) {
                  if (onSelectAlbumTrack) {
                    onSelectAlbumTrack(tracks, 0, album.id);
                  } else {
                    onSelectTrack(tracks[0], true);
                  }
                }
              }}
              className="ather-acid-btn w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-90 transition-transform"
            >
              {isAlbumActive && isPlaying ? (
                <PauseGlyph className="w-6 h-6" />
              ) : (
                <PlayGlyph className="w-6 h-6 translate-x-[0.5px]" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Album Tracklist */}
      <section aria-label="album songs" className="space-y-3">
        {loading ? (
          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`album-skel-${i}`}
                className="ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-3 animate-pulse"
              >
                <div className="w-6 h-3 rounded bg-[#141418]" />
                <div className="w-11 h-11 rounded-xl bg-[#141418] border border-[#242429] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-44 rounded bg-[#141418]" />
                  <div className="h-3 w-28 rounded bg-[#141418]" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-6 text-center text-xs font-bold text-[#A1A1AA]">
            no live tracks returned for this album.
          </div>
        ) : (
          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFav = favoriteIds.has(track.id);

              return (
                <div
                  key={track.id}
                  className={`ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-3 transition-colors ${
                    isCurrent ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span
                    className={`w-6 text-xs font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectAlbumTrack) onSelectAlbumTrack(tracks, idx, album.id);
                      else onSelectTrack(track, true);
                    }}
                    className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[#242429]"
                    aria-label={`play ${track.title.toLowerCase()}`}
                  >
                    <ShowcaseArtwork
                      style={track.artwork}
                      coverUrl={track.coverUrl}
                      alt={track.title.toLowerCase()}
                      preferGradientFallback={track.isAudius}
                      compact={true}
                      className="w-full h-full"
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectAlbumTrack) onSelectAlbumTrack(tracks, idx, album.id);
                        else onSelectTrack(track, true);
                      }}
                      className={`block max-w-full text-sm font-bold truncate text-left ${
                        isCurrent ? 'text-white underline underline-offset-4' : 'text-white'
                      }`}
                    >
                      {track.title.toLowerCase()}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArtist(track.artist)}
                      className="block max-w-full text-xs text-[#A1A1AA] hover:text-white hover:underline truncate mt-0.5 text-left transition-colors"
                    >
                      {track.artist.toLowerCase()}
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={isFav ? 'remove favorite' : 'favorite track'}
                    onClick={() => onToggleFavorite(track.id)}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors shrink-0"
                  >
                    <HeartGlyph
                      className={`w-4 h-4 ${isFav ? 'text-white' : ''}`}
                      active={isFav}
                    />
                  </button>

                  <span className="text-xs tabular-nums text-[#A1A1AA] w-10 text-right shrink-0">
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    type="button"
                    aria-label={isCurrent && isPlaying ? 'pause' : 'play'}
                    onClick={() => {
                      if (isCurrent && isPlaying) onTogglePlay();
                      else if (onSelectAlbumTrack) onSelectAlbumTrack(tracks, idx, album.id);
                      else onSelectTrack(track, true);
                    }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
                      isCurrent
                        ? 'ather-acid-btn'
                        : 'ather-depth-btn text-white'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <PauseGlyph className="w-4 h-4" />
                    ) : (
                      <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

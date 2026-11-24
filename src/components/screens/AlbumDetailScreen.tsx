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
import { lookupAlbumWithYouTube } from '../../services/musicApi';
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

    if (
      initialResolved.length > 0 &&
      album.coverUrl &&
      !/i\.ytimg\.com\/vi\//i.test(album.coverUrl)
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    lookupAlbumWithYouTube(album)
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
    (activeAlbum.coverUrl && !/i\.ytimg\.com\/vi\//i.test(activeAlbum.coverUrl)
      ? activeAlbum.coverUrl
      : undefined) ??
    tracks.find((t) => t.coverUrl && !/i\.ytimg\.com\/vi\//i.test(t.coverUrl))?.coverUrl ??
    activeAlbum.coverUrl ??
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
      <section aria-label={album.title} className="space-y-5">
        <div className="relative ather-hero-bleed h-[340px] sm:h-[500px] overflow-hidden bg-[#0D0D0F]">
          <ShowcaseArtwork
            style={album.artwork}
            coverUrl={heroCoverUrl}
            alt={album.title}
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#111114] border border-white/30 text-xs font-extrabold text-white hover:bg-[#1C1C22] hover:border-white/50 active:scale-95 transition-all"
            >
              <ChevronLeftGlyph className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="px-3 py-1.5 rounded-full bg-[#111114] border border-white/25 text-xs font-extrabold text-white">
              Album{album.year ? ` · ${album.year}` : ''}
            </span>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-5 z-10 space-y-2.5">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
              {album.title}
            </h1>

            <p className="text-xs sm:text-sm max-w-xl leading-relaxed text-white/75 line-clamp-2">
              {album.description}
            </p>

            <div className="flex items-center gap-2.5 pt-0.5">
              <button
                type="button"
                aria-label={`Open ${album.artist}`}
                onClick={() => onOpenArtist(album.artist)}
                className="w-6 h-6 rounded-full overflow-hidden border border-white/25 hover:border-white/70 shrink-0 transition-colors"
              >
                <ShowcaseArtwork
                  style={album.artwork}
                  coverUrl={heroCoverUrl}
                  alt={album.artist}
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
                {album.artist}
              </button>
              <span className="text-white/45" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-semibold tabular-nums text-white/65">
                {album.genre}
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
                allDownloaded ? 'Remove album downloads' : 'Download album'
              }
              onClick={handleToggleAlbumDownload}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 ${
                allDownloaded
                  ? 'bg-white text-black border-white'
                  : 'bg-[#141416] text-white/80 border-white/15 hover:text-white hover:border-white/35'
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
              aria-label="Favorite lead track"
              onClick={() => {
                if (tracks[0]) onToggleFavorite(tracks[0].id);
              }}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 ${
                anyFavorited
                  ? 'bg-white text-black border-white'
                  : 'bg-[#141416] text-white/80 border-white/15 hover:text-white hover:border-white/35'
              }`}
            >
              <HeartGlyph className="w-4 h-4" active={anyFavorited} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label="Shuffle play album"
              onClick={() => onShufflePlay(tracks.map((t) => t.id))}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#141416] text-white border border-white/15 hover:border-white/35 disabled:opacity-40 transition-transform active:scale-90"
            >
              <ShuffleGlyph className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={tracks.length === 0}
              aria-label={isAlbumActive && isPlaying ? 'Pause album' : 'Play album'}
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
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.28)] disabled:opacity-40 hover:scale-105 active:scale-90 transition-transform"
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
      <section aria-label="Album Songs" className="space-y-3">
        {loading ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/10 divide-y divide-white/[0.06] overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`album-skel-${i}`}
                className="flex items-center gap-3.5 px-4 py-3.5 animate-pulse"
              >
                <div className="w-6 h-3 rounded bg-white/10" />
                <div className="w-11 h-11 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-44 rounded bg-white/10" />
                  <div className="h-3 w-28 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/10 p-6 text-center text-xs text-white/55">
            No live tracks returned for this album.
          </div>
        ) : (
          <div className="rounded-3xl bg-[#141416] border border-white/12 divide-y divide-white/[0.08] overflow-hidden">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFav = favoriteIds.has(track.id);

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/[0.05] ${
                    isCurrent ? 'bg-white/[0.08]' : ''
                  }`}
                >
                  <span
                    className={`w-6 text-xs font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-white/40'
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
                    className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10"
                    aria-label={`Play ${track.title}`}
                  >
                    <ShowcaseArtwork
                      style={track.artwork}
                      coverUrl={track.coverUrl}
                      alt={track.title}
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
                      {track.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArtist(track.artist)}
                      className="block max-w-full text-xs text-white/55 hover:text-white hover:underline truncate mt-0.5 text-left transition-colors"
                    >
                      {track.artist}
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={isFav ? 'Remove favorite' : 'Favorite track'}
                    onClick={() => onToggleFavorite(track.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                  >
                    <HeartGlyph
                      className={`w-4 h-4 ${isFav ? 'text-white' : ''}`}
                      active={isFav}
                    />
                  </button>

                  <span className="text-xs tabular-nums text-white/50 w-10 text-right shrink-0">
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    type="button"
                    aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
                    onClick={() => {
                      if (isCurrent && isPlaying) onTogglePlay();
                      else if (onSelectAlbumTrack) onSelectAlbumTrack(tracks, idx, album.id);
                      else onSelectTrack(track, true);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
                      isCurrent
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
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

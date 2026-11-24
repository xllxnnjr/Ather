import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  CloseGlyph,
  DiscGlyph,
  DownloadGlyph,
  HeartGlyph,
  MoreHorizontalGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
  QueueGlyph,
  ShuffleGlyph,
} from '../AppIcons';
import {
  doesArtistNameMatch,
  formatDuration,
  getAlbumsByArtist,
  getTracksByArtist,
  pickGradientArtwork,
} from '../../data/showcaseCatalog';
import { fetchArtistProfileInfo } from '../../services/artistInfoApi';
import { searchAudiusTracks } from '../../services/audiusApi';
import { fetchItunesArtistDiscography } from '../../services/itunesApi';
import {
  isOfficialArtistTrack,
  normalizeMusicText,
  searchYouTubeArtistDiscography,
} from '../../services/musicApi';
import {
  isArtistFollowedInProfile,
  toggleFollowedArtistInProfile,
} from '../../services/tasteProfile';
import {
  AlbumItem,
  ArtistProfileInfo,
  ShowcaseTrack,
  UserPlaylist,
} from '../../types/music';
import { PopupSheet } from '../PopupSheet';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';
import { TrackInfoModal } from '../TrackInfoModal';

interface ArtistDetailScreenProps {
  artistName: string;
  currentTrack: ShowcaseTrack | null;
  allTracks?: ShowcaseTrack[];
  knownAlbums?: AlbumItem[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  isPlaying: boolean;
  favoriteIds: Set<string>;
  downloadedIds: Set<string>;
  playlists: UserPlaylist[];
  onBack: () => void;
  onRegisterTracks?: (tracks: ShowcaseTrack[]) => void;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean
  ) => void;
  onSelectArtistTrack?: (
    tracks: ShowcaseTrack[],
    startIndex: number,
    artistName: string
  ) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: ShowcaseTrack) => void | Promise<void>;
  onShufflePlay: (trackIds: string[]) => void;
  onOpenAlbum: (album: AlbumItem) => void;
  onAddToQueue: (trackId: string) => void;
  onAddTrackToPlaylist: (
    playlistId: string,
    track: ShowcaseTrack
  ) => void | Promise<void>;
}

export const ArtistDetailScreen: React.FC<ArtistDetailScreenProps> = ({
  artistName,
  currentTrack,
  allTracks = [],
  knownAlbums = [],
  resolveTrack,
  isPlaying,
  favoriteIds,
  downloadedIds,
  playlists,
  onBack,
  onRegisterTracks,
  onSelectTrack,
  onSelectArtistTrack,
  onTogglePlay,
  onToggleFavorite,
  onToggleDownload,
  onShufflePlay,
  onOpenAlbum,
  onAddToQueue,
  onAddTrackToPlaylist,
}) => {
  const [artistInfo, setArtistInfo] = useState<ArtistProfileInfo | null>(null);
  const [liveTracks, setLiveTracks] = useState<ShowcaseTrack[]>([]);
  const [liveAlbums, setLiveAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [following, setFollowing] = useState(() =>
    isArtistFollowedInProfile(artistName)
  );
  const [artistMenuOpen, setArtistMenuOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState<ShowcaseTrack | null>(null);
  const [infoTrack, setInfoTrack] = useState<ShowcaseTrack | null>(null);
  const [playlistPickerTrack, setPlaylistPickerTrack] =
    useState<ShowcaseTrack | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [resolvingAddId, setResolvingAddId] = useState<string | null>(null);

  useEffect(() => {
    setFollowing(isArtistFollowedInProfile(artistName));
  }, [artistName]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setArtistInfo(null);
    setLiveTracks([]);
    setLiveAlbums([]);

    Promise.allSettled([
      fetchArtistProfileInfo(artistName),
      searchYouTubeArtistDiscography(artistName),
      fetchItunesArtistDiscography(artistName),
      searchAudiusTracks(artistName, 20),
    ])
      .then(([profileRes, ytRes, itunesRes, audiusRes]) => {
        if (cancelled) return;
        if (profileRes.status === 'fulfilled') {
          setArtistInfo(profileRes.value);
        }

        const ytTracks =
          ytRes.status === 'fulfilled' ? ytRes.value.tracks : [];
        const ytAlbums =
          ytRes.status === 'fulfilled' ? ytRes.value.albums : [];

        const itunesTracks =
          itunesRes.status === 'fulfilled' ? itunesRes.value.tracks : [];
        const itunesAlbums =
          itunesRes.status === 'fulfilled' ? itunesRes.value.albums : [];

        const audiusTracks =
          audiusRes.status === 'fulfilled'
            ? audiusRes.value.filter((t) => doesArtistNameMatch(t.artist, artistName))
            : [];

        const itunesByTitle = new Map<string, ShowcaseTrack>();
        itunesTracks.forEach((it) => {
          const k = normalizeMusicText(it.title);
          if (!itunesByTitle.has(k)) itunesByTitle.set(k, it);
        });

        const mergedMap = new Map<string, ShowcaseTrack>();
        const seenNormTitles = new Set<string>();

        // 1. Place YouTube tracks first (enriched with matching iTunes album/cover if available)
        for (const yt of ytTracks) {
          const normKey = normalizeMusicText(yt.title);
          if (seenNormTitles.has(normKey)) continue;
          seenNormTitles.add(normKey);
          const matchingIt = itunesByTitle.get(normKey);
          mergedMap.set(
            yt.id,
            matchingIt
              ? {
                  ...yt,
                  album: matchingIt.album || yt.album,
                  collectionId: matchingIt.collectionId,
                  coverUrl: matchingIt.coverUrl || yt.coverUrl,
                  previewUrl: matchingIt.previewUrl,
                  releaseDate: matchingIt.releaseDate,
                  explicit: matchingIt.explicit,
                }
              : yt
          );
        }

        // 2. Append remaining iTunes & Audius tracks
        [...itunesTracks, ...audiusTracks].forEach((t) => {
          const normKey = normalizeMusicText(t.title);
          if (seenNormTitles.has(normKey) || mergedMap.has(t.id)) return;
          seenNormTitles.add(normKey);
          mergedMap.set(t.id, t);
        });

        const albumMap = new Map<string, AlbumItem>();
        [...itunesAlbums, ...ytAlbums].forEach((alb) => {
          const k = normalizeMusicText(alb.title);
          const existing = albumMap.get(k);
          const isRealCover = (url?: string) =>
            Boolean(url && !/i\.ytimg\.com\/vi\//i.test(url));
          if (!existing) {
            albumMap.set(k, alb);
          } else {
            const nextCover = isRealCover(alb.coverUrl)
              ? alb.coverUrl
              : existing.coverUrl;
            if ((!existing.collectionId && alb.collectionId) || (!isRealCover(existing.coverUrl) && isRealCover(alb.coverUrl))) {
              albumMap.set(k, { ...alb, coverUrl: nextCover });
            }
          }
        });

        const merged = Array.from(mergedMap.values()).filter((t) =>
          isOfficialArtistTrack(t)
        );
        setLiveTracks(merged);
        setLiveAlbums(Array.from(albumMap.values()));
        if (onRegisterTracks && merged.length > 0) {
          onRegisterTracks(merged);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artistName, onRegisterTracks]);

  const tracks = useMemo(() => {
    const localTracks = getTracksByArtist(artistName, allTracks);
    const map = new Map<string, ShowcaseTrack>();
    [...liveTracks, ...localTracks].forEach((t) => {
      if (!map.has(t.id)) map.set(t.id, t);
    });
    return Array.from(map.values());
  }, [artistName, allTracks, liveTracks]);

  const albums = useMemo(() => {
    const derived = getAlbumsByArtist(artistName, tracks, knownAlbums);
    const map = new Map<string, AlbumItem>();
    [...liveAlbums, ...derived].forEach((a) => {
      const key = `${a.collectionId ?? ''}::${a.title.trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, a);
    });
    return Array.from(map.values());
  }, [artistName, tracks, knownAlbums, liveAlbums]);

  const trackIds = tracks.map((t) => t.id);
  const isArtistActive = currentTrack
    ? tracks.some((t) => t.id === currentTrack.id)
    : false;
  const heroArtwork =
    tracks[0]?.artwork ??
    albums[0]?.artwork ??
    pickGradientArtwork(artistName);
  const heroCoverUrl =
    artistInfo?.photoUrl ??
    albums.find((a) => a.coverUrl && !/i\.ytimg\.com\/vi\//i.test(a.coverUrl))?.coverUrl ??
    tracks.find((t) => t.coverUrl && !/i\.ytimg\.com\/vi\//i.test(t.coverUrl))?.coverUrl ??
    tracks[0]?.coverUrl ??
    albums[0]?.coverUrl;
  const displayArtist =
    artistInfo?.name ?? tracks[0]?.artist ?? albums[0]?.artist ?? artistName;

  const likedTracks = tracks.filter((t) => favoriteIds.has(t.id));

  const artistSubtitleParts: string[] = [];
  if (artistInfo?.deezerFans) {
    artistSubtitleParts.push(
      `${artistInfo.deezerFans.toLocaleString('en-US')} fans on Deezer`
    );
  }
  if (artistInfo?.type) artistSubtitleParts.push(artistInfo.type);
  if (artistInfo?.country) artistSubtitleParts.push(artistInfo.country);
  if (artistInfo?.beginYear) {
    artistSubtitleParts.push(
      `${artistInfo.beginYear}–${artistInfo.endYear ?? 'Present'}`
    );
  }
  if (artistSubtitleParts.length === 0 && !loading) {
    artistSubtitleParts.push(
      `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`
    );
  }

  return (
    <div className="space-y-6">
      {/* Immersive Full-Bleed Artist Hero */}
      <section aria-label={displayArtist} className="space-y-4">
        <div className="relative ather-hero-bleed h-[320px] sm:h-[450px] overflow-hidden bg-[#0D0D0F]">
          <ShowcaseArtwork
            style={heroArtwork}
            coverUrl={heroCoverUrl}
            alt={displayArtist}
            preferGradientFallback={Boolean(heroCoverUrl)}
            className="w-full h-full"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/30 pointer-events-none"
          />

          <div className="absolute ather-hero-topbar z-20 flex items-center justify-start pointer-events-none">
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="pointer-events-auto w-10 h-10 rounded-full bg-[#111114] border border-white/30 text-white flex items-center justify-center hover:bg-[#1C1C22] hover:border-white/50 active:scale-90 transition-all touch-manipulation"
            >
              <ChevronLeftGlyph className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-4 z-10 space-y-1">
            {artistInfo?.disambiguation && (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75 truncate">
                {artistInfo.disambiguation}
              </p>
            )}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[0.98] drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)] truncate">
              {displayArtist}
            </h1>
          </div>
        </div>

        {/* Real Artist Metadata + Controls */}
        <div className="space-y-4">
          {loading && artistSubtitleParts.length === 0 ? (
            <div className="h-4 w-48 rounded-full bg-[#0E0E10] animate-pulse" />
          ) : (
            <p className="text-xs sm:text-sm font-medium text-white/60 tabular-nums">
              {artistSubtitleParts.join(' · ')}
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 relative">
              <button
                type="button"
                onClick={() => {
                  const genres = Array.from(
                    new Set(tracks.map((t) => t.genre || t.category).filter(Boolean))
                  );
                  const res = toggleFollowedArtistInProfile(displayArtist, genres);
                  setFollowing(res.isFollowing);
                }}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold border transition-all active:scale-95 touch-manipulation ${
                  following
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-white border-white/45 hover:border-white'
                }`}
              >
                {following ? 'Following' : 'Follow'}
              </button>

              <button
                type="button"
                aria-label="Artist options"
                onClick={() => setArtistMenuOpen((o) => !o)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <MoreHorizontalGlyph className="w-5 h-5" />
              </button>

              {artistMenuOpen && (
                <>
                  <div
                    aria-hidden="true"
                    onClick={() => setArtistMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div
                    style={{ backgroundColor: '#111114' }}
                    className="absolute left-0 top-11 z-40 w-56 rounded-2xl border border-white/25 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.95)] space-y-0.5"
                  >
                    <button
                      type="button"
                      disabled={tracks.length === 0}
                      onClick={() => {
                        setArtistMenuOpen(false);
                        if (tracks[0]) {
                          if (onSelectArtistTrack) {
                            onSelectArtistTrack(tracks, 0, displayArtist);
                          } else {
                            onSelectTrack(tracks[0], true);
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <PlayGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      <span>Play Top Song</span>
                    </button>
                    <button
                      type="button"
                      disabled={trackIds.length === 0}
                      onClick={() => {
                        setArtistMenuOpen(false);
                        onShufflePlay(trackIds);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <ShuffleGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      <span>Shuffle Discography</span>
                    </button>
                    <button
                      type="button"
                      disabled={tracks.length === 0}
                      onClick={() => {
                        tracks.forEach((t) => onAddToQueue(t.id));
                        setArtistMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <QueueGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      <span>Add All to Queue</span>
                    </button>
                    {tracks[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          setArtistMenuOpen(false);
                          setAddedMsg(null);
                          setPlaylistPickerTrack(tracks[0]);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                      >
                        <PlusGlyph className="w-4 h-4 text-white/80 shrink-0" />
                        <span>Add Top Song to Playlist</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {tracks.length > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  aria-label="Shuffle artist songs"
                  onClick={() => onShufflePlay(trackIds)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-transform active:scale-90"
                >
                  <ShuffleGlyph className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  aria-label={
                    isArtistActive && isPlaying ? 'Pause artist' : 'Play artist'
                  }
                  onClick={() => {
                    if (isArtistActive) {
                      onTogglePlay();
                    } else if (tracks[0]) {
                      if (onSelectArtistTrack) {
                        onSelectArtistTrack(tracks, 0, displayArtist);
                      } else {
                        onSelectTrack(tracks[0], true);
                      }
                    }
                  }}
                  className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:scale-105 active:scale-90 transition-transform touch-manipulation"
                >
                  {isArtistActive && isPlaying ? (
                    <PauseGlyph className="w-6 h-6" />
                  ) : (
                    <PlayGlyph className="w-6 h-6 translate-x-[1px]" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {tracks.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (likedTracks.length > 0) {
                onSelectTrack(likedTracks[0], true);
              } else if (tracks[0]) {
                onToggleFavorite(tracks[0].id);
              }
            }}
            className="w-full flex items-center gap-3.5 py-2 px-1 rounded-2xl hover:bg-white/[0.04] active:bg-white/[0.08] text-left transition-colors"
          >
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/15">
                <ShowcaseArtwork
                  style={heroArtwork}
                  coverUrl={heroCoverUrl}
                  alt={displayArtist}
                  preferGradientFallback={Boolean(heroCoverUrl)}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white text-black border-2 border-black flex items-center justify-center">
                <HeartGlyph className="w-2.5 h-2.5" active={true} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">Liked songs</div>
              <div className="text-xs text-white/75 font-bold truncate mt-0.5 tabular-nums">
                {likedTracks.length}{' '}
                {likedTracks.length === 1 ? 'song' : 'songs'} · {displayArtist}
              </div>
            </div>

            <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
          </button>
        )}
      </section>

      {/* Popular Numbered Track List */}
      <section aria-label="Popular" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
          Popular
        </h2>

        {loading && tracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/10 divide-y divide-white/[0.06] overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`artist-skel-${i}`}
                className="flex items-center gap-3.5 px-4 py-3 animate-pulse"
              >
                <div className="w-5 h-4 rounded bg-white/10" />
                <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-white/10" />
                  <div className="h-3 w-28 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/10 p-6 text-center text-xs text-white/75 font-bold">
            No live tracks found for {displayArtist}.
          </div>
        ) : (
          <div className="divide-y divide-white/10 rounded-3xl bg-[#111114] border border-white/20 overflow-hidden">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.05] ${
                    isCurrent ? 'bg-white/[0.08]' : ''
                  }`}
                >
                  <span
                    className={`w-5 text-sm font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectArtistTrack) {
                        onSelectArtistTrack(tracks, idx, displayArtist);
                      } else {
                        onSelectTrack(track, true);
                      }
                    }}
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.title}
                        preferGradientFallback={track.isAudius}
                        compact={true}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-bold truncate ${
                          isCurrent ? 'text-white underline underline-offset-4' : 'text-white/95'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/75 font-bold truncate mt-0.5 tabular-nums">
                        {track.explicit && (
                          <span className="px-1 py-0.5 rounded-[3px] bg-white/20 text-[9px] font-black leading-none text-white/90 shrink-0">
                            E
                          </span>
                        )}
                        <span className="truncate">
                          {track.playCount
                            ? `${track.playCount.toLocaleString('en-US')} plays · `
                            : ''}
                          {track.album} · {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={`More options for ${track.title}`}
                    onClick={() => setActionTrack(track)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 font-bold hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  >
                    <MoreHorizontalGlyph className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Artist Albums */}
      {(loading || albums.length > 0) && (
        <section aria-label="Artist Albums" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <DiscGlyph className="w-4 h-4 text-white/80" />
              <span>Discography</span>
            </h2>
            {!loading && (
              <span className="text-xs text-white/50 tabular-nums">
                {albums.length} {albums.length === 1 ? 'release' : 'releases'}
              </span>
            )}
          </div>

          {loading && albums.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`alb-skel-${i}`} className="space-y-2 animate-pulse">
                  <div className="w-full aspect-square rounded-2xl bg-[#0E0E10] border border-white/10" />
                  <div className="h-3.5 w-28 rounded bg-[#0E0E10]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {albums.map((album) => {
                const isAlbumActive = currentTrack
                  ? album.trackIds.includes(currentTrack.id)
                  : false;
                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => onOpenAlbum(album)}
                    className="group text-left transition-transform active:scale-[0.98]"
                  >
                    <div
                      className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-all ${
                        isAlbumActive
                          ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                          : 'border-white/12 group-hover:border-white/30'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={album.artwork}
                        coverUrl={album.coverUrl}
                        alt={album.title}
                        preferGradientFallback={Boolean(album.coverUrl)}
                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-black/80 text-white border border-white/25 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <ChevronRightGlyph className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-2.5 text-sm font-bold text-white leading-snug line-clamp-2">
                      {album.title}
                    </div>
                    <div className="mt-0.5 text-xs text-white/75 font-bold truncate">
                      {album.year ? `${album.year} · ` : ''}
                      {album.genre}
                      {album.trackIds.length > 0
                        ? ` · ${album.trackIds.length} ${
                            album.trackIds.length === 1 ? 'song' : 'songs'
                          }`
                        : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Track Three-Dots Bottom Action Sheet */}
      {actionTrack && (
        <PopupSheet
          onClose={() => setActionTrack(null)}
          ariaLabel={`Track options for ${actionTrack.title}`}
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[85dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/15 shrink-0">
                <ShowcaseArtwork
                  style={actionTrack.artwork}
                  coverUrl={actionTrack.coverUrl}
                  alt={actionTrack.title}
                  preferGradientFallback={actionTrack.isAudius}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">
                  {actionTrack.title}
                </div>
                <div className="text-xs text-white/75 font-bold truncate tabular-nums">
                  {actionTrack.artist} · {formatDuration(actionTrack.duration)}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActionTrack(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-1.5 overflow-y-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                onSelectTrack(t, true);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white text-black text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
            >
              <PlayGlyph className="w-4 h-4" />
              <span>Play Song</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setInfoTrack(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DiscGlyph className="w-4 h-4 text-white/80" />
              <span>Song &amp; Artist Info</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleFavorite(actionTrack.id);
                setActionTrack(null);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph
                className="w-4 h-4"
                active={favoriteIds.has(actionTrack.id)}
              />
              <span>
                {favoriteIds.has(actionTrack.id)
                  ? 'Remove from Liked Songs'
                  : 'Like Song'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                void onToggleDownload(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DownloadGlyph
                className="w-4 h-4 text-white/80"
                active={downloadedIds.has(actionTrack.id)}
              />
              <span>
                {downloadedIds.has(actionTrack.id)
                  ? 'Remove Download'
                  : 'Download Full Track'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddToQueue(actionTrack.id);
                setActionTrack(null);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-white/80" />
              <span>Add to Up Next Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setAddedMsg(null);
                setPlaylistPickerTrack(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white/80" />
              <span>Add to Playlist</span>
            </button>
          </div>
        </PopupSheet>
      )}

      {/* Add to Playlist Picker Modal */}
      {playlistPickerTrack && (
        <PopupSheet
          onClose={() => setPlaylistPickerTrack(null)}
          ariaLabel="Add to Playlist"
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[82dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/15 shrink-0">
                <ShowcaseArtwork
                  style={playlistPickerTrack.artwork}
                  coverUrl={playlistPickerTrack.coverUrl}
                  alt={playlistPickerTrack.title}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">
                  Add to Playlist
                </h2>
                <p className="text-xs text-white/75 font-bold truncate mt-0.5">
                  {playlistPickerTrack.title} · {playlistPickerTrack.artist}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPlaylistPickerTrack(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {addedMsg && (
              <div className="rounded-2xl bg-white text-black px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2">
                <CheckGlyph className="w-4 h-4 shrink-0" />
                <span className="truncate">{addedMsg}</span>
              </div>
            )}

            {playlists.length === 0 ? (
              <p className="py-8 text-center text-xs text-white/75 font-bold">
                Create a playlist in Library first to add songs here.
              </p>
            ) : (
              <div className="space-y-2">
                {playlists.map((pl) => {
                  const alreadyIn = pl.trackIds.includes(
                    playlistPickerTrack.id
                  );
                  const firstTrack =
                    (resolveTrack ? resolveTrack(pl.trackIds[0]) : undefined) ??
                    allTracks.find((t) => t.id === pl.trackIds[0]);
                  const isAdding = resolvingAddId === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      disabled={isAdding}
                      onClick={() => {
                        if (!alreadyIn) {
                          setResolvingAddId(pl.id);
                          Promise.resolve(
                            onAddTrackToPlaylist(pl.id, playlistPickerTrack)
                          ).finally(() => {
                            setResolvingAddId(null);
                            setAddedMsg(
                              `Added “${playlistPickerTrack.title}” to ${pl.name}`
                            );
                          });
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#18181C] border border-white/20 hover:border-white/35 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <PlaylistCover
                            coverImageUrl={pl.coverImageUrl}
                            coverArtwork={pl.coverArtwork}
                            fallbackArtwork={firstTrack?.artwork ?? 'lime-noir'}
                            fallbackCoverUrl={firstTrack?.coverUrl}
                            alt={pl.name}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {pl.name}
                          </div>
                          <div className="text-xs text-white/75 font-bold tabular-nums">
                            {pl.trackIds.length}{' '}
                            {pl.trackIds.length === 1 ? 'song' : 'songs'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          alreadyIn
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {alreadyIn ? (
                          <CheckGlyph className="w-4 h-4" />
                        ) : (
                          <PlusGlyph className="w-4 h-4" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopupSheet>
      )}

      <TrackInfoModal
        track={infoTrack}
        onClose={() => setInfoTrack(null)}
        isFavorite={infoTrack ? favoriteIds.has(infoTrack.id) : false}
        isDownloaded={infoTrack ? downloadedIds.has(infoTrack.id) : false}
        onPlayFullTrack={(t) => onSelectTrack(t, true)}
        onToggleFavorite={onToggleFavorite}
        onToggleDownload={(t) => void onToggleDownload(t)}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={(t) => {
          setAddedMsg(null);
          setPlaylistPickerTrack(t);
        }}
        onOpenArtist={() => setInfoTrack(null)}
      />
    </div>
  );
};

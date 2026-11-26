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
  searchRealSongs,
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
      fetchItunesArtistDiscography(artistName),
      searchAudiusTracks(artistName, 20),
      searchRealSongs(artistName, 20),
    ])
      .then(([profileRes, itunesRes, audiusRes, realRes]) => {
        if (cancelled) return;
        if (profileRes.status === 'fulfilled') {
          setArtistInfo(profileRes.value);
        }

        const itunesTracks =
          itunesRes.status === 'fulfilled' ? itunesRes.value.tracks : [];
        const itunesAlbums =
          itunesRes.status === 'fulfilled' ? itunesRes.value.albums : [];

        const audiusTracks =
          audiusRes.status === 'fulfilled'
            ? audiusRes.value.filter((t) => doesArtistNameMatch(t.artist, artistName))
            : [];

        const realTracks =
          realRes.status === 'fulfilled'
            ? realRes.value.filter((t) => doesArtistNameMatch(t.artist, artistName))
            : [];

        const mergedMap = new Map<string, ShowcaseTrack>();
        const seenNormTitles = new Set<string>();

        [...itunesTracks, ...audiusTracks, ...realTracks].forEach((t) => {
          const normKey = normalizeMusicText(t.title);
          if (seenNormTitles.has(normKey) || mergedMap.has(t.id)) return;
          seenNormTitles.add(normKey);
          mergedMap.set(t.id, t);
        });

        const albumMap = new Map<string, AlbumItem>();
        itunesAlbums.forEach((alb) => {
          const k = normalizeMusicText(alb.title);
          const existing = albumMap.get(k);
          if (!existing) {
            albumMap.set(k, alb);
          } else if ((!existing.collectionId && alb.collectionId) || (!existing.coverUrl && alb.coverUrl)) {
            albumMap.set(k, { ...alb, coverUrl: alb.coverUrl || existing.coverUrl });
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
    albums.find((a) => Boolean(a.coverUrl))?.coverUrl ??
    tracks.find((t) => Boolean(t.coverUrl))?.coverUrl ??
    tracks[0]?.coverUrl ??
    albums[0]?.coverUrl;
  const displayArtist =
    artistInfo?.name ?? tracks[0]?.artist ?? albums[0]?.artist ?? artistName;

  const likedTracks = tracks.filter((t) => favoriteIds.has(t.id));

  const artistSubtitleParts: string[] = [];
  if (artistInfo?.deezerFans) {
    artistSubtitleParts.push(
      `${artistInfo.deezerFans.toLocaleString('en-US')} fans`
    );
  }
  if (artistInfo?.type) artistSubtitleParts.push(artistInfo.type.toLowerCase());
  if (artistInfo?.country) artistSubtitleParts.push(artistInfo.country.toLowerCase());
  if (artistInfo?.beginYear) {
    artistSubtitleParts.push(
      `${artistInfo.beginYear}–${artistInfo.endYear ?? 'present'}`
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
      <section aria-label={displayArtist.toLowerCase()} className="space-y-4">
        <div className="relative ather-hero-bleed h-[320px] sm:h-[450px] overflow-hidden bg-black border-b border-[#242429]">
          <ShowcaseArtwork
            style={heroArtwork}
            coverUrl={heroCoverUrl}
            alt={displayArtist.toLowerCase()}
            preferGradientFallback={Boolean(heroCoverUrl)}
            className="w-full h-full"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/30 pointer-events-none"
          />

          <div className="absolute ather-hero-topbar z-20 flex items-center justify-start pointer-events-none">
            <button
              type="button"
              aria-label="back"
              onClick={onBack}
              className="ather-depth-btn pointer-events-auto w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-90 transition-all touch-manipulation"
            >
              <ChevronLeftGlyph className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-4 z-10 space-y-1">
            {artistInfo?.disambiguation && (
              <p className="text-[11px] font-bold tracking-[0.1em] text-[#E4E4E7] truncate">
                {artistInfo.disambiguation.toLowerCase()}
              </p>
            )}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[0.98] drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)] truncate">
              {displayArtist.toLowerCase()}
            </h1>
          </div>
        </div>

        {/* Real Artist Metadata + Controls */}
        <div className="space-y-4">
          {loading && artistSubtitleParts.length === 0 ? (
            <div className="h-4 w-48 rounded-full bg-[#141418] border border-[#242429] animate-pulse" />
          ) : (
            <p className="text-xs sm:text-sm font-medium text-[#A1A1AA] tabular-nums">
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
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all active:scale-95 touch-manipulation ${
                  following
                    ? 'ather-acid-btn'
                    : 'ather-depth-pill text-white'
                }`}
              >
                {following ? 'following' : 'follow'}
              </button>

              <button
                type="button"
                aria-label="artist options"
                onClick={() => setArtistMenuOpen((o) => !o)}
                className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors"
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
                  <div className="ather-depth-card absolute left-0 top-12 z-40 w-56 rounded-2xl p-1.5 space-y-0.5">
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
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <PlayGlyph className="w-4 h-4 shrink-0" />
                      <span>play top song</span>
                    </button>
                    <button
                      type="button"
                      disabled={trackIds.length === 0}
                      onClick={() => {
                        setArtistMenuOpen(false);
                        onShufflePlay(trackIds);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <ShuffleGlyph className="w-4 h-4 shrink-0" />
                      <span>shuffle discography</span>
                    </button>
                    <button
                      type="button"
                      disabled={tracks.length === 0}
                      onClick={() => {
                        tracks.forEach((t) => onAddToQueue(t.id));
                        setArtistMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black disabled:opacity-40 flex items-center gap-2.5 transition-colors"
                    >
                      <QueueGlyph className="w-4 h-4 shrink-0" />
                      <span>add all to queue</span>
                    </button>
                    {tracks[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          setArtistMenuOpen(false);
                          setAddedMsg(null);
                          setPlaylistPickerTrack(tracks[0]);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
                      >
                        <PlusGlyph className="w-4 h-4 shrink-0" />
                        <span>add top song to playlist</span>
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
                  aria-label="shuffle artist songs"
                  onClick={() => onShufflePlay(trackIds)}
                  className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
                >
                  <ShuffleGlyph className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  aria-label={
                    isArtistActive && isPlaying ? 'pause artist' : 'play artist'
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
                  className="ather-acid-btn w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-transform touch-manipulation"
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
            className="ather-depth-row w-full flex items-center gap-3.5 py-2.5 px-3 rounded-2xl text-left transition-colors"
          >
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-[#242429]">
                <ShowcaseArtwork
                  style={heroArtwork}
                  coverUrl={heroCoverUrl}
                  alt={displayArtist.toLowerCase()}
                  preferGradientFallback={Boolean(heroCoverUrl)}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <span className="ather-acid-btn absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center">
                <HeartGlyph className="w-2.5 h-2.5" active={true} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-white">liked songs</div>
              <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                {likedTracks.length}{' '}
                {likedTracks.length === 1 ? 'song' : 'songs'} · {displayArtist.toLowerCase()}
              </div>
            </div>

            <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
          </button>
        )}
      </section>

      {/* Popular Numbered Track List */}
      <section aria-label="popular" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
          popular
        </h2>

        {loading && tracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`artist-skel-${i}`}
                className="ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-3 animate-pulse"
              >
                <div className="w-5 h-4 rounded bg-[#141418]" />
                <div className="w-12 h-12 rounded-xl bg-[#141418] border border-[#242429] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-[#141418]" />
                  <div className="h-3 w-28 rounded bg-[#141418]" />
                </div>
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-6 text-center text-xs text-[#A1A1AA] font-bold">
            no live tracks found for {displayArtist.toLowerCase()}.
          </div>
        ) : (
          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={`ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-2.5 transition-colors ${
                    isCurrent ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span
                    className={`w-5 text-sm font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-[#A1A1AA]'
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
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#242429]">
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.title.toLowerCase()}
                        preferGradientFallback={track.isAudius}
                        compact={true}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-extrabold truncate ${
                          isCurrent ? 'text-white underline underline-offset-4' : 'text-white'
                        }`}
                      >
                        {track.title.toLowerCase()}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                        {track.explicit && (
                          <span className="px-1 py-0.5 rounded-[3px] bg-[#141418] border border-[#242429] text-[9px] font-black leading-none text-white shrink-0">
                            e
                          </span>
                        )}
                        <span className="truncate">
                          {track.playCount
                            ? `${track.playCount.toLocaleString('en-US')} plays · `
                            : ''}
                          {track.album.toLowerCase()} · {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={`more options for ${track.title.toLowerCase()}`}
                    onClick={() => setActionTrack(track)}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[#A1A1AA] font-bold hover:text-white transition-colors shrink-0"
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
        <section aria-label="artist albums" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <DiscGlyph className="w-4 h-4 text-white" />
              <span>discography</span>
            </h2>
            {!loading && (
              <span className="text-xs text-[#A1A1AA] tabular-nums font-bold">
                {albums.length} {albums.length === 1 ? 'release' : 'releases'}
              </span>
            )}
          </div>

          {loading && albums.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`alb-skel-${i}`} className="space-y-2 animate-pulse">
                  <div className="w-full aspect-square rounded-2xl bg-[#141418] border border-[#242429]" />
                  <div className="h-3.5 w-28 rounded bg-[#141418]" />
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
                          ? 'border-white ring-1 ring-white'
                          : 'border-[#242429] group-hover:border-white'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={album.artwork}
                        coverUrl={album.coverUrl}
                        alt={album.title.toLowerCase()}
                        preferGradientFallback={Boolean(album.coverUrl)}
                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="ather-depth-btn absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <ChevronRightGlyph className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-2.5 text-sm font-bold text-white leading-snug line-clamp-2">
                      {album.title.toLowerCase()}
                    </div>
                    <div className="mt-0.5 text-xs text-[#A1A1AA] font-bold truncate">
                      {album.year ? `${album.year} · ` : ''}
                      {album.genre.toLowerCase()}
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
          ariaLabel={`track options for ${actionTrack.title.toLowerCase()}`}
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[85dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#242429] shrink-0">
                <ShowcaseArtwork
                  style={actionTrack.artwork}
                  coverUrl={actionTrack.coverUrl}
                  alt={actionTrack.title.toLowerCase()}
                  preferGradientFallback={actionTrack.isAudius}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">
                  {actionTrack.title.toLowerCase()}
                </div>
                <div className="text-xs text-[#A1A1AA] font-bold truncate tabular-nums">
                  {actionTrack.artist.toLowerCase()} · {formatDuration(actionTrack.duration)}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={() => setActionTrack(null)}
              className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-transform active:scale-90"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 overflow-y-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                onSelectTrack(t, true);
              }}
              className="ather-acid-btn w-full px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <PlayGlyph className="w-4 h-4" />
              <span>play song</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setInfoTrack(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DiscGlyph className="w-4 h-4 text-white shrink-0" />
              <span>song &amp; artist info</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleFavorite(actionTrack.id);
                setActionTrack(null);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph
                className="w-4 h-4 text-white shrink-0"
                active={favoriteIds.has(actionTrack.id)}
              />
              <span>
                {favoriteIds.has(actionTrack.id)
                  ? 'remove from liked songs'
                  : 'like song'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                void onToggleDownload(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DownloadGlyph
                className="w-4 h-4 text-white shrink-0"
                active={downloadedIds.has(actionTrack.id)}
              />
              <span>
                {downloadedIds.has(actionTrack.id)
                  ? 'remove download'
                  : 'download full track'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddToQueue(actionTrack.id);
                setActionTrack(null);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-white shrink-0" />
              <span>add to up next queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setAddedMsg(null);
                setPlaylistPickerTrack(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white shrink-0" />
              <span>add to playlist</span>
            </button>
          </div>
        </PopupSheet>
      )}

      {/* Add to Playlist Picker Modal */}
      {playlistPickerTrack && (
        <PopupSheet
          onClose={() => setPlaylistPickerTrack(null)}
          ariaLabel="add to playlist"
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[82dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#242429] shrink-0">
                <ShowcaseArtwork
                  style={playlistPickerTrack.artwork}
                  coverUrl={playlistPickerTrack.coverUrl}
                  alt={playlistPickerTrack.title.toLowerCase()}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">
                  add to playlist
                </h2>
                <p className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
                  {playlistPickerTrack.title.toLowerCase()} · {playlistPickerTrack.artist.toLowerCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={() => setPlaylistPickerTrack(null)}
              className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-transform active:scale-90"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {addedMsg && (
              <div className="rounded-2xl bg-white text-black border border-[#242429] px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2">
                <CheckGlyph className="w-4 h-4 shrink-0" />
                <span className="truncate">{addedMsg.toLowerCase()}</span>
              </div>
            )}

            {playlists.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#A1A1AA] font-bold">
                create a playlist in library first to add songs here.
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
                              `added “${playlistPickerTrack.title.toLowerCase()}” to ${pl.name.toLowerCase()}`
                            );
                          });
                        }
                      }}
                      className="ather-depth-row w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#242429]">
                          <PlaylistCover
                            coverImageUrl={pl.coverImageUrl}
                            coverArtwork={pl.coverArtwork}
                            fallbackArtwork={firstTrack?.artwork ?? 'lime-noir'}
                            fallbackCoverUrl={firstTrack?.coverUrl}
                            alt={pl.name.toLowerCase()}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {pl.name.toLowerCase()}
                          </div>
                          <div className="text-xs text-[#A1A1AA] font-bold tabular-nums">
                            {pl.trackIds.length}{' '}
                            {pl.trackIds.length === 1 ? 'song' : 'songs'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[#242429] transition-colors ${
                          alreadyIn
                            ? 'bg-white text-black'
                            : 'bg-[#141418] text-white'
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

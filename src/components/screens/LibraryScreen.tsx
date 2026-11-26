import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityGlyph,
  AppIconProps,
  ArrowDownGlyph,
  ArrowUpGlyph,
  CameraGlyph,
  CheckGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  CloseGlyph,
  DownloadGlyph,
  EditPenGlyph,
  HapticsSparkGlyph,
  HeartGlyph,
  ImagePlusGlyph,
  MoreDotsGlyph,
  PauseGlyph,
  PlayGlyph,
  PlaylistsGlyph,
  PlusGlyph,
  RadioStreamGlyph,
  RotateGlyph,
  SearchInputGlyph,
  ShuffleGlyph,
  TrashGlyph,
  UserGlyph,
  WifiOffGlyph,
} from '../AppIcons';
import {
  PLAYLIST_COVER_PRESETS,
  formatDuration,
  pickGradientArtwork,
} from '../../data/showcaseCatalog';
import {
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  REMOTE_SYNC_APPLIED_EVENT,
  compressImageFileToDataUrl,
} from '../../services/accountStorage';
import { fetchDeezerArtistJsonp } from '../../services/artistInfoApi';
import { searchAudiusTracks } from '../../services/audiusApi';
import { searchItunesTracks } from '../../services/itunesApi';
import {
  STATS_UPDATED_EVENT,
  UserActivityStats,
  getTop5StreamedSongs,
  loadLocalActivityStats,
  syncActivityStatsFromCloud,
} from '../../services/listeningStats';
import { searchRealSongs } from '../../services/musicApi';
import {
  loadUserMusicProfile,
  toggleFollowedArtistInProfile,
} from '../../services/tasteProfile';
import { ArtworkStyle, ShowcaseTrack, UserPlaylist } from '../../types/music';
import { PopupSheet } from '../PopupSheet';
import { AvatarPreset, ProfileAvatar } from '../ProfileAvatar';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';
import { TopStreamedArtistsSection } from '../TopStreamedArtistsSection';

type LibrarySubTab = 'playlists' | 'downloads' | 'artists' | 'activity';

export interface PlayHistoryEntry {
  trackId: string;
  playedAt: number;
}

interface PlaylistUpdates {
  name?: string;
  description?: string;
  trackIds?: string[];
  coverArtwork?: ArtworkStyle;
  coverImageUrl?: string;
}

interface LibraryScreenProps {
  mode: 'library' | 'profile';
  uid?: string | null;
  displayName?: string;
  profileImageUrl?: string | null;
  avatarPreset?: AvatarPreset;
  isOffline?: boolean;
  requestedSubTab?: { tab: LibrarySubTab; tick: number } | null;
  currentTrack: ShowcaseTrack | null;
  allTracks?: ShowcaseTrack[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  isPlaying: boolean;
  favoriteIds: Set<string>;
  downloadedIds: Set<string>;
  recentTrackIds: string[];
  playHistory: PlayHistoryEntry[];
  playlists: UserPlaylist[];
  onRegisterTracks?: (tracks: ShowcaseTrack[]) => void;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean
  ) => void;
  onSelectPlaylistTrack?: (
    tracks: ShowcaseTrack[],
    startIndex: number,
    playlistId: string
  ) => void;
  onSelectDownloadTrack?: (
    tracks: ShowcaseTrack[],
    startIndex: number
  ) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: ShowcaseTrack) => void | Promise<void>;
  onOpenArtist: (artistName: string) => void;
  onCreatePlaylist: (
    name: string,
    description: string,
    trackIds: string[],
    cover?: { coverArtwork?: ArtworkStyle; coverImageUrl?: string }
  ) => UserPlaylist;
  onUpdatePlaylist: (playlistId: string, updates: PlaylistUpdates) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTrackToPlaylist?: (
    playlistId: string,
    track: ShowcaseTrack
  ) => void | Promise<void>;
  onShufflePlay: (trackIds: string[]) => void;
}

const SUB_TABS: {
  id: LibrarySubTab;
  label: string;
  icon: React.ComponentType<AppIconProps>;
}[] = [
  { id: 'playlists', label: 'playlists', icon: PlaylistsGlyph },
  { id: 'downloads', label: 'downloads', icon: DownloadGlyph },
  { id: 'artists', label: 'artists', icon: UserGlyph },
  { id: 'activity', label: 'activity', icon: ActivityGlyph },
];

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  mode,
  uid = null,
  displayName = 'listener',
  profileImageUrl,
  avatarPreset = 'silhouette',
  isOffline = false,
  requestedSubTab = null,
  currentTrack,
  allTracks = [],
  resolveTrack,
  isPlaying,
  favoriteIds,
  downloadedIds,
  recentTrackIds,
  playHistory,
  playlists,
  onRegisterTracks,
  onSelectTrack,
  onSelectPlaylistTrack,
  onSelectDownloadTrack,
  onTogglePlay,
  onToggleFavorite,
  onToggleDownload,
  onOpenArtist,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onShufflePlay,
}) => {
  const [subTab, setSubTab] = useState<LibrarySubTab>(
    isOffline ? 'downloads' : 'playlists'
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );
  const [followedArtists, setFollowedArtists] = useState<string[]>(() =>
    loadUserMusicProfile().followedArtists
  );
  const [artistPhotos, setArtistPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    const syncFollowed = () => {
      setFollowedArtists(loadUserMusicProfile().followedArtists);
    };
    syncFollowed();
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, syncFollowed);
    window.addEventListener(REMOTE_SYNC_APPLIED_EVENT, syncFollowed);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, syncFollowed);
      window.removeEventListener(REMOTE_SYNC_APPLIED_EVENT, syncFollowed);
    };
  }, [subTab]);

  useEffect(() => {
    if (subTab !== 'artists' || isOffline || followedArtists.length === 0) return;
    let cancelled = false;
    followedArtists.forEach((name) => {
      if (artistPhotos[name]) return;
      void fetchDeezerArtistJsonp(name)
        .then((info) => {
          if (cancelled || !info?.photoUrl) return;
          setArtistPhotos((prev) =>
            prev[name] ? prev : { ...prev, [name]: info.photoUrl! }
          );
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [subTab, isOffline, followedArtists, artistPhotos]);

  useEffect(() => {
    if (isOffline) {
      setSubTab('downloads');
      setSelectedPlaylistId(null);
    }
  }, [isOffline]);

  useEffect(() => {
    if (requestedSubTab) {
      setSubTab(requestedSubTab.tab);
      if (requestedSubTab.tab !== 'playlists') {
        setSelectedPlaylistId(null);
      }
    }
  }, [requestedSubTab]);

  // Create Playlist panel state
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrackIds, setNewTrackIds] = useState<string[]>([]);
  const [newCoverArtwork, setNewCoverArtwork] = useState<
    ArtworkStyle | undefined
  >(undefined);
  const [newCoverImageUrl, setNewCoverImageUrl] = useState<string | undefined>(
    undefined
  );

  // Edit Playlist metadata & cover state
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editingCoverOnly, setEditingCoverOnly] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [activityStats, setActivityStats] = useState<UserActivityStats>(() =>
    loadLocalActivityStats()
  );

  useEffect(() => {
    let active = true;
    const handleUpdate = () => {
      if (active) setActivityStats(loadLocalActivityStats());
    };
    window.addEventListener(STATS_UPDATED_EVENT, handleUpdate);

    if (uid) {
      syncActivityStatsFromCloud(uid)
        .then((merged) => {
          if (active) setActivityStats(merged);
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
      window.removeEventListener(STATS_UPDATED_EVENT, handleUpdate);
    };
  }, [uid]);
  const [addingSongsOpen, setAddingSongsOpen] = useState(false);
  const [addSongQuery, setAddSongQuery] = useState('');
  const [liveAddResults, setLiveAddResults] = useState<ShowcaseTrack[]>([]);
  const [liveAddLoading, setLiveAddLoading] = useState(false);
  const liveAddSeqRef = useRef(0);

  useEffect(() => {
    if (!addingSongsOpen || isOffline) {
      setLiveAddResults([]);
      setLiveAddLoading(false);
      return;
    }
    const trimmed = addSongQuery.trim();
    if (!trimmed) {
      setLiveAddResults([]);
      setLiveAddLoading(false);
      return;
    }

    const seq = ++liveAddSeqRef.current;
    setLiveAddLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const [realRes, itunesRes, audiusRes] = await Promise.allSettled([
          searchRealSongs(trimmed, 25),
          searchItunesTracks(trimmed, 20),
          searchAudiusTracks(trimmed, 12),
        ]);
        if (seq !== liveAddSeqRef.current) return;
        const mergedMap = new Map<string, ShowcaseTrack>();
        const lists = [
          realRes.status === 'fulfilled' ? realRes.value : [],
          itunesRes.status === 'fulfilled' ? itunesRes.value : [],
          audiusRes.status === 'fulfilled' ? audiusRes.value : [],
        ];
        for (const list of lists) {
          for (const t of list) {
            if (!mergedMap.has(t.id)) mergedMap.set(t.id, t);
          }
        }
        const merged = Array.from(mergedMap.values());
        setLiveAddResults(merged);
        if (onRegisterTracks && merged.length > 0) {
          onRegisterTracks(merged);
        }
      } finally {
        if (seq === liveAddSeqRef.current) setLiveAddLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [addingSongsOpen, addSongQuery, isOffline, onRegisterTracks]);

  const editCoverInputRef = useRef<HTMLInputElement>(null);
  const createCoverInputRef = useRef<HTMLInputElement>(null);

  const [audioQuality, setAudioQuality] = useState<
    'Lossless 24-bit' | 'High 320kbps'
  >('Lossless 24-bit');

  const activeSubTabIdx = Math.max(
    0,
    SUB_TABS.findIndex((t) => t.id === subTab)
  );

  const readImageFile = (
    file: File | undefined,
    onLoaded: (dataUrl: string) => void
  ) => {
    if (!file) return;
    compressImageFileToDataUrl(file, 320, 0.8)
      .then((compressed) => {
        if (compressed) onLoaded(compressed);
      })
      .catch(() => {
        // ignore unsupported image compression failure
      });
  };

  if (mode === 'profile') {
    return (
      <div className="space-y-7 max-w-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white text-black border border-[#242429] flex items-center justify-center">
            <UserGlyph className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {displayName.toLowerCase()}
            </h1>
            <p className="text-xs font-bold text-[#A1A1AA] mt-0.5">
              {playlists.length} playlists · {favoriteIds.size} liked ·{' '}
              {downloadedIds.size} downloaded · {audioQuality.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="ather-depth-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-[#A1A1AA]">
            <RadioStreamGlyph className="w-4 h-4 text-white" />
            <span>streaming quality</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['Lossless 24-bit', 'High 320kbps'] as const).map((tier) => {
              const active = audioQuality === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setAudioQuality(tier)}
                  className={`p-4 rounded-2xl border text-left transition-colors min-h-[44px] ${
                    active
                      ? 'bg-white text-black border-white'
                      : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                  }`}
                >
                  <div className="text-sm font-extrabold flex items-center justify-between">
                    <span>{tier.toLowerCase()}</span>
                    {active && <HapticsSparkGlyph className="w-4 h-4 text-black" />}
                  </div>
                  <div
                    className={`text-xs font-bold mt-1 ${
                      active ? 'text-black/75' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {tier === 'Lossless 24-bit'
                      ? 'studio alac clarity'
                      : 'balanced bandwidth streaming'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const findTrack = (id: string): ShowcaseTrack | undefined =>
    (resolveTrack ? resolveTrack(id) : undefined) ??
    allTracks.find((t) => t.id === id);

  const isViewingLikedSongs = selectedPlaylistId === '__liked__';
  const activePlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) ?? null;
  const likedTracks = Array.from(favoriteIds)
    .map((id) => findTrack(id))
    .filter((t): t is ShowcaseTrack => Boolean(t));
  const downloadedTracks = allTracks.filter((t) => downloadedIds.has(t.id));
  const catalogToDownload = allTracks.filter((t) => !downloadedIds.has(t.id));
  const recentTracks = recentTrackIds
    .map((id) => findTrack(id))
    .filter((t): t is ShowcaseTrack => Boolean(t));

  const handleOpenPlaylist = (pl: UserPlaylist) => {
    setSelectedPlaylistId(pl.id);
    setEditName(pl.name);
    setEditDesc(pl.description);
    setPlaylistMenuOpen(false);
    setEditingMeta(false);
    setEditingCoverOnly(false);
    setAddingSongsOpen(false);
    setAddSongQuery('');
  };

  const handleMoveTrack = (pl: UserPlaylist, index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= pl.trackIds.length) return;
    const next = [...pl.trackIds];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onUpdatePlaylist(pl.id, { trackIds: next });
  };

  const handleRemoveTrackFromPlaylist = (pl: UserPlaylist, index: number) => {
    const next = pl.trackIds.filter((_, i) => i !== index);
    onUpdatePlaylist(pl.id, { trackIds: next });
  };

  const handleToggleTrackInPlaylist = (
    pl: UserPlaylist,
    track: ShowcaseTrack
  ) => {
    const exists = pl.trackIds.includes(track.id);
    if (exists) {
      const next = pl.trackIds.filter((id) => id !== track.id);
      onUpdatePlaylist(pl.id, { trackIds: next });
    } else if (onAddTrackToPlaylist) {
      void onAddTrackToPlaylist(pl.id, track);
    } else {
      onUpdatePlaylist(pl.id, { trackIds: [...pl.trackIds, track.id] });
    }
  };

  const addableTracksPool = (() => {
    const q = addSongQuery.trim().toLowerCase();
    const filteredLocal = q
      ? allTracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        )
      : allTracks;

    if (!q || liveAddResults.length === 0) return filteredLocal;
    const map = new Map<string, ShowcaseTrack>();
    [...liveAddResults, ...filteredLocal].forEach((t) => {
      if (!map.has(t.id)) map.set(t.id, t);
    });
    return Array.from(map.values());
  })();

  const renderCoverPicker = (
    currentImageUrl: string | undefined,
    currentArtwork: ArtworkStyle | undefined,
    inputRef: React.RefObject<HTMLInputElement | null>,
    onPickImage: (dataUrl: string) => void,
    onPickPreset: (style: ArtworkStyle) => void,
    onReset: () => void
  ) => (
    <div className="rounded-2xl bg-[#141418] border border-[#242429] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-white">playlist cover photo</span>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              readImageFile(e.target.files?.[0], onPickImage);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ather-acid-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
          >
            <ImagePlusGlyph className="w-3.5 h-3.5" />
            <span>upload photo</span>
          </button>

          {(currentImageUrl || currentArtwork) && (
            <button
              type="button"
              onClick={onReset}
              className="ather-depth-pill inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-xs font-bold transition-colors"
            >
              <RotateGlyph className="w-3 h-3" />
              <span>reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-[#A1A1AA]">
          or select a cover gradient
        </span>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PLAYLIST_COVER_PRESETS.map((preset) => {
            const selected = !currentImageUrl && currentArtwork === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-label={`use ${preset.toLowerCase()} cover`}
                onClick={() => onPickPreset(preset)}
                className={`relative aspect-square rounded-xl overflow-hidden border transition-all ${
                  selected
                    ? 'border-white ring-2 ring-white scale-95'
                    : 'border-[#242429] hover:opacity-90'
                }`}
              >
                <ShowcaseArtwork
                  style={preset}
                  compact={true}
                  className="w-full h-full"
                />
                {selected && (
                  <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <CheckGlyph className="w-4 h-4 text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTrackRow = (
    track: ShowcaseTrack,
    subtitle: string,
    trailingAction?: React.ReactNode,
    onPlayRow?: (track: ShowcaseTrack) => void
  ) => {
    const isCurrent = currentTrack?.id === track.id;
    const isDownloaded = downloadedIds.has(track.id);
    const unavailableOffline = isOffline && !isDownloaded;
    const triggerPlay = () => {
      if (onPlayRow) onPlayRow(track);
      else onSelectTrack(track, true);
    };
    return (
      <div
        key={track.id}
        className={`ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-3 transition-opacity ${
          isCurrent ? 'ring-1 ring-white border-white/60' : ''
        } ${unavailableOffline ? 'opacity-45' : ''}`}
      >
        <button
          type="button"
          onClick={triggerPlay}
          className="w-12 h-12 rounded-xl overflow-hidden border border-[#242429] shrink-0"
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
            onClick={triggerPlay}
            className={`block max-w-full text-sm font-bold truncate text-left ${
              isCurrent
                ? 'text-white'
                : 'text-[#E4E4E7]'
            }`}
          >
            {track.title.toLowerCase()}
          </button>
          <div className="flex items-center gap-1 text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
            <button
              type="button"
              onClick={() => onOpenArtist(track.artist)}
              className="hover:text-white hover:underline truncate transition-colors"
            >
              {track.artist.toLowerCase()}
            </button>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              {unavailableOffline ? 'unavailable offline' : subtitle.toLowerCase()}
            </span>
          </div>
        </div>

        {trailingAction}

        <span className="text-xs tabular-nums text-[#A1A1AA] w-10 text-right shrink-0">
          {formatDuration(track.duration)}
        </span>

        <button
          type="button"
          aria-label={isCurrent && isPlaying ? 'pause' : 'play'}
          onClick={() => {
            if (isCurrent && isPlaying) onTogglePlay();
            else triggerPlay();
          }}
          className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
            isCurrent
              ? 'bg-white text-black border-white'
              : 'bg-[#141418] text-white border-[#2A2A32] hover:bg-white hover:text-black'
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
  };

  const showingPlaylistDetail =
    subTab === 'playlists' && (activePlaylist !== null || isViewingLikedSongs);

  return (
    <div className="space-y-6">
      {!showingPlaylistDetail && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <p className="text-xs font-extrabold tracking-[0.08em] text-[#A1A1AA] mb-1">
              your library
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {subTab === 'playlists'
                ? 'playlists'
                : subTab === 'downloads'
                ? 'downloads'
                : subTab === 'artists'
                ? 'artists'
                : 'activity'}
            </h1>
          </div>

          <div
            role="tablist"
            aria-label="library sections"
            className="ather-depth-bar relative grid grid-cols-4 w-full sm:w-auto sm:min-w-[360px] items-center rounded-full p-1 overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/4)] rounded-full bg-white pointer-events-none"
              style={{
                transform: `translate3d(${activeSubTabIdx * 100}%, 0, 0)`,
                transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />

            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => {
                    setSubTab(tab.id);
                    if (tab.id !== 'playlists') {
                      setSelectedPlaylistId(null);
                    }
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 min-h-[44px] px-1.5 sm:px-3 py-2 rounded-full text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-colors duration-150 ${
                    active ? 'text-black' : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: PLAYLISTS */}
      {subTab === 'playlists' && (
        <>
          {activePlaylist ? (
            <div className="space-y-6">
              {(() => {
                const playlistTracks = activePlaylist.trackIds
                  .map((id) => findTrack(id))
                  .filter((t): t is ShowcaseTrack => Boolean(t));
                const totalSeconds = playlistTracks.reduce(
                  (sum, t) => sum + t.duration,
                  0
                );
                const fallbackArtwork =
                  playlistTracks[0]?.artwork ??
                  pickGradientArtwork(activePlaylist.id);
                const fallbackCoverUrl = playlistTracks[0]?.coverUrl;
                const isPlaylistPlaying = currentTrack
                  ? playlistTracks.some((t) => t.id === currentTrack.id)
                  : false;

                return (
                  <>
                    <section className="space-y-5">
                      {editingMeta ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedPlaylistId(null)}
                              className="ather-depth-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform"
                            >
                              <ChevronLeftGlyph className="w-4 h-4" />
                              <span>all playlists</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingMeta(false)}
                              className="ather-depth-pill inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold text-white transition-transform active:scale-95"
                            >
                              <CloseGlyph className="w-3.5 h-3.5" />
                              <span>cancel edit</span>
                            </button>
                          </div>

                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              onUpdatePlaylist(activePlaylist.id, {
                                name: editName.trim() || activePlaylist.name,
                                description: editDesc.trim(),
                              });
                              setEditingMeta(false);
                            }}
                            className="ather-depth-card rounded-3xl p-6 space-y-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#242429] shrink-0">
                                <PlaylistCover
                                  coverImageUrl={activePlaylist.coverImageUrl}
                                  coverArtwork={activePlaylist.coverArtwork}
                                  fallbackArtwork={fallbackArtwork}
                                  fallbackCoverUrl={fallbackCoverUrl}
                                  alt={activePlaylist.name.toLowerCase()}
                                  className="w-full h-full"
                                />
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="playlist name"
                                  className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-white"
                                />
                                <input
                                  type="text"
                                  value={editDesc}
                                  onChange={(e) => setEditDesc(e.target.value)}
                                  placeholder="optional mood or notes"
                                  className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-2 text-xs font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                                />
                              </div>
                            </div>

                            {renderCoverPicker(
                              activePlaylist.coverImageUrl,
                              activePlaylist.coverArtwork,
                              editCoverInputRef,
                              (dataUrl) =>
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverImageUrl: dataUrl,
                                  coverArtwork: undefined,
                                }),
                              (style) =>
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverArtwork: style,
                                  coverImageUrl: undefined,
                                }),
                              () =>
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverArtwork: undefined,
                                  coverImageUrl: undefined,
                                })
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingMeta(false)}
                                className="ather-depth-pill px-4 py-2 rounded-full text-xs font-extrabold text-white"
                              >
                                cancel
                              </button>
                              <button
                                type="submit"
                                className="ather-acid-btn px-5 py-2 rounded-full text-xs font-extrabold"
                              >
                                save changes
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <>
                          <div className="relative ather-hero-bleed h-[340px] sm:h-[500px] overflow-hidden bg-[#000000] border-b border-[#242429] group">
                            <PlaylistCover
                              coverImageUrl={activePlaylist.coverImageUrl}
                              coverArtwork={activePlaylist.coverArtwork}
                              fallbackArtwork={fallbackArtwork}
                              fallbackCoverUrl={fallbackCoverUrl}
                              alt={activePlaylist.name.toLowerCase()}
                              className="w-full h-full"
                            />

                            <div
                              aria-hidden="true"
                              className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/35 pointer-events-none"
                            />

                            <div className="absolute ather-hero-topbar z-20 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setPlaylistMenuOpen(false);
                                  setSelectedPlaylistId(null);
                                }}
                                className="ather-depth-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform"
                              >
                                <ChevronLeftGlyph className="w-4 h-4" />
                                <span>all playlists</span>
                              </button>

                              <div className="relative">
                                <button
                                  type="button"
                                  aria-label="playlist options"
                                  aria-expanded={playlistMenuOpen}
                                  onClick={() =>
                                    setPlaylistMenuOpen((o) => !o)
                                  }
                                  className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-95 transition-transform"
                                >
                                  <MoreDotsGlyph className="w-5 h-5" />
                                </button>

                                {playlistMenuOpen && (
                                  <>
                                    <div
                                      aria-hidden="true"
                                      onClick={() => setPlaylistMenuOpen(false)}
                                      className="fixed inset-0 z-20"
                                    />
                                    <div
                                      className="ather-depth-card absolute right-0 top-12 z-30 w-52 rounded-2xl p-1.5 space-y-0.5"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCoverOnly((c) => !c);
                                          setPlaylistMenuOpen(false);
                                        }}
                                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-[#141418] flex items-center gap-2.5 transition-colors"
                                      >
                                        <CameraGlyph className="w-4 h-4 text-white shrink-0" />
                                        <span>change cover</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditName(activePlaylist.name);
                                          setEditDesc(
                                            activePlaylist.description
                                          );
                                          setEditingCoverOnly(false);
                                          setPlaylistMenuOpen(false);
                                          setEditingMeta(true);
                                        }}
                                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-[#141418] flex items-center gap-2.5 transition-colors"
                                      >
                                        <EditPenGlyph className="w-4 h-4 text-white shrink-0" />
                                        <span>edit playlist</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPlaylistMenuOpen(false);
                                          onDeletePlaylist(activePlaylist.id);
                                          setSelectedPlaylistId(null);
                                        }}
                                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-[#E4E4E7] hover:bg-[#141418] hover:text-white flex items-center gap-2.5 transition-colors"
                                      >
                                        <TrashGlyph className="w-4 h-4 text-[#E4E4E7] shrink-0" />
                                        <span>delete playlist</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="absolute inset-x-4 sm:inset-x-8 bottom-5 z-20 space-y-2">
                              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)] truncate">
                                {activePlaylist.name.toLowerCase()}
                              </h2>
                              {activePlaylist.description && (
                                <p className="text-xs sm:text-sm font-bold text-[#A1A1AA] max-w-xl leading-relaxed line-clamp-2">
                                  {activePlaylist.description.toLowerCase()}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <ProfileAvatar
                                  displayName={displayName}
                                  imageUrl={profileImageUrl}
                                  preset={avatarPreset}
                                  className="w-6 h-6 border border-[#242429] shrink-0"
                                />
                                <span className="text-sm font-bold text-white">
                                  {displayName.toLowerCase()}
                                </span>
                                <span className="text-[#A1A1AA]" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-xs font-bold tabular-nums text-[#A1A1AA]">
                                  playlist · {playlistTracks.length}{' '}
                                  {playlistTracks.length === 1 ? 'song' : 'songs'}{' '}
                                  · {formatDuration(totalSeconds)} ·{' '}
                                  {activePlaylist.updatedAt.toLowerCase()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setAddSongQuery('');
                                setAddingSongsOpen(true);
                              }}
                              className="ather-depth-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform"
                            >
                              <PlusGlyph className="w-3.5 h-3.5 text-white" />
                              <span>add songs</span>
                            </button>

                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                type="button"
                                aria-label="shuffle playlist"
                                disabled={playlistTracks.length === 0}
                                onClick={() =>
                                  onShufflePlay(activePlaylist.trackIds)
                                }
                                className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-40 transition-transform active:scale-90"
                              >
                                <ShuffleGlyph className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                aria-label={
                                  isPlaylistPlaying && isPlaying
                                    ? 'pause playlist'
                                    : 'play playlist'
                                }
                                disabled={playlistTracks.length === 0}
                                onClick={() => {
                                  if (isPlaylistPlaying) onTogglePlay();
                                  else if (playlistTracks.length > 0) {
                                    if (onSelectPlaylistTrack) {
                                      onSelectPlaylistTrack(
                                        playlistTracks,
                                        0,
                                        activePlaylist.id
                                      );
                                    } else {
                                      onSelectTrack(playlistTracks[0], true);
                                    }
                                  }
                                }}
                                className="ather-acid-btn w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-90 transition-transform"
                              >
                                {isPlaylistPlaying && isPlaying ? (
                                  <PauseGlyph className="w-6 h-6" />
                                ) : (
                                  <PlayGlyph className="w-6 h-6 translate-x-[1px]" />
                                )}
                              </button>
                            </div>
                          </div>

                          {editingCoverOnly &&
                            renderCoverPicker(
                              activePlaylist.coverImageUrl,
                              activePlaylist.coverArtwork,
                              editCoverInputRef,
                              (dataUrl) => {
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverImageUrl: dataUrl,
                                  coverArtwork: undefined,
                                });
                                setEditingCoverOnly(false);
                              },
                              (style) => {
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverArtwork: style,
                                  coverImageUrl: undefined,
                                });
                                setEditingCoverOnly(false);
                              },
                              () => {
                                onUpdatePlaylist(activePlaylist.id, {
                                  coverArtwork: undefined,
                                  coverImageUrl: undefined,
                                });
                                setEditingCoverOnly(false);
                              }
                            )}
                        </>
                      )}
                    </section>

                    <section aria-label="playlist songs" className="space-y-3">
                      {playlistTracks.length === 0 ? (
                        <div className="ather-depth-card rounded-3xl p-8 text-center space-y-3">
                          <p className="text-xs text-[#A1A1AA] font-bold">
                            this playlist has no songs yet.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAddSongQuery('');
                              setAddingSongsOpen(true);
                            }}
                            className="ather-acid-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
                          >
                            <PlusGlyph className="w-3.5 h-3.5" />
                            <span>add songs to playlist</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
                            {playlistTracks.map((track, idx) => {
                              const isCurrent = currentTrack?.id === track.id;
                              return (
                                <div
                                  key={`${track.id}-${idx}`}
                                  className={`ather-depth-row rounded-2xl flex items-center gap-3 px-3.5 py-3 ${
                                    isCurrent ? 'ring-1 ring-white border-white/60' : ''
                                  }`}
                                >
                                  <span
                                    className={`w-5 text-xs font-bold tabular-nums text-center shrink-0 ${
                                      isCurrent ? 'text-white' : 'text-[#A1A1AA]'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onSelectPlaylistTrack) {
                                        onSelectPlaylistTrack(
                                          playlistTracks,
                                          idx,
                                          activePlaylist.id
                                        );
                                      } else {
                                        onSelectTrack(track, true);
                                      }
                                    }}
                                    className="w-11 h-11 rounded-xl overflow-hidden border border-[#242429] shrink-0"
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
                                        if (onSelectPlaylistTrack) {
                                          onSelectPlaylistTrack(
                                            playlistTracks,
                                            idx,
                                            activePlaylist.id
                                          );
                                        } else {
                                          onSelectTrack(track, true);
                                        }
                                      }}
                                      className={`block max-w-full text-sm font-extrabold truncate text-left ${
                                        isCurrent ? 'text-white' : 'text-[#E4E4E7]'
                                      }`}
                                    >
                                      {track.title.toLowerCase()}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenArtist(track.artist)}
                                      className="block max-w-full text-xs text-[#A1A1AA] font-bold hover:text-white hover:underline truncate mt-0.5 text-left"
                                    >
                                      {track.artist.toLowerCase()}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      aria-label="move song up"
                                      disabled={idx === 0}
                                      onClick={() =>
                                        handleMoveTrack(activePlaylist, idx, -1)
                                      }
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white disabled:opacity-25 transition-colors"
                                    >
                                      <ArrowUpGlyph className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="move song down"
                                      disabled={
                                        idx === playlistTracks.length - 1
                                      }
                                      onClick={() =>
                                        handleMoveTrack(activePlaylist, idx, 1)
                                      }
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white disabled:opacity-25 transition-colors"
                                    >
                                      <ArrowDownGlyph className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="remove song from playlist"
                                      onClick={() =>
                                        handleRemoveTrackFromPlaylist(
                                          activePlaylist,
                                          idx
                                        )
                                      }
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors"
                                    >
                                      <TrashGlyph className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setAddSongQuery('');
                              setAddingSongsOpen(true);
                            }}
                            className="ather-depth-row w-full py-3 rounded-2xl text-xs font-extrabold text-white inline-flex items-center justify-center gap-2 transition-colors"
                          >
                            <PlusGlyph className="w-4 h-4 text-white" />
                            <span>add more songs to this playlist</span>
                          </button>
                        </>
                      )}
                    </section>

                    {/* Add Songs to Playlist Modal Sheet with Live Search */}
                    {addingSongsOpen && (
                      <PopupSheet
                        onClose={() => setAddingSongsOpen(false)}
                        ariaLabel={`add songs to ${activePlaylist.name.toLowerCase()}`}
                        variant="bottom"
                        maxWidthClass="max-w-lg"
                        maxHeightClass="max-h-[85dvh]"
                      >
                        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
                          <div className="min-w-0">
                            <h4 className="text-base font-extrabold text-white truncate">
                              add songs to “{activePlaylist.name.toLowerCase()}”
                            </h4>
                            <p className="text-xs text-[#A1A1AA] font-bold mt-0.5">
                              search live songs and tap + to add to your playlist
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddingSongsOpen(false)}
                            className="ather-acid-btn px-4 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition-transform active:scale-95"
                          >
                            done
                          </button>
                        </div>

                        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
                          <div className="relative shrink-0">
                            <SearchInputGlyph className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="search"
                              value={addSongQuery}
                              onChange={(e) => setAddSongQuery(e.target.value)}
                              placeholder="search any song or artist..."
                              className="w-full rounded-full bg-[#141418] border border-[#242429] pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                            />
                          </div>

                          <div className="rounded-2xl bg-[#141418] border border-[#242429] p-1.5 space-y-1 flex-1 min-h-0 overflow-y-auto no-scrollbar">
                            {liveAddLoading && addableTracksPool.length === 0 ? (
                              <div className="p-4 space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => (
                                  <div
                                    key={`add-skel-${i}`}
                                    className="flex items-center gap-3 animate-pulse"
                                  >
                                    <div className="w-10 h-10 rounded-lg bg-[#242429]" />
                                    <div className="flex-1 space-y-1.5">
                                      <div className="h-3 w-36 rounded bg-[#242429]" />
                                      <div className="h-2.5 w-24 rounded bg-[#242429]" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : addableTracksPool.length === 0 ? (
                              <div className="p-8 text-center text-xs font-bold text-[#A1A1AA]">
                                {addSongQuery.trim()
                                  ? `no songs matched “${addSongQuery.trim().toLowerCase()}”.`
                                  : 'browse or search songs online to build your library.'}
                              </div>
                            ) : (
                              addableTracksPool.map((track) => {
                                const included = activePlaylist.trackIds.includes(
                                  track.id
                                );
                                return (
                                  <button
                                    key={track.id}
                                    type="button"
                                    onClick={() =>
                                      handleToggleTrackInPlaylist(
                                        activePlaylist,
                                        track
                                      )
                                    }
                                    className="ather-depth-row rounded-xl w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                                  >
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-[#242429]">
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
                                      <div className="text-xs font-bold text-white truncate">
                                        {track.title.toLowerCase()}
                                      </div>
                                      <div className="text-[11px] text-[#A1A1AA] font-bold truncate">
                                        {track.artist.toLowerCase()} · {track.album.toLowerCase()}
                                      </div>
                                    </div>
                                    <span
                                      className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                                        included
                                          ? 'bg-white text-black border-white'
                                          : 'bg-[#141418] text-white border-[#242429]'
                                      }`}
                                    >
                                      {included ? (
                                        <CheckGlyph className="w-4 h-4" />
                                      ) : (
                                        <PlusGlyph className="w-4 h-4" />
                                      )}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </PopupSheet>
                    )}
                  </>
                );
              })()}
            </div>
          ) : isViewingLikedSongs ? (
            (() => {
              const totalLikedSeconds = likedTracks.reduce(
                (sum, t) => sum + t.duration,
                0
              );
              const isLikedPlaying = currentTrack
                ? likedTracks.some((t) => t.id === currentTrack.id)
                : false;

              return (
                <div className="space-y-6">
                  <section className="space-y-5">
                    <div className="relative ather-hero-bleed h-[320px] sm:h-[420px] overflow-hidden bg-[#000000] border-b border-[#242429]">
                      {likedTracks[0]?.coverUrl ? (
                        <ShowcaseArtwork
                          style={likedTracks[0].artwork}
                          coverUrl={likedTracks[0].coverUrl}
                          alt="liked songs"
                          className="w-full h-full opacity-55"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#141418] via-[#0D0D10] to-[#000000] flex items-center justify-center">
                          <HeartGlyph className="w-24 h-24 text-white/30" active={true} />
                        </div>
                      )}

                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/35 pointer-events-none"
                      />

                      <div className="absolute ather-hero-topbar z-20 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setSelectedPlaylistId(null)}
                          className="ather-depth-pill inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform"
                        >
                          <ChevronLeftGlyph className="w-4 h-4" />
                          <span>all playlists</span>
                        </button>
                      </div>

                      <div className="absolute inset-x-4 sm:inset-x-8 bottom-5 z-20 space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[#A1A1AA]">
                          <HeartGlyph className="w-3.5 h-3.5 text-white" active={true} />
                          <span>saved collection</span>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.05]">
                          liked songs
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums text-[#A1A1AA]">
                          <span>{displayName.toLowerCase()}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {likedTracks.length}{' '}
                            {likedTracks.length === 1 ? 'song' : 'songs'}
                          </span>
                          {totalLikedSeconds > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{formatDuration(totalLikedSeconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        aria-label="shuffle liked songs"
                        disabled={likedTracks.length === 0}
                        onClick={() =>
                          onShufflePlay(likedTracks.map((t) => t.id))
                        }
                        className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-40 transition-transform active:scale-90"
                      >
                        <ShuffleGlyph className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        aria-label={
                          isLikedPlaying && isPlaying
                            ? 'pause liked songs'
                            : 'play liked songs'
                        }
                        disabled={likedTracks.length === 0}
                        onClick={() => {
                          if (isLikedPlaying) onTogglePlay();
                          else if (likedTracks.length > 0) {
                            if (onSelectPlaylistTrack) {
                              onSelectPlaylistTrack(
                                likedTracks,
                                0,
                                'liked-songs'
                              );
                            } else {
                              onSelectTrack(likedTracks[0], true);
                            }
                          }
                        }}
                        className="ather-acid-btn w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-90 transition-transform"
                      >
                        {isLikedPlaying && isPlaying ? (
                          <PauseGlyph className="w-6 h-6" />
                        ) : (
                          <PlayGlyph className="w-6 h-6 translate-x-[1px]" />
                        )}
                      </button>
                    </div>
                  </section>

                  <section aria-label="liked songs list">
                    {likedTracks.length === 0 ? (
                      <div className="ather-depth-card rounded-3xl p-8 text-center space-y-2">
                        <p className="text-sm font-extrabold text-white">
                          no liked songs yet
                        </p>
                        <p className="text-xs text-[#A1A1AA] font-bold">
                          tap the heart icon on any song while listening to save it here.
                        </p>
                      </div>
                    ) : (
                      <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
                        {likedTracks.map((track, idx) =>
                          renderTrackRow(
                            track,
                            track.album,
                            <button
                              type="button"
                              aria-label={`remove ${track.title.toLowerCase()} from liked songs`}
                              onClick={() => onToggleFavorite(track.id)}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform active:scale-90 shrink-0"
                            >
                              <HeartGlyph className="w-4 h-4" active={true} />
                            </button>,
                            () => {
                              if (onSelectPlaylistTrack) {
                                onSelectPlaylistTrack(
                                  likedTracks,
                                  idx,
                                  'liked-songs'
                                );
                              } else {
                                onSelectTrack(track, true);
                              }
                            }
                          )
                        )}
                      </div>
                    )}
                  </section>
                </div>
              );
            })()
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#A1A1AA] font-bold tabular-nums">
                  {playlists.length}{' '}
                  {playlists.length === 1 ? 'playlist' : 'playlists'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewName('');
                    setNewDesc('');
                    setNewTrackIds([]);
                    setNewCoverArtwork(undefined);
                    setNewCoverImageUrl(undefined);
                    setCreatingPlaylist((c) => !c);
                  }}
                  className="ather-acid-btn inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
                >
                  {creatingPlaylist ? (
                    <>
                      <CloseGlyph className="w-3.5 h-3.5" />
                      <span>close</span>
                    </>
                  ) : (
                    <>
                      <PlusGlyph className="w-3.5 h-3.5" />
                      <span>new playlist</span>
                    </>
                  )}
                </button>
              </div>

              {creatingPlaylist && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const created = onCreatePlaylist(
                      newName.trim() || `custom mix #${playlists.length + 1}`,
                      newDesc.trim() || 'personal curated rotation',
                      newTrackIds,
                      {
                        coverArtwork: newCoverArtwork,
                        coverImageUrl: newCoverImageUrl,
                      }
                    );
                    setCreatingPlaylist(false);
                    handleOpenPlaylist(created);
                  }}
                  className="ather-depth-card rounded-3xl p-5 space-y-4"
                >
                  <div className="text-sm font-extrabold text-white">
                    make a new playlist
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#242429] shrink-0">
                      <PlaylistCover
                        coverImageUrl={newCoverImageUrl}
                        coverArtwork={newCoverArtwork}
                        fallbackArtwork={
                          findTrack(newTrackIds[0])?.artwork ?? 'lime-noir'
                        }
                        fallbackCoverUrl={findTrack(newTrackIds[0])?.coverUrl}
                        alt={(newName || 'new playlist cover').toLowerCase()}
                        compact={true}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="playlist name"
                        className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                      />
                      <input
                        type="text"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="optional description"
                        className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-3.5 py-2.5 text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                      />
                    </div>
                  </div>

                  {renderCoverPicker(
                    newCoverImageUrl,
                    newCoverArtwork,
                    createCoverInputRef,
                    (dataUrl) => {
                      setNewCoverImageUrl(dataUrl);
                      setNewCoverArtwork(undefined);
                    },
                    (style) => {
                      setNewCoverArtwork(style);
                      setNewCoverImageUrl(undefined);
                    },
                    () => {
                      setNewCoverImageUrl(undefined);
                      setNewCoverArtwork(undefined);
                    }
                  )}

                  {allTracks.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#A1A1AA]">
                        pick tracks ({newTrackIds.length} selected)
                      </span>
                      <div className="rounded-2xl bg-[#141418] border border-[#242429] p-1.5 space-y-1 max-h-52 overflow-y-auto no-scrollbar">
                        {allTracks.slice(0, 40).map((track) => {
                          const checked = newTrackIds.includes(track.id);
                          return (
                            <button
                              key={track.id}
                              type="button"
                              onClick={() =>
                                setNewTrackIds((prev) =>
                                  prev.includes(track.id)
                                    ? prev.filter((id) => id !== track.id)
                                    : [...prev, track.id]
                                )
                              }
                              className="ather-depth-row rounded-xl w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                            >
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-[#242429] shrink-0">
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
                                <div className="text-xs font-bold text-white truncate">
                                  {track.title.toLowerCase()}
                                </div>
                                <div className="text-[11px] text-[#A1A1AA] font-bold truncate">
                                  {track.artist.toLowerCase()}
                                </div>
                              </div>
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                                  checked
                                    ? 'bg-white text-black border-white'
                                    : 'bg-[#141418] text-[#A1A1AA] border-[#242429]'
                                }`}
                              >
                                {checked ? (
                                  <CheckGlyph className="w-3.5 h-3.5" />
                                ) : (
                                  <PlusGlyph className="w-3.5 h-3.5" />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatingPlaylist(false)}
                      className="ather-depth-pill px-4 py-2 rounded-full text-xs font-bold text-white"
                    >
                      cancel
                    </button>
                    <button
                      type="submit"
                      className="ather-acid-btn px-5 py-2 rounded-full text-xs font-extrabold"
                    >
                      create playlist
                    </button>
                  </div>
                </form>
              )}

              {/* Liked Songs */}
              <div
                className={`ather-depth-card rounded-3xl p-4 flex items-center gap-4 transition-colors ${
                  currentTrack && favoriteIds.has(currentTrack.id)
                    ? 'ring-1 ring-white border-white/60'
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPlaylistId('__liked__')}
                  className="flex items-center gap-4 min-w-0 flex-1 text-left"
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-white text-black flex items-center justify-center border border-[#242429]">
                    <HeartGlyph className="w-7 h-7" active={true} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-white truncate">
                        liked songs
                      </span>
                    </div>
                    <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                      {likedTracks.length}{' '}
                      {likedTracks.length === 1 ? 'song' : 'songs'} · saved favorites
                    </div>
                  </div>
                </button>

                {likedTracks.length > 0 && (
                  <button
                    type="button"
                    aria-label="play liked songs"
                    onClick={() => {
                      if (onSelectPlaylistTrack) {
                        onSelectPlaylistTrack(likedTracks, 0, 'liked-songs');
                      } else {
                        onSelectTrack(likedTracks[0], true);
                      }
                    }}
                    className="ather-acid-btn w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0"
                  >
                    <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                  </button>
                )}

                <button
                  type="button"
                  aria-label="open liked songs"
                  onClick={() => setSelectedPlaylistId('__liked__')}
                  className="ather-depth-btn w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <ChevronRightGlyph className="w-4 h-4" />
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="ather-depth-card rounded-3xl p-8 text-center text-xs text-[#A1A1AA] font-bold">
                  you don’t have any custom playlists yet. tap “new playlist” to build one, or tap “+” while browsing songs.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {playlists.map((pl) => {
                    const firstTrack = findTrack(pl.trackIds[0]);
                    const isPlPlaying = currentTrack
                      ? pl.trackIds.includes(currentTrack.id)
                      : false;

                    return (
                      <div
                        key={pl.id}
                        className={`group ather-depth-card rounded-3xl p-4 flex items-center gap-4 transition-colors ${
                          isPlPlaying ? 'ring-1 ring-white border-white/60' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenPlaylist(pl)}
                          className="flex items-center gap-4 min-w-0 flex-1 text-left"
                        >
                          <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-[#242429]">
                            <PlaylistCover
                              coverImageUrl={pl.coverImageUrl}
                              coverArtwork={pl.coverArtwork}
                              fallbackArtwork={
                                firstTrack?.artwork ?? 'lime-noir'
                              }
                              fallbackCoverUrl={firstTrack?.coverUrl}
                              alt={pl.name.toLowerCase()}
                              compact={true}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-extrabold text-white truncate">
                              {pl.name.toLowerCase()}
                            </div>
                            <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
                              {pl.trackIds.length}{' '}
                              {pl.trackIds.length === 1 ? 'song' : 'songs'} ·{' '}
                              {pl.updatedAt.toLowerCase()}
                            </div>
                            {pl.description && (
                              <div className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                                {pl.description.toLowerCase()}
                              </div>
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          aria-label={`edit ${pl.name.toLowerCase()}`}
                          onClick={() => handleOpenPlaylist(pl)}
                          className="ather-depth-btn w-10 h-10 rounded-full text-white flex items-center justify-center transition-colors shrink-0"
                        >
                          <ChevronRightGlyph className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: DOWNLOADS */}
      {subTab === 'downloads' && (
        <div className="space-y-6">
          {isOffline && (
            <div className="ather-depth-card rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-full bg-white text-black border border-white flex items-center justify-center shrink-0">
                  <WifiOffGlyph className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white">
                    offline mode active
                  </div>
                  <p className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                    switched automatically to your saved downloads.
                  </p>
                </div>
              </div>

              {downloadedTracks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onShufflePlay(downloadedTracks.map((t) => t.id))
                  }
                  className="ather-acid-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-all shrink-0"
                >
                  <ShuffleGlyph className="w-3.5 h-3.5" />
                  <span>play downloads</span>
                </button>
              )}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <DownloadGlyph className="w-4 h-4 text-white" />
                <span>saved offline ({downloadedTracks.length})</span>
              </h2>
              {!isOffline && downloadedTracks.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onShufflePlay(downloadedTracks.map((t) => t.id))
                  }
                  className="ather-depth-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white transition-colors"
                >
                  <ShuffleGlyph className="w-3.5 h-3.5" />
                  <span>shuffle</span>
                </button>
              )}
            </div>

            {downloadedTracks.length === 0 ? (
              <div className="ather-depth-card rounded-3xl p-7 text-center text-xs text-[#A1A1AA] font-bold">
                {isOffline
                  ? 'no songs are downloaded yet. reconnect to the internet to save tracks for offline playback.'
                  : 'no downloaded songs yet. save tracks below or from the player’s three-dots menu.'}
              </div>
            ) : (
              <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
                {downloadedTracks.map((track, idx) =>
                  renderTrackRow(
                    track,
                    'offline',
                    <button
                      type="button"
                      aria-label="remove download"
                      onClick={() => void onToggleDownload(track)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-[#141418] transition-colors shrink-0"
                    >
                      <CheckGlyph className="w-4 h-4" />
                    </button>,
                    () => {
                      if (onSelectDownloadTrack) {
                        onSelectDownloadTrack(downloadedTracks, idx);
                      } else {
                        onSelectTrack(track, true);
                      }
                    }
                  )
                )}
              </div>
            )}
          </section>

          {catalogToDownload.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-[#A1A1AA]">
                {isOffline
                  ? 'connect to internet to download more'
                  : 'available to download'}
              </h3>
              <div
                className={`ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden ${
                  isOffline ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {catalogToDownload.slice(0, 30).map((track) =>
                  renderTrackRow(
                    track,
                    track.album,
                    <button
                      type="button"
                      disabled={isOffline}
                      aria-label={`download ${track.title.toLowerCase()}`}
                      onClick={() => void onToggleDownload(track)}
                      className="ather-depth-btn w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors shrink-0"
                    >
                      <DownloadGlyph className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVITY */}
      {subTab === 'activity' && (
        <div className="space-y-5">
          {/* 1. Top 10 Most Streamed Artists */}
          <TopStreamedArtistsSection uid={uid} onSelectArtist={onOpenArtist} />

          {/* 2. Listening Activity (Minutes Listened & Streak) */}
          <section className="ather-depth-card rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold tracking-tight text-white">
                listening activity
              </h3>
              <span className="text-[11px] font-extrabold tracking-wider text-white">
                live stats
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="ather-depth-row rounded-2xl p-3.5">
                <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  {Math.round(activityStats.totalMinutesListened)}
                </div>
                <div className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">
                  minutes listened
                </div>
              </div>

              <div className="ather-depth-row rounded-2xl p-3.5">
                <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  {activityStats.streakDays}
                </div>
                <div className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">
                  {activityStats.streakDays === 1 ? 'day streak' : 'days streak'}
                </div>
              </div>

              <div className="ather-depth-row rounded-2xl p-3.5">
                <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  {Object.values(activityStats.songs || {}).reduce(
                    (acc, s) => acc + (s.playCount || 0),
                    0
                  )}
                </div>
                <div className="text-[11px] font-bold text-[#A1A1AA] mt-0.5">
                  full streams
                </div>
              </div>
            </div>
          </section>

          {/* 3. Top 5 Most Streamed Songs */}
          {(() => {
            const topSongs = getTop5StreamedSongs(activityStats);
            return (
              <section className="ather-depth-card rounded-3xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-extrabold tracking-tight text-white">
                    top 5 songs
                  </h3>
                  <span className="text-[11px] font-extrabold tracking-wider text-[#A1A1AA]">
                    most played
                  </span>
                </div>

                {topSongs.length === 0 ? (
                  <p className="text-xs font-bold text-[#A1A1AA] py-1">
                    stream songs for 25 seconds or more to populate your top 5 tracks.
                  </p>
                ) : (
                  <div className="flex flex-col space-y-1.5">
                    {topSongs.map((entry, idx) => {
                      const liveTrack =
                        (resolveTrack ? resolveTrack(entry.trackId) : undefined) ??
                        entry.track;
                      const active = currentTrack?.id === entry.trackId;
                      return (
                        <button
                          key={`${entry.trackId}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (liveTrack) {
                              onRegisterTracks?.([liveTrack]);
                              onSelectTrack(liveTrack, true);
                            }
                          }}
                          style={{
                            transition:
                              'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease',
                          }}
                          className={`ather-depth-row flex items-center gap-3.5 py-2.5 px-3 rounded-2xl text-left active:scale-[0.98] ${
                            active ? 'ring-1 ring-white border-white/60' : ''
                          }`}
                        >
                          <span
                            className={`w-5 text-center text-xs font-extrabold tabular-nums ${
                              active ? 'text-white' : 'text-[#A1A1AA]'
                            }`}
                          >
                            {idx + 1}
                          </span>

                          <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden border border-[#242429] bg-[#141418]">
                            <ShowcaseArtwork
                              style={liveTrack?.artwork ?? 'obsidian-grid'}
                              coverUrl={entry.coverUrl || entry.artwork || liveTrack?.coverUrl}
                              alt={entry.title.toLowerCase()}
                              compact={true}
                              className="w-full h-full"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-extrabold ${
                                active ? 'text-white' : 'text-[#E4E4E7]'
                              }`}
                            >
                              {entry.title.toLowerCase()}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-bold text-[#A1A1AA] tabular-nums">
                              {entry.artist.toLowerCase()} • {entry.playCount}{' '}
                              {entry.playCount === 1 ? 'stream' : 'streams'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}

      {/* TAB 4: FOLLOWED ARTISTS */}
      {subTab === 'artists' && (
        <div className="space-y-4">
          {followedArtists.length === 0 ? (
            <div className="ather-depth-card rounded-3xl p-8 text-center space-y-2">
              <div className="text-sm font-extrabold text-white">
                no followed artists yet
              </div>
              <p className="text-xs text-[#A1A1AA] font-bold">
                tap follow on any artist profile or select artists during onboarding to keep them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {followedArtists.map((artistName) => {
                const trackWithArtist = allTracks.find(
                  (t) =>
                    t.artist.toLowerCase().includes(artistName.toLowerCase()) &&
                    Boolean(t.coverUrl)
                );
                const photo = artistPhotos[artistName] || trackWithArtist?.coverUrl;

                return (
                  <div
                    key={artistName}
                    className="group ather-depth-card rounded-3xl p-4 flex flex-col items-center text-center gap-3 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenArtist(artistName)}
                      className="flex flex-col items-center gap-2.5 w-full active:scale-95 transition-transform"
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden border border-[#242429] group-hover:scale-105 transition-transform">
                        <ShowcaseArtwork
                          style={pickGradientArtwork(artistName)}
                          coverUrl={photo}
                          alt={artistName.toLowerCase()}
                          compact={true}
                          className="w-full h-full"
                        />
                      </div>
                      <span className="w-full text-sm font-extrabold text-white truncate">
                        {artistName.toLowerCase()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const res = toggleFollowedArtistInProfile(artistName);
                        if (!res.isFollowing) {
                          setFollowedArtists((prev) =>
                            prev.filter((a) => a !== artistName)
                          );
                        }
                      }}
                      className="ather-depth-pill px-3.5 py-1.5 rounded-full text-[11px] font-extrabold text-white transition-colors"
                    >
                      following
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

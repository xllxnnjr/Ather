import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckGlyph,
  ChevronLeftGlyph,
  ClockGlyph,
  CloseGlyph,
  MoreDotsGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
  SearchInputGlyph,
} from '../AppIcons';
import { MOOD_GENRE_TILES, formatDuration } from '../../data/showcaseCatalog';
import {
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  REMOTE_SYNC_APPLIED_EVENT,
  dispatchLocalAccountSyncNeeded,
  readAccountJson,
  touchSyncSection,
  writeAccountJson,
} from '../../services/accountStorage';
import {
  TopResultItem,
  fetchGenreArtworkMap,
  getTopSearchResultsProgressive,
} from '../../services/musicApi';
import {
  AlbumItem,
  SearchArtistResult,
  ShowcaseTrack,
  UserPlaylist,
} from '../../types/music';
import { PopupSheet } from '../PopupSheet';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';
import { TrackInfoModal } from '../TrackInfoModal';

type SearchFilterTab = 'all' | 'songs' | 'artists' | 'albums';

interface SearchScreenProps {
  currentTrack: ShowcaseTrack | null;
  isPlaying: boolean;
  isOffline?: boolean;
  allTracks?: ShowcaseTrack[];
  playlists: UserPlaylist[];
  favoriteIds: Set<string>;
  downloadedIds: Set<string>;
  onRegisterTracks?: (tracks: ShowcaseTrack[]) => void;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean,
    seekTo?: number
  ) => void;
  onTogglePlay: () => void;
  onOpenArtist: (artistName: string) => void;
  onOpenAlbum?: (album: AlbumItem) => void;
  onRecordSearch?: (term: string, topHit?: ShowcaseTrack) => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: ShowcaseTrack) => void;
  onAddToQueue: (trackId: string) => void;
  onAddTrackToPlaylist: (
    playlistId: string,
    track: ShowcaseTrack
  ) => void | Promise<void>;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  currentTrack,
  isPlaying,
  isOffline = false,
  allTracks = [],
  playlists,
  favoriteIds,
  downloadedIds,
  onRegisterTracks,
  onSelectTrack,
  onTogglePlay,
  onOpenArtist,
  onOpenAlbum,
  onRecordSearch,
  onToggleFavorite,
  onToggleDownload,
  onAddToQueue,
  onAddTrackToPlaylist,
}) => {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<SearchFilterTab>('all');
  const [topResult, setTopResult] = useState<TopResultItem | null>(null);
  const [results, setResults] = useState<ShowcaseTrack[]>([]);
  const [artistResults, setArtistResults] = useState<SearchArtistResult[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumItem[]>([]);
  const [genreCovers, setGenreCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoTrack, setInfoTrack] = useState<ShowcaseTrack | null>(null);
  const [playlistPickerTrack, setPlaylistPickerTrack] =
    useState<ShowcaseTrack | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [resolvingAddId, setResolvingAddId] = useState<string | null>(null);

  useEffect(() => {
    if (isOffline) return;
    let cancelled = false;
    fetchGenreArtworkMap(MOOD_GENRE_TILES.map((t) => t.searchQuery))
      .then((map) => {
        if (!cancelled) setGenreCovers(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOffline]);

  const loadAccountRecentSearches = useCallback((): string[] => {
    const parsed = readAccountJson<unknown[]>('recentSearches', []);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 8)
      : [];
  }, []);

  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadAccountRecentSearches()
  );

  useEffect(() => {
    const syncRecent = () => setRecentSearches(loadAccountRecentSearches());
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, syncRecent);
    window.addEventListener(REMOTE_SYNC_APPLIED_EVENT, syncRecent);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, syncRecent);
      window.removeEventListener(REMOTE_SYNC_APPLIED_EVENT, syncRecent);
    };
  }, [loadAccountRecentSearches]);

  const requestSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [
        clean,
        ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 8);
      writeAccountJson('recentSearches', next);
      touchSyncSection('history');
      dispatchLocalAccountSyncNeeded();
      return next;
    });
  }, []);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    writeAccountJson('recentSearches', []);
    touchSyncSection('history');
    dispatchLocalAccountSyncNeeded();
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== term);
      writeAccountJson('recentSearches', next);
      touchSyncSection('history');
      dispatchLocalAccountSyncNeeded();
      return next;
    });
  };

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const runSearch = useCallback(
    async (term: string, recordTerm = false) => {
      const trimmed = term.trim();
      if (!trimmed) {
        searchAbortRef.current?.abort();
        setTopResult(null);
        setResults([]);
        setArtistResults([]);
        setAlbumResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (recordTerm) {
        saveRecentSearch(trimmed);
      }

      if (isOffline) {
        const lower = trimmed.toLowerCase();
        const offlineMatches = allTracks.filter(
          (t) =>
            downloadedIds.has(t.id) &&
            (t.title.toLowerCase().includes(lower) ||
              t.artist.toLowerCase().includes(lower) ||
              t.album.toLowerCase().includes(lower) ||
              t.category.toLowerCase().includes(lower))
        );
        setTopResult(
          offlineMatches[0]
            ? { type: 'song', score: 100, data: offlineMatches[0] }
            : null
        );
        setResults(offlineMatches);
        setArtistResults([]);
        setAlbumResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      const seq = ++requestSeqRef.current;
      setLoading(true);
      setError(null);

      try {
        const bundle = await getTopSearchResultsProgressive(
          trimmed,
          (partialBundle) => {
            if (seq !== requestSeqRef.current || controller.signal.aborted) return;
            setTopResult(partialBundle.topResult);
            setResults(partialBundle.songs);
            setArtistResults(partialBundle.artists);
            setAlbumResults(partialBundle.albums);
            if (partialBundle.songs.length > 0 && onRegisterTracks) {
              onRegisterTracks(partialBundle.songs);
            }
          },
          controller.signal
        );

        if (seq !== requestSeqRef.current || controller.signal.aborted) return;

        setTopResult(bundle.topResult);
        setResults(bundle.songs);
        setArtistResults(bundle.artists);
        setAlbumResults(bundle.albums);

        if (bundle.songs.length > 0 && onRegisterTracks) {
          onRegisterTracks(bundle.songs);
        }
        if (recordTerm) {
          onRecordSearch?.(trimmed, bundle.songs[0]);
        }
      } catch (err) {
        if (seq !== requestSeqRef.current || controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load search results.'
        );
      } finally {
        if (seq === requestSeqRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [allTracks, downloadedIds, isOffline, onRecordSearch, onRegisterTracks, saveRecentSearch]
  );

  // 180ms debounced instant progressive live search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (!selectedGenre) {
        searchAbortRef.current?.abort();
        setTopResult(null);
        setResults([]);
        setArtistResults([]);
        setAlbumResults([]);
        setError(null);
        setLoading(false);
      }
      return;
    }

    setSelectedGenre(null);
    const timer = window.setTimeout(() => {
      void runSearch(trimmed, false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, selectedGenre, runSearch]);

  const handleSelectGenreTile = (tileTitle: string, searchQuery: string) => {
    setQuery('');
    setSelectedGenre(tileTitle);
    setFilterTab('all');
    void runSearch(searchQuery, false);
  };

  const handleClearAll = () => {
    requestSeqRef.current += 1;
    searchAbortRef.current?.abort();
    setQuery('');
    setSelectedGenre(null);
    setFilterTab('all');
    setTopResult(null);
    setResults([]);
    setArtistResults([]);
    setAlbumResults([]);
    setError(null);
    setLoading(false);
  };

  const activeTerm = query.trim() || selectedGenre || '';
  const showingResults = Boolean(activeTerm);
  const totalCount =
    results.length + artistResults.length + albumResults.length;

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="bg-[#111114] border border-white/25 rounded-full pl-5 pr-3 py-2.5 flex items-center gap-2.5 focus-within:border-white transition-colors shadow-lg">
        <SearchInputGlyph className="w-4 h-4 text-white/75 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              void runSearch(query, true);
            }
          }}
          placeholder="Search for a song, artist, or genre"
          aria-label="Search for a song"
          className="w-full bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-white/55 focus:outline-none py-1"
        />

        {showingResults && (
          <button
            type="button"
            onClick={handleClearAll}
            aria-label="Clear search"
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <CloseGlyph className="w-4 h-4" />
          </button>
        )}
      </div>

      {showingResults ? (
        <section aria-label="Search Results" className="space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedGenre && !query.trim() && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    aria-label="Back to Mood & Genres"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141416] border border-white/15 text-xs font-bold text-white hover:border-white/35 active:scale-95 transition-all shrink-0"
                  >
                    <ChevronLeftGlyph className="w-3.5 h-3.5" />
                    <span>Mood &amp; Genres</span>
                  </button>
                )}
                <div className="text-xs font-semibold text-white/65 truncate">
                  {loading && totalCount > 0
                    ? `${totalCount} ${totalCount === 1 ? 'result' : 'results'} · Updating...`
                    : loading
                    ? `Searching for “${activeTerm}”...`
                    : `${totalCount} ${totalCount === 1 ? 'result' : 'results'} for “${activeTerm}”`}
                </div>
              </div>
            </div>

            {/* Clean Filter Chips: All | Songs | Artists | Albums */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'songs', label: `Songs (${results.length})` },
                  { id: 'artists', label: `Artists (${artistResults.length})` },
                  { id: 'albums', label: `Albums (${albumResults.length})` },
                ] as const
              ).map((chip) => {
                const active = filterTab === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilterTab(chip.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                      active
                        ? 'bg-white text-black'
                        : 'bg-[#141416] text-white/75 hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading && totalCount === 0 ? (
            <div className="rounded-3xl bg-[#0E0E10] border border-white/12 divide-y divide-white/[0.08] overflow-hidden">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3.5 px-4 py-3.5 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/[0.08] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 rounded bg-white/[0.1]" />
                    <div className="h-3 w-1/4 rounded bg-white/[0.06]" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/[0.08] shrink-0" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-[#0E0E10] border border-white/15 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">
                  Search unavailable
                </div>
                <p className="text-xs text-white/60">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void runSearch(activeTerm, false)}
                className="self-start sm:self-auto px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 shrink-0"
              >
                Retry
              </button>
            </div>
          ) : totalCount === 0 ? (
            <div className="rounded-3xl bg-[#0E0E10] border border-white/12 p-8 text-center text-sm text-white/60">
              No songs, artists, or albums found for “{activeTerm}”.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Result Card (Ranked Highest Confidence Match) */}
              {filterTab === 'all' && topResult && (
                <div className="space-y-3">
                  <h2 className="text-sm font-extrabold text-white tracking-tight">
                    Top Result
                  </h2>

                  {topResult.type === 'artist' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (query.trim()) saveRecentSearch(query.trim());
                        onOpenArtist(topResult.data.name);
                      }}
                      className="w-full rounded-2xl bg-[#111114] border border-white/25 p-4 flex items-center justify-between gap-4 text-left hover:border-white/45 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0">
                          <ShowcaseArtwork
                            style={topResult.data.artwork}
                            coverUrl={topResult.data.photoUrl}
                            alt={topResult.data.name}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="text-base sm:text-lg font-black text-white truncate">
                            {topResult.data.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-white/75">
                            <span className="px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-extrabold uppercase tracking-wider">
                              Artist
                            </span>
                            {topResult.data.genre && (
                              <span className="truncate">{topResult.data.genre}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="px-3.5 py-1.5 rounded-full bg-white/15 text-xs font-extrabold text-white shrink-0">
                        Open
                      </span>
                    </button>
                  ) : topResult.type === 'album' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (query.trim()) saveRecentSearch(query.trim());
                        onOpenAlbum?.(topResult.data);
                      }}
                      className="w-full rounded-2xl bg-[#111114] border border-white/25 p-4 flex items-center justify-between gap-4 text-left hover:border-white/45 active:scale-[0.99] transition-all"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-white/20">
                          <ShowcaseArtwork
                            style={topResult.data.artwork}
                            coverUrl={topResult.data.coverUrl}
                            alt={topResult.data.title}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="text-base sm:text-lg font-black text-white truncate">
                            {topResult.data.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold text-white/75">
                            <span className="px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                              Album
                            </span>
                            <span className="truncate">
                              {topResult.data.artist}
                              {topResult.data.year ? ` · ${topResult.data.year}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="px-3.5 py-1.5 rounded-full bg-white/15 text-xs font-extrabold text-white shrink-0">
                        View
                      </span>
                    </button>
                  ) : (
                    (() => {
                      const topTrack = topResult.data;
                      const isCurrent = currentTrack?.id === topTrack.id;
                      return (
                        <div
                          className="w-full rounded-2xl bg-[#111114] border border-white/25 p-4 flex items-center justify-between gap-4 hover:border-white/45 transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (query.trim()) saveRecentSearch(query.trim());
                              onRecordSearch?.(activeTerm, topTrack);
                              onSelectTrack(topTrack, true);
                            }}
                            className="flex items-center gap-4 min-w-0 flex-1 text-left"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-white/12">
                              <ShowcaseArtwork
                                style={topTrack.artwork}
                                coverUrl={topTrack.coverUrl}
                                alt={topTrack.title}
                                compact={true}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="text-base sm:text-lg font-black text-white truncate">
                                {topTrack.title}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-white/60">
                                <span className="px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                                  Song
                                </span>
                                <span className="truncate">
                                  {topTrack.artist} · {formatDuration(topTrack.duration)}
                                </span>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
                            onClick={() => {
                              if (query.trim()) saveRecentSearch(query.trim());
                              if (isCurrent) onTogglePlay();
                              else {
                                onRecordSearch?.(activeTerm, topTrack);
                                onSelectTrack(topTrack, true);
                              }
                            }}
                            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.28)] hover:bg-white/90 active:scale-90 transition-all shrink-0"
                          >
                            {isCurrent && isPlaying ? (
                              <PauseGlyph className="w-5 h-5" />
                            ) : (
                              <PlayGlyph className="w-5 h-5 translate-x-[0.5px]" />
                            )}
                          </button>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Songs List (prioritized right after Top Result in All tab or under Songs filter) */}
              {(filterTab === 'all' || filterTab === 'songs') &&
                results.length > 0 && (
                  <div className="space-y-3">
                    {filterTab === 'all' && (
                      <h2 className="text-sm font-extrabold text-white tracking-tight">
                        Songs
                      </h2>
                    )}
                    <div className="rounded-3xl bg-[#141416] border border-white/12 divide-y divide-white/[0.08] overflow-hidden">
                      {(filterTab === 'all' ? results.slice(0, 6) : results).map((track) => {
                        const isCurrent = currentTrack?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.06] transition-colors ${
                              isCurrent ? 'bg-white/[0.08]' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (query.trim()) saveRecentSearch(query.trim());
                                onRecordSearch?.(activeTerm, track);
                                onSelectTrack(track, true);
                              }}
                              className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10"
                              aria-label={`Play ${track.title}`}
                            >
                              <ShowcaseArtwork
                                style={track.artwork}
                                coverUrl={track.coverUrl}
                                alt={track.title}
                                compact={true}
                                className="w-full h-full"
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (query.trim()) saveRecentSearch(query.trim());
                                  onRecordSearch?.(activeTerm, track);
                                  onSelectTrack(track, true);
                                }}
                                className={`block max-w-full text-sm font-bold truncate text-left ${
                                  isCurrent ? 'text-white' : 'text-white/95'
                                }`}
                              >
                                {track.title}
                              </button>
                              <div className="flex items-center gap-1.5 text-xs text-white/55 truncate mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenArtist(track.artist)}
                                  className="hover:text-white hover:underline truncate transition-colors"
                                >
                                  {track.artist}
                                </button>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{track.album}</span>
                              </div>
                            </div>

                            <span className="hidden sm:inline text-xs tabular-nums text-white/50 shrink-0">
                              {formatDuration(track.duration)}
                            </span>

                            <button
                              type="button"
                              aria-label={`Song info and options for ${track.title}`}
                              onClick={() => setInfoTrack(track)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            >
                              <MoreDotsGlyph className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (query.trim()) saveRecentSearch(query.trim());
                                if (isCurrent) onTogglePlay();
                                else {
                                  onRecordSearch?.(activeTerm, track);
                                  onSelectTrack(track, true);
                                }
                              }}
                              aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isCurrent
                                  ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.28)]'
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
                  </div>
                )}

              {/* Artists Strip (strictly borderless circular portraits) */}
              {(filterTab === 'all' || filterTab === 'artists') &&
                artistResults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-extrabold text-white tracking-tight">
                      Artists
                    </h2>
                    <div
                      className={
                        filterTab === 'artists'
                          ? 'grid grid-cols-2 sm:grid-cols-4 gap-4'
                          : 'flex gap-4 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0'
                      }
                    >
                      {artistResults.map((artist) => (
                        <button
                          key={artist.id}
                          type="button"
                          onClick={() => {
                            if (query.trim()) saveRecentSearch(query.trim());
                            onOpenArtist(artist.name);
                          }}
                          className={`group flex flex-col items-center text-center transition-transform active:scale-95 ${
                            filterTab === 'artists'
                              ? 'w-full rounded-2xl bg-[#141416] border border-white/12 p-4 hover:border-white/35'
                              : 'shrink-0 w-[96px] sm:w-[108px]'
                          }`}
                        >
                          <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full overflow-hidden group-hover:scale-105 transition-transform">
                            <ShowcaseArtwork
                              style={artist.artwork}
                              coverUrl={artist.photoUrl}
                              alt={artist.name}
                              compact={true}
                              className="w-full h-full"
                            />
                          </div>
                          <span className="mt-2.5 w-full text-[13px] font-bold text-white truncate">
                            {artist.name}
                          </span>
                          <span className="mt-0.5 w-full text-[11px] text-white/50 truncate">
                            {artist.genre || 'Artist'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Albums Shelf */}
              {(filterTab === 'all' || filterTab === 'albums') &&
                albumResults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-extrabold text-white tracking-tight">
                      Albums
                    </h2>
                    <div
                      className={
                        filterTab === 'albums'
                          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                          : 'flex gap-3.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0'
                      }
                    >
                      {albumResults.map((album) => (
                        <button
                          key={album.id}
                          type="button"
                          onClick={() => {
                            if (query.trim()) saveRecentSearch(query.trim());
                            onOpenAlbum?.(album);
                          }}
                          className={`group text-left transition-transform active:scale-[0.98] ${
                            filterTab === 'albums'
                              ? 'w-full'
                              : 'shrink-0 w-[138px] sm:w-[156px]'
                          }`}
                        >
                          <div className="w-full aspect-square rounded-xl overflow-hidden border border-white/12 group-hover:border-white/35 transition-colors">
                            <ShowcaseArtwork
                              style={album.artwork}
                              coverUrl={album.coverUrl}
                              alt={album.title}
                              compact={true}
                              className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="mt-2 text-xs sm:text-sm font-bold text-white truncate">
                            {album.title}
                          </div>
                          <div className="text-[11px] text-white/55 truncate mt-0.5">
                            {album.artist}
                            {album.year ? ` · ${album.year}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {/* Minimal Horizontal Recent Searches */}
          {recentSearches.length > 0 && (
            <section aria-label="Recent Searches" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-white/75 flex items-center gap-1.5">
                  <ClockGlyph className="w-3.5 h-3.5 text-white/70" />
                  <span>Recent</span>
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[11px] font-bold text-white/70 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#111114] border border-white/25 hover:border-white/45 pl-3.5 pr-1.5 py-1.5 text-xs font-bold text-white transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        void runSearch(term, true);
                      }}
                      className="hover:text-white whitespace-nowrap max-w-[160px] truncate"
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${term} from recent searches`}
                      onClick={() => removeRecentSearch(term)}
                      className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white shrink-0 transition-colors"
                    >
                      <CloseGlyph className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Interactive Mood & Genres Grid with Real Artist/Album Artwork */}
          <section aria-label="Mood & Genres" className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Mood &amp; Genres
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
              {MOOD_GENRE_TILES.map((tile) => {
                const liveCover = genreCovers[tile.searchQuery];
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleSelectGenreTile(tile.title, tile.searchQuery)}
                    className="group relative h-[112px] sm:h-[128px] rounded-2xl p-4 overflow-hidden text-left border border-white/12 shadow-lg hover:border-white/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${tile.gradientFrom} 0%, ${tile.gradientTo} 100%)`,
                    }}
                  >
                    <span className="relative z-10 text-base sm:text-lg font-extrabold text-white leading-tight block max-w-[65%]">
                      {tile.title}
                    </span>

                    <div className="absolute -bottom-3 -right-2 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden rotate-[14deg] shadow-2xl border border-white/20 transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-105 pointer-events-none">
                      <ShowcaseArtwork
                        style={tile.artwork}
                        coverUrl={liveCover}
                        alt={tile.title}
                        compact={true}
                        className="w-full h-full"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Live MusicBrainz Track & Artist Info Modal */}
      <TrackInfoModal
        track={infoTrack}
        onClose={() => setInfoTrack(null)}
        isFavorite={infoTrack ? favoriteIds.has(infoTrack.id) : false}
        isDownloaded={infoTrack ? downloadedIds.has(infoTrack.id) : false}
        onPlayFullTrack={(track) => onSelectTrack(track, true)}
        onToggleFavorite={onToggleFavorite}
        onToggleDownload={onToggleDownload}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={(track) => {
          setAddedMsg(null);
          setPlaylistPickerTrack(track);
        }}
        onOpenArtist={onOpenArtist}
      />

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
                <p className="text-xs text-white/55 truncate mt-0.5">
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
              <p className="text-xs text-white/55 py-8 text-center">
                No playlists yet. Create one under Library → Playlists first.
              </p>
            ) : (
              <div className="space-y-2">
                {playlists.map((pl) => {
                  const alreadyIn = pl.trackIds.includes(playlistPickerTrack.id);
                  const firstTrack = allTracks.find(
                    (t) => t.id === pl.trackIds[0]
                  );
                  const busy = resolvingAddId === pl.id;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (alreadyIn) return;
                        setResolvingAddId(pl.id);
                        try {
                          await onAddTrackToPlaylist(pl.id, playlistPickerTrack);
                          setAddedMsg(
                            `Added “${playlistPickerTrack.title}” to ${pl.name}`
                          );
                        } finally {
                          setResolvingAddId(null);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-black/75 border border-white/12 hover:border-white/35 text-left transition-colors"
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
                          <div className="text-xs text-white/55 tabular-nums">
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
    </div>
  );
};

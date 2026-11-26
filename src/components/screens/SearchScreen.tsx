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
import portraitSinger from '../../assets/images/login_portrait_singer_1795680683171.jpg';
import portraitProducer from '../../assets/images/login_portrait_producer_1795680684778.jpg';
import portraitGuitarist from '../../assets/images/login_portrait_guitarist_1795680684411.jpg';
import portraitListener from '../../assets/images/login_portrait_listener_1795680685672.jpg';
import { PopupSheet } from '../PopupSheet';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';
import { TrackInfoModal } from '../TrackInfoModal';

const GENRE_PORTRAIT_FALLBACKS = [
  portraitSinger,
  portraitProducer,
  portraitGuitarist,
  portraitListener,
];

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
      <div className="ather-depth-pill rounded-full pl-5 pr-3 py-2.5 flex items-center gap-2.5 focus-within:border-white transition-colors">
        <SearchInputGlyph className="w-4 h-4 text-white shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              void runSearch(query, true);
            }
          }}
          placeholder="artists, songs, lyrics, and more"
          aria-label="search for a song"
          className="w-full bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none py-1"
        />

        {showingResults && (
          <button
            type="button"
            onClick={handleClearAll}
            aria-label="clear search"
            className="ather-depth-btn w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors shrink-0"
          >
            <CloseGlyph className="w-4 h-4" />
          </button>
        )}
      </div>

      {showingResults ? (
        <section aria-label="search results" className="space-y-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedGenre && !query.trim() && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    aria-label="back to mood & genres"
                    className="ather-depth-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform shrink-0"
                  >
                    <ChevronLeftGlyph className="w-3.5 h-3.5" />
                    <span>mood &amp; genres</span>
                  </button>
                )}
                <div className="text-xs font-bold text-[#A1A1AA] truncate">
                  {loading && totalCount > 0
                    ? `${totalCount} ${totalCount === 1 ? 'result' : 'results'} · updating...`
                    : loading
                    ? `searching for “${activeTerm.toLowerCase()}”...`
                    : `${totalCount} ${totalCount === 1 ? 'result' : 'results'} for “${activeTerm.toLowerCase()}”`}
                </div>
              </div>
            </div>

            {/* Clean Filter Chips: All | Songs | Artists | Albums */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {(
                [
                  { id: 'all', label: 'all' },
                  { id: 'songs', label: `songs (${results.length})` },
                  { id: 'artists', label: `artists (${artistResults.length})` },
                  { id: 'albums', label: `albums (${albumResults.length})` },
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
                        ? 'bg-white text-black border border-white'
                        : 'ather-depth-pill text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading && totalCount === 0 ? (
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-3 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#141418] border border-[#242429] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/5 rounded bg-[#141418]" />
                    <div className="h-3 w-1/4 rounded bg-[#141418]" />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#141418] shrink-0" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="ather-depth-card rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-extrabold text-white">
                  search unavailable
                </div>
                <p className="text-xs font-bold text-[#A1A1AA]">{error.toLowerCase()}</p>
              </div>
              <button
                type="button"
                onClick={() => void runSearch(activeTerm, false)}
                className="ather-acid-btn self-start sm:self-auto px-4 py-2 rounded-full text-xs font-extrabold shrink-0"
              >
                retry
              </button>
            </div>
          ) : totalCount === 0 ? (
            <div className="ather-depth-card rounded-3xl p-8 text-center text-sm font-bold text-[#A1A1AA]">
              no songs, artists, or albums found for “{activeTerm.toLowerCase()}”.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Result Card (Ranked Highest Confidence Match) */}
              {filterTab === 'all' && topResult && (
                <div className="space-y-3">
                  <h2 className="text-sm font-extrabold text-white tracking-tight">
                    top result
                  </h2>

                  {topResult.type === 'artist' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (query.trim()) saveRecentSearch(query.trim());
                        onOpenArtist(topResult.data.name);
                      }}
                      className="ather-depth-card w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left hover:border-white active:scale-[0.99] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-[#242429] shrink-0">
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
                            {topResult.data.name.toLowerCase()}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#A1A1AA]">
                            <span className="text-white font-extrabold">artist</span>
                            {topResult.data.genre && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{topResult.data.genre.toLowerCase()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="ather-depth-pill px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white shrink-0">
                        open
                      </span>
                    </button>
                  ) : topResult.type === 'album' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (query.trim()) saveRecentSearch(query.trim());
                        onOpenAlbum?.(topResult.data);
                      }}
                      className="ather-depth-card w-full rounded-2xl p-4 flex items-center justify-between gap-4 text-left hover:border-white active:scale-[0.99] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 border-black">
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
                            {topResult.data.title.toLowerCase()}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#A1A1AA]">
                            <span className="text-white font-extrabold shrink-0">album</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">
                              {topResult.data.artist.toLowerCase()}
                              {topResult.data.year ? ` · ${topResult.data.year}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="ather-depth-pill px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white shrink-0">
                        view
                      </span>
                    </button>
                  ) : (
                    (() => {
                      const topTrack = topResult.data;
                      const isCurrent = currentTrack?.id === topTrack.id;
                      return (
                        <div
                          className={`ather-depth-card w-full rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors ${
                            isCurrent ? 'border-white' : ''
                          }`}
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
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-[#242429]">
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
                                {topTrack.title.toLowerCase()}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[#A1A1AA]">
                                <span className="text-white font-extrabold shrink-0">song</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">
                                  {topTrack.artist.toLowerCase()} · {formatDuration(topTrack.duration)}
                                </span>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            aria-label={isCurrent && isPlaying ? 'pause' : 'play'}
                            onClick={() => {
                              if (query.trim()) saveRecentSearch(query.trim());
                              if (isCurrent) onTogglePlay();
                              else {
                                onRecordSearch?.(activeTerm, topTrack);
                                onSelectTrack(topTrack, true);
                              }
                            }}
                            className="ather-acid-btn w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform shrink-0"
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

              {/* Songs List */}
              {(filterTab === 'all' || filterTab === 'songs') &&
                results.length > 0 && (
                  <div className="space-y-3">
                    {filterTab === 'all' && (
                      <h2 className="text-sm font-extrabold text-white tracking-tight">
                        songs
                      </h2>
                    )}
                    <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
                      {(filterTab === 'all' ? results.slice(0, 6) : results).map((track) => {
                        const isCurrent = currentTrack?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            className={`ather-depth-row rounded-2xl w-full flex items-center gap-3 px-3.5 py-3 transition-colors ${
                              isCurrent ? 'ring-2 ring-white' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (query.trim()) saveRecentSearch(query.trim());
                                onRecordSearch?.(activeTerm, track);
                                onSelectTrack(track, true);
                              }}
                              className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#242429]"
                              aria-label={`play ${track.title.toLowerCase()}`}
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
                                  isCurrent ? 'text-white' : 'text-[#E4E4E7]'
                                }`}
                              >
                                {track.title.toLowerCase()}
                              </button>
                              <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] truncate mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenArtist(track.artist)}
                                  className="hover:text-white hover:underline truncate transition-colors"
                                >
                                  {track.artist.toLowerCase()}
                                </button>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{track.album.toLowerCase()}</span>
                              </div>
                            </div>

                            <span className="hidden sm:inline text-xs tabular-nums text-[#A1A1AA] shrink-0">
                              {formatDuration(track.duration)}
                            </span>

                            <button
                              type="button"
                              aria-label={`song info and options for ${track.title.toLowerCase()}`}
                              onClick={() => setInfoTrack(track)}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors shrink-0"
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
                              aria-label={isCurrent && isPlaying ? 'pause' : 'play'}
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
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
                  </div>
                )}

              {/* Artists Strip */}
              {(filterTab === 'all' || filterTab === 'artists') &&
                artistResults.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-extrabold text-white tracking-tight">
                      artists
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
                              ? 'ather-depth-card w-full rounded-2xl p-4 hover:border-white'
                              : 'shrink-0 w-[96px] sm:w-[108px]'
                          }`}
                        >
                          <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full overflow-hidden border border-[#242429] group-hover:border-white group-hover:scale-105 transition-all">
                            <ShowcaseArtwork
                              style={artist.artwork}
                              coverUrl={artist.photoUrl}
                              alt={artist.name}
                              compact={true}
                              className="w-full h-full"
                            />
                          </div>
                          <span className="mt-2.5 w-full text-[13px] font-bold text-white truncate">
                            {artist.name.toLowerCase()}
                          </span>
                          <span className="mt-0.5 w-full text-[11px] font-bold text-[#A1A1AA] truncate">
                            {(artist.genre || 'artist').toLowerCase()}
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
                      albums
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
                          <div className="w-full aspect-square rounded-xl overflow-hidden border border-[#242429] group-hover:border-white transition-colors">
                            <ShowcaseArtwork
                              style={album.artwork}
                              coverUrl={album.coverUrl}
                              alt={album.title}
                              compact={true}
                              className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="mt-2 text-xs sm:text-sm font-bold text-white truncate">
                            {album.title.toLowerCase()}
                          </div>
                          <div className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                            {album.artist.toLowerCase()}
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
            <section aria-label="recent searches" className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-extrabold tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                  <ClockGlyph className="w-3.5 h-3.5 text-white" />
                  <span>recent</span>
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[11px] font-extrabold text-white hover:opacity-80 transition-opacity"
                >
                  clear
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="ather-depth-pill shrink-0 inline-flex items-center gap-1 rounded-full pl-3.5 pr-1.5 py-1.5 text-xs font-bold text-white transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        void runSearch(term, true);
                      }}
                      className="hover:opacity-80 whitespace-nowrap max-w-[160px] truncate"
                    >
                      {term.toLowerCase()}
                    </button>
                    <button
                      type="button"
                      aria-label={`remove ${term.toLowerCase()} from recent searches`}
                      onClick={() => removeRecentSearch(term)}
                      className="w-5 h-5 rounded-full hover:bg-black flex items-center justify-center text-[#A1A1AA] hover:text-white shrink-0 transition-colors"
                    >
                      <CloseGlyph className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Full-Bleed B&W Portrait Mood & Genres Grid */}
          <section aria-label="mood & genres" className="space-y-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              mood &amp; genres
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
              {MOOD_GENRE_TILES.map((tile, idx) => {
                const liveCover = genreCovers[tile.searchQuery];
                const fallbackPortrait =
                  GENRE_PORTRAIT_FALLBACKS[idx % GENRE_PORTRAIT_FALLBACKS.length];
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleSelectGenreTile(tile.title, tile.searchQuery)}
                    className="group relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-[#242429] hover:border-white bg-[#0D0D10] text-left active:scale-[0.98] transition-all"
                  >
                    <img
                      src={liveCover || fallbackPortrait}
                      alt={tile.title.toLowerCase()}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === '1') return;
                        img.dataset.fallbackApplied = '1';
                        img.src = fallbackPortrait;
                      }}
                      className="absolute inset-0 w-full h-full object-cover object-top grayscale contrast-110 transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none"
                    />
                    <span className="absolute left-3.5 right-3 bottom-3 z-10 text-base sm:text-lg font-black text-white leading-tight truncate">
                      {tile.title.toLowerCase()}
                    </span>
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
          ariaLabel="add to playlist"
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[82dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b-2 border-black shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-black shrink-0">
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
                  add to playlist
                </h2>
                <p className="text-xs font-bold text-[#A1A1AA] truncate mt-0.5">
                  {playlistPickerTrack.title.toLowerCase()} · {playlistPickerTrack.artist.toLowerCase()}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={() => setPlaylistPickerTrack(null)}
              className="ather-depth-btn w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {addedMsg && (
              <div className="ather-acid-btn rounded-2xl px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2">
                <CheckGlyph className="w-4 h-4 shrink-0" />
                <span className="truncate">{addedMsg.toLowerCase()}</span>
              </div>
            )}

            {playlists.length === 0 ? (
              <p className="text-xs font-bold text-[#A1A1AA] py-8 text-center">
                no playlists yet. create one under library → playlists first.
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
                            `added “${playlistPickerTrack.title}” to ${pl.name}`
                          );
                        } finally {
                          setResolvingAddId(null);
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
                            alt={pl.name}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {pl.name.toLowerCase()}
                          </div>
                          <div className="text-xs text-[#A1A1AA] tabular-nums">
                            {pl.trackIds.length}{' '}
                            {pl.trackIds.length === 1 ? 'song' : 'songs'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          alreadyIn
                            ? 'ather-acid-btn'
                            : 'ather-depth-btn text-white'
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

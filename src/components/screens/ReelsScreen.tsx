import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CardSwitcherGlyph,
  CheckGlyph,
  CloseGlyph,
  DownloadGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
} from '../AppIcons';
import {
  markReelsSeen,
  recordTrackInteraction,
} from '../../services/tasteProfile';
import { ShowcaseTrack, UserPlaylist } from '../../types/music';
import { PopupSheet } from '../PopupSheet';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';

interface ReelsScreenProps {
  playlists: UserPlaylist[];
  allTracks?: ShowcaseTrack[];
  reelsTracks?: ShowcaseTrack[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  downloadedIds: Set<string>;
  feedLoading?: boolean;
  refreshingReels?: boolean;
  onRefreshReels?: () => void;
  onLoadMoreReels?: (excludeIds: string[]) => Promise<ShowcaseTrack[]>;
  isOffline?: boolean;
  isPaused?: boolean;
  autoScroll?: boolean;
  clipDurationSeconds?: number;
  bottomClearance?: number;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean,
    seekTo?: number
  ) => void;
  onAddTrackToPlaylist: (
    playlistId: string,
    track: ShowcaseTrack
  ) => void | Promise<void>;
  onToggleDownload: (track: ShowcaseTrack) => void | Promise<void>;
  onEnsureFullTrack: (track: ShowcaseTrack) => Promise<ShowcaseTrack>;
  onOpenArtist: (artistName: string) => void;
}

const formatHandle = (artist: string) =>
  `@${artist.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

export const ReelsScreen: React.FC<ReelsScreenProps> = ({
  playlists,
  allTracks = [],
  reelsTracks,
  resolveTrack,
  downloadedIds,
  feedLoading = false,
  onLoadMoreReels,
  isOffline = false,
  isPaused = false,
  autoScroll = true,
  clipDurationSeconds = 12,
  bottomClearance = 88,
  onSelectTrack,
  onAddTrackToPlaylist,
  onToggleDownload,
  onEnsureFullTrack,
  onOpenArtist,
}) => {
  const [reelQueue, setReelQueue] = useState<ShowcaseTrack[]>(() => {
    const pool = reelsTracks && reelsTracks.length > 0 ? reelsTracks : allTracks;
    const withPreview = pool.filter((t) => Boolean(t.previewUrl));
    const arr = [...withPreview];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 28);
  });
  const fetchingMoreRef = useRef(false);

  // Merge newly incoming initial reelsTracks cleanly when feed refreshes or first arrives
  useEffect(() => {
    const pool = reelsTracks && reelsTracks.length > 0 ? reelsTracks : allTracks;
    const withPreview = pool.filter((t) => Boolean(t.previewUrl));
    if (withPreview.length === 0) return;

    setReelQueue((prev) => {
      if (prev.length === 0) {
        const arr = [...withPreview];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.slice(0, 28);
      }
      const existing = new Set(prev.map((t) => t.id));
      const fresh = withPreview.filter((t) => !existing.has(t.id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh.slice(0, 18)];
    });
  }, [reelsTracks, allTracks]);

  const reels = useMemo(
    () =>
      reelQueue.map((track, idx) => ({
        key: `${track.id}-${idx}`,
        track,
        baseIndex: idx,
      })),
    [reelQueue]
  );

  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reelAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string>('');
  const lastAutoKeyRef = useRef<string | null>(null);
  const autoScrollingIdxRef = useRef<number | null>(null);
  const tasteRecordedForKeyRef = useRef<string | null>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [reelElapsed, setReelElapsed] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [pickerTrack, setPickerTrack] = useState<ShowcaseTrack | null>(null);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [resolvingBusyId, setResolvingBusyId] = useState<string | null>(null);
  const [cardSwitcherOpen, setCardSwitcherOpen] = useState(false);

  // Dynamically load unseen songs as user swipes toward the end of the queue
  useEffect(() => {
    if (reels.length === 0 || activeIdx < reels.length - 4) return;
    if (fetchingMoreRef.current) return;

    const existingIds = reelQueue.map((t) => t.id);
    const existingSet = new Set(existingIds);

    if (onLoadMoreReels && !isOffline) {
      fetchingMoreRef.current = true;
      void onLoadMoreReels(existingIds)
        .then((more) => {
          const unseen = more.filter((t) => Boolean(t.previewUrl) && !existingSet.has(t.id));
          if (unseen.length > 0) {
            setReelQueue((prev) => {
              const seenNow = new Set(prev.map((t) => t.id));
              const add = unseen.filter((t) => !seenNow.has(t.id));
              return add.length > 0 ? [...prev, ...add] : prev;
            });
          } else {
            const fallbackPool = allTracks.filter(
              (t) => Boolean(t.previewUrl) && !existingSet.has(t.id)
            );
            if (fallbackPool.length > 0) {
              setReelQueue((prev) => [...prev, ...fallbackPool.slice(0, 12)]);
            }
          }
        })
        .catch(() => undefined)
        .finally(() => {
          fetchingMoreRef.current = false;
        });
    } else {
      const localUnseen = allTracks.filter(
        (t) => Boolean(t.previewUrl) && !existingSet.has(t.id)
      );
      if (localUnseen.length > 0) {
        setReelQueue((prev) => [...prev, ...localUnseen.slice(0, 12)]);
      }
    }
  }, [activeIdx, reels.length, reelQueue, onLoadMoreReels, isOffline, allTracks]);

  // Detect which reel is currently snapped in view
  useEffect(() => {
    const container = feedRef.current;
    if (!container || reels.length === 0) return;

    cardRefs.current = cardRefs.current.slice(0, reels.length);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idxAttr = entry.target.getAttribute('data-reel-idx');
            if (idxAttr !== null) {
              setActiveIdx(Number(idxAttr));
            }
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels.length]);

  // Reset timer & play only the active visible 30s iTunes preview
  const activeReel = reels[activeIdx] ?? null;

  useEffect(() => {
    if (!activeReel) return;
    const autoKey = `${activeIdx}:${activeReel.track.id}`;
    if (lastAutoKeyRef.current !== autoKey) {
      lastAutoKeyRef.current = autoKey;
      autoScrollingIdxRef.current = null;
      tasteRecordedForKeyRef.current = null;
      setReelElapsed(0);
      setUserPaused(false);
      markReelsSeen([activeReel.track.id]);
    }
  }, [activeIdx, activeReel]);

  // Increment taste affinity once user spends >5s listening to a Reel
  useEffect(() => {
    if (!activeReel || isPaused || userPaused) return;
    const autoKey = `${activeIdx}:${activeReel.track.id}`;
    if (reelElapsed >= 5 && tasteRecordedForKeyRef.current !== autoKey) {
      tasteRecordedForKeyRef.current = autoKey;
      recordTrackInteraction(activeReel.track, 1);
    }
  }, [activeIdx, activeReel, isPaused, reelElapsed, userPaused]);

  useEffect(() => {
    const audio = reelAudioRef.current;
    if (!audio) return;

    const shouldPlay =
      Boolean(activeReel) &&
      !isPaused &&
      !userPaused &&
      pickerTrack === null &&
      !cardSwitcherOpen &&
      (!isOffline || (activeReel ? downloadedIds.has(activeReel.track.id) : false));

    const targetUrl = activeReel?.track.previewUrl || '';

    if (!shouldPlay || !targetUrl) {
      audio.pause();
      return;
    }

    if (activeAudioUrlRef.current !== targetUrl) {
      activeAudioUrlRef.current = targetUrl;
      audio.src = targetUrl;
      audio.currentTime = 0;
    }

    void audio.play().catch(() => {
      // Browser autoplay may require gesture if not yet interacted
    });
  }, [
    activeReel,
    isPaused,
    userPaused,
    pickerTrack,
    cardSwitcherOpen,
    isOffline,
    downloadedIds,
  ]);

  useEffect(() => {
    return () => {
      if (reelAudioRef.current) {
        reelAudioRef.current.pause();
        reelAudioRef.current.removeAttribute('src');
      }
    };
  }, []);

  // Auto-scroll smoothly to the next reel when the clip window finishes
  useEffect(() => {
    if (
      reels.length === 0 ||
      isPaused ||
      userPaused ||
      pickerTrack !== null ||
      cardSwitcherOpen
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setReelElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= clipDurationSeconds) {
          if (!autoScroll) {
            return 0;
          }
          if (autoScrollingIdxRef.current !== activeIdx) {
            autoScrollingIdxRef.current = activeIdx;
            const nextIdx = activeIdx + 1;
            const container = feedRef.current;
            const nextEl = cardRefs.current[nextIdx];
            if (container) {
              container.scrollTo({
                top: nextIdx * container.clientHeight,
                behavior: 'smooth',
              });
            } else if (nextEl) {
              nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
          return clipDurationSeconds;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    reels.length,
    activeIdx,
    isPaused,
    userPaused,
    pickerTrack,
    cardSwitcherOpen,
    autoScroll,
    clipDurationSeconds,
  ]);

  const jumpToBaseReel = (targetIdx: number) => {
    if (reelQueue.length === 0) return;
    const clampedIdx = Math.max(0, Math.min(targetIdx, reelQueue.length - 1));
    const container = feedRef.current;
    if (container) {
      container.scrollTo({
        top: clampedIdx * container.clientHeight,
        behavior: 'smooth',
      });
    } else {
      cardRefs.current[clampedIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    setCardSwitcherOpen(false);
  };

  const reelProgressPct = Math.min(
    100,
    Math.max(0, (reelElapsed / clipDurationSeconds) * 100)
  );

  const activeBaseIndex = activeIdx;

  if (reelQueue.length === 0) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center p-6">
        {feedLoading ? (
          <div className="ather-depth-card w-full max-w-md aspect-[9/14] rounded-3xl p-6 flex flex-col justify-end space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#141418] border border-[#242429]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-[#141418]" />
                <div className="h-3 w-1/2 rounded bg-[#141418]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="ather-depth-card max-w-sm rounded-3xl p-6 text-center space-y-2">
            <h2 className="text-base font-extrabold text-white">
              {isOffline ? 'reels unavailable offline' : 'no previews loaded'}
            </h2>
            <p className="text-xs font-semibold text-[#A1A1AA]">
              {isOffline
                ? 'reconnect to browse 30-second song previews and stream full tracks.'
                : 'live previews will appear here as soon as the catalog finishes loading.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden">
      {/* Dedicated active-Reel <audio> player (auto-plays visible Reel, pauses when away) */}
      <audio ref={reelAudioRef} preload="auto" loop={!autoScroll} />

      {/* Vertical Snap-Scrolling Continuous Full-Bleed Auto-Playing Reel Feed */}
      <div
        ref={feedRef}
        className="w-full h-full overflow-y-auto snap-y snap-mandatory no-scrollbar"
      >
        {reels.map(({ key, track }, idx) => {
          const isActiveReel = idx === activeIdx;
          const isSaved = downloadedIds.has(track.id);
          const isBusy = resolvingBusyId === track.id;

          return (
            <div
              key={key}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              data-reel-idx={idx}
              className="relative w-full h-[100dvh] shrink-0 snap-start overflow-hidden bg-black"
            >
              {/* Full-Bleed Cover Visual Canvas (tap toggles preview pause/play) */}
              <button
                type="button"
                aria-label={userPaused ? 'resume preview' : 'pause preview'}
                onClick={() => setUserPaused((p) => !p)}
                className="absolute inset-0 w-full h-full overflow-hidden text-left cursor-pointer"
              >
                <ShowcaseArtwork
                  style={track.artwork}
                  coverUrl={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full"
                />

                {/* Top & Bottom Scrim for Crisp Legibility */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-68 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none"
                />
              </button>

              {/* Top Bar: Paused indicator only when paused */}
              {userPaused && isActiveReel && (
                <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex items-center justify-start pointer-events-none">
                  <span className="ather-depth-pill px-3 py-1 rounded-full text-[11px] font-extrabold text-white inline-flex items-center gap-1.5">
                    <PauseGlyph className="w-3 h-3" />
                    <span>paused</span>
                  </span>
                </div>
              )}

              {/* Bottom Layout: Left Creator/Track Info + Right Action Rail */}
              <div
                className="absolute left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-20 flex items-end justify-between gap-4 pointer-events-none"
                style={{ bottom: `${Math.max(bottomClearance + 22, 108)}px` }}
              >
                <div className="min-w-0 flex-1 space-y-2 pb-1 pointer-events-auto">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      aria-label={`open ${track.artist.toLowerCase()} profile`}
                      onClick={() => onOpenArtist(track.artist)}
                      className="w-12 h-12 rounded-full overflow-hidden border border-[#242429] shrink-0 hover:border-white hover:scale-105 active:scale-95 transition-transform"
                    >
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.artist}
                        compact={true}
                        className="w-full h-full"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTrack(track, true, 0)}
                        className="block max-w-full text-base sm:text-lg font-extrabold text-white truncate leading-tight text-left hover:opacity-80 transition-opacity"
                      >
                        {track.title.toLowerCase()}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenArtist(track.artist)}
                        className="block max-w-full text-xs font-semibold text-[#E4E4E7] hover:text-white hover:underline truncate mt-0.5 leading-tight text-left transition-colors"
                      >
                        {formatHandle(track.artist)} · {track.artist.toLowerCase()}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#A1A1AA] truncate pl-0.5">
                    {track.album.toLowerCase()} · {track.category.toLowerCase()}
                  </p>
                </div>

                {/* Right-Side Floating Vertical Rail: Play Full Track, Download, +, Card Switcher */}
                <div className="ather-depth-card pointer-events-auto rounded-full p-1.5 flex flex-col items-center gap-2 shrink-0">
                  <motion.button
                    type="button"
                    aria-label={`play full track ${track.title}`}
                    title="play full track"
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                    onClick={async () => {
                      setResolvingBusyId(track.id);
                      try {
                        const resolved = await onEnsureFullTrack(track);
                        onSelectTrack(resolved, true, 0);
                      } finally {
                        setResolvingBusyId(null);
                      }
                    }}
                    className="ather-acid-btn w-11 h-11 rounded-full flex items-center justify-center transition-all touch-manipulation"
                  >
                    <PlayGlyph className="w-5 h-5 translate-x-[1px]" />
                  </motion.button>

                  <motion.button
                    type="button"
                    aria-label={`add full song ${track.title.toLowerCase()} to an existing playlist`}
                    title="add to playlist"
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.14 }}
                    onClick={() => {
                      setAddedFeedback(null);
                      setPickerTrack(track);
                    }}
                    className="ather-depth-btn w-11 h-11 rounded-full text-white hover:border-white flex items-center justify-center transition-colors touch-manipulation"
                  >
                    <PlusGlyph className="w-5 h-5" />
                  </motion.button>

                  <motion.button
                    type="button"
                    aria-label={isSaved ? 'remove download' : 'download full song'}
                    title={isSaved ? 'saved offline' : 'download / save'}
                    whileTap={{ scale: 0.9 }}
                    disabled={isBusy}
                    transition={{ duration: 0.14 }}
                    onClick={async () => {
                      setResolvingBusyId(track.id);
                      try {
                        await onToggleDownload(track);
                      } finally {
                        setResolvingBusyId(null);
                      }
                    }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors touch-manipulation ${
                      isSaved
                        ? 'ather-acid-btn'
                        : 'ather-depth-btn text-white hover:border-white'
                    }`}
                  >
                    {isSaved ? (
                      <CheckGlyph className="w-5 h-5" />
                    ) : (
                      <DownloadGlyph className="w-5 h-5" />
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    aria-label="open reel card switcher"
                    title="card switcher"
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.14 }}
                    onClick={() => setCardSwitcherOpen(true)}
                    className="ather-depth-btn w-11 h-11 rounded-full text-white hover:border-white flex items-center justify-center transition-colors touch-manipulation"
                  >
                    <CardSwitcherGlyph className="w-5 h-5" active={cardSwitcherOpen} />
                  </motion.button>
                </div>
              </div>

              {/* Reel Duration Progress Bar for Autoscroll */}
              <div
                aria-hidden="true"
                className="absolute left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-20 h-[3px] bg-white/20 rounded-full overflow-hidden pointer-events-none"
                style={{ bottom: `${Math.max(bottomClearance + 10, 94)}px` }}
              >
                <div
                  className="h-full bg-white rounded-full transition-[width] duration-100 linear"
                  style={{ width: `${isActiveReel ? reelProgressPct : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Reel Card Switcher Drawer */}
      {cardSwitcherOpen && (
        <PopupSheet
          onClose={() => setCardSwitcherOpen(false)}
          ariaLabel="reel card switcher"
          variant="bottom"
          maxWidthClass="max-w-lg"
          maxHeightClass="max-h-[min(82dvh,calc(100dvh-max(1rem,env(safe-area-inset-top))-0.75rem))]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="ather-acid-btn w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                <CardSwitcherGlyph className="w-4 h-4" active={true} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">
                  reel cards
                </h2>
                <p className="text-xs font-semibold text-[#A1A1AA] truncate">
                  tap any card to jump directly to that preview
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="close card switcher"
              onClick={() => setCardSwitcherOpen(false)}
              className="ather-depth-btn w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-x-auto no-scrollbar">
            <div className="flex gap-3 pb-1">
              {reelQueue.map((track, idx) => {
                const isCurrent = idx === activeBaseIndex;
                return (
                  <button
                    key={`${track.id}-${idx}`}
                    type="button"
                    onClick={() => jumpToBaseReel(idx)}
                    className={`group relative shrink-0 w-32 h-48 rounded-2xl overflow-hidden border text-left transition-colors active:scale-95 ${
                      isCurrent
                        ? 'border-white'
                        : 'border-[#242429] hover:border-white/70'
                    }`}
                  >
                    <ShowcaseArtwork
                      style={track.artwork}
                      coverUrl={track.coverUrl}
                      alt={track.title}
                      compact={true}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"
                    />
                    {isCurrent && (
                      <span className="ather-acid-btn absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                        playing
                      </span>
                    )}
                    <div className="absolute inset-x-2.5 bottom-2.5 space-y-0.5">
                      <div className="text-xs font-extrabold text-white truncate">
                        {track.title.toLowerCase()}
                      </div>
                      <div className="text-[10px] font-medium text-[#A1A1AA] truncate">
                        {track.artist.toLowerCase()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </PopupSheet>
      )}

      {/* Add Song to Existing Playlist Modal */}
      {pickerTrack && (
        <PopupSheet
          onClose={() => setPickerTrack(null)}
          ariaLabel="add to playlist"
          variant="bottom"
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[82dvh]"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#242429] shrink-0">
                <ShowcaseArtwork
                  style={pickerTrack.artwork}
                  coverUrl={pickerTrack.coverUrl}
                  alt={pickerTrack.title}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">
                  add to playlist
                </h2>
                <p className="text-xs font-semibold text-[#A1A1AA] truncate mt-0.5">
                  {pickerTrack.title.toLowerCase()} · {pickerTrack.artist.toLowerCase()}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="close playlist picker"
              onClick={() => setPickerTrack(null)}
              className="ather-depth-btn w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {addedFeedback && (
              <div className="ather-acid-btn rounded-2xl px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2">
                <CheckGlyph className="w-4 h-4 shrink-0" />
                <span className="truncate">{addedFeedback.toLowerCase()}</span>
              </div>
            )}

            {playlists.length === 0 ? (
              <p className="text-xs font-bold text-[#A1A1AA] py-8 text-center">
                no playlists yet. create one under library → playlists first.
              </p>
            ) : (
              <div className="space-y-2">
                {playlists.map((pl) => {
                  const alreadyIn = pl.trackIds.includes(pickerTrack.id);
                  const firstPlTrack =
                    (resolveTrack ? resolveTrack(pl.trackIds[0]) : undefined) ??
                    allTracks.find((t) => t.id === pl.trackIds[0]);
                  const busy = resolvingBusyId === pl.id;

                  return (
                    <button
                      key={pl.id}
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (alreadyIn) return;
                        setResolvingBusyId(pl.id);
                        try {
                          await onAddTrackToPlaylist(pl.id, pickerTrack);
                          setAddedFeedback(
                            `added “${pickerTrack.title}” to ${pl.name}`
                          );
                        } finally {
                          setResolvingBusyId(null);
                        }
                      }}
                      className="ather-depth-row w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#242429]">
                          <PlaylistCover
                            coverImageUrl={pl.coverImageUrl}
                            coverArtwork={pl.coverArtwork}
                            fallbackArtwork={firstPlTrack?.artwork ?? 'lime-noir'}
                            fallbackCoverUrl={firstPlTrack?.coverUrl}
                            alt={pl.name}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-white truncate">
                            {pl.name.toLowerCase()}
                          </div>
                          <div className="text-xs font-semibold text-[#A1A1AA] tabular-nums">
                            {busy
                              ? 'adding...'
                              : `${pl.trackIds.length} ${
                                  pl.trackIds.length === 1 ? 'song' : 'songs'
                                }`}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
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

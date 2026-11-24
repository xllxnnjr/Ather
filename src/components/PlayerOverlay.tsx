import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AiSparklesGlyph,
  ArrowDownGlyph,
  ArrowUpGlyph,
  CheckGlyph,
  ChevronLeftGlyph,
  CloseGlyph,
  DevicesGlyph,
  DiscGlyph,
  DownloadGlyph,
  HeartGlyph,
  LyricsGlyph,
  MoreDotsGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
  PrevGlyph,
  QueueGlyph,
  RepeatGlyph,
  RotateGlyph,
  SearchInputGlyph,
  ShuffleGlyph,
  TrashGlyph,
} from './AppIcons';
import { formatDuration } from '../data/showcaseCatalog';
import {
  RegisteredDevice,
  RemoteCommandType,
  SharedPlaybackState,
  getLocalDeviceId,
} from '../services/deviceHandoff';
import { getTopSearchResults } from '../services/musicApi';
import { RepeatMode, ShowcaseTrack } from '../types/music';
import { AlbumCoverWithHiddenPlayer } from './AlbumCoverWithHiddenPlayer';
import {
  BrowserAudioOutputOption,
  DeviceHandoffSheet,
} from './DeviceHandoffSheet';
import { FullScreenLyricsView } from './FullScreenLyricsView';
import { PopupSheet } from './PopupSheet';
import { ShowcaseArtwork } from './ShowcaseArtwork';

const DEFAULT_DEVICE: BrowserAudioOutputOption = {
  id: 'default',
  name: 'This Device',
  spec: 'Browser Audio Output',
};

interface PlayerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  track: ShowcaseTrack;
  allTracks?: ShowcaseTrack[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  isPlaying: boolean;
  isBuffering?: boolean;
  audioError?: string | null;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isFavorite: boolean;
  isDownloaded: boolean;
  queueTrackIds: string[];
  aiSmartShuffleEnabled?: boolean;
  aiShuffleLoading?: boolean;
  aiShuffleNote?: string | null;
  aiShuffleError?: string | null;
  showLyricsEnabled?: boolean;
  hapticsEnabled?: boolean;
  lyricsGlowEnabled?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onToggleDownload: () => void;
  onSelectTrack: (trackId: string) => void;
  onMoveQueueTrack: (fromIndex: number, toIndex: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onAddToQueue: (trackOrId: string | ShowcaseTrack) => void;
  onClearUpcoming: () => void;
  onResetQueue: () => void;
  onOpenArtist: (artistName: string) => void;
  onOpenTrackInfo?: (track: ShowcaseTrack) => void;
  signedInUid?: string | null;
  accountDevices?: RegisteredDevice[];
  sharedPlayback?: SharedPlaybackState | null;
  onClaimPlaybackHere?: () => Promise<void> | void;
  onTransferPlaybackToDevice?: (device: RegisteredDevice) => Promise<void> | void;
  onSendRemoteCommand?: (
    targetDeviceId: string,
    command: RemoteCommandType
  ) => Promise<void> | void;
  onRemoveDevice?: (device: RegisteredDevice) => Promise<void> | void;
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({
  isOpen,
  onClose,
  track,
  allTracks = [],
  resolveTrack,
  isPlaying,
  isBuffering = false,
  audioError = null,
  currentTime,
  duration,
  shuffle,
  repeatMode,
  isFavorite,
  isDownloaded,
  queueTrackIds,
  aiSmartShuffleEnabled = true,
  aiShuffleLoading = false,
  aiShuffleNote = null,
  aiShuffleError = null,
  showLyricsEnabled = true,
  hapticsEnabled = true,
  lyricsGlowEnabled = true,
  onTogglePlay,
  onSeek,
  onPrevTrack,
  onNextTrack,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onToggleDownload,
  onSelectTrack,
  onMoveQueueTrack,
  onRemoveFromQueue,
  onAddToQueue,
  onClearUpcoming,
  onResetQueue,
  onOpenArtist,
  onOpenTrackInfo,
  signedInUid = null,
  accountDevices = [],
  sharedPlayback = null,
  onClaimPlaybackHere,
  onTransferPlaybackToDevice,
  onSendRemoteCommand,
  onRemoveDevice,
}) => {
  const [lyricsViewOpen, setLyricsViewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<BrowserAudioOutputOption[]>([
    DEFAULT_DEVICE,
  ]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('default');
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [queueAddQuery, setQueueAddQuery] = useState('');
  const [queueSearchResults, setQueueSearchResults] = useState<ShowcaseTrack[]>([]);
  const [queueSearchLoading, setQueueSearchLoading] = useState(false);
  const queueSearchSeqRef = useRef(0);
  const [coverPulseTick, setCoverPulseTick] = useState(0);
  const [transportPulse, setTransportPulse] = useState<{
    id: 'shuffle' | 'prev' | 'play' | 'next' | 'repeat';
    tick: number;
  } | null>(null);

  const scrubberRef = useRef<HTMLDivElement>(null);
  const prevTrackIdRef = useRef(track.id);

  const effectiveDuration = duration > 0 ? duration : track.duration;

  useEffect(() => {
    if (!devicesOpen || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => {
        if (cancelled) return;
        const outputs = list
          .filter((d) => d.kind === 'audiooutput' && d.deviceId)
          .map((d, idx) => ({
            id: d.deviceId,
            name: d.label || (idx === 0 ? 'System Default Output' : `Audio Output ${idx + 1}`),
            spec: 'Live Browser Output',
          }));
        setAvailableDevices(outputs.length > 0 ? outputs : [DEFAULT_DEVICE]);
      })
      .catch(() => {
        if (!cancelled) setAvailableDevices([DEFAULT_DEVICE]);
      });
    return () => {
      cancelled = true;
    };
  }, [devicesOpen]);

  useEffect(() => {
    if (!addingToQueue) {
      queueSearchSeqRef.current += 1;
      setQueueSearchResults([]);
      setQueueSearchLoading(false);
      return;
    }

    const trimmed = queueAddQuery.trim();
    if (!trimmed) {
      queueSearchSeqRef.current += 1;
      setQueueSearchResults([]);
      setQueueSearchLoading(false);
      return;
    }

    const seq = ++queueSearchSeqRef.current;
    setQueueSearchLoading(true);
    const timer = window.setTimeout(() => {
      getTopSearchResults(trimmed)
        .then((bundle) => {
          if (seq !== queueSearchSeqRef.current) return;
          setQueueSearchResults(bundle.songs);
        })
        .catch(() => {
          if (seq !== queueSearchSeqRef.current) return;
          setQueueSearchResults([]);
        })
        .finally(() => {
          if (seq === queueSearchSeqRef.current) {
            setQueueSearchLoading(false);
          }
        });
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [addingToQueue, queueAddQuery]);

  const triggerHapticVibrate = () => {
    if (!hapticsEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch {
      // ignore unsupported vibration environments
    }
  };

  const triggerCoverPulse = () => {
    if (!hapticsEnabled) return;
    setCoverPulseTick((t) => t + 1);
    triggerHapticVibrate();
  };

  const triggerTransportPulse = (
    id: 'shuffle' | 'prev' | 'play' | 'next' | 'repeat',
    pulseCover = false
  ) => {
    if (!hapticsEnabled) return;
    setTransportPulse((prev) => ({ id, tick: (prev?.tick ?? 0) + 1 }));
    if (pulseCover) {
      triggerCoverPulse();
    } else {
      triggerHapticVibrate();
    }
  };

  useEffect(() => {
    if (prevTrackIdRef.current !== track.id) {
      prevTrackIdRef.current = track.id;
      if (hapticsEnabled) setCoverPulseTick((t) => t + 1);
    }
  }, [track.id, hapticsEnabled]);

  useEffect(() => {
    if (!isOpen) {
      setMenuOpen(false);
      setQueueOpen(false);
      setDevicesOpen(false);
      setLyricsViewOpen(false);
      setAddingToQueue(false);
      setQueueAddQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showLyricsEnabled && lyricsViewOpen) {
      setLyricsViewOpen(false);
    }
  }, [showLyricsEnabled, lyricsViewOpen]);

  const progress =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  const queueTracks = useMemo(
    () =>
      queueTrackIds
        .map(
          (id) =>
            resolveTrack?.(id) ?? allTracks.find((t) => t.id === id)
        )
        .filter((t): t is ShowcaseTrack => Boolean(t)),
    [queueTrackIds, resolveTrack, allTracks]
  );

  const seekFromPointer = (clientX: number) => {
    const bar = scrubberRef.current;
    if (!bar || effectiveDuration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio * effectiveDuration);
  };

  const streamBadgeText =
    track.youtubeVideoId || track.streamStatus === 'full'
      ? 'Full Audio'
      : track.previewUrl
      ? 'Track'
      : 'Audio';

  const localDeviceId = getLocalDeviceId(signedInUid);
  const isPlayingRemotely =
    Boolean(signedInUid) &&
    Boolean(sharedPlayback?.activeDeviceId) &&
    sharedPlayback?.activeDeviceId !== localDeviceId;

  const activeDeviceName = isPlayingRemotely
    ? sharedPlayback?.activeDeviceName || 'Remote Device'
    : availableDevices.find((d) => d.id === activeDeviceId)?.name ?? 'This Device';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full screen player"
      aria-hidden={!isOpen}
      onClick={() => {
        if (menuOpen) setMenuOpen(false);
      }}
      className={`fixed inset-0 z-40 bg-black overflow-hidden transition-all duration-400 ${
        isOpen
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {/* Subtle Monochrome Studio Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 24%, rgba(255,255,255,0.06) 0%, transparent 56%)',
          filter: 'blur(72px)',
        }}
      />

      <div className="relative z-10 h-full w-full max-w-xl mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col justify-between gap-3 [@media(max-height:600px)]:overflow-y-auto [@media(max-height:600px)]:no-scrollbar">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 shrink-0 relative z-20">
          <button
            type="button"
            aria-label="Collapse player"
            onClick={onClose}
            className="w-10 h-10 shrink-0 rounded-full bg-[#111114] border border-white/25 flex items-center justify-center text-white hover:bg-[#1C1C22] hover:border-white/45 active:scale-90 transition-all"
          >
            <ChevronLeftGlyph className="w-5 h-5" />
          </button>

          <div className="flex-1 text-center min-w-0 px-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/75 truncate">
              {streamBadgeText}
            </div>
            <div className="text-sm font-extrabold text-white truncate mt-0.5">
              {track.album}
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Song options"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((m) => !m);
              }}
              className="w-10 h-10 shrink-0 rounded-full bg-[#111114] border border-white/25 flex items-center justify-center text-white hover:bg-[#1C1C22] hover:border-white/45 active:scale-90 transition-all"
            >
              <MoreDotsGlyph className="w-5 h-5" />
            </button>

            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: '#111114' }}
                className="absolute right-0 top-12 w-64 rounded-2xl border border-white/25 shadow-[0_24px_64px_rgba(0,0,0,0.95)] z-30 overflow-hidden"
              >
                <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-white/15">
                  <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 shrink-0">
                    <ShowcaseArtwork
                      style={track.artwork}
                      coverUrl={track.coverUrl}
                      alt={track.title}
                      compact={true}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-white truncate">
                      {track.title}
                    </div>
                    <div className="text-[11px] font-bold text-white/75 truncate">
                      {track.artist}
                    </div>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5">
                  {onOpenTrackInfo && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenTrackInfo(track);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/15 transition-colors"
                    >
                      <DiscGlyph className="w-4 h-4 text-white shrink-0" />
                      <span>Song &amp; Artist Info</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onClose();
                      onOpenArtist(track.artist);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/15 transition-colors"
                  >
                    <PlayGlyph className="w-4 h-4 text-white shrink-0" />
                    <span>Go to Artist</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddToQueue(track.id);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-white/15 transition-colors"
                  >
                    <QueueGlyph className="w-4 h-4 text-white shrink-0" />
                    <span>Add to Up Next Queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleDownload();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      {isDownloaded ? (
                        <CheckGlyph className="w-4 h-4 text-white shrink-0" />
                      ) : (
                        <DownloadGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      )}
                      <span>
                        {isDownloaded ? 'Downloaded' : 'Download Full Track'}
                      </span>
                    </span>
                    {isDownloaded && (
                      <span className="text-[10px] font-bold text-white/55">
                        Saved
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onToggleFavorite();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <HeartGlyph
                      className="w-4 h-4 text-white shrink-0"
                      active={isFavorite}
                    />
                    <span>
                      {isFavorite
                        ? 'Remove from Liked Songs'
                        : 'Add to Liked Songs'}
                    </span>
                  </button>

                  {showLyricsEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setLyricsViewOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      <LyricsGlyph
                        className="w-4 h-4 shrink-0"
                        active={lyricsViewOpen}
                      />
                      <span>View Lyrics</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Central Feature: Constrained Artwork with Masked YouTube Audio Host */}
        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center py-2 overflow-hidden"
          style={{ containerType: 'size' }}
        >
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 'min(360px, 92cqmin)',
              height: 'min(360px, 92cqmin)',
            }}
          >
            <AnimatePresence>
              {coverPulseTick > 0 && (
                <motion.div
                  key={`cover-ring-${coverPulseTick}`}
                  aria-hidden="true"
                  initial={{ scale: isPlaying ? 0.94 : 0.89, opacity: 0.45 }}
                  animate={{ scale: 1.07, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-3xl border border-white/55 pointer-events-none"
                  style={{
                    boxShadow: '0 0 28px rgba(255,255,255,0.2)',
                  }}
                />
              )}
            </AnimatePresence>

            <motion.button
              key={`cover-pulse-${coverPulseTick}`}
              type="button"
              aria-label={isPlaying ? 'Pause playback' : 'Resume playback'}
              onClick={() => {
                triggerTransportPulse('play', true);
                onTogglePlay();
              }}
              whileHover={{ scale: isPlaying ? 1.015 : 0.94 }}
              whileTap={{ scale: 0.91 }}
              initial={{
                scale:
                  coverPulseTick > 0
                    ? isPlaying
                      ? 0.94
                      : 0.96
                    : isPlaying
                    ? 1
                    : 0.92,
              }}
              animate={{
                scale: isPlaying ? 1 : 0.92,
              }}
              transition={{
                type: 'spring',
                stiffness: 460,
                damping: 18,
                mass: 0.7,
              }}
              className="relative w-full h-full rounded-3xl overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            >
              <AlbumCoverWithHiddenPlayer
                style={track.artwork}
                coverUrl={track.coverUrl}
                alt={track.title}
                isActive={isOpen}
                className="w-full h-full"
              />
            </motion.button>
          </div>
        </div>

        {/* Lower Controls */}
        <div className="space-y-4 shrink-0">
          {audioError && (
            <div className="text-center text-[11px] font-semibold text-white/70">
              {audioError}
            </div>
          )}

          {/* Song Title, Artist & Favorite Heart */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
                {track.title}
              </h2>
              <button
                type="button"
                onClick={() => onOpenArtist(track.artist)}
                className="block max-w-full text-sm sm:text-base text-white/60 hover:text-white hover:underline truncate mt-0.5 text-left transition-colors"
              >
                {track.artist}
              </button>
            </div>

            <button
              type="button"
              aria-label={isFavorite ? 'Remove favorite' : 'Favorite track'}
              onClick={onToggleFavorite}
              className={`w-11 h-11 rounded-full bg-[#111114] border flex items-center justify-center active:scale-90 transition-all shrink-0 ${
                isFavorite ? 'border-white' : 'border-white/25'
              }`}
            >
              <HeartGlyph
                className={`w-5 h-5 ${
                  isFavorite
                    ? 'text-white'
                    : 'text-white/80 hover:text-white'
                }`}
                active={isFavorite}
              />
            </button>
          </div>

          {/* Interactive Scrubber */}
          <div className="space-y-1.5">
            <div
              ref={scrubberRef}
              role="slider"
              tabIndex={0}
              aria-label="Track progress"
              aria-valuemin={0}
              aria-valuemax={Math.round(effectiveDuration)}
              aria-valuenow={Math.round(currentTime)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) seekFromPointer(e.clientX);
              }}
              className="group relative w-full h-6 flex items-center cursor-pointer touch-none"
            >
              <div className="w-full h-1 group-hover:h-1.5 transition-all rounded-full bg-white/20 relative">
                <div
                  className="h-full rounded-full bg-white relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.75)]" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold tabular-nums text-white/75">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(effectiveDuration)}</span>
            </div>
          </div>

          {/* Monochrome Transport Controls */}
          <div className="flex items-center justify-between max-w-sm mx-auto w-full">
            <motion.button
              type="button"
              aria-label={
                aiSmartShuffleEnabled
                  ? 'Toggle AI Smart Shuffle'
                  : 'Toggle shuffle'
              }
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              onClick={() => {
                triggerTransportPulse('shuffle');
                onToggleShuffle();
              }}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                shuffle
                  ? 'text-black bg-white'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              <AnimatePresence>
                {transportPulse?.id === 'shuffle' && (
                  <motion.span
                    key={`pulse-shuffle-${transportPulse.tick}`}
                    aria-hidden="true"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.38, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border border-white/70 pointer-events-none"
                  />
                )}
              </AnimatePresence>
              <ShuffleGlyph className="w-5 h-5" />
              {aiSmartShuffleEnabled && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                    shuffle
                      ? 'bg-black text-white border border-white/40'
                      : 'bg-[#141416] text-white/75 border border-white/25'
                  }`}
                >
                  <AiSparklesGlyph className="w-2.5 h-2.5" active={shuffle} />
                </span>
              )}
            </motion.button>

            <motion.button
              type="button"
              aria-label="Previous track"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              onClick={() => {
                triggerTransportPulse('prev', true);
                onPrevTrack();
              }}
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <AnimatePresence>
                {transportPulse?.id === 'prev' && (
                  <motion.span
                    key={`pulse-prev-${transportPulse.tick}`}
                    aria-hidden="true"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 0.38, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border border-white/60 pointer-events-none"
                  />
                )}
              </AnimatePresence>
              <PrevGlyph className="w-6 h-6" />
            </motion.button>

            <motion.button
              key={`play-pulse-${transportPulse?.id === 'play' ? transportPulse.tick : 0}`}
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              initial={{
                scale: transportPulse?.id === 'play' ? 0.9 : 1,
              }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.86 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              onClick={() => {
                triggerTransportPulse('play', true);
                onTogglePlay();
              }}
              className="relative w-[66px] h-[66px] rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.28)] hover:bg-white/90 transition-colors"
            >
              <AnimatePresence>
                {transportPulse?.id === 'play' && (
                  <motion.span
                    key={`pulse-play-${transportPulse.tick}`}
                    aria-hidden="true"
                    initial={{ scale: 0.92, opacity: 0.55 }}
                    animate={{ scale: 1.38, opacity: 0 }}
                    transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-full border-2 border-white pointer-events-none"
                  />
                )}
              </AnimatePresence>
              {isPlaying ? (
                <PauseGlyph className="w-7 h-7" />
              ) : (
                <PlayGlyph className="w-7 h-7 translate-x-[1px]" />
              )}
            </motion.button>

            <motion.button
              type="button"
              aria-label="Next track"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              onClick={() => {
                triggerTransportPulse('next', true);
                onNextTrack();
              }}
              className="relative w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            >
              <AnimatePresence>
                {transportPulse?.id === 'next' && (
                  <motion.span
                    key={`pulse-next-${transportPulse.tick}`}
                    aria-hidden="true"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 0.38, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border border-white/60 pointer-events-none"
                  />
                )}
              </AnimatePresence>
              <NextGlyph className="w-6 h-6" />
            </motion.button>

            <motion.button
              type="button"
              aria-label="Cycle repeat"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
              onClick={() => {
                triggerTransportPulse('repeat');
                onCycleRepeat();
              }}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                repeatMode !== 'off'
                  ? 'text-black bg-white'
                  : 'text-white/55 hover:text-white'
              }`}
            >
              <AnimatePresence>
                {transportPulse?.id === 'repeat' && (
                  <motion.span
                    key={`pulse-repeat-${transportPulse.tick}`}
                    aria-hidden="true"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.38, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border border-white/70 pointer-events-none"
                  />
                )}
              </AnimatePresence>
              <RepeatGlyph className="w-5 h-5" one={repeatMode === 'one'} />
            </motion.button>
          </div>

          {/* Bottom Action Buttons Row: LYRICS, Devices, Up Next */}
          <div
            className={`grid gap-2.5 pt-1 ${
              showLyricsEnabled ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {showLyricsEnabled && (
              <button
                type="button"
                aria-pressed={lyricsViewOpen}
                onClick={() => setLyricsViewOpen(true)}
                className={`rounded-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider border transition-all active:scale-95 ${
                  lyricsViewOpen
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-[#111114] text-white border-white/25 hover:border-white/50'
                }`}
              >
                <LyricsGlyph className="w-4 h-4" active={lyricsViewOpen} />
                <span>LYRICS</span>
              </button>
            )}

            <button
              type="button"
              aria-pressed={devicesOpen || activeDeviceId !== 'default' || isPlayingRemotely}
              onClick={() => setDevicesOpen(true)}
              className={`rounded-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-extrabold border transition-all active:scale-95 ${
                isPlayingRemotely
                  ? 'bg-white text-black border-white shadow-md'
                  : activeDeviceId !== 'default'
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-[#111114] text-white border-white/25 hover:border-white/50'
              }`}
            >
              <DevicesGlyph
                className="w-4 h-4 shrink-0"
                active={activeDeviceId !== 'default' || isPlayingRemotely}
              />
              <span className="truncate">
                {isPlayingRemotely
                  ? activeDeviceName.split(' ')[0]
                  : activeDeviceId === 'default'
                  ? 'Devices'
                  : activeDeviceName.split(' ')[0]}
              </span>
            </button>

            <button
              type="button"
              aria-pressed={queueOpen}
              onClick={() => setQueueOpen(true)}
              className="rounded-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-extrabold bg-[#111114] text-white border border-white/25 hover:border-white/50 transition-all active:scale-95"
            >
              <QueueGlyph className="w-4 h-4" />
              <span>Up Next</span>
            </button>
          </div>
        </div>
      </div>

      {/* Original Full-Screen 100dvh Synced Lyrics View */}
      <AnimatePresence>
        {lyricsViewOpen && (
          <FullScreenLyricsView
            isOpen={lyricsViewOpen}
            onClose={() => setLyricsViewOpen(false)}
            track={track}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={effectiveDuration}
            lyricsGlowEnabled={lyricsGlowEnabled}
            onTogglePlay={onTogglePlay}
            onSeek={onSeek}
            onPrevTrack={onPrevTrack}
            onNextTrack={onNextTrack}
            onOpenArtist={onOpenArtist}
          />
        )}
      </AnimatePresence>

      {/* Cross-Device Handoff & Audio Output Sheet */}
      {devicesOpen && (
        <DeviceHandoffSheet
          onClose={() => setDevicesOpen(false)}
          currentTrack={track}
          isPlaying={isPlaying}
          browserOutputs={availableDevices}
          activeBrowserOutputId={activeDeviceId}
          onSelectBrowserOutput={(deviceId) => {
            setActiveDeviceId(deviceId);
            setDevicesOpen(false);
          }}
          signedInUid={signedInUid}
          accountDevices={accountDevices}
          sharedPlayback={sharedPlayback}
          onClaimHere={() => onClaimPlaybackHere?.()}
          onTransferToDevice={(device) => onTransferPlaybackToDevice?.(device)}
          onSendRemoteCommand={(targetId, command) =>
            onSendRemoteCommand?.(targetId, command)
          }
          onRemoveDevice={(device) => onRemoveDevice?.(device)}
        />
      )}

      {/* Interactive Up Next Queue Drawer */}
      {queueOpen && (
        <PopupSheet
          onClose={() => setQueueOpen(false)}
          ariaLabel="Up Next Queue"
          variant="bottom"
          maxWidthClass="max-w-lg"
          maxHeightClass="max-h-[min(86dvh,calc(100dvh-max(1rem,env(safe-area-inset-top))-0.75rem))]"
        >
          {/* Queue Header */}
          <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Up Next</h3>
                {shuffle && aiSmartShuffleEnabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-extrabold">
                    <AiSparklesGlyph className="w-3 h-3" active={true} />
                    <span>Smart</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-white/55 mt-0.5 tabular-nums truncate">
                {aiShuffleLoading
                  ? 'Sequencing queue...'
                  : `${queueTracks.length} ${
                      queueTracks.length === 1 ? 'track' : 'tracks'
                    } in queue`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAddingToQueue((v) => !v);
                  setQueueAddQuery('');
                }}
                className={`h-8 px-3 rounded-full text-xs font-bold border inline-flex items-center gap-1 transition-colors ${
                  addingToQueue
                    ? 'bg-white text-black border-white'
                    : 'bg-black/75 text-white/85 border-white/15 hover:border-white/35'
                }`}
              >
                <PlusGlyph className="w-3.5 h-3.5" />
                <span>{addingToQueue ? 'Done' : 'Add'}</span>
              </button>

              <button
                type="button"
                aria-label="Reset queue"
                title="Reset Queue"
                onClick={onResetQueue}
                className="w-8 h-8 rounded-full bg-black/75 border border-white/15 flex items-center justify-center text-white/75 hover:text-white hover:border-white/35 transition-colors"
              >
                <RotateGlyph className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                aria-label="Close queue"
                onClick={() => setQueueOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <CloseGlyph className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pinned Now Playing & Transport Controls */}
          <div className="px-5 py-3.5 bg-[#0A0A0D] border-b border-white/20 space-y-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/20 shrink-0">
                <ShowcaseArtwork
                  style={track.artwork}
                  coverUrl={track.coverUrl}
                  alt={track.title}
                  compact={true}
                  className="w-full h-full"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Now Playing
                </div>
                <div className="text-sm font-extrabold text-white truncate">
                  {track.title}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQueueOpen(false);
                    onOpenArtist(track.artist);
                  }}
                  className="block max-w-full text-xs text-white/60 hover:text-white hover:underline truncate text-left"
                >
                  {track.artist}
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Previous track"
                  onClick={onPrevTrack}
                  className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/15 flex items-center justify-center text-white/85 transition-colors"
                >
                  <PrevGlyph className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  onClick={onTogglePlay}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 active:scale-95 transition-all"
                >
                  {isPlaying ? (
                    <PauseGlyph className="w-4 h-4" />
                  ) : (
                    <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next track"
                  onClick={onNextTrack}
                  className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/15 flex items-center justify-center text-white/85 transition-colors"
                >
                  <NextGlyph className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={shuffle}
                  onClick={onToggleShuffle}
                  className={`h-8 px-3 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 transition-colors ${
                    shuffle
                      ? 'bg-white text-black border-white'
                      : 'bg-black/75 text-white/75 border-white/15 hover:text-white hover:border-white/35'
                  }`}
                >
                  <ShuffleGlyph className="w-3.5 h-3.5" />
                  <span>Shuffle</span>
                </button>

                <button
                  type="button"
                  aria-pressed={repeatMode !== 'off'}
                  onClick={onCycleRepeat}
                  className={`h-8 px-3 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 transition-colors ${
                    repeatMode !== 'off'
                      ? 'bg-white text-black border-white'
                      : 'bg-black/75 text-white/75 border-white/15 hover:text-white hover:border-white/35'
                  }`}
                >
                  <RepeatGlyph
                    className="w-3.5 h-3.5"
                    one={repeatMode === 'one'}
                  />
                  <span>
                    {repeatMode === 'one'
                      ? 'Repeat 1'
                      : repeatMode === 'all'
                      ? 'Repeat All'
                      : 'Repeat'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClearUpcoming}
                className="h-8 px-3 rounded-full bg-black/75 border border-white/15 text-[11px] font-bold text-white/70 hover:text-white hover:border-white/35 transition-colors"
              >
                Clear Queue
              </button>
            </div>
          </div>

          {(aiShuffleNote || aiShuffleError) && (
            <div
              className={`mx-5 mt-3 rounded-2xl px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shrink-0 ${
                aiShuffleError
                  ? 'bg-black/80 border border-white/25 text-white/85'
                  : 'bg-white/[0.08] border border-white/15 text-white'
              }`}
            >
              <AiSparklesGlyph
                className="w-3.5 h-3.5 shrink-0"
                active={!aiShuffleError}
              />
              <span className="truncate">{aiShuffleError ?? aiShuffleNote}</span>
            </div>
          )}

          {addingToQueue && (
            <div className="mx-5 mt-3 rounded-2xl bg-black/80 border border-white/15 p-3 space-y-2.5 max-h-60 flex flex-col shrink-0">
              <div className="relative shrink-0">
                <SearchInputGlyph className="w-3.5 h-3.5 text-white/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={queueAddQuery}
                  onChange={(e) => setQueueAddQuery(e.target.value)}
                  placeholder="Search for a song or artist..."
                  className="w-full rounded-full bg-[#0E0E10] border border-white/15 pl-8 pr-3 py-1.5 text-base sm:text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar divide-y divide-white/[0.06]">
                {(() => {
                  const q = queueAddQuery.trim();
                  if (queueSearchLoading) {
                    return (
                      <p className="text-xs text-white/55 px-1 py-4 text-center">
                        Searching songs...
                      </p>
                    );
                  }
                  const lower = q.toLowerCase();
                  const localMatches = lower
                    ? allTracks.filter(
                        (t) =>
                          t.title.toLowerCase().includes(lower) ||
                          t.artist.toLowerCase().includes(lower)
                      )
                    : allTracks;
                  const seen = new Set<string>();
                  const combined: ShowcaseTrack[] = [];
                  for (const item of [...queueSearchResults, ...localMatches]) {
                    if (!seen.has(item.id)) {
                      seen.add(item.id);
                      combined.push(item);
                    }
                  }
                  if (combined.length === 0) {
                    return (
                      <p className="text-xs text-white/45 px-1 py-3 text-center">
                        {q
                          ? `No matching songs found for "${q}".`
                          : 'Search any song to add it to Up Next.'}
                      </p>
                    );
                  }
                  return combined.slice(0, 40).map((catalogTrack) => {
                    const alreadyQueued = queueTrackIds.includes(catalogTrack.id);
                    return (
                      <button
                        key={catalogTrack.id}
                        type="button"
                        onClick={() => onAddToQueue(catalogTrack)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 hover:bg-white/[0.07] text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                          <ShowcaseArtwork
                            style={catalogTrack.artwork}
                            coverUrl={catalogTrack.coverUrl}
                            alt={catalogTrack.title}
                            compact={true}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">
                            {catalogTrack.title}
                          </div>
                          <div className="text-[11px] text-white/50 truncate">
                            {catalogTrack.artist}
                          </div>
                        </div>
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            alreadyQueued
                              ? 'bg-white text-black'
                              : 'bg-white/10 hover:bg-white hover:text-black text-white'
                          }`}
                        >
                          {alreadyQueued ? (
                            <CheckGlyph className="w-3.5 h-3.5" />
                          ) : (
                            <PlusGlyph className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Queue Track List */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 divide-y divide-white/[0.07]">
            {queueTracks.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs font-bold text-white/75">Queue is empty</p>
                <p className="text-[11px] text-white/45">
                  Tap “Add” or Reset to line up upcoming songs.
                </p>
              </div>
            ) : (
              queueTracks.map((item, idx) => {
                const active = item.id === track.id;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className={`flex items-center gap-2.5 py-2.5 px-2 rounded-2xl transition-colors hover:bg-white/[0.05] ${
                      active ? 'bg-white/[0.09]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTrack(item.id);
                        setQueueOpen(false);
                      }}
                      className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10"
                      aria-label={`Play ${item.title}`}
                    >
                      <ShowcaseArtwork
                        style={item.artwork}
                        coverUrl={item.coverUrl}
                        alt={item.title}
                        compact={true}
                        className="w-full h-full"
                      />
                    </button>

                    <div className="min-w-0 flex-1 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTrack(item.id);
                          setQueueOpen(false);
                        }}
                        className={`block max-w-full text-sm font-bold truncate text-left ${
                          active ? 'text-white underline' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQueueOpen(false);
                          onOpenArtist(item.artist);
                        }}
                        className="block max-w-full text-xs text-white/55 hover:text-white hover:underline truncate text-left transition-colors"
                      >
                        {item.artist}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Move ${item.title} up`}
                        disabled={idx === 0}
                        onClick={() => onMoveQueueTrack(idx, idx - 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
                      >
                        <ArrowUpGlyph className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${item.title} down`}
                        disabled={idx === queueTracks.length - 1}
                        onClick={() => onMoveQueueTrack(idx, idx + 1)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-colors"
                      >
                        <ArrowDownGlyph className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title} from queue`}
                        onClick={() => onRemoveFromQueue(idx)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <TrashGlyph className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PopupSheet>
      )}
    </div>
  );
};

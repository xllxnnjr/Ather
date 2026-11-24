import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeftGlyph,
  LyricsGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PrevGlyph,
} from './AppIcons';
import { formatDuration } from '../data/showcaseCatalog';
import { audioEngine } from '../services/audioEngine';
import { fetchSyncedLyrics } from '../services/musicApi';
import {
  LyricsLookupResult,
  ShowcaseTrack,
  SyncedLyricLine,
} from '../types/music';
import { ShowcaseArtwork } from './ShowcaseArtwork';
import { SyncedLyricsView } from './SyncedLyricsView';

interface FullScreenLyricsViewProps {
  isOpen: boolean;
  onClose: () => void;
  track: ShowcaseTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyricsGlowEnabled?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onOpenArtist: (artistName: string) => void;
}

export const FullScreenLyricsView: React.FC<FullScreenLyricsViewProps> = ({
  isOpen,
  onClose,
  track,
  isPlaying,
  currentTime,
  duration,
  lyricsGlowEnabled = true,
  onTogglePlay,
  onSeek,
  onPrevTrack,
  onNextTrack,
  onOpenArtist,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lyricsResult, setLyricsResult] = useState<LyricsLookupResult>({
    syncedLyrics: [],
    lines: [],
    plainLyrics: null,
    isSynced: false,
  });
  const [engineSnap, setEngineSnap] = useState(() => audioEngine.getSnapshot());
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Direct subscription to audioEngine 250ms playback ticker when open
  useEffect(() => {
    if (!isOpen) return;
    setEngineSnap(audioEngine.getSnapshot());
    return audioEngine.subscribe((snap) => {
      setEngineSnap(snap);
    });
  }, [isOpen, track.id]);

  const activeIsPlaying =
    engineSnap.trackId === track.id ? engineSnap.isPlaying : isPlaying;
  const activeTime =
    engineSnap.trackId === track.id ? engineSnap.currentTime : currentTime;
  const effectiveDuration =
    engineSnap.trackId === track.id && engineSnap.duration > 0
      ? engineSnap.duration
      : duration > 0
      ? duration
      : track.duration;
  const progress =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (activeTime / effectiveDuration) * 100))
      : 0;

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setLyricsResult({
      syncedLyrics: [],
      lines: [],
      plainLyrics: null,
      isSynced: false,
    });

    fetchSyncedLyrics(track.title, track.artist, track.duration || effectiveDuration)
      .then((res) => {
        if (cancelled) return;
        setLyricsResult(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Unable to fetch lyrics right now.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, track.id, track.title, track.artist, track.duration]);

  const syncedLines: SyncedLyricLine[] = useMemo(() => {
    if (lyricsResult.isSynced && lyricsResult.lines.length > 0) {
      return lyricsResult.lines;
    }
    return [];
  }, [lyricsResult]);

  const seekFromPointer = (clientX: number) => {
    const bar = scrubberRef.current;
    if (!bar || effectiveDuration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const target = ratio * effectiveDuration;
    audioEngine.seekTo(target);
    onSeek(target);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Lyrics for ${track.title}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 overflow-hidden bg-[#000000] flex flex-col justify-between"
    >
      {/* Subtle Pure Monochrome Ambient Radial */}
      {lyricsGlowEnabled && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 22%, rgba(255,255,255,0.06) 0%, transparent 58%)',
            filter: 'blur(72px)',
          }}
        />
      )}

      {/* Top Dismiss Header */}
      <header className="relative z-20 w-full max-w-2xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-3 shrink-0 border-b border-white/10">
        <button
          type="button"
          aria-label="Back to player"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-[#0E0E10]/92 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/90 hover:text-white hover:border-white/35 active:scale-90 transition-all shrink-0"
        >
          <ChevronLeftGlyph className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/15 shrink-0">
            <ShowcaseArtwork
              style={track.artwork}
              coverUrl={track.coverUrl}
              alt={track.title}
              compact={true}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-white truncate leading-tight">
              {track.title}
            </h2>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenArtist(track.artist);
              }}
              className="block max-w-full text-xs text-white/60 hover:text-white hover:underline truncate mt-0.5 text-left transition-colors"
            >
              {track.artist}
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Lyrics Stage */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 space-y-5 animate-pulse">
            <div className="h-7 w-3/4 rounded-xl bg-[#0E0E10]" />
            <div className="h-8 w-5/6 rounded-xl bg-white/15" />
            <div className="h-7 w-2/3 rounded-xl bg-[#0E0E10]" />
            <div className="h-7 w-4/5 rounded-xl bg-[#0E0E10]" />
            <div className="h-7 w-1/2 rounded-xl bg-[#0E0E10]" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-3">
            <LyricsGlyph className="w-10 h-10 text-white/30" />
            <p className="text-base font-extrabold text-white">
              No lyrics available for this track
            </p>
            <p className="text-xs text-white/50 max-w-xs">{error}</p>
          </div>
        ) : syncedLines.length > 0 ? (
          <div className="flex-1 min-h-0">
            <SyncedLyricsView
              lines={syncedLines}
              currentTimeSec={activeTime}
              lyricsGlowEnabled={lyricsGlowEnabled}
              onSeekLine={(timeSec) => {
                onSeek(timeSec);
                if (!activeIsPlaying) {
                  audioEngine.resume();
                  onTogglePlay();
                }
              }}
            />
          </div>
        ) : lyricsResult.plainLyrics || lyricsResult.lines.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 sm:px-8 py-8">
            <div className="whitespace-pre-line text-lg sm:text-xl font-bold text-white/85 leading-relaxed pb-16">
              {lyricsResult.plainLyrics ??
                lyricsResult.lines.map((l) => l.text).join('\n')}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-2.5">
            <LyricsGlyph className="w-10 h-10 text-white/30" />
            <p className="text-base font-extrabold text-white">
              No lyrics available for this track
            </p>
            <p className="text-xs text-white/50 max-w-xs">
              Lyrics were not found for “{track.title}”.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Monochrome Transport Capsule */}
      <footer className="relative z-20 w-full max-w-xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shrink-0">
        <div
          className="rounded-3xl border border-white/15 px-5 py-4 space-y-3 shadow-[0_-10px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          style={{ backgroundColor: 'rgba(14, 14, 16, 0.92)' }}
        >
          <div className="space-y-1">
            <div
              ref={scrubberRef}
              role="slider"
              tabIndex={0}
              aria-label="Lyrics track progress"
              aria-valuemin={0}
              aria-valuemax={Math.round(effectiveDuration)}
              aria-valuenow={Math.round(activeTime)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seekFromPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) seekFromPointer(e.clientX);
              }}
              className="group relative w-full h-5 flex items-center cursor-pointer touch-none"
            >
              <div className="w-full h-1 group-hover:h-1.5 transition-all rounded-full bg-white/20 relative">
                <div
                  className="h-full rounded-full bg-white relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-white/55">
              <span>{formatDuration(activeTime)}</span>
              <span>{formatDuration(effectiveDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              aria-label="Previous track"
              onClick={onPrevTrack}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            >
              <PrevGlyph className="w-6 h-6" />
            </button>

            <button
              type="button"
              aria-label={activeIsPlaying ? 'Pause' : 'Play'}
              onClick={onTogglePlay}
              className="w-13 h-13 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:bg-white/90 active:scale-90 transition-all"
            >
              {activeIsPlaying ? (
                <PauseGlyph className="w-6 h-6" />
              ) : (
                <PlayGlyph className="w-6 h-6 translate-x-[1px]" />
              )}
            </button>

            <button
              type="button"
              aria-label="Next track"
              onClick={onNextTrack}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            >
              <NextGlyph className="w-6 h-6" />
            </button>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};

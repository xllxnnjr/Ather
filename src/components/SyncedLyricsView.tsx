import React, { useEffect, useMemo, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

export interface LyricLine {
  timeSec: number;
  text: string;
  isSynced?: boolean;
}

interface SyncedLyricsViewProps {
  lines: LyricLine[];
  currentTimeSec: number;
  lyricsGlowEnabled?: boolean;
  onSeekLine?: (timeSec: number) => void;
}

export const SyncedLyricsView: React.FC<SyncedLyricsViewProps> = ({
  lines,
  currentTimeSec,
  lyricsGlowEnabled = true,
  onSeekLine,
}) => {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const userScrollingRef = useRef(false);
  const scrollResumeTimerRef = useRef<number | null>(null);

  // Determine the active line index directly from live audioEngine currentTime
  const activeIndex = useMemo(() => {
    if (!lines.length) return -1;
    // Small 0.15s lookahead keeps line highlights feeling crisp and on-beat
    const t = currentTimeSec + 0.15;
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeSec <= t) idx = i;
      else break;
    }
    return idx;
  }, [lines, currentTimeSec]);

  // Smoothly auto-center the active line while the song plays
  useEffect(() => {
    if (activeIndex < 0 || userScrollingRef.current) return;
    const el = lineRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  // Briefly pause auto-scroll only while the user is actively dragging/scrolling
  const handleManualScroll = () => {
    userScrollingRef.current = true;
    if (scrollResumeTimerRef.current !== null) {
      window.clearTimeout(scrollResumeTimerRef.current);
    }
    scrollResumeTimerRef.current = window.setTimeout(() => {
      userScrollingRef.current = false;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (scrollResumeTimerRef.current !== null) {
        window.clearTimeout(scrollResumeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      onScroll={handleManualScroll}
      onWheel={handleManualScroll}
      onTouchMove={handleManualScroll}
      className="h-full overflow-y-auto no-scrollbar px-6 sm:px-8 py-16 space-y-6"
      style={{
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)',
      }}
    >
      {lines.map((line, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;
        return (
          <button
            key={`${line.timeSec}-${index}`}
            ref={(el) => {
              lineRefs.current[index] = el;
            }}
            type="button"
            onClick={() => {
              userScrollingRef.current = false;
              audioEngine.seekTo(line.timeSec);
              if (onSeekLine) onSeekLine(line.timeSec);
            }}
            className={`block w-full text-left font-extrabold leading-snug transition-all duration-300 origin-left cursor-pointer ${
              isActive
                ? 'text-2xl sm:text-3xl text-white scale-[1.02]'
                : isPast
                ? 'text-lg sm:text-xl text-white/40 hover:text-white/75'
                : 'text-lg sm:text-xl text-white/30 hover:text-white/70'
            }`}
            style={{
              textShadow:
                isActive && lyricsGlowEnabled
                  ? '0 0 28px rgba(255,255,255,0.28)'
                  : 'none',
            }}
          >
            {line.text}
          </button>
        );
      })}
    </div>
  );
};

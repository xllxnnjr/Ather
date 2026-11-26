import { Capacitor } from '@capacitor/core';
import {
  MediaSession as NativeMediaSession,
  MediaSessionAction as CapMediaSessionAction,
} from '@capgo/capacitor-media-session';
import { ShowcaseTrack } from '../types/music';

export interface BackgroundMediaHandlers {
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekOffset: (offsetSeconds: number) => void;
}

let lastPositionSyncMs = 0;

function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function buildMediaArtwork(coverUrl?: string): MediaImage[] {
  if (!coverUrl || !coverUrl.startsWith('http')) {
    return [
      {
        src: '/assets/aistudio/image_6ac665d7.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ];
  }

  const sizes: Array<{ dim: number; label: string }> = [
    { dim: 96, label: '96x96' },
    { dim: 192, label: '192x192' },
    { dim: 300, label: '300x300' },
    { dim: 512, label: '512x512' },
  ];

  const isItunesUrl = /(?:\/\d+x\d+bb(-\d+)?\.|\d+x\d+bb)/.test(coverUrl);
  if (!isItunesUrl) {
    return sizes.map(({ label }) => ({ src: coverUrl, sizes: label }));
  }

  return sizes.map(({ dim, label }) => ({
    src: coverUrl.replace(
      /(?:\/\d+x\d+bb(-\d+)?\.|\d+x\d+bb)/g,
      (match) => (match.startsWith('/') ? `/${dim}x${dim}bb.` : `${dim}x${dim}bb`)
    ),
    sizes: label,
    type: 'image/jpeg',
  }));
}

export function registerBackgroundMediaActions(
  handlers: BackgroundMediaHandlers
): void {
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const safeSet = (
      action: MediaSessionAction,
      fn: MediaSessionActionHandler | null
    ) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // ignore unsupported browser media action
      }
    };

    safeSet('play', () => handlers.onPlay());
    safeSet('pause', () => handlers.onPause());
    safeSet('previoustrack', () => handlers.onPrevious());
    safeSet('nexttrack', () => handlers.onNext());
    safeSet('stop', () => handlers.onPause());
    safeSet('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        handlers.onSeekTo(Math.max(0, details.seekTime));
      }
    });
    safeSet('seekbackward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
      handlers.onSeekOffset(-Math.abs(offset));
    });
    safeSet('seekforward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
      handlers.onSeekOffset(Math.abs(offset));
    });
  }

  if (isNativePlatform()) {
    const regNative = (
      action: CapMediaSessionAction,
      fn: (details: { seekTime?: number | null }) => void
    ) => {
      void NativeMediaSession.setActionHandler({ action }, fn).catch(() => undefined);
    };

    regNative('play', () => handlers.onPlay());
    regNative('pause', () => handlers.onPause());
    regNative('previoustrack', () => handlers.onPrevious());
    regNative('nexttrack', () => handlers.onNext());
    regNative('stop', () => handlers.onPause());
    regNative('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        handlers.onSeekTo(Math.max(0, details.seekTime));
      }
    });
    regNative('seekbackward', () => handlers.onSeekOffset(-10));
    regNative('seekforward', () => handlers.onSeekOffset(10));
  }
}

export function syncBackgroundTrackMetadata(track: ShowcaseTrack | null): void {
  if (!track) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        // ignore
      }
    }
    if (isNativePlatform()) {
      void NativeMediaSession.setPlaybackState({ playbackState: 'none' }).catch(
        () => undefined
      );
    }
    return;
  }

  const artwork = buildMediaArtwork(track.coverUrl);
  const title = track.title || 'unknown track';
  const artist = track.artist || 'Ather';
  const album = track.album || 'Ather';

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album,
          artwork,
        });
      }
    } catch {
      // ignore unsupported MediaMetadata
    }
  }

  if (isNativePlatform()) {
    void NativeMediaSession.setMetadata({
      title,
      artist,
      album,
      artwork,
    }).catch(() => undefined);
  }
}

export function syncBackgroundPlaybackState(isPlaying: boolean): void {
  const stateValue = isPlaying ? 'playing' : 'paused';
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = stateValue;
    } catch {
      // ignore
    }
  }

  if (isNativePlatform()) {
    void NativeMediaSession.setPlaybackState({
      playbackState: stateValue,
    }).catch(() => undefined);
  }
}

export function syncBackgroundPosition(
  positionSec: number,
  durationSec: number,
  force = false
): void {
  const now = Date.now();
  if (!force && now - lastPositionSyncMs < 950) return;
  lastPositionSyncMs = now;

  const safeDuration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  if (safeDuration <= 0) return;

  const safePos = Math.max(
    0,
    Math.min(safeDuration, Number.isFinite(positionSec) ? positionSec : 0)
  );

  if (
    typeof navigator !== 'undefined' &&
    'mediaSession' in navigator &&
    typeof navigator.mediaSession.setPositionState === 'function'
  ) {
    try {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: 1.0,
        position: safePos,
      });
    } catch {
      // ignore range errors
    }
  }

  if (isNativePlatform()) {
    void NativeMediaSession.setPositionState({
      duration: safeDuration,
      playbackRate: 1.0,
      position: safePos,
    }).catch(() => undefined);
  }
}

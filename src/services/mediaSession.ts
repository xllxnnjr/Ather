import { ShowcaseTrack } from '../types/music';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekOffset: (offsetSeconds: number) => void;
}

// 1-second ultra-quiet 8kHz mono PCM WAV encoded as data URI so background WebView audio focus stays alive
const SILENT_KEEPALIVE_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

class AtherMediaSessionService {
  private callbacks: MediaSessionCallbacks | null = null;
  private lastTrackId: string | null = null;
  private silentKeepAliveAudio: HTMLAudioElement | null = null;
  private wakeLock: { release?: () => Promise<void> } | null = null;
  private lastPositionSyncAt = 0;

  init(callbacks: MediaSessionCallbacks) {
    this.callbacks = callbacks;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    const safeSetHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported actions in older WebViews
      }
    };

    safeSetHandler('play', () => this.callbacks?.onPlay());
    safeSetHandler('pause', () => this.callbacks?.onPause());
    safeSetHandler('previoustrack', () => this.callbacks?.onPrevious());
    safeSetHandler('nexttrack', () => this.callbacks?.onNext());
    safeSetHandler('stop', () => this.callbacks?.onPause());
    safeSetHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        this.callbacks?.onSeekTo(Math.max(0, details.seekTime));
      }
    });
    safeSetHandler('seekbackward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
      this.callbacks?.onSeekOffset(-Math.abs(offset));
    });
    safeSetHandler('seekforward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 10;
      this.callbacks?.onSeekOffset(Math.abs(offset));
    });
  }

  private buildArtworkList(coverUrl?: string): MediaImage[] {
    if (!coverUrl || !coverUrl.startsWith('http')) {
      return [
        { src: '/assets/aistudio/image_6ac665d7.png', sizes: '512x512', type: 'image/png' },
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

  updateMetadata(track: ShowcaseTrack | null) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!track) {
      this.lastTrackId = null;
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        // ignore
      }
      return;
    }

    if (this.lastTrackId === track.id && navigator.mediaSession.metadata) {
      return;
    }
    this.lastTrackId = track.id;

    try {
      if (typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'Unknown Track',
          artist: track.artist || 'ATHER',
          album: track.album || 'ATHER',
          artwork: this.buildArtworkList(track.coverUrl),
        });
      }
    } catch {
      // ignore MediaMetadata errors in unsupported browsers
    }
  }

  updatePlaybackState(isPlaying: boolean) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch {
        // ignore
      }
    }

    if (isPlaying) {
      this.startKeepAlive();
      void this.acquireWakeLock();
    } else {
      this.stopKeepAlive();
      void this.releaseWakeLock();
    }
  }

  updatePositionState(positionSec: number, durationSec: number) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;

    const now = Date.now();
    if (now - this.lastPositionSyncAt < 800) return;
    this.lastPositionSyncAt = now;

    const safeDuration =
      Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    if (safeDuration <= 0) return;

    const safePos = Math.max(
      0,
      Math.min(safeDuration, Number.isFinite(positionSec) ? positionSec : 0)
    );

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

  private startKeepAlive() {
    if (typeof Audio === 'undefined') return;
    try {
      if (!this.silentKeepAliveAudio) {
        const audio = new Audio(SILENT_KEEPALIVE_WAV);
        audio.loop = true;
        audio.volume = 0.001;
        this.silentKeepAliveAudio = audio;
      }
      if (this.silentKeepAliveAudio.paused) {
        void this.silentKeepAliveAudio.play().catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }

  private stopKeepAlive() {
    if (!this.silentKeepAliveAudio) return;
    try {
      this.silentKeepAliveAudio.pause();
    } catch {
      // ignore
    }
  }

  private async acquireWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (this.wakeLock) return;
    try {
      const navWithWakeLock = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      this.wakeLock = (await navWithWakeLock.wakeLock?.request('screen')) ?? null;
    } catch {
      // Ignore wakeLock permission errors when screen locks or is in background
    }
  }

  private async releaseWakeLock() {
    if (!this.wakeLock) return;
    try {
      await this.wakeLock.release?.();
    } catch {
      // ignore
    } finally {
      this.wakeLock = null;
    }
  }
}

export const mediaSessionService = new AtherMediaSessionService();

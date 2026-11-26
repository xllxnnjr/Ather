import { ShowcaseTrack } from '../types/music';
import {
  registerBackgroundMediaActions,
  syncBackgroundPlaybackState,
  syncBackgroundPosition,
  syncBackgroundTrackMetadata,
} from './backgroundAudioController';

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
  private lastTrackId: string | null = null;
  private silentKeepAliveAudio: HTMLAudioElement | null = null;
  private wakeLock: { release?: () => Promise<void> } | null = null;

  init(callbacks: MediaSessionCallbacks) {
    registerBackgroundMediaActions(callbacks);
  }

  updateMetadata(track: ShowcaseTrack | null) {
    if (!track) {
      this.lastTrackId = null;
      syncBackgroundTrackMetadata(null);
      return;
    }

    if (
      this.lastTrackId === track.id &&
      typeof navigator !== 'undefined' &&
      navigator.mediaSession?.metadata
    ) {
      return;
    }
    this.lastTrackId = track.id;
    syncBackgroundTrackMetadata(track);
  }

  updatePlaybackState(isPlaying: boolean) {
    syncBackgroundPlaybackState(isPlaying);

    if (isPlaying) {
      this.startKeepAlive();
      void this.acquireWakeLock();
    } else {
      this.stopKeepAlive();
      void this.releaseWakeLock();
    }
  }

  updatePositionState(positionSec: number, durationSec: number, force = false) {
    syncBackgroundPosition(positionSec, durationSec, force);
  }

  private startKeepAlive() {
    if (typeof Audio === 'undefined') return;
    try {
      if (!this.silentKeepAliveAudio) {
        const audio = new Audio(SILENT_KEEPALIVE_WAV);
        audio.loop = true;
        audio.volume = 0.001;
        audio.setAttribute('playsinline', 'true');
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

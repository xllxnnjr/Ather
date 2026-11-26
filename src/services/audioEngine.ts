import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ShowcaseTrack } from '../types/music';
import { recordTrackStream } from './listeningStats';
import { mediaSessionService } from './mediaSession';
import { getOfflineAudioUrl } from './offlineDownloads';
import { loadPlaybackSession, savePlaybackSession } from './playbackPersistence';
import { queueManager } from './queueManager';
import {
  AudioQualityTier,
  preloadFullAudioStream,
  resolveFullAudioStream,
} from './simpmusicStreamResolver';
import { getActiveUserId } from './userScope';

export interface AudioEngineSnapshot {
  trackId: string | null;
  mode: 'html-audio';
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

type AudioStateListener = (snapshot: AudioEngineSnapshot) => void;

interface CachedResolvedAudio {
  url: string;
  streamStatus: 'full' | 'preview-only';
  streamSource?: ShowcaseTrack['streamSource'];
  duration?: number;
  audiusId?: string;
}

class UnifiedAudioEngine {
  private htmlAudio: HTMLAudioElement | null = null;

  private listeners = new Set<AudioStateListener>();
  private onEndedCallback: (() => void) | null = null;
  private onTrackStreamResolvedCallback: ((track: ShowcaseTrack) => void) | null = null;
  private navCallbacks: { onPrevious?: () => void; onNext?: () => void } = {};

  private activeTrack: ShowcaseTrack | null = null;
  private desiredPlaying = false;
  private resolveSeq = 0;
  private hasRestoredSession = false;
  private currentUid: string | null = null;
  private trackingEnabled = true;
  private streamRecordedForSession = false;
  private accumulatedListenSec = 0;
  private lastListenSampleAt = 0;
  private isAdvancingTrack = false;

  private preResolvedCache = new Map<string, CachedResolvedAudio>();
  private preloadingIds = new Set<string>();
  private preferredQualityTier: AudioQualityTier = 'High';
  private eqBands: number[] = [0, 0, 0, 0, 0];
  private volumeNormalization = true;
  private monoAudio = false;
  private crossfadeSeconds = 4;
  private gaplessPlayback = true;
  private fadeRafId: number | null = null;

  private state: AudioEngineSnapshot = {
    trackId: null,
    mode: 'html-audio',
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    error: null,
  };

  constructor() {
    this.restoreSessionOnBoot();
    this.bindLifecyclePersistence();

    mediaSessionService.init({
      onPlay: () => {
        void this.resume();
      },
      onPause: () => {
        this.pause();
      },
      onPrevious: () => {
        if (this.navCallbacks.onPrevious) {
          this.navCallbacks.onPrevious();
          return;
        }
        const prev = queueManager.getPreviousTrack(this.getCurrentTime());
        if (prev.action === 'restart') {
          this.seekTo(0);
        } else if (prev.action === 'track' && prev.track) {
          void this.playTrack(prev.track, 0);
        }
      },
      onNext: () => {
        if (this.navCallbacks.onNext) {
          this.navCallbacks.onNext();
          return;
        }
        const next = queueManager.getNextTrack(true);
        if (next) {
          void this.playTrack(next, 0);
        }
      },
      onSeekTo: (seconds) => this.seekTo(seconds),
      onSeekOffset: (offset) => {
        this.seekTo(this.getCurrentTime() + offset);
      },
    });
  }

  public setNavigationCallbacks(callbacks: {
    onPrevious?: () => void;
    onNext?: () => void;
  }) {
    this.navCallbacks = callbacks;
  }

  public setOnTrackStreamResolved(cb: ((track: ShowcaseTrack) => void) | null) {
    this.onTrackStreamResolvedCallback = cb;
  }

  public setCurrentUid(uid: string | null) {
    this.currentUid = uid;
  }

  public setTrackingEnabled(enabled: boolean) {
    this.trackingEnabled = enabled;
  }

  public setPreferredQualityTier(tier: AudioQualityTier) {
    this.preferredQualityTier = tier;
  }

  public setEqBands(bands: number[]) {
    if (Array.isArray(bands) && bands.length > 0) {
      this.eqBands = bands.slice(0, 5);
    }
  }

  public setVolumeNormalization(enabled: boolean) {
    this.volumeNormalization = Boolean(enabled);
    if (this.htmlAudio && !this.fadeRafId) {
      this.htmlAudio.volume = this.getTargetBaseVolume();
    }
  }

  public setMonoAudio(enabled: boolean) {
    this.monoAudio = Boolean(enabled);
  }

  public setCrossfadeSeconds(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(12, Number(seconds) || 0));
  }

  public setGaplessPlayback(enabled: boolean) {
    this.gaplessPlayback = Boolean(enabled);
  }

  private getTargetBaseVolume(): number {
    // Subtle headroom scaling when volume normalization or bass boost is active
    const maxBoostDb = Math.max(0, ...this.eqBands);
    const headroom = maxBoostDb > 3 ? Math.max(0.75, 1 - maxBoostDb * 0.015) : 1;
    return this.volumeNormalization ? Math.min(0.92, 0.9 * headroom) : Math.min(1, headroom);
  }

  private runFadeInRamp(audio: HTMLAudioElement) {
    if (typeof window === 'undefined') return;
    if (this.fadeRafId !== null) {
      window.cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
    const targetVol = this.getTargetBaseVolume();
    const fadeMs = Math.min(2400, this.crossfadeSeconds * 400);
    if (fadeMs <= 80) {
      audio.volume = targetVol;
      return;
    }
    const start = performance.now();
    audio.volume = Math.max(0.18, targetVol * 0.3);
    const step = (now: number) => {
      const pct = Math.min(1, (now - start) / fadeMs);
      audio.volume = Math.min(1, targetVol * (0.3 + 0.7 * pct));
      if (pct < 1) {
        this.fadeRafId = window.requestAnimationFrame(step);
      } else {
        audio.volume = targetVol;
        this.fadeRafId = null;
      }
    };
    this.fadeRafId = window.requestAnimationFrame(step);
  }

  public getRestoredTrack(): ShowcaseTrack | null {
    return this.activeTrack;
  }

  private restoreSessionOnBoot() {
    if (this.hasRestoredSession) return;
    this.hasRestoredSession = true;

    const bootUid = getActiveUserId();
    this.currentUid = bootUid;
    if (!bootUid) return;

    const saved = loadPlaybackSession(bootUid);
    if (!saved) return;

    this.activeTrack = saved.track;

    if (
      saved.queue &&
      Array.isArray(saved.queue.tracks) &&
      saved.queue.tracks.length > 0
    ) {
      queueManager.restoreQueueState({
        scope: saved.queue.scope,
        contextId: saved.queue.contextId,
        tracks: saved.queue.tracks,
        currentIndex: saved.queue.currentIndex,
      });
    }

    this.state = {
      trackId: saved.track.id,
      mode: 'html-audio',
      isPlaying: false,
      isBuffering: false,
      currentTime: saved.positionSec,
      duration: saved.durationSec || saved.track.duration || 0,
      error: null,
    };
    mediaSessionService.updateMetadata(saved.track);
    mediaSessionService.updatePlaybackState(false);
    this.emit();
  }

  public resetForAccountSwitch(): void {
    this.resolveSeq += 1;
    this.desiredPlaying = false;
    this.stopHtmlAudio(true);
    this.activeTrack = null;
    this.streamRecordedForSession = false;
    this.accumulatedListenSec = 0;
    this.lastListenSampleAt = 0;
    this.currentUid = null;
    queueManager.reset();
    this.state = {
      trackId: null,
      mode: 'html-audio',
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      error: null,
    };
    mediaSessionService.updateMetadata(null);
    mediaSessionService.updatePlaybackState(false);
    this.emit();
  }

  public reloadSessionForActiveAccount(uidOverride?: string | null): ShowcaseTrack | null {
    this.resolveSeq += 1;
    this.desiredPlaying = false;
    this.stopHtmlAudio(true);
    this.activeTrack = null;
    this.streamRecordedForSession = false;
    this.accumulatedListenSec = 0;
    this.lastListenSampleAt = 0;
    queueManager.reset();

    const targetUid = uidOverride !== undefined ? uidOverride : getActiveUserId();
    this.currentUid = targetUid;

    const saved = targetUid ? loadPlaybackSession(targetUid) : null;
    if (!saved) {
      this.state = {
        trackId: null,
        mode: 'html-audio',
        isPlaying: false,
        isBuffering: false,
        currentTime: 0,
        duration: 0,
        error: null,
      };
      mediaSessionService.updateMetadata(null);
      mediaSessionService.updatePlaybackState(false);
      this.emit();
      return null;
    }

    this.activeTrack = saved.track;
    if (
      saved.queue &&
      Array.isArray(saved.queue.tracks) &&
      saved.queue.tracks.length > 0
    ) {
      queueManager.restoreQueueState({
        scope: saved.queue.scope,
        contextId: saved.queue.contextId,
        tracks: saved.queue.tracks,
        currentIndex: saved.queue.currentIndex,
      });
    }

    this.state = {
      trackId: saved.track.id,
      mode: 'html-audio',
      isPlaying: false,
      isBuffering: false,
      currentTime: saved.positionSec,
      duration: saved.durationSec || saved.track.duration || 0,
      error: null,
    };
    mediaSessionService.updateMetadata(saved.track);
    mediaSessionService.updatePlaybackState(false);
    this.emit();
    return saved.track;
  }

  public loadPausedTrackAtPosition(track: ShowcaseTrack, positionSec = 0) {
    this.pause();
    this.activeTrack = track;
    this.desiredPlaying = false;
    this.state = {
      trackId: track.id,
      mode: 'html-audio',
      isPlaying: false,
      isBuffering: false,
      currentTime: Math.max(0, positionSec),
      duration: track.duration || 0,
      error: null,
    };
    mediaSessionService.updateMetadata(track);
    mediaSessionService.updatePlaybackState(false);
    this.persistNow(true);
    this.emit();
  }

  private persistNow(force = false) {
    if (!this.activeTrack) return;
    const effectiveUid = this.currentUid ?? getActiveUserId();
    if (!effectiveUid) return;
    const q = queueManager.getState();
    savePlaybackSession(
      {
        track: this.activeTrack,
        positionSec: this.state.currentTime,
        durationSec: this.state.duration || this.activeTrack.duration || 0,
        updatedAt: Date.now(),
        queue:
          q.tracks.length > 0
            ? {
                scope: q.scope,
                contextId: q.contextId,
                tracks: q.tracks,
                currentIndex: q.currentIndex,
              }
            : undefined,
      },
      { force, uid: effectiveUid }
    );
  }

  private bindLifecyclePersistence() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const flush = () => this.persistNow(true);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
        if (this.desiredPlaying) {
          mediaSessionService.updatePlaybackState(true);
          if (this.htmlAudio?.paused) {
            void this.htmlAudio.play().catch(() => undefined);
          }
        }
      }
    });

    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          flush();
          if (this.desiredPlaying) {
            mediaSessionService.updatePlaybackState(true);
            if (this.htmlAudio?.paused && this.htmlAudio.src) {
              void this.htmlAudio.play().catch(() => undefined);
            }
          }
        }
      }).catch(() => undefined);
    }
  }

  private sampleRealListening(fromFinish = false) {
    if (!this.trackingEnabled || !this.activeTrack || this.streamRecordedForSession) {
      return;
    }

    const now = Date.now();
    if (!fromFinish && this.state.isPlaying) {
      if (this.lastListenSampleAt > 0) {
        const dt = Math.min(2.5, Math.max(0, (now - this.lastListenSampleAt) / 1000));
        this.accumulatedListenSec += dt;
      }
      this.lastListenSampleAt = now;
    }

    const effectiveListened = fromFinish
      ? Math.max(
          this.accumulatedListenSec,
          this.state.duration > 0
            ? Math.min(this.state.duration, this.state.currentTime || this.state.duration)
            : 30
        )
      : this.accumulatedListenSec;

    if (this.accumulatedListenSec >= 25 || (fromFinish && effectiveListened >= 5)) {
      this.streamRecordedForSession = true;
      void recordTrackStream(
        this.activeTrack,
        Math.max(25, Math.round(effectiveListened)),
        this.currentUid
      ).catch(() => undefined);
    }
  }

  private emit() {
    const copy = { ...this.state };
    this.listeners.forEach((cb) => cb(copy));
  }

  /**
   * Maintains ONE persistent HTMLAudioElement with playsInline so mobile browsers
   * and Android WebViews never drop media activation across track auto-advance.
   */
  private ensureHtmlAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (this.htmlAudio) return this.htmlAudio;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');

    audio.addEventListener('loadedmetadata', () => {
      const d =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : this.state.duration;
      this.state = { ...this.state, duration: d };
      this.emit();
    });

    audio.addEventListener('timeupdate', () => {
      const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : this.state.duration;
      this.state = {
        ...this.state,
        currentTime: cur,
        duration: dur,
      };
      mediaSessionService.updatePositionState(cur, dur);
      this.sampleRealListening(false);
      this.persistNow(false);

      // Preload upcoming queue track before end so auto-advance is instant on mobile
      const preloadLeadSec = this.gaplessPlayback ? 12 : 4;
      if (dur > 0 && dur - cur <= preloadLeadSec) {
        this.preloadNextFromQueue();
      }
      if (this.crossfadeSeconds > 0 && dur > 8 && dur - cur > 0 && dur - cur < Math.min(2.5, this.crossfadeSeconds * 0.4)) {
        const remainRatio = Math.max(0.25, (dur - cur) / Math.min(2.5, this.crossfadeSeconds * 0.4));
        audio.volume = this.getTargetBaseVolume() * remainRatio;
      }
      this.emit();
    });

    audio.addEventListener('play', () => {
      this.isAdvancingTrack = false;
      this.lastListenSampleAt = Date.now();
      this.state = {
        ...this.state,
        isPlaying: true,
        isBuffering: false,
        error: null,
      };
      mediaSessionService.updatePlaybackState(true);
      this.emit();
    });

    audio.addEventListener('waiting', () => {
      if (!this.desiredPlaying) return;
      this.state = { ...this.state, isBuffering: true };
      this.emit();
    });

    audio.addEventListener('playing', () => {
      this.isAdvancingTrack = false;
      this.state = {
        ...this.state,
        isPlaying: true,
        isBuffering: false,
        error: null,
      };
      this.emit();
    });

    audio.addEventListener('pause', () => {
      if (audio.ended || this.isAdvancingTrack) return;
      this.lastListenSampleAt = 0;
      this.state = { ...this.state, isPlaying: false, isBuffering: false };
      mediaSessionService.updatePlaybackState(false);
      this.persistNow(true);
      this.emit();
    });

    audio.addEventListener('ended', () => {
      this.lastListenSampleAt = 0;
      this.sampleRealListening(true);
      this.persistNow(true);

      if (this.onEndedCallback) {
        // Keep desiredPlaying/Audio element hot on mobile while calling onEndedCallback synchronously
        this.isAdvancingTrack = true;
        this.onEndedCallback();
        return;
      }

      this.desiredPlaying = false;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        currentTime: this.state.duration,
      };
      mediaSessionService.updatePlaybackState(false);
      this.emit();
    });

    audio.addEventListener('error', () => {
      this.isAdvancingTrack = false;
      this.desiredPlaying = false;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        error: 'unable to play this audio stream.',
      };
      mediaSessionService.updatePlaybackState(false);
      this.emit();
    });

    this.htmlAudio = audio;
    return audio;
  }

  private stopHtmlAudio(clearSource = false) {
    if (!this.htmlAudio) return;
    try {
      this.htmlAudio.pause();
      if (clearSource) {
        this.htmlAudio.removeAttribute('src');
        this.htmlAudio.load();
      }
    } catch {
      // ignore
    }
  }

  private preloadNextFromQueue() {
    const { tracks, currentIndex, repeatMode } = queueManager.getState();
    if (tracks.length === 0 || currentIndex < 0) return;
    const nextIdx =
      currentIndex + 1 < tracks.length
        ? currentIndex + 1
        : repeatMode === 'all'
        ? 0
        : -1;
    if (nextIdx >= 0 && tracks[nextIdx]) {
      this.preloadTrack(tracks[nextIdx]);
    }
  }

  private getBestImmediateUrl(track: ShowcaseTrack): CachedResolvedAudio | null {
    const cached = this.preResolvedCache.get(track.id);
    if (cached?.url) return cached;
    if (track.streamUrl && track.streamStatus === 'full') {
      return {
        url: track.streamUrl,
        streamStatus: 'full',
        duration: track.duration,
        audiusId: track.audiusId,
      };
    }
    if (track.streamUrl) {
      return {
        url: track.streamUrl,
        streamStatus: track.streamStatus === 'full' ? 'full' : 'preview-only',
        duration: track.duration,
        audiusId: track.audiusId,
      };
    }
    if (track.previewUrl) {
      return {
        url: track.previewUrl,
        streamStatus: 'preview-only',
        duration: track.duration,
      };
    }
    return null;
  }

  private assignAndPlayAudio(
    audio: HTMLAudioElement,
    url: string,
    startSeconds = 0
  ): Promise<boolean> {
    this.isAdvancingTrack = true;
    try {
      // Never call removeAttribute('src') + load() between consecutive songs
      if (audio.src !== url) {
        audio.src = url;
      }
      if (startSeconds > 0) {
        const applyStartSeek = () => {
          try {
            audio.currentTime = startSeconds;
          } catch {
            // ignore seek range error
          }
        };
        if (audio.readyState >= 1) {
          applyStartSeek();
        } else {
          audio.addEventListener('loadedmetadata', applyStartSeek, { once: true });
        }
      } else {
        try {
          if (audio.readyState >= 1) audio.currentTime = 0;
        } catch {
          // ignore
        }
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        return playPromise
          .then(() => {
            this.isAdvancingTrack = false;
            this.runFadeInRamp(audio);
            return true;
          })
          .catch(() => {
            this.isAdvancingTrack = false;
            return false;
          });
      }
      this.isAdvancingTrack = false;
      return Promise.resolve(true);
    } catch {
      this.isAdvancingTrack = false;
      return Promise.resolve(false);
    }
  }

  public getCurrentTime(): number {
    const t = this.htmlAudio?.currentTime ?? this.state.currentTime;
    return Number.isFinite(t) && t >= 0 ? t : this.state.currentTime;
  }

  public getDuration(): number {
    const d = this.htmlAudio?.duration ?? 0;
    return Number.isFinite(d) && d > 0 ? d : this.state.duration;
  }

  public async playTrack(track: ShowcaseTrack, startSeconds = 0) {
    const seq = ++this.resolveSeq;
    const isSameTrackResume =
      this.activeTrack?.id === track.id && !this.desiredPlaying && startSeconds > 0;
    this.activeTrack = track;
    this.desiredPlaying = true;

    if (!isSameTrackResume) {
      this.streamRecordedForSession = false;
      this.accumulatedListenSec = 0;
    }
    this.lastListenSampleAt = Date.now();

    const safeStart = Math.max(0, startSeconds || 0);
    const immediate = this.getBestImmediateUrl(track);

    this.state = {
      trackId: track.id,
      mode: 'html-audio',
      isPlaying: false,
      isBuffering: true,
      currentTime: safeStart,
      duration: track.duration > 0 ? track.duration : 0,
      error: null,
    };
    mediaSessionService.updateMetadata(track);
    mediaSessionService.updatePlaybackState(true);
    this.persistNow(true);
    this.emit();

    const audio = this.ensureHtmlAudio();
    if (!audio) {
      this.desiredPlaying = false;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        error: 'audio playback is not supported in this browser.',
      };
      this.emit();
      return;
    }

    // Start immediate cached/stream/preview audio synchronously in the same tick as user tap or ended event
    let startedImmediate = false;
    if (immediate?.url) {
      startedImmediate = await this.assignAndPlayAudio(
        audio,
        immediate.url,
        safeStart < 29 || immediate.streamStatus === 'full' ? safeStart : 0
      );
      if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;
      if (startedImmediate && immediate.streamStatus === 'full') {
        const updatedTrack: ShowcaseTrack = {
          ...track,
          streamUrl: immediate.url,
          audiusId: immediate.audiusId ?? track.audiusId,
          duration: immediate.duration || track.duration,
          streamStatus: 'full',
        };
        this.activeTrack = updatedTrack;
        this.onTrackStreamResolvedCallback?.(updatedTrack);
        this.preloadNextFromQueue();
        return;
      }
    }

    // Check offline IndexedDB blob & SimpMusic-style full-track stream resolver concurrently
    const [offlineUrl, resolvedStream] = await Promise.all([
      getOfflineAudioUrl(track.id, this.currentUid).catch(() => null),
      resolveFullAudioStream(track, this.preferredQualityTier).catch(() => null),
    ]);

    if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;

    if (offlineUrl) {
      this.preResolvedCache.set(track.id, {
        url: offlineUrl,
        streamStatus: 'full',
        duration: track.duration,
      });
      const resumeAt = startedImmediate ? this.getCurrentTime() : safeStart;
      const ok = await this.assignAndPlayAudio(audio, offlineUrl, resumeAt);
      if (ok) {
        const updated: ShowcaseTrack = {
          ...track,
          streamStatus: 'full',
        };
        this.activeTrack = updated;
        this.onTrackStreamResolvedCallback?.(updated);
        this.preloadNextFromQueue();
        return;
      }
    }

    if (resolvedStream?.streamUrl && resolvedStream.source !== 'itunes-preview') {
      const nextDuration =
        resolvedStream.durationSec > 0 ? resolvedStream.durationSec : track.duration;
      this.preResolvedCache.set(track.id, {
        url: resolvedStream.streamUrl,
        streamStatus: 'full',
        streamSource: resolvedStream.source,
        duration: nextDuration,
      });
      const resumeAt = startedImmediate ? this.getCurrentTime() : safeStart;
      const ok = await this.assignAndPlayAudio(audio, resolvedStream.streamUrl, resumeAt);
      if (ok) {
        const updatedTrack: ShowcaseTrack = {
          ...track,
          streamUrl: resolvedStream.streamUrl,
          fullDuration: nextDuration,
          duration: nextDuration,
          durationMs: nextDuration * 1000,
          streamStatus: 'full',
          streamSource: resolvedStream.source,
        };
        this.activeTrack = updatedTrack;
        this.onTrackStreamResolvedCallback?.(updatedTrack);
        this.preloadNextFromQueue();
        return;
      }
    }

    // Fallback: remain on or start iTunes 30s previewUrl
    if (track.previewUrl) {
      this.preResolvedCache.set(track.id, {
        url: track.previewUrl,
        streamStatus: 'preview-only',
        streamSource: 'itunes-preview',
        duration: 30,
      });
      const previewTrack: ShowcaseTrack = {
        ...track,
        streamStatus: 'preview-only',
        streamSource: 'itunes-preview',
      };
      this.activeTrack = previewTrack;
      this.onTrackStreamResolvedCallback?.(previewTrack);

      if (startedImmediate) {
        this.preloadNextFromQueue();
        return;
      }
      const ok = await this.assignAndPlayAudio(
        audio,
        track.previewUrl,
        safeStart < 29 ? safeStart : 0
      );
      if (ok) {
        this.preloadNextFromQueue();
        return;
      }
    }

    if (!startedImmediate) {
      this.desiredPlaying = false;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        error: 'no playable audio source matched this track.',
      };
      mediaSessionService.updatePlaybackState(false);
      this.emit();
    }
  }

  public preloadTrack(track: ShowcaseTrack) {
    if (
      this.preResolvedCache.has(track.id) ||
      this.preloadingIds.has(track.id)
    ) {
      return;
    }
    if (track.streamUrl && track.streamStatus === 'full') {
      this.preResolvedCache.set(track.id, {
        url: track.streamUrl,
        streamStatus: 'full',
        duration: track.duration,
        audiusId: track.audiusId,
      });
      return;
    }
    preloadFullAudioStream(track, this.preferredQualityTier);
    this.preloadingIds.add(track.id);
    void (async () => {
      try {
        const offline = await getOfflineAudioUrl(track.id, this.currentUid).catch(
          () => null
        );
        if (offline) {
          this.preResolvedCache.set(track.id, {
            url: offline,
            streamStatus: 'full',
            duration: track.duration,
          });
          return;
        }
        const resolved = await resolveFullAudioStream(track, this.preferredQualityTier);
        if (resolved?.streamUrl && resolved.source !== 'itunes-preview') {
          const nextDur = resolved.durationSec > 0 ? resolved.durationSec : track.duration;
          this.preResolvedCache.set(track.id, {
            url: resolved.streamUrl,
            streamStatus: 'full',
            streamSource: resolved.source,
            duration: nextDur,
          });
          queueManager.syncTrackMetadata({
            ...track,
            streamUrl: resolved.streamUrl,
            fullDuration: nextDur,
            duration: nextDur,
            durationMs: nextDur * 1000,
            streamStatus: 'full',
            streamSource: resolved.source,
          });
        } else if (track.previewUrl) {
          this.preResolvedCache.set(track.id, {
            url: track.previewUrl,
            streamStatus: 'preview-only',
            streamSource: 'itunes-preview',
            duration: 30,
          });
        }
      } catch {
        if (track.previewUrl) {
          this.preResolvedCache.set(track.id, {
            url: track.previewUrl,
            streamStatus: 'preview-only',
            streamSource: 'itunes-preview',
            duration: 30,
          });
        }
      } finally {
        this.preloadingIds.delete(track.id);
      }
    })();
  }

  public pause() {
    this.desiredPlaying = false;
    this.isAdvancingTrack = false;
    this.lastListenSampleAt = 0;
    try {
      this.htmlAudio?.pause();
    } catch {
      // ignore
    }
    this.state = {
      ...this.state,
      isPlaying: false,
      isBuffering: false,
    };
    mediaSessionService.updatePlaybackState(false);
    this.persistNow(true);
    this.emit();
  }

  public async resume() {
    if (!this.activeTrack) return;
    this.desiredPlaying = true;
    this.lastListenSampleAt = Date.now();
    mediaSessionService.updateMetadata(this.activeTrack);
    mediaSessionService.updatePlaybackState(true);

    if (this.htmlAudio?.src) {
      try {
        await this.htmlAudio.play();
        this.state = { ...this.state, isPlaying: true, isBuffering: false, error: null };
        this.emit();
        return;
      } catch {
        // Re-resolve cleanly below
      }
    }

    const resumeAt = Math.max(0, Math.floor(this.state.currentTime || 0));
    await this.playTrack(this.activeTrack, resumeAt);
  }

  public togglePlay() {
    if (this.state.isPlaying || this.desiredPlaying) {
      this.pause();
    } else {
      void this.resume();
    }
  }

  public seekTo(seconds: number) {
    const maxDur = this.getDuration();
    const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, seconds) : seconds);
    this.state = { ...this.state, currentTime: clamped };
    mediaSessionService.updatePositionState(clamped, maxDur);
    this.persistNow(true);
    this.emit();

    if (this.htmlAudio) {
      try {
        this.htmlAudio.currentTime = clamped;
      } catch {
        // ignore
      }
    }
  }

  public setOnEnded(cb: (() => void) | null) {
    this.onEndedCallback = cb;
  }

  public getSnapshot(): AudioEngineSnapshot {
    return { ...this.state };
  }

  public subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const audioEngine = new UnifiedAudioEngine();

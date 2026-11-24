import { ShowcaseTrack } from '../types/music';
import { resolveFullAudiusTrack } from './audiusApi';
import { recordTrackStream } from './listeningStats';
import { mediaSessionService } from './mediaSession';
import { resolveYouTubeCandidates } from './musicApi';
import { getOfflineAudioUrl } from './offlineDownloads';
import { loadPlaybackSession, savePlaybackSession } from './playbackPersistence';
import { queueManager } from './queueManager';
import { getActiveUserId } from './userScope';

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number } | string) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number } | string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setSize?: (width: number, height: number) => void;
  getIframe?: () => HTMLElement | null;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  unMute: () => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
}

interface YTGlobal {
  Player: new (
    element: HTMLElement | string,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number; target: YTPlayerInstance }) => void;
      };
    }
  ) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface AudioEngineSnapshot {
  trackId: string | null;
  videoId: string | null;
  mode: 'youtube' | 'html-audio';
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

type AudioStateListener = (snapshot: AudioEngineSnapshot) => void;

const HOST_ELEMENT_ID = 'ather-yt-host';
const PLAYER_ELEMENT_ID = 'ather-yt-player';

class UnifiedAudioEngine {
  private player: YTPlayerInstance | null = null;
  private isPlayerReady = false;
  private readyPromise: Promise<YTPlayerInstance | null> | null = null;
  private apiLoadingPromise: Promise<void> | null = null;

  private activeCoverEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private htmlAudio: HTMLAudioElement | null = null;
  private activeMode: 'youtube' | 'html-audio' = 'youtube';

  private listeners = new Set<AudioStateListener>();
  private onEndedCallback: (() => void) | null = null;
  private navCallbacks: { onPrevious?: () => void; onNext?: () => void } = {};

  private activeTrack: ShowcaseTrack | null = null;
  private candidates: string[] = [];
  private candidateIndex = 0;
  private desiredPlaying = false;
  private pendingVideoLoad: { videoId: string; startSeconds: number; autoplay: boolean } | null = null;
  private watchdogTimer: number | null = null;
  private tickTimer: number | null = null;
  private resolveSeq = 0;
  private hasRestoredSession = false;
  private currentUid: string | null = null;
  private trackingEnabled = true;
  private streamRecordedForSession = false;
  private accumulatedListenSec = 0;
  private lastListenSampleAt = 0;

  private state: AudioEngineSnapshot = {
    trackId: null,
    videoId: null,
    mode: 'youtube',
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

    // Pre-warm the YouTube IFrame API & permanent #ather-yt-host once DOM is ready
    // so the very first song tap starts without a 2s script bootstrap delay.
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const warmup = () => {
        if (document.body) {
          void this.ensurePlayer();
        }
      };
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', warmup, { once: true });
      } else {
        window.setTimeout(warmup, 80);
      }
    }
  }

  public setNavigationCallbacks(callbacks: {
    onPrevious?: () => void;
    onNext?: () => void;
  }) {
    this.navCallbacks = callbacks;
  }

  public setCurrentUid(uid: string | null) {
    this.currentUid = uid;
  }

  public setTrackingEnabled(enabled: boolean) {
    this.trackingEnabled = enabled;
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
      videoId: saved.track.youtubeVideoId ?? null,
      mode: 'youtube',
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
    this.clearWatchdog();
    this.stopTicker();
    this.stopYouTubeAudio();
    this.stopHtmlAudio();
    this.activeTrack = null;
    this.candidates = [];
    this.candidateIndex = 0;
    this.pendingVideoLoad = null;
    this.streamRecordedForSession = false;
    this.accumulatedListenSec = 0;
    this.lastListenSampleAt = 0;
    this.currentUid = null;
    queueManager.reset();
    this.state = {
      trackId: null,
      videoId: null,
      mode: 'youtube',
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
    this.clearWatchdog();
    this.stopTicker();
    this.stopYouTubeAudio();
    this.stopHtmlAudio();
    this.activeTrack = null;
    this.candidates = [];
    this.candidateIndex = 0;
    this.pendingVideoLoad = null;
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
        videoId: null,
        mode: 'youtube',
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
      videoId: saved.track.youtubeVideoId ?? null,
      mode: 'youtube',
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
      videoId: track.youtubeVideoId ?? null,
      mode: 'youtube',
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
        // Keep YouTube background playback active when app is minimized / screen locked
        if (this.desiredPlaying) {
          mediaSessionService.updatePlaybackState(true);
          if (this.activeMode === 'youtube' && this.canCallPlayer()) {
            window.setTimeout(() => {
              if (!this.desiredPlaying || this.activeMode !== 'youtube' || !this.canCallPlayer()) {
                return;
              }
              try {
                if (this.player!.getPlayerState?.() !== 1) {
                  this.player!.unMute();
                  this.player!.playVideo();
                }
              } catch {
                // ignore
              }
            }, 220);
          }
        }
      }
    });
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
          this.state.duration > 0 ? Math.min(this.state.duration, this.state.currentTime || this.state.duration) : 30
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

  private ensureHtmlAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (this.htmlAudio) return this.htmlAudio;

    const audio = new Audio();
    audio.preload = 'auto';

    audio.addEventListener('loadedmetadata', () => {
      if (this.activeMode !== 'html-audio') return;
      const d =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : this.state.duration;
      this.state = { ...this.state, duration: d };
      this.emit();
    });

    audio.addEventListener('timeupdate', () => {
      if (this.activeMode !== 'html-audio') return;
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
      this.emit();
    });

    audio.addEventListener('play', () => {
      if (this.activeMode !== 'html-audio') return;
      this.lastListenSampleAt = Date.now();
      this.state = { ...this.state, isPlaying: true, isBuffering: false, error: null };
      mediaSessionService.updatePlaybackState(true);
      this.emit();
    });

    audio.addEventListener('pause', () => {
      if (this.activeMode !== 'html-audio') return;
      if (audio.ended) return;
      this.lastListenSampleAt = 0;
      this.state = { ...this.state, isPlaying: false, isBuffering: false };
      mediaSessionService.updatePlaybackState(false);
      this.persistNow(true);
      this.emit();
    });

    audio.addEventListener('ended', () => {
      if (this.activeMode !== 'html-audio') return;
      this.desiredPlaying = false;
      this.lastListenSampleAt = 0;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        currentTime: this.state.duration,
      };
      mediaSessionService.updatePlaybackState(false);
      this.sampleRealListening(true);
      this.persistNow(true);
      this.emit();
      this.onEndedCallback?.();
    });

    audio.addEventListener('error', () => {
      if (this.activeMode !== 'html-audio') return;
      this.desiredPlaying = false;
      this.state = {
        ...this.state,
        isPlaying: false,
        isBuffering: false,
        error: 'Unable to play this audio stream.',
      };
      mediaSessionService.updatePlaybackState(false);
      this.emit();
    });

    this.htmlAudio = audio;
    return audio;
  }

  private stopHtmlAudio() {
    if (!this.htmlAudio) return;
    try {
      this.htmlAudio.pause();
      this.htmlAudio.removeAttribute('src');
      this.htmlAudio.load();
    } catch {
      // ignore
    }
  }

  /**
   * Guards every YT Player API call so it NEVER fires before onReady or on a detached iframe.
   */
  private canCallPlayer(): boolean {
    if (!this.player || !this.isPlayerReady) return false;
    try {
      const iframe = this.player.getIframe?.() ?? null;
      return Boolean(iframe && document.body.contains(iframe));
    } catch {
      return false;
    }
  }

  private stopYouTubeAudio() {
    this.clearWatchdog();
    this.stopTicker();
    this.pendingVideoLoad = null;
    if (this.canCallPlayer()) {
      try {
        this.player!.pauseVideo();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Mounts #ather-yt-host permanently once directly on document.body so the
   * live YouTube <iframe> is NEVER detached or reparented across React views.
   */
  private getOrCreateHost(): HTMLDivElement {
    let host = document.getElementById(HOST_ELEMENT_ID) as HTMLDivElement | null;
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ELEMENT_ID;
      host.setAttribute('aria-hidden', 'true');
      Object.assign(host.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '160px',
        height: '160px',
        opacity: '0.01',
        pointerEvents: 'none',
        zIndex: '0',
        overflow: 'hidden',
      });

      const inner = document.createElement('div');
      inner.id = PLAYER_ELEMENT_ID;
      inner.style.width = '100%';
      inner.style.height = '100%';
      host.appendChild(inner);
      document.body.appendChild(host);
    } else if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    return host;
  }

  private syncOverlayBounds(): void {
    if (typeof document === 'undefined' || !document.body) return;
    const host = this.getOrCreateHost();
    const el = this.activeCoverEl;

    if (!el || !document.body.contains(el)) {
      Object.assign(host.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '1px',
        height: '1px',
        opacity: '0.01',
        pointerEvents: 'none',
        zIndex: '0',
        overflow: 'hidden',
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    const w = Math.max(Math.round(rect.width), 1);
    const h = Math.max(Math.round(rect.height), 1);

    Object.assign(host.style, {
      position: 'fixed',
      top: `${Math.round(rect.top)}px`,
      left: `${Math.round(rect.left)}px`,
      width: `${w}px`,
      height: `${h}px`,
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '0',
      overflow: 'hidden',
    });

    if (this.canCallPlayer() && w > 1 && h > 1) {
      try {
        this.player!.setSize?.(w, h);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Aligns #ather-yt-host visually over the active AlbumCoverWithHiddenPlayer rect
   * without moving or detaching the iframe in the DOM.
   */
  public attachToCoverContainer(containerEl: HTMLElement | null) {
    if (typeof document === 'undefined' || !document.body) return;
    this.activeCoverEl = containerEl;
    this.getOrCreateHost();

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (containerEl && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncOverlayBounds());
      this.resizeObserver.observe(containerEl);
    }

    this.syncOverlayBounds();
  }

  public detachCoverContainer(containerEl: HTMLElement | null) {
    if (!containerEl || this.activeCoverEl === containerEl) {
      this.attachToCoverContainer(null);
    }
  }

  private loadYouTubeIframeApi(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT?.Player) return Promise.resolve();
    if (this.apiLoadingPromise) return this.apiLoadingPromise;

    this.apiLoadingPromise = new Promise<void>((resolve) => {
      const existing = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        existing?.();
        resolve();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    });

    return this.apiLoadingPromise;
  }

  private async ensurePlayer(): Promise<YTPlayerInstance | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    if (this.canCallPlayer()) {
      return this.player;
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = (async () => {
      await this.loadYouTubeIframeApi();
      if (!window.YT?.Player || !document.body) {
        this.readyPromise = null;
        return null;
      }

      // If a stale player exists whose iframe left document.body, recreate cleanly
      if (this.player && !this.canCallPlayer()) {
        try {
          this.player.destroy?.();
        } catch {
          // ignore
        }
        this.player = null;
        this.isPlayerReady = false;
      }

      const host = this.getOrCreateHost();
      let mountTarget = document.getElementById(PLAYER_ELEMENT_ID);
      if (!mountTarget || mountTarget.tagName.toLowerCase() === 'iframe') {
        host.innerHTML = '';
        mountTarget = document.createElement('div');
        mountTarget.id = PLAYER_ELEMENT_ID;
        mountTarget.style.width = '100%';
        mountTarget.style.height = '100%';
        host.appendChild(mountTarget);
      }

      return new Promise<YTPlayerInstance | null>((resolve) => {
        this.isPlayerReady = false;

        this.player = new window.YT!.Player(PLAYER_ELEMENT_ID, {
          width: '160',
          height: '160',
          playerVars: {
            autoplay: 1,
            controls: 0,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            modestbranding: 1,
            ...(window.location.origin.startsWith('http')
              ? { origin: window.location.origin }
              : {}),
          },
          events: {
            onReady: (ev) => {
              this.player = ev.target;
              this.isPlayerReady = true;
              this.syncOverlayBounds();

              if (this.canCallPlayer()) {
                try {
                  ev.target.unMute();
                  ev.target.setVolume(100);
                } catch {
                  // ignore
                }
              }

              if (this.activeMode === 'youtube' && this.pendingVideoLoad) {
                const job = this.pendingVideoLoad;
                this.pendingVideoLoad = null;
                if (job.autoplay) {
                  this.loadCandidateVideo(job.videoId, job.startSeconds);
                } else if (this.canCallPlayer()) {
                  try {
                    ev.target.cueVideoById({
                      videoId: job.videoId,
                      startSeconds: job.startSeconds,
                    });
                  } catch {
                    // ignore
                  }
                }
              }

              resolve(this.player);
            },
            onStateChange: (ev) => {
              if (this.activeMode !== 'youtube') return;
              const code = ev.data;
              if (code === 1) {
                this.clearWatchdog();
                this.lastListenSampleAt = Date.now();
                if (this.canCallPlayer()) {
                  try {
                    ev.target.unMute();
                    ev.target.setVolume(100);
                  } catch {
                    // ignore
                  }
                }
                const dur = this.safeGetDuration();
                this.state = {
                  ...this.state,
                  isPlaying: true,
                  isBuffering: false,
                  error: null,
                  duration: dur > 0 ? dur : this.state.duration,
                };
                mediaSessionService.updatePlaybackState(true);
                this.startTicker();
                this.emit();
              } else if (code === 2) {
                this.clearWatchdog();
                this.stopTicker();
                this.lastListenSampleAt = 0;
                this.state = {
                  ...this.state,
                  isPlaying: false,
                  isBuffering: false,
                };
                mediaSessionService.updatePlaybackState(false);
                this.persistNow(true);
                this.emit();
              } else if (code === 3) {
                this.state = {
                  ...this.state,
                  isBuffering: true,
                };
                this.emit();
              } else if (code === 0) {
                this.clearWatchdog();
                this.stopTicker();
                this.desiredPlaying = false;
                this.lastListenSampleAt = 0;
                this.state = {
                  ...this.state,
                  isPlaying: false,
                  isBuffering: false,
                  currentTime: this.state.duration,
                };
                mediaSessionService.updatePlaybackState(false);
                this.sampleRealListening(true);
                this.persistNow(true);
                this.emit();
                this.onEndedCallback?.();
              }
            },
            onError: () => {
              if (this.activeMode !== 'youtube') return;
              this.clearWatchdog();
              void this.failoverToNextCandidate();
            },
          },
        });
      });
    })();

    return this.readyPromise;
  }

  private clearWatchdog() {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private startWatchdog() {
    this.clearWatchdog();
    const expectedVideo = this.candidates[this.candidateIndex];
    this.watchdogTimer = window.setTimeout(() => {
      if (!this.desiredPlaying || this.activeMode !== 'youtube') return;
      if (this.state.videoId !== expectedVideo) return;
      if (!this.canCallPlayer()) return;
      try {
        const ytState = this.player!.getPlayerState?.();
        if (ytState !== 1) {
          void this.failoverToNextCandidate();
        }
      } catch {
        void this.failoverToNextCandidate();
      }
    }, 2200);
  }

  private async failoverToNextCandidate() {
    if (this.candidateIndex + 1 < this.candidates.length) {
      this.candidateIndex += 1;
      const nextId = this.candidates[this.candidateIndex];
      this.state = {
        ...this.state,
        videoId: nextId,
        error: null,
      };
      this.emit();
      this.loadCandidateVideo(nextId, this.state.currentTime);
      return;
    }

    const track = this.activeTrack;
    if (track) {
      const startedFallback = await this.tryHtmlFallbackForTrack(
        track,
        this.state.currentTime
      );
      if (startedFallback) return;
    }

    this.desiredPlaying = false;
    this.stopTicker();
    this.state = {
      ...this.state,
      isPlaying: false,
      isBuffering: false,
      error: 'Unable to play full audio for this track right now.',
    };
    this.emit();
  }

  private async playViaHtmlAudio(url: string, startSeconds = 0): Promise<boolean> {
    const audio = this.ensureHtmlAudio();
    if (!audio) return false;
    this.stopYouTubeAudio();
    this.activeMode = 'html-audio';
    this.state = {
      ...this.state,
      mode: 'html-audio',
      videoId: null,
      isBuffering: false,
      error: null,
    };
    this.emit();

    try {
      audio.src = url;
      if (startSeconds > 0) {
        const applyStartSeek = () => {
          try {
            audio.currentTime = startSeconds;
          } catch {
            // ignore
          }
        };
        if (audio.readyState >= 1) {
          applyStartSeek();
        } else {
          audio.addEventListener('loadedmetadata', applyStartSeek, { once: true });
        }
      }
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  private async tryHtmlFallbackForTrack(
    track: ShowcaseTrack,
    startSeconds = 0
  ): Promise<boolean> {
    if (track.streamUrl) {
      if (await this.playViaHtmlAudio(track.streamUrl, startSeconds)) return true;
    }
    try {
      const audiusUpgraded = await resolveFullAudiusTrack(track);
      if (audiusUpgraded.streamUrl) {
        if (await this.playViaHtmlAudio(audiusUpgraded.streamUrl, startSeconds)) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    if (track.previewUrl) {
      if (await this.playViaHtmlAudio(track.previewUrl, startSeconds)) return true;
    }
    return false;
  }

  private loadCandidateVideo(videoId: string, startSeconds = 0) {
    this.stopHtmlAudio();
    this.activeMode = 'youtube';
    this.state = {
      ...this.state,
      mode: 'youtube',
      videoId,
      isBuffering: false,
      error: null,
    };
    this.emit();

    if (!this.canCallPlayer()) {
      this.pendingVideoLoad = { videoId, startSeconds, autoplay: true };
      if (!this.readyPromise) {
        this.isPlayerReady = false;
      } else if (this.isPlayerReady) {
        // Player existed previously but its iframe is no longer in DOM -> re-init
        this.isPlayerReady = false;
        this.readyPromise = null;
      }
      void this.ensurePlayer();
      return;
    }

    try {
      this.player!.unMute();
      this.player!.setVolume(100);
      this.player!.loadVideoById({ videoId, startSeconds });
      this.startWatchdog();
    } catch {
      void this.failoverToNextCandidate();
    }
  }

  private startTicker() {
    if (this.tickTimer !== null) return;
    this.tickTimer = window.setInterval(() => {
      if (this.activeMode !== 'youtube' || !this.canCallPlayer()) return;
      const currentTime = this.getCurrentTime();
      const dur = this.safeGetDuration();
      const effectiveDur = dur > 0 ? dur : this.state.duration;
      if (
        Math.abs(currentTime - this.state.currentTime) >= 0.08 ||
        (dur > 0 && Math.abs(dur - this.state.duration) >= 0.5)
      ) {
        this.state = {
          ...this.state,
          currentTime,
          duration: effectiveDur,
        };
        this.emit();
      }
      mediaSessionService.updatePositionState(currentTime, effectiveDur);
      this.sampleRealListening(false);
      this.persistNow(false);
    }, 250);
  }

  private stopTicker() {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private safeGetDuration(): number {
    if (this.activeMode === 'html-audio') {
      const d = this.htmlAudio?.duration ?? 0;
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    if (!this.canCallPlayer()) return 0;
    try {
      const d = this.player!.getDuration?.() ?? 0;
      return Number.isFinite(d) && d > 0 ? d : 0;
    } catch {
      return 0;
    }
  }

  public getCurrentTime(): number {
    if (this.activeMode === 'html-audio') {
      const t = this.htmlAudio?.currentTime ?? this.state.currentTime;
      return Number.isFinite(t) && t >= 0 ? t : this.state.currentTime;
    }
    if (!this.canCallPlayer()) return this.state.currentTime;
    try {
      const t = this.player!.getCurrentTime?.() ?? this.state.currentTime;
      return Number.isFinite(t) && t >= 0 ? t : this.state.currentTime;
    } catch {
      return this.state.currentTime;
    }
  }

  public getDuration(): number {
    const d = this.safeGetDuration();
    return d > 0 ? d : this.state.duration;
  }

  public async playTrack(track: ShowcaseTrack, startSeconds = 0) {
    const seq = ++this.resolveSeq;
    const isSameTrackResume =
      this.activeTrack?.id === track.id && !this.desiredPlaying && startSeconds > 0;
    this.activeTrack = track;
    this.desiredPlaying = true;
    this.stopTicker();
    this.clearWatchdog();

    if (!isSameTrackResume) {
      this.streamRecordedForSession = false;
      this.accumulatedListenSec = 0;
    }
    this.lastListenSampleAt = Date.now();

    const safeStart = Math.max(0, Math.floor(startSeconds || 0));

    this.state = {
      trackId: track.id,
      videoId: track.youtubeVideoId ?? null,
      mode: 'youtube',
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

    const preattachedIds =
      track.youtubeCandidates && track.youtubeCandidates.length > 0
        ? track.youtubeCandidates
        : track.youtubeVideoId
        ? [track.youtubeVideoId]
        : null;

    // Race offline IndexedDB check, YouTube player initialization, and candidate resolution concurrently
    const [offlineUrl, _, resolvedIds] = await Promise.all([
      getOfflineAudioUrl(track.id, this.currentUid),
      this.ensurePlayer(),
      preattachedIds
        ? Promise.resolve(preattachedIds)
        : resolveYouTubeCandidates(
            track.title,
            track.artist,
            track.youtubeVideoId,
            track.duration
          ),
    ]);

    if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;

    // Priority 1: Real offline IndexedDB Blob URL if saved offline
    if (offlineUrl) {
      const ok = await this.playViaHtmlAudio(offlineUrl, startSeconds);
      if (ok) return;
    }

    if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;

    // Priority 2: YouTube IFrame full audio stream
    if (resolvedIds.length > 0) {
      this.candidates = resolvedIds;
      this.candidateIndex = 0;

      if (!this.canCallPlayer()) {
        this.isPlayerReady = false;
        this.readyPromise = null;
        await this.ensurePlayer();
      }
      if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;

      this.loadCandidateVideo(resolvedIds[0], startSeconds);
      return;
    }

    // Priority 3: Audius HTML5 / iTunes preview fallback
    const htmlStarted = await this.tryHtmlFallbackForTrack(track, startSeconds);
    if (seq !== this.resolveSeq || this.activeTrack?.id !== track.id) return;
    if (htmlStarted) return;

    this.desiredPlaying = false;
    this.state = {
      ...this.state,
      isPlaying: false,
      isBuffering: false,
      error: 'No playable audio source matched this track.',
    };
    this.emit();
  }

  public preloadTrack(track: ShowcaseTrack) {
    if (
      track.youtubeVideoId ||
      (track.youtubeCandidates && track.youtubeCandidates.length > 0)
    ) {
      return;
    }
    void resolveYouTubeCandidates(
      track.title,
      track.artist,
      undefined,
      track.duration
    ).catch(() => undefined);
  }

  public pause() {
    this.desiredPlaying = false;
    this.clearWatchdog();
    this.stopTicker();
    this.lastListenSampleAt = 0;
    if (this.pendingVideoLoad) {
      this.pendingVideoLoad = { ...this.pendingVideoLoad, autoplay: false };
    }
    if (this.activeMode === 'html-audio') {
      try {
        this.htmlAudio?.pause();
      } catch {
        // ignore
      }
    } else if (this.canCallPlayer()) {
      try {
        this.player!.pauseVideo();
      } catch {
        // ignore
      }
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
    if (this.activeMode === 'html-audio' && this.htmlAudio?.src) {
      try {
        await this.htmlAudio.play();
        this.state = { ...this.state, isPlaying: true, error: null };
        this.emit();
        return;
      } catch {
        // Re-resolve cleanly below
      }
    }

    // If restored on boot and YT player hasn't loaded this track yet, resume at exact saved second
    if (
      (!this.state.videoId && this.candidates.length === 0) ||
      (!this.canCallPlayer() && this.candidates.length === 0)
    ) {
      const resumeAt = Math.max(0, Math.floor(this.state.currentTime || 0));
      await this.playTrack(this.activeTrack, resumeAt);
      return;
    }

    if (!this.canCallPlayer()) {
      const resumeAt = Math.max(0, Math.floor(this.state.currentTime || 0));
      await this.playTrack(this.activeTrack, resumeAt);
      return;
    }

    if (this.canCallPlayer()) {
      try {
        this.player!.unMute();
        this.player!.setVolume(100);
        this.player!.playVideo();
        this.startTicker();
        this.state = { ...this.state, isPlaying: true, error: null };
        this.emit();
      } catch {
        if (this.state.videoId) {
          this.loadCandidateVideo(
            this.state.videoId,
            Math.max(0, Math.floor(this.state.currentTime || 0))
          );
        }
      }
    } else if (this.state.videoId) {
      this.loadCandidateVideo(
        this.state.videoId,
        Math.max(0, Math.floor(this.state.currentTime || 0))
      );
    }
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

    if (this.activeMode === 'html-audio' && this.htmlAudio) {
      try {
        this.htmlAudio.currentTime = clamped;
      } catch {
        // ignore
      }
      return;
    }

    if (this.canCallPlayer()) {
      try {
        this.player!.seekTo(clamped, true);
      } catch {
        // ignore
      }
    } else if (this.pendingVideoLoad) {
      this.pendingVideoLoad = { ...this.pendingVideoLoad, startSeconds: clamped };
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

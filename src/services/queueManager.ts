import { RepeatMode, ShowcaseTrack } from '../types/music';

export type QueueScope = 'album' | 'playlist' | 'artist' | 'downloads' | 'general' | 'reel';

export interface UserTasteContext {
  topGenres: string[];
  followedArtists: string[];
  likedTrackIds: string[];
}

export interface QueueState {
  scope: QueueScope;
  contextId: string | null;
  tracks: ShowcaseTrack[];
  currentIndex: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
}

class AtherQueueManager {
  private state: QueueState = {
    scope: 'general',
    contextId: null,
    tracks: [],
    currentIndex: -1,
    repeatMode: 'off',
    shuffle: false,
  };

  private upNext: ShowcaseTrack[] = [];
  private historyIds: string[] = [];
  private tasteContext: UserTasteContext = {
    topGenres: [],
    followedArtists: [],
    likedTrackIds: [],
  };
  private listeners = new Set<(state: QueueState) => void>();

  subscribe(fn: (state: QueueState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): QueueState {
    return { ...this.state, tracks: [...this.state.tracks] };
  }

  setTasteContext(context: Partial<UserTasteContext>) {
    this.tasteContext = {
      topGenres: context.topGenres ?? this.tasteContext.topGenres,
      followedArtists: context.followedArtists ?? this.tasteContext.followedArtists,
      likedTrackIds: context.likedTrackIds ?? this.tasteContext.likedTrackIds,
    };
  }

  private emit() {
    const snapshot = this.getState();
    for (const fn of this.listeners) fn(snapshot);
  }

  private pushHistory(trackId?: string) {
    if (!trackId) return;
    this.historyIds = [trackId, ...this.historyIds.filter((id) => id !== trackId)].slice(
      0,
      100
    );
  }

  /**
   * Starts playback locked strictly to an Album, Playlist, Downloads, Reel, or General list.
   * When scope === 'album', ONLY tracks from that album are placed in the queue,
   * shuffle is disabled by default so the album plays sequentially, and playback stops
   * cleanly when the album ends unless repeatMode === 'all'.
   */
  setScopedQueue(params: {
    scope: QueueScope;
    contextId?: string | null;
    tracks: ShowcaseTrack[];
    startIndex?: number;
  }): ShowcaseTrack | null {
    const cleanTracks = (params.tracks || []).filter(Boolean);
    if (cleanTracks.length === 0) return null;

    const idx = Math.max(0, Math.min(params.startIndex ?? 0, cleanTracks.length - 1));
    this.upNext = [];

    this.state = {
      ...this.state,
      scope: params.scope,
      contextId: params.contextId ?? null,
      tracks: cleanTracks,
      currentIndex: idx,
      shuffle: params.scope === 'album' ? false : this.state.shuffle,
    };

    this.pushHistory(cleanTracks[idx]?.id);
    this.emit();
    return cleanTracks[idx];
  }

  restoreQueueState(params: {
    scope: QueueScope;
    contextId?: string | null;
    tracks: ShowcaseTrack[];
    currentIndex: number;
  }): void {
    const cleanTracks = (params.tracks || []).filter(Boolean);
    if (cleanTracks.length === 0) return;
    const idx = Math.max(
      0,
      Math.min(params.currentIndex ?? 0, cleanTracks.length - 1)
    );
    this.state = {
      ...this.state,
      scope: params.scope || 'general',
      contextId: params.contextId ?? null,
      tracks: cleanTracks,
      currentIndex: idx,
    };
    this.pushHistory(cleanTracks[idx]?.id);
    this.emit();
  }

  getCurrentTrack(): ShowcaseTrack | null {
    const { tracks, currentIndex } = this.state;
    if (currentIndex < 0 || currentIndex >= tracks.length) return null;
    return tracks[currentIndex];
  }

  setCurrentTrackById(trackId: string): ShowcaseTrack | null {
    const idx = this.state.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return null;
    this.state = { ...this.state, currentIndex: idx };
    this.pushHistory(trackId);
    this.emit();
    return this.state.tracks[idx];
  }

  /**
   * Scores how strongly a candidate track matches the active playing track + user taste context.
   */
  scoreIntentMatch(candidate: ShowcaseTrack, anchor: ShowcaseTrack | null): number {
    let score = 0;
    const candArtist = candidate.artist.toLowerCase();
    const candGenre = (candidate.genre || candidate.category || '').toLowerCase();

    if (anchor) {
      const anchorArtist = anchor.artist.toLowerCase();
      const anchorGenre = (anchor.genre || anchor.category || '').toLowerCase();
      if (candArtist === anchorArtist) score += 18;
      if (anchorGenre && candGenre === anchorGenre) score += 14;
      if (candidate.category === anchor.category) score += 8;
    }

    for (const g of this.tasteContext.topGenres) {
      if (candGenre.includes(g.toLowerCase())) score += 10;
    }
    for (const a of this.tasteContext.followedArtists) {
      if (candArtist.includes(a.toLowerCase())) score += 12;
    }
    if (this.tasteContext.likedTrackIds.includes(candidate.id)) {
      score += 6;
    }
    if (candidate.streamUrl) score += 4;
    if (this.historyIds.slice(0, 12).includes(candidate.id)) {
      score -= 20;
    }

    return score + Math.random() * 4;
  }

  /**
   * Enqueues a track directly after the currently playing track without altering scope unless album-locked.
   */
  enqueueNext(track: ShowcaseTrack) {
    this.upNext = [track, ...this.upNext.filter((t) => t.id !== track.id)];
    this.addToQueue(track);
  }

  /**
   * Appends a track to the end of the active queue.
   */
  addToQueueEnd(track: ShowcaseTrack) {
    if (this.state.tracks.some((t) => t.id === track.id)) return;
    this.state = {
      ...this.state,
      scope: this.state.scope === 'album' ? 'general' : this.state.scope,
      tracks: [...this.state.tracks, track],
    };
    this.emit();
  }

  /**
   * Resolves the next track respecting strict scope boundaries, explicit upNext items, and intent fallback pool.
   * Returns null when the scoped album/playlist/downloads ends and repeatMode === 'off'.
   */
  resolveNextTrack(
    fallbackPool: ShowcaseTrack[] = [],
    fromManualSkip = false
  ): ShowcaseTrack | null {
    const { tracks, currentIndex, repeatMode, shuffle, scope } = this.state;
    const current = this.getCurrentTrack();

    if (repeatMode === 'one' && !fromManualSkip && current) {
      return current;
    }

    if (this.upNext.length > 0) {
      const nextManual = this.upNext.shift()!;
      const idx = this.state.tracks.findIndex((t) => t.id === nextManual.id);
      if (idx !== -1) {
        this.state = { ...this.state, currentIndex: idx };
      } else {
        const list = [...this.state.tracks];
        const insertAt = Math.max(0, currentIndex + 1);
        list.splice(insertAt, 0, nextManual);
        this.state = { ...this.state, tracks: list, currentIndex: insertAt };
      }
      this.pushHistory(nextManual.id);
      this.emit();
      return nextManual;
    }

    if (tracks.length > 0 && currentIndex >= 0) {
      if (shuffle && tracks.length > 1) {
        const recentWindow = new Set(this.historyIds.slice(0, 6));
        const candidates = tracks
          .map((t, i) => ({ t, i }))
          .filter(({ t, i }) => i !== currentIndex && !recentWindow.has(t.id));
        const pool =
          candidates.length > 0
            ? candidates
            : tracks.map((t, i) => ({ t, i })).filter(({ i }) => i !== currentIndex);

        pool.sort(
          (a, b) =>
            this.scoreIntentMatch(b.t, current) - this.scoreIntentMatch(a.t, current)
        );
        const topSlice = pool.slice(0, Math.min(4, pool.length));
        const picked = topSlice[Math.floor(Math.random() * topSlice.length)];
        this.state = { ...this.state, currentIndex: picked.i };
        this.pushHistory(picked.t.id);
        this.emit();
        return picked.t;
      }

      const nextIdx = currentIndex + 1;
      if (nextIdx < tracks.length) {
        this.state = { ...this.state, currentIndex: nextIdx };
        this.pushHistory(tracks[nextIdx].id);
        this.emit();
        return tracks[nextIdx];
      }

      if (repeatMode === 'all') {
        this.state = { ...this.state, currentIndex: 0 };
        this.pushHistory(tracks[0].id);
        this.emit();
        return tracks[0];
      }
    }

    // Only extend via intent-matched fallbackPool when not strictly locked to an album/playlist/downloads
    if (
      scope === 'general' &&
      fallbackPool.length > 0
    ) {
      const seen = new Set(tracks.map((t) => t.id));
      const available = fallbackPool.filter((t) => !seen.has(t.id));
      if (available.length > 0) {
        const sorted = [...available].sort(
          (a, b) => this.scoreIntentMatch(b, current) - this.scoreIntentMatch(a, current)
        );
        const picked = sorted[0];
        const nextList = [...tracks, picked];
        this.state = {
          ...this.state,
          tracks: nextList,
          currentIndex: nextList.length - 1,
        };
        this.pushHistory(picked.id);
        this.emit();
        return picked;
      }
    }

    return null;
  }

  /**
   * Resolves the next track respecting strict scope boundaries.
   * Returns null when the scoped album/playlist/downloads ends and repeatMode === 'off'.
   */
  getNextTrack(fromManualSkip = false): ShowcaseTrack | null {
    return this.resolveNextTrack([], fromManualSkip);
  }

  getPreviousTrack(currentPlaybackSec = 0): {
    action: 'restart' | 'track' | 'none';
    track: ShowcaseTrack | null;
  } {
    const { tracks, currentIndex, repeatMode } = this.state;
    if (tracks.length === 0 || currentIndex < 0) {
      return { action: 'none', track: null };
    }

    if (currentPlaybackSec > 3) {
      return { action: 'restart', track: tracks[currentIndex] };
    }

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeatMode === 'all' ? tracks.length - 1 : 0;
    }

    if (prevIdx === currentIndex && currentIndex === 0 && repeatMode !== 'all') {
      return { action: 'restart', track: tracks[currentIndex] };
    }

    this.state = { ...this.state, currentIndex: prevIdx };
    this.pushHistory(tracks[prevIdx]?.id);
    this.emit();
    return { action: 'track', track: tracks[prevIdx] };
  }

  setRepeatMode(mode: RepeatMode) {
    this.state = { ...this.state, repeatMode: mode };
    this.emit();
  }

  cycleRepeatMode(): RepeatMode {
    const next: RepeatMode =
      this.state.repeatMode === 'off'
        ? 'all'
        : this.state.repeatMode === 'all'
        ? 'one'
        : 'off';
    this.setRepeatMode(next);
    return next;
  }

  setShuffle(enabled: boolean) {
    this.state = { ...this.state, shuffle: enabled };
    this.emit();
  }

  toggleShuffle(): boolean {
    const next = !this.state.shuffle;
    this.setShuffle(next);
    return next;
  }

  reorderUpcomingById(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const list = [...this.state.tracks];
    const fromIdx = list.findIndex((t) => t.id === dragId);
    const toIdx = list.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const currentTrackId = this.getCurrentTrack()?.id ?? null;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const nextCurrentIndex = currentTrackId
      ? list.findIndex((t) => t.id === currentTrackId)
      : this.state.currentIndex;

    this.state = {
      ...this.state,
      tracks: list,
      currentIndex: nextCurrentIndex >= 0 ? nextCurrentIndex : this.state.currentIndex,
    };
    this.emit();
  }

  moveTrackByOffset(trackId: string, direction: 'up' | 'down') {
    const list = [...this.state.tracks];
    const idx = list.findIndex((t) => t.id === trackId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const currentTrackId = this.getCurrentTrack()?.id ?? null;
    const [item] = list.splice(idx, 1);
    list.splice(targetIdx, 0, item);
    const nextCurrentIndex = currentTrackId
      ? list.findIndex((t) => t.id === currentTrackId)
      : this.state.currentIndex;

    this.state = {
      ...this.state,
      tracks: list,
      currentIndex: nextCurrentIndex >= 0 ? nextCurrentIndex : this.state.currentIndex,
    };
    this.emit();
  }

  removeTrackById(trackId: string) {
    this.upNext = this.upNext.filter((t) => t.id !== trackId);
    const idx = this.state.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1 || idx === this.state.currentIndex) return;
    const currentTrackId = this.getCurrentTrack()?.id ?? null;
    const list = this.state.tracks.filter((t) => t.id !== trackId);
    const nextCurrentIndex = currentTrackId
      ? list.findIndex((t) => t.id === currentTrackId)
      : -1;
    this.state = {
      ...this.state,
      tracks: list,
      currentIndex: nextCurrentIndex,
    };
    this.emit();
  }

  addToQueue(track: ShowcaseTrack) {
    if (this.state.tracks.some((t) => t.id === track.id)) return;
    const insertAt =
      this.state.currentIndex >= 0
        ? this.state.currentIndex + 1
        : this.state.tracks.length;
    const list = [...this.state.tracks];
    list.splice(insertAt, 0, track);
    this.state = {
      ...this.state,
      scope: this.state.scope === 'album' ? 'general' : this.state.scope,
      tracks: list,
    };
    this.emit();
  }

  clearUpcoming() {
    this.upNext = [];
    const current = this.getCurrentTrack();
    if (!current) {
      this.state = { ...this.state, tracks: [], currentIndex: -1 };
    } else {
      this.state = {
        ...this.state,
        tracks: [current],
        currentIndex: 0,
      };
    }
    this.emit();
  }

  replaceUpcoming(nextUpcoming: ShowcaseTrack[]) {
    this.upNext = [];
    const current = this.getCurrentTrack();
    const seen = new Set<string>(current ? [current.id] : []);
    const filtered = nextUpcoming.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    const list = current ? [current, ...filtered] : filtered;
    this.state = {
      ...this.state,
      tracks: list,
      currentIndex: current ? 0 : list.length > 0 ? 0 : -1,
    };
    this.emit();
  }

  syncTrackMetadata(updated: ShowcaseTrack) {
    const idx = this.state.tracks.findIndex((t) => t.id === updated.id);
    if (idx === -1) return;
    const list = [...this.state.tracks];
    list[idx] = { ...list[idx], ...updated };
    this.state = { ...this.state, tracks: list };
    this.emit();
  }

  reset() {
    this.upNext = [];
    this.historyIds = [];
    this.state = {
      scope: 'general',
      contextId: null,
      tracks: [],
      currentIndex: -1,
      repeatMode: 'off',
      shuffle: false,
    };
    this.emit();
  }
}

export const queueManager = new AtherQueueManager();

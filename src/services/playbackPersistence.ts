import { ShowcaseTrack } from '../types/music';
import { QueueScope } from './queueManager';
import { getActiveUserId, scopedStorageKey } from './userScope';

export interface SavedPlaybackSession {
  track: ShowcaseTrack;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  queue?: {
    scope: QueueScope;
    contextId: string | null;
    tracks: ShowcaseTrack[];
    currentIndex: number;
  };
}

let lastThrottledWriteAt = 0;
const PLAYBACK_BASE_KEY = 'last_playback_session_v1';

function getSessionKey(uid?: string | null): string | null {
  const effectiveUid = uid !== undefined ? uid : getActiveUserId();
  if (!effectiveUid) return null;
  return scopedStorageKey(PLAYBACK_BASE_KEY, effectiveUid);
}

export function savePlaybackSession(
  session: SavedPlaybackSession,
  options?: { force?: boolean; uid?: string | null }
): void {
  if (!session?.track?.id) return;
  if (typeof window === 'undefined' || !window.localStorage) return;

  const key = getSessionKey(options?.uid);
  if (!key) return;

  const now = Date.now();
  if (!options?.force && now - lastThrottledWriteAt < 1400) {
    return;
  }
  lastThrottledWriteAt = now;

  try {
    const fallbackDuration =
      typeof session.track.duration === 'number' && session.track.duration > 0
        ? session.track.duration
        : typeof session.track.durationMs === 'number'
        ? Math.round(session.track.durationMs / 1000)
        : 0;

    const safePosition = Math.max(0, Math.floor(session.positionSec || 0));
    const safeDuration = Math.max(
      0,
      Math.floor(session.durationSec || fallbackDuration)
    );

    const normalizedPosition =
      safeDuration > 5 && safePosition >= safeDuration - 2 ? 0 : safePosition;

    const payload: SavedPlaybackSession = {
      track: session.track,
      positionSec: normalizedPosition,
      durationSec: safeDuration,
      updatedAt: now,
    };

    if (
      session.queue &&
      Array.isArray(session.queue.tracks) &&
      session.queue.tracks.length > 0
    ) {
      payload.queue = {
        scope: session.queue.scope,
        contextId: session.queue.contextId,
        tracks: session.queue.tracks.slice(0, 80),
        currentIndex: Math.max(
          0,
          Math.min(
            session.queue.currentIndex,
            Math.min(session.queue.tracks.length, 80) - 1
          )
        ),
      };
    }

    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function loadPlaybackSession(uid?: string | null): SavedPlaybackSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const key = getSessionKey(uid);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlaybackSession;
    if (
      !parsed ||
      !parsed.track ||
      !parsed.track.id ||
      !parsed.track.title ||
      !parsed.track.artist
    ) {
      return null;
    }

    const fallbackDuration =
      typeof parsed.track.duration === 'number' && parsed.track.duration > 0
        ? parsed.track.duration
        : typeof parsed.track.durationMs === 'number'
        ? Math.round(parsed.track.durationMs / 1000)
        : 0;

    return {
      ...parsed,
      positionSec: Math.max(0, Number(parsed.positionSec || 0)),
      durationSec: Math.max(0, Number(parsed.durationSec || fallbackDuration)),
    };
  } catch {
    return null;
  }
}

export function clearPlaybackSessionForAccount(uid?: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = getSessionKey(uid);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

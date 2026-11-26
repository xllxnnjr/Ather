import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  stripUndefined,
} from '../firebase';
import { ShowcaseTrack } from '../types/music';
import { fetchArtistProfilePhoto } from './musicApi';
import { getActiveUserId, scopedStorageKey } from './userScope';

export interface ArtistStreamStat {
  artistKey: string;
  name: string;
  playCount: number;
  totalMinutes: number;
  image: string;
  lastPlayedAt: number;
}

export interface SongStreamStat {
  trackId: string;
  title: string;
  artist: string;
  artwork: string;
  coverUrl?: string;
  playCount: number;
  lastPlayedAt: number;
  track: ShowcaseTrack;
}

export interface UserActivityStats {
  artists: Record<string, ArtistStreamStat>;
  songs: Record<string, SongStreamStat>;
  totalMinutesListened: number;
  streakDays: number;
  lastActiveDateKey: string;
}

export const STATS_UPDATED_EVENT = 'ather:activity-stats-updated';
const STATS_BASE_KEY = 'user_activity_stats_v1';

export function emptyStats(): UserActivityStats {
  return {
    artists: {},
    songs: {},
    totalMinutesListened: 0,
    streakDays: 0,
    lastActiveDateKey: '',
  };
}

function getStatsStorageKey(uid?: string | null): string | null {
  const effectiveUid = uid !== undefined ? uid : getActiveUserId();
  if (!effectiveUid) return null;
  return scopedStorageKey(STATS_BASE_KEY, effectiveUid);
}

export function resetActivityStatsMemory(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(STATS_UPDATED_EVENT, { detail: emptyStats() })
  );
}

export function notifyActivityStatsChanged(uid?: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(STATS_UPDATED_EVENT, {
      detail: loadLocalActivityStats(uid),
    })
  );
}

function normalizeArtistName(rawArtist: string): string {
  return rawArtist.split(/[,&]|feat\.|ft\.|x\s/i)[0].trim() || rawArtist.trim();
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function sanitizeTrackForStats(track: ShowcaseTrack): ShowcaseTrack {
  return stripUndefined({
    id: track.id,
    itunesId: track.itunesId,
    audiusId: track.audiusId,
    title: track.title,
    artist: track.artist,
    album: track.album || '',
    category: track.category,
    genre: track.genre,
    duration: Number.isFinite(track.duration) ? track.duration : 0,
    durationMs: Number.isFinite(track.durationMs) ? track.durationMs : undefined,
    artwork: track.artwork,
    coverUrl: track.coverUrl,
    previewUrl: track.previewUrl,
    streamUrl: track.streamUrl,
    streamStatus: track.streamStatus,
    source: track.source,
    isAudius: track.isAudius,
    releaseDate: track.releaseDate,
    collectionId: track.collectionId,
    accentColor: track.accentColor || '#FFFFFF',
    glowColor: track.glowColor || 'rgba(255, 255, 255, 0.22)',
    secondaryGlowColor: track.secondaryGlowColor || 'rgba(255, 255, 255, 0.12)',
    lyrics: [],
  });
}

function pruneStatsForStorage(stats: UserActivityStats): UserActivityStats {
  const artistEntries = Object.entries(stats.artists || {})
    .sort((a, b) => b[1].playCount - a[1].playCount || b[1].lastPlayedAt - a[1].lastPlayedAt)
    .slice(0, 250)
    .map(([k, v]) => [k, stripUndefined(v)]);
  const songEntries = Object.entries(stats.songs || {})
    .sort((a, b) => b[1].playCount - a[1].playCount || b[1].lastPlayedAt - a[1].lastPlayedAt)
    .slice(0, 250)
    .map(([k, v]) => [
      k,
      stripUndefined({
        ...v,
        track: sanitizeTrackForStats(v.track),
      }),
    ]);

  return stripUndefined({
    artists: Object.fromEntries(artistEntries),
    songs: Object.fromEntries(songEntries),
    totalMinutesListened: Math.max(0, Number(stats.totalMinutesListened || 0)),
    streakDays: Math.max(0, Math.floor(Number(stats.streakDays || 0))),
    lastActiveDateKey: String(stats.lastActiveDateKey || '').slice(0, 32),
  });
}

export function loadLocalActivityStats(uid?: string | null): UserActivityStats {
  if (typeof window === 'undefined' || !window.localStorage) {
    return emptyStats();
  }
  const key = getStatsStorageKey(uid);
  if (!key) {
    return emptyStats();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return emptyStats();
    }
    const parsed = JSON.parse(raw) as UserActivityStats;
    return {
      artists: parsed.artists || {},
      songs: parsed.songs || {},
      totalMinutesListened: Number(parsed.totalMinutesListened || 0),
      streakDays: Number(parsed.streakDays || 0),
      lastActiveDateKey: String(parsed.lastActiveDateKey || ''),
    };
  } catch {
    return emptyStats();
  }
}

function saveLocalActivityStats(
  stats: UserActivityStats,
  uid?: string | null
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = getStatsStorageKey(uid);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(stats));
    window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT, { detail: stats }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Records a real completed or substantial (>=25s) play into Activity stats,
 * resolves the real artist portrait via Deezer JSONP if missing, and syncs to users/{uid}.
 */
export async function recordTrackStream(
  track: ShowcaseTrack,
  listenedSeconds: number,
  uid?: string | null
): Promise<UserActivityStats> {
  const effectiveUid = uid ?? getActiveUserId();
  if (!effectiveUid) return emptyStats();

  const stats = loadLocalActivityStats(effectiveUid);
  const now = Date.now();
  const today = getTodayDateKey();

  const primaryArtist = normalizeArtistName(track.artist);
  const artistKey = primaryArtist.toLowerCase();
  const addedMinutes = Math.max(0.25, Math.round((listenedSeconds / 60) * 10) / 10);

  const existingArtist = stats.artists[artistKey];
  let artistImage = existingArtist?.image || '';
  if (!artistImage) {
    artistImage = await fetchArtistProfilePhoto(primaryArtist).catch(() => '');
  }

  stats.artists[artistKey] = {
    artistKey,
    name: primaryArtist,
    playCount: (existingArtist?.playCount || 0) + 1,
    totalMinutes:
      Math.round(((existingArtist?.totalMinutes || 0) + addedMinutes) * 10) / 10,
    image: artistImage || existingArtist?.image || '',
    lastPlayedAt: now,
  };

  const songKey = `${artistKey}::${track.title.toLowerCase().trim()}`;
  const existingSong = stats.songs[songKey];
  stats.songs[songKey] = stripUndefined({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    artwork: track.coverUrl || existingSong?.artwork || '',
    coverUrl: track.coverUrl || existingSong?.coverUrl || '',
    playCount: (existingSong?.playCount || 0) + 1,
    lastPlayedAt: now,
    track: sanitizeTrackForStats(track),
  });

  stats.totalMinutesListened =
    Math.round((stats.totalMinutesListened + addedMinutes) * 10) / 10;
  if (stats.lastActiveDateKey !== today) {
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(
      yesterday.getMonth() + 1
    ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    stats.streakDays =
      stats.lastActiveDateKey === yesterdayKey ? stats.streakDays + 1 : 1;
    stats.lastActiveDateKey = today;
  }

  const sanitized = pruneStatsForStorage(stats);
  saveLocalActivityStats(sanitized, effectiveUid);

  const targetUid = effectiveUid;
  if (
    targetUid &&
    auth.currentUser &&
    auth.currentUser.uid === targetUid &&
    auth.currentUser.emailVerified
  ) {
    const docPath = `users/${targetUid}`;
    try {
      await setDoc(
        doc(db, 'users', targetUid),
        stripUndefined({ activityStats: sanitized, updatedAt: now }),
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return sanitized;
}

/**
 * Hydrates Activity stats from Firestore users/{uid} so Top 10 Artists sync across devices.
 */
export async function syncActivityStatsFromCloud(
  uid: string
): Promise<UserActivityStats> {
  const local = loadLocalActivityStats(uid);
  if (
    !uid ||
    !auth.currentUser ||
    auth.currentUser.uid !== uid ||
    !auth.currentUser.emailVerified
  ) {
    return local;
  }

  const docPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const cloud = snap.data()?.activityStats as UserActivityStats | undefined;
    if (!cloud) {
      if (Object.keys(local.artists).length > 0 || local.totalMinutesListened > 0) {
        const sanitizedLocal = pruneStatsForStorage(local);
        await setDoc(
          doc(db, 'users', uid),
          stripUndefined({ activityStats: sanitizedLocal, updatedAt: Date.now() }),
          { merge: true }
        );
      }
      return local;
    }

    const mergedArtists: Record<string, ArtistStreamStat> = { ...local.artists };
    for (const [key, cloudStat] of Object.entries(cloud.artists || {})) {
      const localStat = mergedArtists[key];
      if (!localStat) {
        mergedArtists[key] = cloudStat;
      } else {
        mergedArtists[key] = {
          ...cloudStat,
          playCount: Math.max(localStat.playCount, cloudStat.playCount),
          totalMinutes: Math.max(localStat.totalMinutes, cloudStat.totalMinutes),
          image: cloudStat.image || localStat.image,
          lastPlayedAt: Math.max(localStat.lastPlayedAt, cloudStat.lastPlayedAt),
        };
      }
    }

    const mergedSongs: Record<string, SongStreamStat> = { ...local.songs };
    for (const [key, cloudSong] of Object.entries(cloud.songs || {})) {
      const localSong = mergedSongs[key];
      if (!localSong) {
        mergedSongs[key] = cloudSong;
      } else {
        mergedSongs[key] = {
          ...cloudSong,
          playCount: Math.max(localSong.playCount, cloudSong.playCount),
          artwork: cloudSong.artwork || localSong.artwork,
          coverUrl: cloudSong.coverUrl || localSong.coverUrl,
          lastPlayedAt: Math.max(localSong.lastPlayedAt, cloudSong.lastPlayedAt),
        };
      }
    }

    const merged = pruneStatsForStorage({
      artists: mergedArtists,
      songs: mergedSongs,
      totalMinutesListened: Math.max(
        local.totalMinutesListened,
        Number(cloud.totalMinutesListened || 0)
      ),
      streakDays: Math.max(local.streakDays, Number(cloud.streakDays || 0)),
      lastActiveDateKey: cloud.lastActiveDateKey || local.lastActiveDateKey,
    });

    saveLocalActivityStats(merged, uid);
    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

/**
 * Returns the user's real Top 10 Most Streamed Artists ranked by playCount & minutes.
 */
export function getTop10StreamedArtists(
  stats: UserActivityStats
): ArtistStreamStat[] {
  return Object.values(stats.artists || {})
    .filter((a) => a.playCount > 0 && a.name)
    .sort((a, b) => b.playCount - a.playCount || b.totalMinutes - a.totalMinutes)
    .slice(0, 10);
}

/**
 * Returns the user's real Top 5 Most Streamed Songs ranked by playCount & recency.
 */
export function getTop5StreamedSongs(
  stats: UserActivityStats
): SongStreamStat[] {
  return Object.values(stats.songs || {})
    .filter((s) => s.playCount > 0 && s.title)
    .sort((a, b) => b.playCount - a.playCount || b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 5);
}

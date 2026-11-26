import { ShowcaseTrack } from '../types/music';
import { getAudiusStreamUrl } from './audiusApi';
import { AudioQualityTier, resolveFullAudioStream } from './simpmusicStreamResolver';
import { getActiveUserId } from './userScope';

const DB_NAME = 'ather-offline-downloads';
const DB_VERSION = 1;
const STORE_NAME = 'audio-blobs';

interface StoredAudioEntry {
  trackId: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  savedAt: string;
}

const memoryBlobUrlCache = new Map<string, string>();

function scopedBlobKey(trackId: string, uid?: string | null): string {
  const scope = (uid ?? getActiveUserId() ?? 'guest').trim() || 'guest';
  return `${scope}::${trackId}`;
}

function openDownloadsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open offline DB'));
  });
}

async function putAudioEntry(entry: StoredAudioEntry): Promise<void> {
  const db = await openDownloadsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save offline audio'));
    };
  });
}

async function getAudioEntry(storageKey: string): Promise<StoredAudioEntry | null> {
  try {
    const db = await openDownloadsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(storageKey);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredAudioEntry | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function removeOfflineTrackBlob(
  trackId: string,
  uid?: string | null
): Promise<void> {
  const key = scopedBlobKey(trackId, uid);
  const cachedUrl = memoryBlobUrlCache.get(key);
  if (cachedUrl) {
    URL.revokeObjectURL(cachedUrl);
    memoryBlobUrlCache.delete(key);
  }
  try {
    const db = await openDownloadsDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore DB cleanup errors
  }
}

export async function clearAllOfflineTrackBlobs(uid?: string | null): Promise<void> {
  const effectiveScope = (uid ?? getActiveUserId() ?? 'guest').trim() || 'guest';
  const prefix = `${effectiveScope}::`;

  Array.from(memoryBlobUrlCache.entries()).forEach(([k, url]) => {
    if (k.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      memoryBlobUrlCache.delete(k);
    }
  });

  try {
    const db = await openDownloadsDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      keysReq.onsuccess = () => {
        const keys = Array.isArray(keysReq.result) ? keysReq.result : [];
        for (const k of keys) {
          if (typeof k === 'string' && k.startsWith(prefix)) {
            store.delete(k);
          }
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore
  }
}

export async function hasOfflineTrackBlob(
  trackId: string,
  uid?: string | null
): Promise<boolean> {
  const entry = await getAudioEntry(scopedBlobKey(trackId, uid));
  return Boolean(entry && entry.blob && entry.blob.size > 0);
}

export async function getOfflineAudioUrl(
  trackId: string,
  uid?: string | null
): Promise<string | null> {
  const key = scopedBlobKey(trackId, uid);
  const existing = memoryBlobUrlCache.get(key);
  if (existing) return existing;

  const entry = await getAudioEntry(key);
  if (!entry || !entry.blob || entry.blob.size === 0) return null;

  const url = URL.createObjectURL(entry.blob);
  memoryBlobUrlCache.set(key, url);
  return url;
}

export interface OfflineDownloadResult {
  ok: boolean;
  error?: string;
}

async function fetchFullAudioBlob(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): Promise<Blob | null> {
  const candidateUrls: string[] = [];

  if (
    track.streamUrl &&
    track.streamStatus === 'full' &&
    track.streamSource !== 'itunes-preview'
  ) {
    candidateUrls.push(track.streamUrl);
  }

  try {
    const resolved = await resolveFullAudioStream(track, quality);
    if (resolved?.streamUrl && resolved.source !== 'itunes-preview') {
      candidateUrls.push(resolved.streamUrl);
    }
  } catch {
    // Try remaining full stream candidates
  }

  if (track.audiusId) {
    candidateUrls.push(getAudiusStreamUrl(track.audiusId));
  }

  for (const url of Array.from(new Set(candidateUrls))) {
    if (!url || (track.previewUrl && url === track.previewUrl)) continue;
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 24000);
      const res = await fetch(url, { signal: controller.signal });
      window.clearTimeout(timeout);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.toLowerCase().includes('text/html')) continue;
      const blob = await res.blob();
      if (
        blob &&
        blob.size >= 16384 &&
        !String(blob.type || '').toLowerCase().includes('text/html')
      ) {
        return blob;
      }
    } catch {
      // Try next full stream URL candidate
    }
  }
  return null;
}

/**
 * Downloads the full SimpMusic/InnerTube/Piped/Audius track audio into IndexedDB.
 * Never saves 30s iTunes preview clips as offline full songs.
 */
export async function saveTrackOffline(
  track: ShowcaseTrack,
  uid?: string | null,
  quality: AudioQualityTier = 'High'
): Promise<OfflineDownloadResult> {
  try {
    const key = scopedBlobKey(track.id, uid);
    const existing = await getAudioEntry(key);
    if (existing && existing.blob.size >= 16384) {
      return { ok: true };
    }

    const blob = await fetchFullAudioBlob(track, quality);
    if (!blob) {
      return {
        ok: false,
        error: 'full track stream is unavailable for offline download right now',
      };
    }

    const oldUrl = memoryBlobUrlCache.get(key);
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      memoryBlobUrlCache.delete(key);
    }

    await putAudioEntry({
      trackId: key,
      blob,
      mimeType: blob.type || 'audio/mp4',
      sizeBytes: blob.size,
      savedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'could not store offline audio on this device',
    };
  }
}

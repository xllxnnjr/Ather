import { ShowcaseTrack } from '../types/music';
import { getAudiusStreamUrl, resolveFullAudiusTrack } from './audiusApi';
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

async function fetchPlayableAudioBlob(track: ShowcaseTrack): Promise<Blob | null> {
  const candidateUrls: string[] = [];

  if (track.streamUrl) {
    candidateUrls.push(track.streamUrl);
  }
  if (track.audiusId) {
    candidateUrls.push(getAudiusStreamUrl(track.audiusId));
  }
  if (!track.streamUrl && track.source !== 'audius') {
    try {
      const upgraded = await resolveFullAudiusTrack(track);
      if (upgraded.streamUrl) candidateUrls.push(upgraded.streamUrl);
    } catch {
      // Ignore Audius lookup errors and fall back to previewUrl if present
    }
  }
  if (track.previewUrl) {
    candidateUrls.push(track.previewUrl);
  }

  for (const url of Array.from(new Set(candidateUrls))) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 14000);
      const res = await fetch(url, { signal: controller.signal });
      window.clearTimeout(timeout);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob && blob.size > 1024) {
        return blob;
      }
    } catch {
      // Try next URL candidate
    }
  }
  return null;
}

/**
 * Downloads the real playable audio stream into IndexedDB so it plays completely offline.
 * Returns true if a real Blob was stored cleanly on the device.
 */
export async function saveTrackOffline(
  track: ShowcaseTrack,
  uid?: string | null
): Promise<boolean> {
  try {
    const key = scopedBlobKey(track.id, uid);
    const existing = await getAudioEntry(key);
    if (existing && existing.blob.size > 0) return true;

    const blob = await fetchPlayableAudioBlob(track);
    if (!blob) return false;

    const oldUrl = memoryBlobUrlCache.get(key);
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl);
      memoryBlobUrlCache.delete(key);
    }

    await putAudioEntry({
      trackId: key,
      blob,
      mimeType: blob.type || 'audio/mpeg',
      sizeBytes: blob.size,
      savedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

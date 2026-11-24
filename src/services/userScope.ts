import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  stripUndefined,
} from '../firebase';

export interface UserLookPreferences {
  glassOpacity: number;
  compactTiles: boolean;
  springMotion: boolean;
}

const DEFAULT_LOOK: UserLookPreferences = {
  glassOpacity: 0.98,
  compactTiles: true,
  springMotion: true,
};

const LOOK_BASE_KEY = 'look_preferences_v1';
const LEGACY_UNSCOPED_KEYS = [
  'ather_last_playback_session_v1',
  'ather_user_activity_stats_v1',
  'ather_device_uuid_v1',
  'ather_device_id_v1',
  'ather_device_name_v1',
  'ather_user_music_profile_v2',
  'ather_ytm_shelves_v2',
  'ather_live_new_releases_v1',
  'hasCompletedOnboarding',
];

let activeUid: string | null = null;
const lookListeners = new Set<(look: UserLookPreferences) => void>();
let currentLook: UserLookPreferences = { ...DEFAULT_LOOK };

function normalizeLookPreferences(
  raw?: Partial<UserLookPreferences> | null
): UserLookPreferences {
  const opacity = Number(raw?.glassOpacity);
  const clampedOpacity = Number.isFinite(opacity)
    ? Math.min(1, Math.max(0.5, Math.round(opacity * 100) / 100))
    : DEFAULT_LOOK.glassOpacity;

  return {
    glassOpacity: clampedOpacity,
    compactTiles:
      typeof raw?.compactTiles === 'boolean'
        ? raw.compactTiles
        : DEFAULT_LOOK.compactTiles,
    springMotion:
      typeof raw?.springMotion === 'boolean'
        ? raw.springMotion
        : DEFAULT_LOOK.springMotion,
  };
}

function sanitizeScopeId(uid: string): string {
  return uid
    .trim()
    .replace(/[^a-zA-Z0-9_:@.\-]+/g, '_')
    .slice(0, 120);
}

function emitLook(): void {
  const copy = { ...currentLook };
  lookListeners.forEach((cb) => cb(copy));
}

function isVerifiedFirebaseUser(uid: string | null | undefined): uid is string {
  return Boolean(
    uid &&
      auth.currentUser &&
      auth.currentUser.uid === uid &&
      auth.currentUser.emailVerified
  );
}

export function setActiveUserId(uid: string | null): void {
  const normalized = uid ? sanitizeScopeId(uid) : null;
  if (activeUid === normalized) return;
  activeUid = normalized;

  // Reset look state to defaults before hydrating the newly signed-in account's own look
  currentLook = { ...DEFAULT_LOOK };
  emitLook();

  if (normalized) {
    currentLook = loadUserLookLocal(normalized);
    emitLook();
    if (isVerifiedFirebaseUser(normalized)) {
      void syncUserLookFromCloud(normalized).catch(() => undefined);
    }
  }
}

export function getActiveUserId(): string | null {
  return activeUid;
}

export function scopedStorageKey(
  baseKey: string,
  uid?: string | null
): string {
  const resolved = uid !== undefined ? uid : activeUid;
  const effective = resolved ? sanitizeScopeId(resolved) : 'anon';
  return `ather_u_${effective}_${baseKey}`;
}

export function loadUserLookLocal(uid?: string | null): UserLookPreferences {
  const effectiveUid = uid ?? activeUid;
  if (
    !effectiveUid ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return { ...DEFAULT_LOOK };
  }
  try {
    const raw = window.localStorage.getItem(
      scopedStorageKey(LOOK_BASE_KEY, effectiveUid)
    );
    if (!raw) return { ...DEFAULT_LOOK };
    const parsed = JSON.parse(raw) as Partial<UserLookPreferences>;
    return normalizeLookPreferences(parsed);
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveUserLookLocal(
  prefs: UserLookPreferences,
  uid?: string | null
): void {
  const effectiveUid = uid ?? activeUid;
  if (
    !effectiveUid ||
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return;
  }
  try {
    window.localStorage.setItem(
      scopedStorageKey(LOOK_BASE_KEY, effectiveUid),
      JSON.stringify(normalizeLookPreferences(prefs))
    );
  } catch {
    // ignore quota errors
  }
}

export async function updateUserLookPreferences(
  patch: Partial<UserLookPreferences>,
  uid?: string | null
): Promise<UserLookPreferences> {
  const effectiveUid = uid ?? activeUid;
  const base = effectiveUid === activeUid ? currentLook : loadUserLookLocal(effectiveUid);
  const next = normalizeLookPreferences({ ...base, ...patch });

  if (effectiveUid) {
    saveUserLookLocal(next, effectiveUid);
  }

  if (effectiveUid === activeUid || (!uid && activeUid)) {
    currentLook = next;
    emitLook();
  }

  if (isVerifiedFirebaseUser(effectiveUid)) {
    const docPath = `users/${effectiveUid}`;
    try {
      await setDoc(
        doc(db, 'users', effectiveUid),
        stripUndefined({
          lookPreferences: next,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }

  return next;
}

export async function syncUserLookFromCloud(
  uid: string
): Promise<UserLookPreferences> {
  const local = loadUserLookLocal(uid);
  if (!isVerifiedFirebaseUser(uid)) {
    return local;
  }

  const docPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const cloud = snap.data()?.lookPreferences as
      | Partial<UserLookPreferences>
      | undefined;

    if (!cloud) {
      if (
        local.glassOpacity !== DEFAULT_LOOK.glassOpacity ||
        local.compactTiles !== DEFAULT_LOOK.compactTiles ||
        local.springMotion !== DEFAULT_LOOK.springMotion
      ) {
        await setDoc(
          doc(db, 'users', uid),
          stripUndefined({
            lookPreferences: local,
            updatedAt: Date.now(),
          }),
          { merge: true }
        );
      }
      return local;
    }

    const merged = normalizeLookPreferences({ ...local, ...cloud });
    saveUserLookLocal(merged, uid);

    if (activeUid === uid) {
      currentLook = merged;
      emitLook();
    }
    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      msg.includes('offline') ||
      msg.includes('unavailable')
    ) {
      return local;
    }
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export function subscribeUserLook(
  listener: (look: UserLookPreferences) => void
): () => void {
  lookListeners.add(listener);
  listener({ ...currentLook });
  return () => {
    lookListeners.delete(listener);
  };
}

export function getCurrentUserLook(): UserLookPreferences {
  return { ...currentLook };
}

export function clearAccountSessionState(previousUid?: string | null): void {
  if (typeof window !== 'undefined') {
    try {
      for (const legacyKey of LEGACY_UNSCOPED_KEYS) {
        window.localStorage?.removeItem(legacyKey);
      }
      window.sessionStorage?.removeItem('ather_home_shelves_session_v1');
      if (previousUid) {
        // Clear any volatile in-session cache scoped under previousUid if requested
        window.sessionStorage?.removeItem(scopedStorageKey('session_cache', previousUid));
      }
    } catch {
      // ignore storage errors
    }
  }

  activeUid = null;
  currentLook = { ...DEFAULT_LOOK };
  emitLook();
}

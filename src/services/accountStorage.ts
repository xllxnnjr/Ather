import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AvatarPreset } from '../components/ProfileAvatar';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  stripUndefined,
} from '../firebase';
import {
  RecognitionHistoryItem,
  ShowcaseTrack,
  UserPlaylist,
} from '../types/music';
import {
  clearAccountSessionState,
  getActiveUserId,
  setActiveUserId,
} from './userScope';

export type AccountProvider = 'google' | 'apple' | 'email' | 'guest';

export interface ActiveAccountIdentity {
  id: string;
  provider: AccountProvider;
  displayName?: string;
  email?: string;
  handle?: string;
  photoUrl?: string;
  uid?: string | null;
}

export interface StoredAccountProfile {
  displayName: string;
  handle: string;
  email: string;
  profileImageUrl: string | null;
  avatarPreset: AvatarPreset;
}

export interface StoredAiSettings {
  smartShuffle: boolean;
  recommendations: boolean;
  discoveryLevel: string;
}

export interface StoredAppPreferences {
  autoplay: boolean;
  audioQuality: string;
  explicitAllowed: boolean;
  showLyricsEnabled: boolean;
  hapticsEnabled: boolean;
  lyricsGlowEnabled: boolean;
  showFeedCounts: boolean;
  notificationsEnabled: boolean;
  microphoneEnabled: boolean;
  crossfadeSeconds?: number;
  gaplessPlayback?: boolean;
  openPlayerOnTap?: boolean;
  miniSwipeEnabled?: boolean;
  reelsAutoScroll?: boolean;
  reelsDurationSeconds?: number;
  reelsAutoPauseMusic?: boolean;
  trackActivity?: boolean;
  privateSession?: boolean;
  autoDownloadFavorites?: boolean;
}

export interface StoredEqState {
  preset: string;
  bands: number[];
}

export interface StoredPlayHistoryEntry {
  trackId: string;
  playedAt: number;
}

export interface FavoriteTombstoneState {
  liked: boolean;
  updatedAt: number;
}

export interface SyncSectionTimestamps {
  onboarding?: number;
  profile?: number;
  taste?: number;
  playlists?: number;
  favorites?: number;
  ai?: number;
  preferences?: number;
  eq?: number;
  history?: number;
}

export interface AccountSyncMeta {
  pendingSync: boolean;
  syncVersion: number;
  lastSyncedAt: number;
  historyClearedAt: number;
  deletedPlaylistIds: Record<string, number>;
  favoriteStates: Record<string, FavoriteTombstoneState>;
  sectionTimestamps: SyncSectionTimestamps;
}

export interface CloudAccountSnapshot {
  hasCompletedOnboarding: boolean;
  profile?: StoredAccountProfile;
  userMusicProfile?: Record<string, unknown>;
  playlists?: UserPlaylist[];
  deletedPlaylistIds?: Record<string, number>;
  favorites?: string[];
  favoriteStates?: Record<string, FavoriteTombstoneState>;
  aiSettings?: StoredAiSettings;
  preferences?: StoredAppPreferences;
  eqState?: StoredEqState;
  recentIds?: string[];
  playHistory?: StoredPlayHistoryEntry[];
  recognitionHistory?: RecognitionHistoryItem[];
  recentSearches?: unknown[];
  historyClearedAt?: number;
  sectionTimestamps?: SyncSectionTimestamps;
  syncVersion?: number;
  lastModifiedByDeviceId?: string;
  updatedAt: number;
}

const ACTIVE_ACCOUNT_KEY = 'ather_active_account_v1';
const ACCOUNT_LIST_KEY = 'ather_known_accounts_v1';
export const ACTIVE_ACCOUNT_CHANGED_EVENT = 'ather:active-account-changed';
export const LOCAL_SYNC_NEEDED_EVENT = 'ather:local-sync-needed';
export const REMOTE_SYNC_APPLIED_EVENT = 'ather:remote-sync-applied';
const MAX_CLOUD_DATA_URL_LENGTH = 90_000;

export function dispatchLocalAccountSyncNeeded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_SYNC_NEEDED_EVENT));
  }
}

export function dispatchRemoteSyncApplied(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMOTE_SYNC_APPLIED_EVENT));
  }
}

export function sanitizeAccountId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:@.\-]+/g, '_')
    .slice(0, 100);
}

export function getCanonicalAccountScopeId(
  account: ActiveAccountIdentity | null | undefined
): string | null {
  if (!account) return null;
  if (account.provider === 'google' && account.uid) {
    return account.uid;
  }
  return account.id ? sanitizeAccountId(account.id) : null;
}

export function getActiveAccount(): ActiveAccountIdentity | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveAccountIdentity;
    if (!parsed?.id || !parsed?.provider) return null;
    if (parsed.provider === 'guest') {
      delete parsed.email;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getActiveAccountId(): string | null {
  return getActiveAccount()?.id ?? null;
}

// Synchronize initial userScope synchronously at module bootstrap
if (typeof window !== 'undefined') {
  const initial = getActiveAccount();
  setActiveUserId(getCanonicalAccountScopeId(initial));
}

export function getKnownAccounts(): ActiveAccountIdentity[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNT_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActiveAccountIdentity[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => Boolean(a?.id))
      .map((a) => {
        if (a.provider === 'guest') {
          const copy = { ...a };
          delete copy.email;
          return copy;
        }
        return a;
      });
  } catch {
    return [];
  }
}

export function setActiveAccount(account: ActiveAccountIdentity | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const prevScopeUid = getActiveUserId();
    if (!account) {
      window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      window.localStorage.removeItem('hasCompletedOnboarding');
      clearAccountSessionState(prevScopeUid);
    } else {
      const normalized: ActiveAccountIdentity = {
        ...account,
        id: sanitizeAccountId(account.id),
      };
      if (normalized.provider === 'guest') {
        delete normalized.email;
      }
      const nextScopeUid = getCanonicalAccountScopeId(normalized);
      if (prevScopeUid && prevScopeUid !== nextScopeUid) {
        clearAccountSessionState(prevScopeUid);
      }

      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(normalized));
      setActiveUserId(nextScopeUid);

      // Mirror current account onboarding flag strictly for active user
      const completed = hasCompletedAccountOnboarding(normalized.id);
      if (completed) {
        window.localStorage.setItem('hasCompletedOnboarding', 'true');
      } else {
        window.localStorage.removeItem('hasCompletedOnboarding');
      }

      // Save into known accounts list for convenient re-login display
      const existing = getKnownAccounts().filter((a) => a.id !== normalized.id);
      window.localStorage.setItem(
        ACCOUNT_LIST_KEY,
        JSON.stringify([normalized, ...existing].slice(0, 8))
      );

      // Ensure default profile exists for newly signed-in account if absent,
      // and strip any leftover email from an existing guest profile.
      const profKey = getAccountSliceKey('profile', normalized.id);
      const existingProfRaw = window.localStorage.getItem(profKey);
      if (!existingProfRaw) {
        const fallbackName =
          normalized.displayName ||
          (normalized.provider !== 'guest' && normalized.email
            ? normalized.email.split('@')[0]
            : '') ||
          (normalized.provider === 'guest'
            ? 'Guest Listener'
            : normalized.provider === 'apple'
            ? 'Apple Listener'
            : 'ATHER Listener');
        const baseHandle =
          fallbackName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'listener';
        const defaultProfile: StoredAccountProfile = {
          displayName: fallbackName,
          handle: normalized.handle || `@${baseHandle}`,
          email: normalized.provider === 'guest' ? '' : normalized.email || '',
          profileImageUrl: normalized.photoUrl || null,
          avatarPreset: 'studio',
        };
        window.localStorage.setItem(profKey, JSON.stringify(defaultProfile));
      } else if (normalized.provider === 'guest') {
        try {
          const parsedProf = JSON.parse(existingProfRaw) as StoredAccountProfile;
          if (parsedProf && parsedProf.email) {
            window.localStorage.setItem(
              profKey,
              JSON.stringify({ ...parsedProf, email: '' })
            );
          }
        } catch {
          // ignore malformed stored profile
        }
      }
    }
    window.dispatchEvent(
      new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, { detail: account })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getAccountSliceKey(
  slice: string,
  accountIdOverride?: string | null
): string {
  const id = accountIdOverride || getActiveAccountId() || 'anonymous';
  return `ather_acct_${sanitizeAccountId(id)}_${slice}`;
}

function isGuestScopeId(accountIdOverride?: string | null): boolean {
  const effectiveId = sanitizeAccountId(
    accountIdOverride || getActiveAccountId() || ''
  );
  if (effectiveId === 'guest:local' || effectiveId.startsWith('guest:')) {
    return true;
  }
  const active = getActiveAccount();
  return !accountIdOverride && active?.provider === 'guest';
}

export function readAccountJson<T>(
  slice: string,
  fallback: T,
  accountIdOverride?: string | null
): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(
      getAccountSliceKey(slice, accountIdOverride)
    );
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (
      slice === 'profile' &&
      parsed &&
      typeof parsed === 'object' &&
      isGuestScopeId(accountIdOverride)
    ) {
      return { ...(parsed as Record<string, unknown>), email: '' } as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function writeAccountJson<T>(
  slice: string,
  value: T,
  accountIdOverride?: string | null
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload =
      slice === 'profile' &&
      value &&
      typeof value === 'object' &&
      isGuestScopeId(accountIdOverride)
        ? { ...(value as Record<string, unknown>), email: '' }
        : value;
    window.localStorage.setItem(
      getAccountSliceKey(slice, accountIdOverride),
      JSON.stringify(payload)
    );
  } catch {
    // ignore quota errors
  }
}

export function getDefaultSyncMeta(): AccountSyncMeta {
  return {
    pendingSync: false,
    syncVersion: 0,
    lastSyncedAt: 0,
    historyClearedAt: 0,
    deletedPlaylistIds: {},
    favoriteStates: {},
    sectionTimestamps: {},
  };
}

export function getSyncMeta(
  accountIdOverride?: string | null
): AccountSyncMeta {
  const stored = readAccountJson<Partial<AccountSyncMeta>>(
    'syncMeta',
    {},
    accountIdOverride
  );
  return {
    pendingSync: Boolean(stored.pendingSync),
    syncVersion: Number(stored.syncVersion || 0),
    lastSyncedAt: Number(stored.lastSyncedAt || 0),
    historyClearedAt: Number(stored.historyClearedAt || 0),
    deletedPlaylistIds:
      stored.deletedPlaylistIds && typeof stored.deletedPlaylistIds === 'object'
        ? stored.deletedPlaylistIds
        : {},
    favoriteStates:
      stored.favoriteStates && typeof stored.favoriteStates === 'object'
        ? stored.favoriteStates
        : {},
    sectionTimestamps:
      stored.sectionTimestamps && typeof stored.sectionTimestamps === 'object'
        ? stored.sectionTimestamps
        : {},
  };
}

export function saveSyncMeta(
  meta: AccountSyncMeta,
  accountIdOverride?: string | null
): void {
  writeAccountJson('syncMeta', meta, accountIdOverride);
}

export function touchSyncSection(
  section: keyof SyncSectionTimestamps,
  accountIdOverride?: string | null,
  markPending = true
): void {
  const now = Date.now();
  const meta = getSyncMeta(accountIdOverride);
  saveSyncMeta(
    {
      ...meta,
      pendingSync: markPending ? true : meta.pendingSync,
      sectionTimestamps: {
        ...meta.sectionTimestamps,
        [section]: now,
      },
    },
    accountIdOverride
  );
}

export function recordPlaylistDeletion(
  playlistId: string,
  accountIdOverride?: string | null
): void {
  if (!playlistId) return;
  const now = Date.now();
  const meta = getSyncMeta(accountIdOverride);
  const nextDeleted = { ...meta.deletedPlaylistIds, [playlistId]: now };
  const prunedEntries = Object.entries(nextDeleted)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120);
  saveSyncMeta(
    {
      ...meta,
      pendingSync: true,
      deletedPlaylistIds: Object.fromEntries(prunedEntries),
      sectionTimestamps: {
        ...meta.sectionTimestamps,
        playlists: now,
      },
    },
    accountIdOverride
  );
}

export function recordFavoriteMutation(
  trackId: string,
  liked: boolean,
  accountIdOverride?: string | null
): void {
  if (!trackId) return;
  const now = Date.now();
  const meta = getSyncMeta(accountIdOverride);
  const nextFavStates: Record<string, FavoriteTombstoneState> = {
    ...meta.favoriteStates,
    [trackId]: { liked, updatedAt: now },
  };
  // Keep latest 400 favorite state records
  const entries = Object.entries(nextFavStates)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, 400);
  saveSyncMeta(
    {
      ...meta,
      pendingSync: true,
      favoriteStates: Object.fromEntries(entries),
      sectionTimestamps: {
        ...meta.sectionTimestamps,
        favorites: now,
      },
    },
    accountIdOverride
  );
}

export function recordHistoryCleared(
  accountIdOverride?: string | null
): void {
  const now = Date.now();
  const meta = getSyncMeta(accountIdOverride);
  saveSyncMeta(
    {
      ...meta,
      pendingSync: true,
      historyClearedAt: now,
      sectionTimestamps: {
        ...meta.sectionTimestamps,
        history: now,
      },
    },
    accountIdOverride
  );
}

export function hasCompletedAccountOnboarding(
  accountIdOverride?: string | null
): boolean {
  const targetId = accountIdOverride ?? getActiveAccountId();
  if (!targetId) return false;
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return (
    window.localStorage.getItem(getAccountSliceKey('hasCompletedOnboarding', targetId)) ===
    'true'
  );
}

export function setAccountOnboardingCompleted(
  completed: boolean,
  accountIdOverride?: string | null
): void {
  const targetId = accountIdOverride ?? getActiveAccountId();
  if (!targetId || typeof window === 'undefined' || !window.localStorage) return;
  const key = getAccountSliceKey('hasCompletedOnboarding', targetId);
  if (completed) {
    window.localStorage.setItem(key, 'true');
    window.localStorage.setItem('hasCompletedOnboarding', 'true');
  } else {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem('hasCompletedOnboarding');
  }
  touchSyncSection('onboarding', targetId, true);
}

export function getDefaultAiSettings(): StoredAiSettings {
  return {
    smartShuffle: false,
    recommendations: false,
    discoveryLevel: 'Balanced',
  };
}

export function getDefaultAppPreferences(): StoredAppPreferences {
  return {
    autoplay: true,
    audioQuality: 'High · Spatial',
    explicitAllowed: true,
    showLyricsEnabled: true,
    hapticsEnabled: true,
    lyricsGlowEnabled: true,
    showFeedCounts: true,
    notificationsEnabled: false,
    microphoneEnabled: false,
    crossfadeSeconds: 4,
    gaplessPlayback: true,
    openPlayerOnTap: true,
    miniSwipeEnabled: true,
    reelsAutoScroll: true,
    reelsDurationSeconds: 12,
    reelsAutoPauseMusic: true,
    trackActivity: true,
    privateSession: false,
    autoDownloadFavorites: false,
  };
}

export function getDefaultProfile(
  identity?: ActiveAccountIdentity | null
): StoredAccountProfile {
  const acc = identity ?? getActiveAccount();
  const isGuest = acc?.provider === 'guest';
  const baseName =
    acc?.displayName ||
    (!isGuest && acc?.email ? acc.email.split('@')[0] : '') ||
    (isGuest ? 'Guest Listener' : 'Listener');
  const handleSlug =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'listener';
  return {
    displayName: baseName,
    handle: acc?.handle || `@${handleSlug}`,
    email: isGuest ? '' : acc?.email || '',
    profileImageUrl: acc?.photoUrl || null,
    avatarPreset: 'studio',
  };
}

function sanitizeCloudImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:') && url.length > MAX_CLOUD_DATA_URL_LENGTH) {
    return null;
  }
  return url.slice(0, MAX_CLOUD_DATA_URL_LENGTH);
}

/**
 * Downscales & JPEG-compresses uploaded image files so avatars / covers sync smoothly
 * to Firestore without hitting the 1 MiB document size ceiling.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 256,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) {
        reject(new Error('Empty image data'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || maxDimension;
          const h = img.naturalHeight || maxDimension;
          const scale = Math.min(1, maxDimension / Math.max(w, h));
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed.length < rawUrl.length ? compressed : rawUrl);
        } catch {
          resolve(rawUrl);
        }
      };
      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function buildLocalCloudSnapshot(
  accountId: string,
  deviceId?: string
): CloudAccountSnapshot {
  const meta = getSyncMeta(accountId);
  const rawProfile = readAccountJson<StoredAccountProfile>(
    'profile',
    getDefaultProfile(),
    accountId
  );
  const safeProfile: StoredAccountProfile = {
    ...rawProfile,
    profileImageUrl: sanitizeCloudImageUrl(rawProfile.profileImageUrl),
  };

  const rawPlaylists = readAccountJson<UserPlaylist[]>('playlists', [], accountId)
    .slice(0, 60)
    .map((pl) => ({
      ...pl,
      coverImageUrl: sanitizeCloudImageUrl(pl.coverImageUrl) ?? undefined,
      updatedAtMs: pl.updatedAtMs ?? meta.sectionTimestamps.playlists ?? Date.now(),
    }));

  const rawFavorites = readAccountJson<string[]>('favorites', [], accountId).slice(
    0,
    400
  );
  const favStatesRaw: Record<string, FavoriteTombstoneState> = {
    ...meta.favoriteStates,
  };
  const fallbackFavTs = meta.sectionTimestamps.favorites || Date.now();
  for (const id of rawFavorites) {
    if (!favStatesRaw[id]) {
      favStatesRaw[id] = { liked: true, updatedAt: fallbackFavTs };
    }
  }
  const favStates = Object.fromEntries(
    Object.entries(favStatesRaw)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, 400)
  );
  const safeDeletedPlaylistIds = Object.fromEntries(
    Object.entries(meta.deletedPlaylistIds || {})
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 150)
  );

  const eqState = readAccountJson<StoredEqState>(
    'eqState',
    { preset: 'Flat', bands: [0, 0, 0, 0, 0] },
    accountId
  );
  const recentIds = readAccountJson<string[]>('recentIds', [], accountId).slice(0, 15);
  const playHistory = readAccountJson<StoredPlayHistoryEntry[]>(
    'playHistory',
    [],
    accountId
  ).slice(0, 120);

  const now = Date.now();
  return stripUndefined({
    hasCompletedOnboarding: hasCompletedAccountOnboarding(accountId),
    profile: safeProfile,
    userMusicProfile: readAccountJson<Record<string, unknown>>(
      'userMusicProfile',
      {},
      accountId
    ),
    playlists: rawPlaylists,
    deletedPlaylistIds: safeDeletedPlaylistIds,
    favorites: rawFavorites,
    favoriteStates: favStates,
    aiSettings: readAccountJson<StoredAiSettings>(
      'aiSettings',
      getDefaultAiSettings(),
      accountId
    ),
    preferences: {
      ...getDefaultAppPreferences(),
      ...readAccountJson<Partial<StoredAppPreferences>>(
        'preferences',
        {},
        accountId
      ),
    },
    eqState,
    recentIds,
    playHistory,
    recentSearches: readAccountJson<unknown[]>(
      'recentSearches',
      [],
      accountId
    ).slice(0, 20),
    historyClearedAt: meta.historyClearedAt,
    sectionTimestamps: meta.sectionTimestamps,
    syncVersion: (meta.syncVersion || 0) + 1,
    lastModifiedByDeviceId: deviceId || undefined,
    updatedAt: now,
  });
}

function mergeScoreMaps(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined
): Record<string, number> {
  const out: Record<string, number> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = Math.max(Number(out[k] || 0), Number(v || 0));
  }
  return out;
}

export function mergeCloudAndLocalSnapshots(
  local: CloudAccountSnapshot,
  cloud: CloudAccountSnapshot,
  localHasPendingChanges: boolean
): CloudAccountSnapshot {
  const localTs = local.sectionTimestamps || {};
  const cloudTs = cloud.sectionTimestamps || {};

  const pickSection = <T>(
    key: keyof SyncSectionTimestamps,
    localVal: T,
    cloudVal: T | undefined
  ): { value: T; ts: number } => {
    const lTs = Number(localTs[key] || 0);
    const cTs = Number(cloudTs[key] || cloud.updatedAt || 0);
    if (cloudVal === undefined) {
      return { value: localVal, ts: lTs };
    }
    if (localHasPendingChanges && lTs > cTs) {
      return { value: localVal, ts: lTs };
    }
    if (cTs >= lTs) {
      return { value: cloudVal, ts: cTs };
    }
    return { value: localVal, ts: lTs };
  };

  // 1. Onboarding: sticky true across devices unless locally reset more recently
  const onboardingResult = pickSection(
    'onboarding',
    local.hasCompletedOnboarding,
    cloud.hasCompletedOnboarding
  );
  const mergedOnboarding = Boolean(
    cloud.hasCompletedOnboarding || onboardingResult.value
  );

  // 2. Profile (preserve local custom photo if cloud stripped an oversized inline image)
  const profRes = pickSection('profile', local.profile, cloud.profile);
  const mergedProfile = profRes.value
    ? {
        ...profRes.value,
        profileImageUrl:
          profRes.value.profileImageUrl ?? local.profile?.profileImageUrl ?? null,
      }
    : undefined;

  // 3. Playlists with tombstones (no ghost resurrection, no duplicates)
  const mergedDeleted: Record<string, number> = {
    ...(cloud.deletedPlaylistIds || {}),
  };
  for (const [id, ts] of Object.entries(local.deletedPlaylistIds || {})) {
    mergedDeleted[id] = Math.max(Number(mergedDeleted[id] || 0), Number(ts || 0));
  }
  const playlistById = new Map<string, UserPlaylist>();
  const ingestPlaylists = (list: UserPlaylist[] | undefined, defaultTs: number) => {
    for (const pl of list || []) {
      if (!pl?.id) continue;
      const itemTs = Number(pl.updatedAtMs || defaultTs || 0);
      const deletedAt = Number(mergedDeleted[pl.id] || 0);
      if (deletedAt >= itemTs && deletedAt > 0) continue;
      const existing = playlistById.get(pl.id);
      if (!existing || itemTs >= Number(existing.updatedAtMs || 0)) {
        playlistById.set(pl.id, {
          ...pl,
          updatedAtMs: itemTs || Date.now(),
        });
      }
    }
  };
  ingestPlaylists(cloud.playlists, Number(cloudTs.playlists || cloud.updatedAt || 0));
  ingestPlaylists(local.playlists, Number(localTs.playlists || local.updatedAt || 0));
  const mergedPlaylists = Array.from(playlistById.values())
    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0))
    .slice(0, 60);

  // 4. Favorites with per-track timestamps
  const mergedFavStates: Record<string, FavoriteTombstoneState> = {};
  const ingestFavStates = (
    states: Record<string, FavoriteTombstoneState> | undefined,
    list: string[] | undefined,
    fallbackTs: number
  ) => {
    for (const [id, st] of Object.entries(states || {})) {
      if (!id || !st) continue;
      const cur = mergedFavStates[id];
      if (!cur || Number(st.updatedAt || 0) >= cur.updatedAt) {
        mergedFavStates[id] = {
          liked: Boolean(st.liked),
          updatedAt: Number(st.updatedAt || fallbackTs),
        };
      }
    }
    for (const id of list || []) {
      if (!id) continue;
      if (!mergedFavStates[id]) {
        mergedFavStates[id] = { liked: true, updatedAt: fallbackTs };
      }
    }
  };
  ingestFavStates(
    cloud.favoriteStates,
    cloud.favorites,
    Number(cloudTs.favorites || cloud.updatedAt || 0)
  );
  ingestFavStates(
    local.favoriteStates,
    local.favorites,
    Number(localTs.favorites || local.updatedAt || 0)
  );
  const mergedFavorites = Object.entries(mergedFavStates)
    .filter(([, st]) => st.liked)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([id]) => id)
    .slice(0, 400);

  // 5. History, recentIds, recentSearches respecting historyClearedAt
  const historyClearedAt = Math.max(
    Number(local.historyClearedAt || 0),
    Number(cloud.historyClearedAt || 0)
  );
  const playMap = new Map<string, StoredPlayHistoryEntry>();
  for (const entry of [
    ...(cloud.playHistory || []),
    ...(local.playHistory || []),
  ]) {
    if (!entry?.trackId || Number(entry.playedAt || 0) <= historyClearedAt) {
      continue;
    }
    const key = `${entry.trackId}::${entry.playedAt}`;
    if (!playMap.has(key)) playMap.set(key, entry);
  }
  const mergedPlayHistory = Array.from(playMap.values())
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, 120);

  const histRes = pickSection('history', local.recentIds || [], cloud.recentIds);
  const mergedRecentIds =
    historyClearedAt > Number(localTs.history || 0) &&
    historyClearedAt > Number(cloudTs.history || 0)
      ? []
      : Array.from(
          new Set([
            ...(histRes.value || []),
            ...mergedPlayHistory.map((p) => p.trackId),
          ])
        ).slice(0, 10);

  // 6. User Taste Profile merge (union onboarding/followed artists + max scores)
  const localTaste = (local.userMusicProfile || {}) as Record<string, any>;
  const cloudTaste = (cloud.userMusicProfile || {}) as Record<string, any>;
  const tasteRes = pickSection('taste', localTaste, cloudTaste);
  const mergedTaste: Record<string, unknown> = {
    ...(tasteRes.value || {}),
    genreScores: mergeScoreMaps(cloudTaste.genreScores, localTaste.genreScores),
    artistScores: mergeScoreMaps(cloudTaste.artistScores, localTaste.artistScores),
    followedArtists: Array.from(
      new Set([
        ...(Array.isArray(cloudTaste.followedArtists)
          ? cloudTaste.followedArtists
          : []),
        ...(Array.isArray(localTaste.followedArtists)
          ? localTaste.followedArtists
          : []),
      ])
    ).slice(0, 100),
    onboardingGenres:
      Array.isArray(cloudTaste.onboardingGenres) &&
      cloudTaste.onboardingGenres.length > 0
        ? cloudTaste.onboardingGenres
        : Array.isArray(localTaste.onboardingGenres)
        ? localTaste.onboardingGenres
        : [],
    onboardingArtists:
      Array.isArray(cloudTaste.onboardingArtists) &&
      cloudTaste.onboardingArtists.length > 0
        ? cloudTaste.onboardingArtists
        : Array.isArray(localTaste.onboardingArtists)
        ? localTaste.onboardingArtists
        : [],
    recentlySeenTrackIds: Array.from(
      new Set([
        ...(Array.isArray(localTaste.recentlySeenTrackIds)
          ? localTaste.recentlySeenTrackIds
          : []),
        ...(Array.isArray(cloudTaste.recentlySeenTrackIds)
          ? cloudTaste.recentlySeenTrackIds
          : []),
      ])
    ).slice(0, 120),
    updatedAt: new Date().toISOString(),
  };

  const aiRes = pickSection('ai', local.aiSettings, cloud.aiSettings);
  const prefsRes = pickSection('preferences', local.preferences, cloud.preferences);
  const eqRes = pickSection('eq', local.eqState, cloud.eqState);

  const searchRes = pickSection(
    'history',
    local.recentSearches || [],
    cloud.recentSearches
  );
  const searchSeed = Array.isArray(searchRes.value) ? searchRes.value : [];

  const cappedFavStates = Object.fromEntries(
    Object.entries(mergedFavStates)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, 400)
  );
  const cappedDeleted = Object.fromEntries(
    Object.entries(mergedDeleted)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 150)
  );

  const mergedTimestamps: SyncSectionTimestamps = {
    onboarding: onboardingResult.ts,
    profile: profRes.ts,
    taste: tasteRes.ts,
    playlists: Math.max(Number(localTs.playlists || 0), Number(cloudTs.playlists || 0)),
    favorites: Math.max(Number(localTs.favorites || 0), Number(cloudTs.favorites || 0)),
    ai: aiRes.ts,
    preferences: prefsRes.ts,
    eq: eqRes.ts,
    history: Math.max(Number(localTs.history || 0), Number(cloudTs.history || 0)),
  };

  return stripUndefined({
    hasCompletedOnboarding: mergedOnboarding,
    profile: mergedProfile,
    userMusicProfile: mergedTaste,
    playlists: mergedPlaylists,
    deletedPlaylistIds: cappedDeleted,
    favorites: mergedFavorites,
    favoriteStates: cappedFavStates,
    aiSettings: aiRes.value,
    preferences: prefsRes.value
      ? { ...getDefaultAppPreferences(), ...prefsRes.value }
      : undefined,
    eqState: eqRes.value,
    recentIds: mergedRecentIds,
    playHistory: mergedPlayHistory,
    recentSearches: searchSeed.slice(0, 20),
    historyClearedAt,
    sectionTimestamps: mergedTimestamps,
    syncVersion: Math.max(
      Number(local.syncVersion || 0),
      Number(cloud.syncVersion || 0)
    ),
    updatedAt: Math.max(Number(local.updatedAt || 0), Number(cloud.updatedAt || 0)),
  });
}

export function applyMergedSnapshotToLocal(
  merged: CloudAccountSnapshot,
  accountId: string,
  options?: { markPending?: boolean; syncedAt?: number }
): void {
  if (merged.hasCompletedOnboarding) {
    const key = getAccountSliceKey('hasCompletedOnboarding', accountId);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, 'true');
      if (getActiveAccountId() === accountId) {
        window.localStorage.setItem('hasCompletedOnboarding', 'true');
      }
    }
  }
  if (merged.profile) {
    writeAccountJson('profile', merged.profile, accountId);
  }
  if (
    merged.userMusicProfile &&
    Object.keys(merged.userMusicProfile).length > 0
  ) {
    writeAccountJson('userMusicProfile', merged.userMusicProfile, accountId);
  }
  if (Array.isArray(merged.playlists)) {
    writeAccountJson('playlists', merged.playlists, accountId);
  }
  if (Array.isArray(merged.favorites)) {
    writeAccountJson('favorites', merged.favorites, accountId);
  }
  if (merged.aiSettings) {
    writeAccountJson('aiSettings', merged.aiSettings, accountId);
  }
  if (merged.preferences) {
    writeAccountJson('preferences', merged.preferences, accountId);
  }
  if (merged.eqState) {
    writeAccountJson('eqState', merged.eqState, accountId);
  }
  if (Array.isArray(merged.recentIds)) {
    writeAccountJson('recentIds', merged.recentIds, accountId);
  }
  if (Array.isArray(merged.playHistory)) {
    writeAccountJson('playHistory', merged.playHistory, accountId);
  }
  if (Array.isArray(merged.recentSearches)) {
    writeAccountJson('recentSearches', merged.recentSearches, accountId);
  }

  const prevMeta = getSyncMeta(accountId);
  saveSyncMeta(
    {
      pendingSync: options?.markPending ?? prevMeta.pendingSync,
      syncVersion: Number(merged.syncVersion || prevMeta.syncVersion || 0),
      lastSyncedAt: options?.syncedAt ?? prevMeta.lastSyncedAt,
      historyClearedAt: Number(
        merged.historyClearedAt ?? prevMeta.historyClearedAt ?? 0
      ),
      deletedPlaylistIds:
        merged.deletedPlaylistIds ?? prevMeta.deletedPlaylistIds,
      favoriteStates: merged.favoriteStates ?? prevMeta.favoriteStates,
      sectionTimestamps: merged.sectionTimestamps ?? prevMeta.sectionTimestamps,
    },
    accountId
  );
}

export async function saveAccountCloudSnapshot(
  uid: string,
  accountId?: string
): Promise<void> {
  if (
    !uid ||
    !auth.currentUser ||
    auth.currentUser.uid !== uid ||
    !auth.currentUser.emailVerified
  ) {
    return;
  }
  const resolvedAccountId = accountId || `google:${uid}`;
  const payload = buildLocalCloudSnapshot(resolvedAccountId);
  const now = payload.updatedAt;
  const docPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({
        accountData: payload,
        updatedAt: now,
      }),
      { merge: true }
    );
    const meta = getSyncMeta(resolvedAccountId);
    saveSyncMeta(
      {
        ...meta,
        pendingSync: false,
        syncVersion: payload.syncVersion || meta.syncVersion + 1,
        lastSyncedAt: now,
      },
      resolvedAccountId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function loadAccountCloudSnapshot(
  uid: string,
  accountId?: string
): Promise<CloudAccountSnapshot | null> {
  if (
    !uid ||
    !auth.currentUser ||
    auth.currentUser.uid !== uid ||
    !auth.currentUser.emailVerified
  ) {
    return null;
  }
  const resolvedAccountId = accountId || `google:${uid}`;
  const docPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const cloud = snap.data()?.accountData as CloudAccountSnapshot | undefined;
    if (!cloud) {
      // First login on Google or cloud empty: if local has completed onboarding or data, push it!
      const localSnap = buildLocalCloudSnapshot(resolvedAccountId);
      if (
        localSnap.hasCompletedOnboarding ||
        (localSnap.playlists?.length ?? 0) > 0 ||
        (localSnap.favorites?.length ?? 0) > 0
      ) {
        await setDoc(
          doc(db, 'users', uid),
          stripUndefined({ accountData: localSnap, updatedAt: Date.now() }),
          { merge: true }
        );
      }
      return null;
    }

    const meta = getSyncMeta(resolvedAccountId);
    const localSnap = buildLocalCloudSnapshot(resolvedAccountId);
    const merged = mergeCloudAndLocalSnapshots(localSnap, cloud, meta.pendingSync);
    applyMergedSnapshotToLocal(merged, resolvedAccountId, {
      markPending: false,
      syncedAt: Date.now(),
    });

    if (meta.pendingSync) {
      void setDoc(
        doc(db, 'users', uid),
        stripUndefined({ accountData: merged, updatedAt: Date.now() }),
        { merge: true }
      ).catch(() => undefined);
    }

    return merged;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

/**
 * Utility to resolve an array of downloaded track records isolated per account.
 */
export function loadDownloadedTracksForAccount(
  accountIdOverride?: string | null
): ShowcaseTrack[] {
  return readAccountJson<ShowcaseTrack[]>(
    'downloadedTracks',
    [],
    accountIdOverride
  );
}

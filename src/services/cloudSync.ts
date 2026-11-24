import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  stripUndefined,
} from '../firebase';
import {
  CloudAccountSnapshot,
  applyMergedSnapshotToLocal,
  buildLocalCloudSnapshot,
  dispatchRemoteSyncApplied,
  getSyncMeta,
  mergeCloudAndLocalSnapshots,
  saveSyncMeta,
} from './accountStorage';
import { getLocalDeviceId } from './deviceHandoff';
import {
  UserActivityStats,
  notifyActivityStatsChanged,
  syncActivityStatsFromCloud,
} from './listeningStats';
import {
  UserLookPreferences,
  syncUserLookFromCloud,
  updateUserLookPreferences,
} from './userScope';

export type CloudSyncPhase =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'retrying';

export interface CloudSyncStatus {
  phase: CloudSyncPhase;
  label: string;
  lastSyncedAt: number | null;
  pendingChanges: boolean;
  retryCount: number;
  errorMessage: string | null;
}

const DEFAULT_SYNC_STATUS: CloudSyncStatus = {
  phase: 'idle',
  label: 'Ready to sync',
  lastSyncedAt: null,
  pendingChanges: false,
  retryCount: 0,
  errorMessage: null,
};

let currentStatus: CloudSyncStatus = { ...DEFAULT_SYNC_STATUS };
const statusListeners = new Set<(status: CloudSyncStatus) => void>();

function emitStatus(patch: Partial<CloudSyncStatus>): void {
  currentStatus = { ...currentStatus, ...patch };
  const snapshot = { ...currentStatus };
  statusListeners.forEach((cb) => cb(snapshot));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return { ...currentStatus };
}

export function subscribeCloudSyncStatus(
  listener: (status: CloudSyncStatus) => void
): () => void {
  statusListeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    statusListeners.delete(listener);
  };
}

function isVerifiedSession(uid: string | null | undefined): uid is string {
  return Boolean(
    uid &&
      auth.currentUser &&
      auth.currentUser.uid === uid &&
      auth.currentUser.emailVerified
  );
}

function isNetworkOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function isTransientNetworkError(error: unknown): boolean {
  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('failed to get document')
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Cloud sync request timed out'));
    }, timeoutMs);
    promise.then(
      (val) => {
        window.clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

class CrossDeviceCloudSyncEngine {
  private activeUid: string | null = null;
  private activeAccountId: string | null = null;
  private unsubDoc: (() => void) | null = null;
  private pushDebounceTimer: number | null = null;
  private retryTimer: number | null = null;
  private retryCount = 0;
  private pushInFlight = false;
  private queuedPushAfterFlight = false;
  private lastWrittenVersion = 0;
  private applyingRemote = false;
  private onRemoteAppliedCb: (() => void) | null = null;
  private cleanupWindowListeners: (() => void) | null = null;

  start(
    uid: string | null,
    accountId: string | null,
    onRemoteApplied?: () => void
  ): void {
    this.stop();
    if (!uid || !accountId || !isVerifiedSession(uid)) {
      emitStatus({
        ...DEFAULT_SYNC_STATUS,
        phase: isNetworkOnline() ? 'idle' : 'offline',
        label: isNetworkOnline()
          ? 'Local account storage active'
          : 'Offline – changes saved locally',
      });
      return;
    }

    this.activeUid = uid;
    this.activeAccountId = accountId;
    this.onRemoteAppliedCb = onRemoteApplied ?? null;
    this.retryCount = 0;

    const initialMeta = getSyncMeta(accountId);
    emitStatus({
      phase: isNetworkOnline() ? 'syncing' : 'offline',
      label: isNetworkOnline()
        ? 'Syncing...'
        : 'Offline – changes saved locally',
      lastSyncedAt: initialMeta.lastSyncedAt || null,
      pendingChanges: initialMeta.pendingSync,
      retryCount: 0,
      errorMessage: null,
    });

    const docPath = `users/${uid}`;
    this.unsubDoc = onSnapshot(
      doc(db, 'users', uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (this.activeUid !== uid || this.activeAccountId !== accountId) return;

        if (!snap.exists()) {
          if (initialMeta.pendingSync) {
            void this.flushPush(true);
          }
          return;
        }

        const data = snap.data() as {
          accountData?: CloudAccountSnapshot;
          activityStats?: UserActivityStats;
          lookPreferences?: Partial<UserLookPreferences>;
          updatedAt?: number;
        };

        const cloud = data?.accountData;
        const localDeviceId = getLocalDeviceId(uid);

        // Ignore our own immediate local write echo
        if (
          cloud &&
          cloud.lastModifiedByDeviceId === localDeviceId &&
          Number(cloud.syncVersion || 0) === this.lastWrittenVersion &&
          this.lastWrittenVersion > 0
        ) {
          if (!snap.metadata.hasPendingWrites) {
            emitStatus({
              phase: 'synced',
              label: 'Synced successfully',
              lastSyncedAt: Date.now(),
              pendingChanges: false,
              retryCount: 0,
              errorMessage: null,
            });
          }
          return;
        }

        let didChangeLocal = false;
        if (cloud) {
          const meta = getSyncMeta(accountId);
          const localSnap = buildLocalCloudSnapshot(accountId, localDeviceId);
          const merged = mergeCloudAndLocalSnapshots(
            localSnap,
            cloud,
            meta.pendingSync
          );

          const beforeSig = JSON.stringify({
            ob: localSnap.hasCompletedOnboarding,
            p: localSnap.profile,
            pl: localSnap.playlists,
            fav: localSnap.favorites,
            ai: localSnap.aiSettings,
            pr: localSnap.preferences,
            eq: localSnap.eqState,
            rec: localSnap.recentIds,
            ph: localSnap.playHistory,
            rs: localSnap.recentSearches,
            tp: localSnap.userMusicProfile,
            hc: localSnap.historyClearedAt,
          });
          const afterSig = JSON.stringify({
            ob: merged.hasCompletedOnboarding,
            p: merged.profile,
            pl: merged.playlists,
            fav: merged.favorites,
            ai: merged.aiSettings,
            pr: merged.preferences,
            eq: merged.eqState,
            rec: merged.recentIds,
            ph: merged.playHistory,
            rs: merged.recentSearches,
            tp: merged.userMusicProfile,
            hc: merged.historyClearedAt,
          });

          if (beforeSig !== afterSig) {
            this.applyingRemote = true;
            try {
              applyMergedSnapshotToLocal(merged, accountId, {
                markPending: meta.pendingSync,
                syncedAt: Date.now(),
              });
              didChangeLocal = true;
            } finally {
              this.applyingRemote = false;
            }
          }
        }

        if (data?.activityStats) {
          void syncActivityStatsFromCloud(uid)
            .then(() => notifyActivityStatsChanged(uid))
            .catch(() => undefined);
        }
        if (data?.lookPreferences) {
          void syncUserLookFromCloud(uid).catch(() => undefined);
        }

        if (didChangeLocal) {
          dispatchRemoteSyncApplied();
          this.onRemoteAppliedCb?.();
        }

        if (snap.metadata.fromCache && !isNetworkOnline()) {
          emitStatus({
            phase: 'offline',
            label: 'Offline – changes saved locally',
            pendingChanges: getSyncMeta(accountId).pendingSync,
          });
        } else if (!getSyncMeta(accountId).pendingSync) {
          emitStatus({
            phase: 'synced',
            label: 'Synced successfully',
            lastSyncedAt: Date.now(),
            pendingChanges: false,
            retryCount: 0,
            errorMessage: null,
          });
        } else {
          void this.flushPush(true);
        }
      },
      (error) => {
        console.warn('Realtime account sync warning:', docPath, error);
        if (!isNetworkOnline() || isTransientNetworkError(error)) {
          emitStatus({
            phase: 'offline',
            label: 'Offline – changes saved locally',
            errorMessage: null,
          });
        } else {
          emitStatus({
            phase: 'retrying',
            label: 'Sync failed – retrying',
            errorMessage:
              error instanceof Error ? error.message : 'Sync listener error',
          });
        }
      }
    );

    if (typeof window !== 'undefined') {
      const handleOnlineOrVisible = () => {
        if (this.activeUid !== uid || this.activeAccountId !== accountId) return;
        if (!isNetworkOnline()) {
          emitStatus({
            phase: 'offline',
            label: 'Offline – changes saved locally',
          });
          return;
        }
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        if (getSyncMeta(accountId).pendingSync) {
          void this.flushPush(true);
        }
      };
      const handleOffline = () => {
        emitStatus({
          phase: 'offline',
          label: 'Offline – changes saved locally',
        });
      };

      window.addEventListener('online', handleOnlineOrVisible);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('visibilitychange', handleOnlineOrVisible);
      this.cleanupWindowListeners = () => {
        window.removeEventListener('online', handleOnlineOrVisible);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleOnlineOrVisible);
      };
    }
  }

  async hydrateOnSignIn(
    uid: string,
    accountId: string
  ): Promise<CloudAccountSnapshot | null> {
    if (!isVerifiedSession(uid)) return null;

    const meta = getSyncMeta(accountId);
    const localDeviceId = getLocalDeviceId(uid);
    const docPath = `users/${uid}`;

    emitStatus({
      phase: isNetworkOnline() ? 'syncing' : 'offline',
      label: isNetworkOnline()
        ? 'Syncing...'
        : 'Offline – changes saved locally',
      pendingChanges: meta.pendingSync,
      errorMessage: null,
    });

    try {
      let snap;
      try {
        snap = await withTimeout(getDocFromServer(doc(db, 'users', uid)), 5000);
      } catch {
        snap = await withTimeout(getDoc(doc(db, 'users', uid)), 3500);
      }

      await Promise.allSettled([
        syncActivityStatsFromCloud(uid),
        syncUserLookFromCloud(uid),
      ]);

      const cloud = snap?.data()?.accountData as CloudAccountSnapshot | undefined;
      if (!cloud) {
        const localSnap = buildLocalCloudSnapshot(accountId, localDeviceId);
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
        emitStatus({
          phase: 'synced',
          label: 'Synced successfully',
          lastSyncedAt: Date.now(),
          pendingChanges: false,
          retryCount: 0,
          errorMessage: null,
        });
        return null;
      }

      const localSnap = buildLocalCloudSnapshot(accountId, localDeviceId);
      const merged = mergeCloudAndLocalSnapshots(localSnap, cloud, meta.pendingSync);
      const syncedNow = Date.now();

      applyMergedSnapshotToLocal(merged, accountId, {
        markPending: meta.pendingSync,
        syncedAt: syncedNow,
      });
      dispatchRemoteSyncApplied();

      if (meta.pendingSync) {
        void this.flushPush(true);
      } else {
        emitStatus({
          phase: 'synced',
          label: 'Synced successfully',
          lastSyncedAt: syncedNow,
          pendingChanges: false,
          retryCount: 0,
          errorMessage: null,
        });
      }

      return merged;
    } catch (error) {
      if (isTransientNetworkError(error) || !isNetworkOnline()) {
        emitStatus({
          phase: 'offline',
          label: 'Offline – changes saved locally',
          errorMessage: null,
        });
        return null;
      }
      emitStatus({
        phase: 'retrying',
        label: 'Sync failed – retrying',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch {
        // already logged structured FirestoreErrorInfo
      }
      return null;
    }
  }

  schedulePush(uid: string, accountId: string, immediate = false): void {
    if (this.applyingRemote || !isVerifiedSession(uid)) return;
    if (this.activeUid !== uid || this.activeAccountId !== accountId) return;

    const meta = getSyncMeta(accountId);
    if (!meta.pendingSync) {
      saveSyncMeta({ ...meta, pendingSync: true }, accountId);
    }

    if (!isNetworkOnline()) {
      emitStatus({
        phase: 'offline',
        label: 'Offline – changes saved locally',
        pendingChanges: true,
        errorMessage: null,
      });
      return;
    }

    emitStatus({
      phase: 'syncing',
      label: 'Syncing...',
      pendingChanges: true,
      errorMessage: null,
    });

    if (this.pushDebounceTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pushDebounceTimer);
      this.pushDebounceTimer = null;
    }

    if (immediate) {
      void this.flushPush(true);
      return;
    }

    if (typeof window !== 'undefined') {
      this.pushDebounceTimer = window.setTimeout(() => {
        this.pushDebounceTimer = null;
        void this.flushPush(false);
      }, 900);
    }
  }

  async flushPush(manual = false): Promise<void> {
    const uid = this.activeUid;
    const accountId = this.activeAccountId;
    if (!uid || !accountId || !isVerifiedSession(uid)) return;

    if (!isNetworkOnline()) {
      emitStatus({
        phase: 'offline',
        label: 'Offline – changes saved locally',
        pendingChanges: getSyncMeta(accountId).pendingSync,
      });
      return;
    }

    if (this.pushInFlight) {
      this.queuedPushAfterFlight = true;
      return;
    }

    this.pushInFlight = true;
    emitStatus({
      phase: 'syncing',
      label: 'Syncing...',
      errorMessage: null,
    });

    const docPath = `users/${uid}`;
    try {
      const localDeviceId = getLocalDeviceId(uid);
      const payload = buildLocalCloudSnapshot(accountId, localDeviceId);
      this.lastWrittenVersion = Number(payload.syncVersion || 1);

      await withTimeout(
        setDoc(
          doc(db, 'users', uid),
          stripUndefined({
            accountData: payload,
            updatedAt: payload.updatedAt,
          }),
          { merge: true }
        ),
        8000
      );

      const syncedNow = Date.now();
      const latestMeta = getSyncMeta(accountId);
      saveSyncMeta(
        {
          ...latestMeta,
          pendingSync: false,
          syncVersion: this.lastWrittenVersion,
          lastSyncedAt: syncedNow,
        },
        accountId
      );

      this.retryCount = 0;
      if (this.retryTimer !== null && typeof window !== 'undefined') {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      emitStatus({
        phase: 'synced',
        label: 'Synced successfully',
        lastSyncedAt: syncedNow,
        pendingChanges: false,
        retryCount: 0,
        errorMessage: null,
      });
    } catch (error) {
      const offline = !isNetworkOnline() || isTransientNetworkError(error);
      if (offline) {
        emitStatus({
          phase: 'offline',
          label: 'Offline – changes saved locally',
          pendingChanges: true,
          errorMessage: null,
        });
      } else {
        this.retryCount += 1;
        emitStatus({
          phase: 'retrying',
          label: 'Sync failed – retrying',
          pendingChanges: true,
          retryCount: this.retryCount,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        if (manual) {
          try {
            handleFirestoreError(error, OperationType.WRITE, docPath);
          } catch {
            // logged cleanly
          }
        }
      }

      // Exponential backoff retry: 2s -> 5s -> 12s -> 30s
      const delays = [2000, 5000, 12000, 30000];
      const delayMs = delays[Math.min(this.retryCount, delays.length - 1)];
      if (typeof window !== 'undefined') {
        if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => {
          this.retryTimer = null;
          if (this.activeUid === uid && isNetworkOnline()) {
            void this.flushPush(false);
          }
        }, delayMs);
      }
    } finally {
      this.pushInFlight = false;
      if (this.queuedPushAfterFlight) {
        this.queuedPushAfterFlight = false;
        void this.flushPush(false);
      }
    }
  }

  isApplyingRemoteUpdate(): boolean {
    return this.applyingRemote;
  }

  stop(): void {
    this.activeUid = null;
    this.activeAccountId = null;
    this.onRemoteAppliedCb = null;
    this.retryCount = 0;
    this.lastWrittenVersion = 0;
    this.queuedPushAfterFlight = false;

    if (this.pushDebounceTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.pushDebounceTimer);
      this.pushDebounceTimer = null;
    }
    if (this.retryTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try {
      this.cleanupWindowListeners?.();
    } catch {
      // ignore
    }
    this.cleanupWindowListeners = null;
    try {
      this.unsubDoc?.();
    } catch {
      // ignore
    }
    this.unsubDoc = null;
  }
}

export const cloudSync = new CrossDeviceCloudSyncEngine();

export async function pushLookPrefsWithSyncStatus(
  patch: Partial<UserLookPreferences>,
  uid: string | null
): Promise<UserLookPreferences> {
  return updateUserLookPreferences(patch, uid);
}

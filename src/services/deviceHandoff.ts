import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  stripUndefined,
} from '../firebase';
import { ShowcaseTrack } from '../types/music';
import { getActiveUserId, scopedStorageKey } from './userScope';

export interface RegisteredDevice {
  id: string;
  ownerId: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  platform: string;
  isActive: boolean;
  lastSeenAt: number;
}

export type RemoteCommandType =
  | 'play'
  | 'pause'
  | 'seek'
  | 'next'
  | 'prev'
  | 'claim';

export interface RemotePlaybackCommand {
  id: string;
  type: RemoteCommandType;
  targetDeviceId: string;
  seekSec?: number;
  issuedByDeviceId: string;
  issuedAt: number;
}

export interface SharedPlaybackState {
  activeDeviceId: string;
  activeDeviceName: string;
  track?: ShowcaseTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  remoteCommand?: RemotePlaybackCommand | null;
}

const DEVICE_UUID_BASE_KEY = 'device_uuid_v1';
const DEVICE_NAME_BASE_KEY = 'device_name_v1';

function isVerifiedOwnerSession(uid: string | null | undefined): uid is string {
  return Boolean(
    uid &&
      auth.currentUser &&
      auth.currentUser.uid === uid &&
      auth.currentUser.emailVerified
  );
}

export function isDeviceRecentlyOnline(device: RegisteredDevice): boolean {
  return Date.now() - Number(device.lastSeenAt || 0) <= 90_000;
}

export function formatDeviceLastSeen(lastSeenAt: number): string {
  const diffMs = Math.max(0, Date.now() - Number(lastSeenAt || 0));
  if (diffMs <= 60_000) return 'online now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `active ${days}d ago`;
}

function detectDeviceMeta(): {
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  platform: string;
} {
  if (typeof navigator === 'undefined') {
    return { name: 'web player', type: 'desktop', platform: 'web' };
  }
  const ua = navigator.userAgent;
  const isCapacitor =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { Capacitor?: unknown }).Capacitor);
  const isAndroid = /Android/i.test(ua);
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua);
  const isMac = /Macintosh|Mac OS/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua);

  const browser = isCapacitor
    ? 'app'
    : /Edg\//i.test(ua)
    ? 'edge'
    : /Chrome\//i.test(ua)
    ? 'chrome'
    : /Safari\//i.test(ua)
    ? 'safari'
    : /Firefox\//i.test(ua)
    ? 'firefox'
    : 'browser';

  if (isAndroid) {
    return {
      name: isCapacitor ? 'Ather for android' : `android (${browser})`,
      type: 'mobile',
      platform: 'android',
    };
  }
  if (isIPhone) {
    return {
      name: `iPhone (${browser})`,
      type: 'mobile',
      platform: 'iOS',
    };
  }
  if (isIPad) {
    return {
      name: `iPad (${browser})`,
      type: 'tablet',
      platform: 'iPadOS',
    };
  }
  if (isMac) {
    return {
      name: `Mac (${browser})`,
      type: 'desktop',
      platform: 'macOS',
    };
  }
  if (isWindows) {
    return {
      name: `Windows PC (${browser})`,
      type: 'desktop',
      platform: 'Windows',
    };
  }
  if (isLinux) {
    return {
      name: `linux (${browser})`,
      type: 'desktop',
      platform: 'linux',
    };
  }
  return { name: `web player (${browser})`, type: 'desktop', platform: 'web' };
}

export function getLocalDeviceId(uid?: string | null): string {
  const effectiveUid = uid !== undefined ? uid : getActiveUserId();
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'web_device_default';
  }
  if (!effectiveUid) {
    return 'web_device_signed_out';
  }
  const storageKey = scopedStorageKey(DEVICE_UUID_BASE_KEY, effectiveUid);
  let existing = window.localStorage.getItem(storageKey);
  if (!existing || !/^[a-zA-Z0-9_-]+$/.test(existing)) {
    const rand = Math.random().toString(36).slice(2, 10);
    existing = `dev_${Date.now().toString(36)}_${rand}`;
    window.localStorage.setItem(storageKey, existing);
  }
  return existing;
}

export function getLocalDeviceInfo(
  uid?: string | null
): Omit<RegisteredDevice, 'ownerId' | 'isActive' | 'lastSeenAt'> {
  const effectiveUid = uid !== undefined ? uid : getActiveUserId();
  const detected = detectDeviceMeta();
  const customName =
    effectiveUid && typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(
          scopedStorageKey(DEVICE_NAME_BASE_KEY, effectiveUid)
        )
      : null;
  return {
    id: getLocalDeviceId(effectiveUid),
    name: customName?.trim() || detected.name,
    type: detected.type,
    platform: detected.platform,
  };
}

export function setLocalDeviceName(name: string, uid?: string | null): void {
  const effectiveUid = uid !== undefined ? uid : getActiveUserId();
  if (!effectiveUid || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const clean = name.trim().slice(0, 120);
  if (!clean) return;
  try {
    window.localStorage.setItem(
      scopedStorageKey(DEVICE_NAME_BASE_KEY, effectiveUid),
      clean
    );
  } catch {
    // ignore
  }
}

export function computeExactPositionSec(
  shared: SharedPlaybackState | null | undefined
): number {
  if (!shared) return 0;
  const base = Math.max(0, Number(shared.positionSec || 0));
  if (!shared.isPlaying || !shared.updatedAt) return base;
  const elapsedSec = Math.max(0, (Date.now() - shared.updatedAt) / 1000);
  const next = base + Math.min(elapsedSec, 60 * 60);
  if (shared.durationSec > 0) {
    return Math.min(shared.durationSec, next);
  }
  return next;
}

export async function heartbeatCurrentDevice(
  uid: string,
  isActivePlayback: boolean
): Promise<void> {
  if (!isVerifiedOwnerSession(uid)) return;
  const info = getLocalDeviceInfo(uid);
  const docPath = `users/${uid}/devices/${info.id}`;
  const payload: RegisteredDevice = stripUndefined({
    id: info.id,
    ownerId: uid,
    name: info.name.slice(0, 120),
    type: info.type,
    platform: info.platform.slice(0, 64),
    isActive: Boolean(isActivePlayback),
    lastSeenAt: Date.now(),
  });
  try {
    await setDoc(doc(db, 'users', uid, 'devices', info.id), payload, {
      merge: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function removeRegisteredDevice(
  uid: string,
  deviceId: string
): Promise<void> {
  if (!isVerifiedOwnerSession(uid) || !deviceId) return;
  const docPath = `users/${uid}/devices/${deviceId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'devices', deviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeToUserDevices(
  uid: string,
  onDevices: (devices: RegisteredDevice[]) => void,
  onError?: (errMessage: string) => void
): () => void {
  if (!isVerifiedOwnerSession(uid)) {
    onDevices([]);
    return () => undefined;
  }
  const colPath = `users/${uid}/devices`;
  const localId = getLocalDeviceId(uid);

  // Must match Firestore rule: resource.data.ownerId == request.auth.uid
  const devicesQuery = query(
    collection(db, 'users', uid, 'devices'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    devicesQuery,
    (snap) => {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const list: RegisteredDevice[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as RegisteredDevice;
        if (d?.id && (Number(d.lastSeenAt || 0) >= cutoff || d.id === localId)) {
          list.push(d);
        }
      });
      list.sort((a, b) => {
        if (a.id === localId) return -1;
        if (b.id === localId) return 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0);
      });
      onDevices(list);
    },
    (error) => {
      console.warn('Devices snapshot listener error:', colPath, error);
      onError?.(error instanceof Error ? error.message : String(error));
      onDevices([]);
    }
  );
}

export function subscribeToSharedPlayback(
  uid: string,
  onChange: (state: SharedPlaybackState | null) => void
): () => void {
  if (!isVerifiedOwnerSession(uid)) {
    onChange(null);
    return () => undefined;
  }
  const docPath = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const sp = snap.data()?.sharedPlayback as SharedPlaybackState | undefined;
      onChange(sp ?? null);
    },
    (error) => {
      console.warn('Shared playback listener warning:', docPath, error);
    }
  );
}

function sanitizeTrackForShared(track: ShowcaseTrack): ShowcaseTrack {
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
    explicit: track.explicit,
    releaseDate: track.releaseDate,
    collectionId: track.collectionId,
    accentColor: track.accentColor || '#FFFFFF',
    glowColor: track.glowColor || 'rgba(255, 255, 255, 0.22)',
    secondaryGlowColor:
      track.secondaryGlowColor || 'rgba(255, 255, 255, 0.12)',
    lyrics: [],
  });
}

export async function publishSharedPlayback(
  uid: string,
  params: {
    track: ShowcaseTrack;
    isPlaying: boolean;
    positionSec: number;
    durationSec: number;
  }
): Promise<void> {
  if (!isVerifiedOwnerSession(uid) || !params.track?.id) return;
  const info = getLocalDeviceInfo(uid);
  const now = Date.now();
  const sharedPlayback: SharedPlaybackState = stripUndefined({
    activeDeviceId: info.id,
    activeDeviceName: info.name,
    track: sanitizeTrackForShared(params.track),
    isPlaying: Boolean(params.isPlaying),
    positionSec: Math.max(0, Number(params.positionSec || 0)),
    durationSec: Math.max(
      0,
      Number(params.durationSec || params.track.duration || 0)
    ),
    updatedAt: now,
    remoteCommand: null,
  });
  const docPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({
        sharedPlayback,
        updatedAt: now,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function transferPlaybackToDevice(
  uid: string,
  targetDeviceId: string,
  targetDeviceName: string,
  params: {
    track: ShowcaseTrack;
    isPlaying: boolean;
    positionSec: number;
    durationSec: number;
  }
): Promise<void> {
  if (!isVerifiedOwnerSession(uid) || !params.track?.id) return;
  const info = getLocalDeviceInfo(uid);
  const now = Date.now();
  const sharedPlayback: SharedPlaybackState = stripUndefined({
    activeDeviceId: targetDeviceId,
    activeDeviceName: targetDeviceName,
    track: sanitizeTrackForShared(params.track),
    isPlaying: Boolean(params.isPlaying),
    positionSec: Math.max(0, Number(params.positionSec || 0)),
    durationSec: Math.max(
      0,
      Number(params.durationSec || params.track.duration || 0)
    ),
    updatedAt: now,
    remoteCommand: {
      id: `cmd_${now}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'claim',
      targetDeviceId,
      seekSec: Math.max(0, Number(params.positionSec || 0)),
      issuedByDeviceId: info.id,
      issuedAt: now,
    },
  });
  const docPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({ sharedPlayback, updatedAt: now }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function sendRemoteControlCommand(
  uid: string,
  targetDeviceId: string,
  type: RemoteCommandType,
  seekSec?: number
): Promise<void> {
  if (!isVerifiedOwnerSession(uid)) return;
  const info = getLocalDeviceInfo(uid);
  const now = Date.now();
  const command: RemotePlaybackCommand = stripUndefined({
    id: `cmd_${now}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    targetDeviceId,
    seekSec: seekSec !== undefined ? Math.max(0, Number(seekSec)) : undefined,
    issuedByDeviceId: info.id,
    issuedAt: now,
  });
  const docPath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      stripUndefined({
        sharedPlayback: {
          remoteCommand: command,
          updatedAt: now,
        },
        updatedAt: now,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

class DeviceHandoffController {
  private activeUid: string | null = null;
  private unsubDevices: (() => void) | null = null;
  private unsubShared: (() => void) | null = null;
  private heartbeatTimer: number | null = null;
  private cleanupListeners: (() => void) | null = null;
  private getIsPlayingFn: (() => boolean) | null = null;
  private onDevicesCb: ((devices: RegisteredDevice[]) => void) | null = null;
  private onSharedCb: ((state: SharedPlaybackState | null) => void) | null =
    null;

  start(
    uid: string | null,
    options?: {
      getIsPlaying?: () => boolean;
      onDevices?: (devices: RegisteredDevice[]) => void;
      onSharedPlayback?: (state: SharedPlaybackState | null) => void;
    }
  ): void {
    this.stop();
    if (!isVerifiedOwnerSession(uid)) {
      options?.onDevices?.([]);
      options?.onSharedPlayback?.(null);
      return;
    }

    this.activeUid = uid;
    this.getIsPlayingFn = options?.getIsPlaying ?? null;
    this.onDevicesCb = options?.onDevices ?? null;
    this.onSharedCb = options?.onSharedPlayback ?? null;

    this.unsubDevices = subscribeToUserDevices(uid, (list) => {
      if (this.activeUid === uid) {
        this.onDevicesCb?.(list);
      }
    });
    this.unsubShared = subscribeToSharedPlayback(uid, (state) => {
      if (this.activeUid === uid) {
        this.onSharedCb?.(state);
      }
    });

    const sendHeartbeat = () => {
      if (this.activeUid !== uid) return;
      void heartbeatCurrentDevice(
        uid,
        Boolean(this.getIsPlayingFn?.())
      ).catch(() => undefined);
    };

    sendHeartbeat();
    if (typeof window !== 'undefined') {
      this.heartbeatTimer = window.setInterval(sendHeartbeat, 15000);
      const onVisibleOrOnline = () => {
        if (
          typeof document === 'undefined' ||
          document.visibilityState === 'visible'
        ) {
          sendHeartbeat();
        }
      };
      window.addEventListener('online', onVisibleOrOnline);
      document.addEventListener('visibilitychange', onVisibleOrOnline);
      this.cleanupListeners = () => {
        window.removeEventListener('online', onVisibleOrOnline);
        document.removeEventListener('visibilitychange', onVisibleOrOnline);
      };
    }
  }

  triggerHeartbeat(isPlaying?: boolean): void {
    const uid = this.activeUid;
    if (!uid || !isVerifiedOwnerSession(uid)) return;
    const playing =
      isPlaying !== undefined ? isPlaying : Boolean(this.getIsPlayingFn?.());
    void heartbeatCurrentDevice(uid, playing).catch(() => undefined);
  }

  stop(): void {
    this.activeUid = null;
    this.getIsPlayingFn = null;
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      this.cleanupListeners?.();
    } catch {
      // ignore
    }
    this.cleanupListeners = null;
    try {
      this.unsubDevices?.();
    } catch {
      // ignore
    }
    this.unsubDevices = null;
    try {
      this.unsubShared?.();
    } catch {
      // ignore
    }
    this.unsubShared = null;
    this.onDevicesCb?.([]);
    this.onSharedCb?.(null);
    this.onDevicesCb = null;
    this.onSharedCb = null;
  }
}

export const deviceHandoff = new DeviceHandoffController();

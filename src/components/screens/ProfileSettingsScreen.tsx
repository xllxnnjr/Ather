import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityGlyph,
  AiSparklesGlyph,
  BellGlyph,
  CameraGlyph,
  CheckGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  ClockGlyph,
  DevicesGlyph,
  DiscGlyph,
  DocumentGlyph,
  DownloadGlyph,
  EqSlidersGlyph,
  ExplicitShieldGlyph,
  GlobeGlyph,
  HapticsSparkGlyph,
  HelpGlyph,
  ImagePlusGlyph,
  LogoutGlyph,
  LyricsGlyph,
  RadioStreamGlyph,
  ReelsFilmGlyph,
  RotateGlyph,
  ShuffleGlyph,
  SpeakerVolumeGlyph,
  StorageDriveGlyph,
  TrashGlyph,
  UserGlyph,
  WifiAudioGlyph,
  WifiOffGlyph,
  WifiOnGlyph,
} from '../AppIcons';
import {
  AccountProvider,
  compressImageFileToDataUrl,
} from '../../services/accountStorage';
import { CloudSyncStatus } from '../../services/cloudSync';
import { UserLookPreferences } from '../../services/userScope';
import {
  AiDiscoveryLevel,
  AiRecommendationEntry,
  EqualizerPreset,
} from '../../types/music';
import {
  AVATAR_PRESETS,
  AvatarPreset,
  ProfileAvatar,
} from '../ProfileAvatar';

export type QualityTier = 'Low' | 'Normal' | 'High';
export type EqPreset = EqualizerPreset;

export type SettingsPageId =
  | 'hub'
  | 'profile'
  | 'ai'
  | 'audio-quality'
  | 'equalizer'
  | 'playback'
  | 'sleep-timer'
  | 'reels'
  | 'interface'
  | 'data-downloads'
  | 'storage'
  | 'permissions'
  | 'content'
  | 'privacy'
  | 'notifications'
  | 'help';

const EQ_BANDS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'] as const;

export const EQ_PRESET_VALUES: Record<Exclude<EqPreset, 'Custom'>, number[]> = {
  Flat: [0, 0, 0, 0, 0],
  'Bass Boost': [7, 5, 1, 0, 2],
  Pop: [-1, 3, 5, 3, -1],
  Rock: [5, 2, -1, 3, 5],
  Vocal: [-2, 1, 5, 4, 1],
  Electronic: [6, 3, 0, 4, 6],
  'Late Night': [3, 2, 1, -2, -3],
};

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
] as const;

interface ProfileSettingsScreenProps {
  authUid?: string | null;
  authEmail?: string | null;
  accountProvider?: AccountProvider;
  onSignInGoogle?: () => Promise<void> | void;
  onSignOutGoogle?: () => Promise<void> | void;
  onResetOnboarding?: () => void;
  onSwitchAccount?: () => Promise<void> | void;
  displayName: string;
  email: string;
  profileImageUrl: string | null;
  avatarPreset: AvatarPreset;
  onUpdateProfile: (
    name: string,
    email: string,
    imageUrl: string | null,
    preset: AvatarPreset
  ) => void;
  downloadedCount: number;
  playlistCount: number;
  favoriteCount: number;
  recentCount: number;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  showLyricsEnabled: boolean;
  onToggleShowLyrics: () => void;
  explicitAllowed: boolean;
  onToggleExplicit: () => void;
  crossfadeSeconds: number;
  onChangeCrossfade: (seconds: number) => void;
  gaplessPlayback: boolean;
  onToggleGapless: () => void;
  openPlayerOnTap: boolean;
  onToggleOpenPlayerOnTap: () => void;
  hapticsEnabled: boolean;
  onToggleHaptics: () => void;
  miniSwipeEnabled: boolean;
  onToggleMiniSwipe: () => void;
  lyricsGlowEnabled: boolean;
  onToggleLyricsGlow: () => void;
  reelsAutoScroll: boolean;
  onToggleReelsAutoScroll: () => void;
  reelsDurationSeconds: number;
  onChangeReelsDuration: (seconds: number) => void;
  reelsAutoPauseMusic: boolean;
  onToggleReelsAutoPauseMusic: () => void;
  trackActivity: boolean;
  onToggleTrackActivity: () => void;
  privateSession: boolean;
  onTogglePrivateSession: () => void;
  onClearRecentHistory: () => void;
  autoDownloadFavorites: boolean;
  onToggleAutoDownloadFavorites: () => void;
  onClearAllDownloads: () => void;
  sleepTimerRemainingSeconds: number | null;
  sleepTimerEndOfTrack: boolean;
  onSetSleepTimerMinutes: (minutes: number | null) => void;
  onSetSleepTimerEndOfTrack: () => void;
  isOffline: boolean;
  isNetworkOnline: boolean;
  manualOfflineMode: boolean;
  onToggleManualOfflineMode: () => void;
  eqPreset: EqPreset;
  eqBands: number[];
  onSelectEqPreset: (preset: Exclude<EqPreset, 'Custom'>) => void;
  onChangeEqBand: (index: number, value: number) => void;
  aiSmartShuffleEnabled: boolean;
  onToggleAiSmartShuffle: () => void;
  aiRecommendationsEnabled: boolean;
  onToggleAiRecommendations: () => void;
  aiDiscoveryLevel: AiDiscoveryLevel;
  onChangeAiDiscoveryLevel: (level: AiDiscoveryLevel) => void;
  aiRecLoading: boolean;
  aiRecHeadline: string | null;
  aiRecommendations: AiRecommendationEntry[];
  aiRecError: string | null;
  onRefreshAiRecommendations: () => void;
  lookPrefs?: UserLookPreferences;
  onUpdateLookPrefs?: (patch: Partial<UserLookPreferences>) => void;
  syncStatus?: CloudSyncStatus;
  onSyncNow?: () => Promise<void> | void;
  accountDeviceCount?: number;
  onOpenDevices?: () => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
      checked ? 'bg-white' : 'bg-white/15'
    }`}
  >
    <span
      className={`block w-5 h-5 rounded-full transition-transform duration-200 ${
        checked ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'
      }`}
    />
  </button>
);

const formatTimerCountdown = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  authUid = null,
  authEmail = null,
  accountProvider = 'guest',
  onSignInGoogle,
  onSignOutGoogle,
  onResetOnboarding,
  onSwitchAccount,
  displayName,
  email,
  profileImageUrl,
  avatarPreset,
  onUpdateProfile,
  downloadedCount,
  playlistCount,
  favoriteCount,
  recentCount,
  autoplay,
  onToggleAutoplay,
  showLyricsEnabled,
  onToggleShowLyrics,
  explicitAllowed,
  onToggleExplicit,
  crossfadeSeconds,
  onChangeCrossfade,
  gaplessPlayback,
  onToggleGapless,
  openPlayerOnTap,
  onToggleOpenPlayerOnTap,
  hapticsEnabled,
  onToggleHaptics,
  miniSwipeEnabled,
  onToggleMiniSwipe,
  lyricsGlowEnabled,
  onToggleLyricsGlow,
  reelsAutoScroll,
  onToggleReelsAutoScroll,
  reelsDurationSeconds,
  onChangeReelsDuration,
  reelsAutoPauseMusic,
  onToggleReelsAutoPauseMusic,
  trackActivity,
  onToggleTrackActivity,
  privateSession,
  onTogglePrivateSession,
  onClearRecentHistory,
  autoDownloadFavorites,
  onToggleAutoDownloadFavorites,
  onClearAllDownloads,
  sleepTimerRemainingSeconds,
  sleepTimerEndOfTrack,
  onSetSleepTimerMinutes,
  onSetSleepTimerEndOfTrack,
  isOffline,
  isNetworkOnline,
  manualOfflineMode,
  onToggleManualOfflineMode,
  eqPreset,
  eqBands,
  onSelectEqPreset,
  onChangeEqBand,
  aiSmartShuffleEnabled,
  onToggleAiSmartShuffle,
  aiRecommendationsEnabled,
  onToggleAiRecommendations,
  aiDiscoveryLevel,
  onChangeAiDiscoveryLevel,
  aiRecLoading,
  aiRecHeadline,
  aiRecommendations,
  aiRecError,
  onRefreshAiRecommendations,
  lookPrefs = { glassOpacity: 0.92, compactTiles: true, springMotion: true },
  onUpdateLookPrefs,
  syncStatus,
  onSyncNow,
  accountDeviceCount = 0,
  onOpenDevices,
}) => {
  const isGuest = accountProvider === 'guest';
  const providerLabel =
    accountProvider === 'google'
      ? 'Google'
      : accountProvider === 'apple'
      ? 'Apple'
      : accountProvider === 'email'
      ? 'Email'
      : 'Guest';

  const [activePage, setActivePage] = useState<SettingsPageId>('hub');
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const noticeTimersRef = useRef<number[]>([]);

  const scheduleNoticeClear = (setter: React.Dispatch<React.SetStateAction<boolean>>, ms: number) => {
    setter(true);
    const id = window.setTimeout(() => setter(false), ms);
    noticeTimersRef.current.push(id);
  };

  // Profile Edit draft state
  const [draftName, setDraftName] = useState(displayName);
  const [draftEmail, setDraftEmail] = useState(isGuest ? '' : email);
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(profileImageUrl);
  const [draftPreset, setDraftPreset] = useState<AvatarPreset>(avatarPreset);
  const [profileSavedNotice, setProfileSavedNotice] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(displayName);
    setDraftEmail(isGuest ? '' : email);
    setDraftImageUrl(profileImageUrl);
    setDraftPreset(avatarPreset);
  }, [displayName, email, profileImageUrl, avatarPreset, isGuest]);

  useEffect(() => {
    return () => {
      noticeTimersRef.current.forEach((id) => window.clearTimeout(id));
      noticeTimersRef.current = [];
    };
  }, []);

  // Playback & Audio sub-page local controls
  const [wifiQuality, setWifiQuality] = useState<QualityTier>('High');
  const [cellularQuality, setCellularQuality] = useState<QualityTier>('Normal');
  const [downloadQuality, setDownloadQuality] = useState<QualityTier>('High');
  const [losslessSpatial, setLosslessSpatial] = useState(true);

  const [volumeNormalization, setVolumeNormalization] = useState(true);
  const [monoAudio, setMonoAudio] = useState(false);

  // Storage & Data local controls
  const [dataSaver, setDataSaver] = useState(false);
  const [downloadOverCellular, setDownloadOverCellular] = useState(false);
  const [cacheMb, setCacheMb] = useState(148);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [downloadsClearedNotice, setDownloadsClearedNotice] = useState(false);

  // Content & Privacy local controls
  const [language, setLanguage] = useState<string>('English');
  const [historyClearedNotice, setHistoryClearedNotice] = useState(false);

  // Notifications & Support local controls
  const [notifyNewReleases, setNotifyNewReleases] = useState(true);
  const [notifyMixUpdates, setNotifyMixUpdates] = useState(true);
  const [notifyAppUpdates, setNotifyAppUpdates] = useState(true);
  const [loggedOutNotice, setLoggedOutNotice] = useState(false);

  // Device Access / Browser Permissions status
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [storagePersisted, setStoragePersisted] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }
    if (navigator.storage?.persisted) {
      navigator.storage
        .persisted()
        .then((persisted) => setStoragePersisted(persisted))
        .catch(() => undefined);
    }
  }, [activePage]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifPermission('unsupported');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
    } catch {
      // ignore
    }
  };

  const requestPersistentStorage = async () => {
    if (!navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      setStoragePersisted(granted);
    } catch {
      // ignore
    }
  };

  const navigateTo = (page: SettingsPageId) => {
    if (page === 'profile') {
      setDraftName(displayName);
      setDraftEmail(isGuest ? '' : email);
      setDraftImageUrl(profileImageUrl);
      setDraftPreset(avatarPreset);
      setProfileSavedNotice(false);
    }
    setActivePage(page);
  };

  useEffect(() => {
    topAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activePage]);

  const readImageFile = (file: File | undefined) => {
    if (!file) return;
    compressImageFileToDataUrl(file, 256, 0.78)
      .then((compressed) => {
        if (compressed) {
          setDraftImageUrl(compressed);
        }
      })
      .catch(() => {
        // ignore unsupported image compression failure
      });
  };

  const handleSelectEqPreset = (preset: Exclude<EqPreset, 'Custom'>) => {
    onSelectEqPreset(preset);
  };

  const handleEqBandChange = (index: number, value: number) => {
    onChangeEqBand(index, value);
  };

  const downloadsMb = downloadedCount * 42;
  const totalStorageMb = 1024;
  const usedMb = downloadsMb + cacheMb;
  const downloadsPct = Math.min(100, Math.round((downloadsMb / totalStorageMb) * 100));
  const cachePct = Math.min(100 - downloadsPct, Math.round((cacheMb / totalStorageMb) * 100));

  const sleepSummary = sleepTimerEndOfTrack
    ? 'End of track'
    : sleepTimerRemainingSeconds !== null && sleepTimerRemainingSeconds > 0
    ? formatTimerCountdown(sleepTimerRemainingSeconds)
    : 'Off';

  const renderSubPageHeader = (title: string, subtitle: string) => (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setActivePage('hub')}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#111114] border border-white/15 text-xs font-bold text-white hover:border-white/35 active:scale-95 transition-all"
      >
        <ChevronLeftGlyph className="w-4 h-4" />
        <span>Settings</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-white/75 font-bold mt-1">{subtitle}</p>
      </div>
    </div>
  );

  const renderHubRow = (
    icon: React.ReactNode,
    title: string,
    summary: string,
    target: SettingsPageId
  ) => (
    <button
      key={target}
      type="button"
      onClick={() => navigateTo(target)}
      className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors text-left"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="w-9 h-9 rounded-full bg-white/[0.07] border border-white/10 flex items-center justify-center text-white/85 shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white truncate">{title}</div>
          <div className="text-xs text-white/50 truncate mt-0.5">{summary}</div>
        </div>
      </div>
      <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
    </button>
  );

  return (
    <div ref={topAnchorRef} className="max-w-2xl mx-auto space-y-6">
      {/* MAIN SETTINGS HUB */}
      {activePage === 'hub' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Settings
            </h1>
            <span className="text-xs font-semibold text-white/50 tabular-nums">
              {playlistCount} Playlists · {favoriteCount} Liked
            </span>
          </div>

          {loggedOutNotice && (
            <div className="rounded-3xl bg-white text-black px-5 py-4 flex items-center justify-between gap-4 shadow-xl">
              <div>
                <div className="text-sm font-extrabold">Signed out of ATHER</div>
                <div className="text-xs text-black/65 mt-0.5">
                  Tap Sign Back In to continue listening as {displayName}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLoggedOutNotice(false)}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-extrabold shrink-0 hover:opacity-90 active:scale-95 transition-all"
              >
                Sign Back In
              </button>
            </div>
          )}

          {/* GROUP 1: ACCOUNT */}
          <section aria-label="Account" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Account
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ProfileAvatar
                    displayName={displayName}
                    imageUrl={profileImageUrl}
                    preset={avatarPreset}
                    className="w-13 h-13 border border-white/25 shrink-0 shadow-md"
                  />
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-white truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-white/75 font-bold truncate mt-0.5">
                      {isGuest
                        ? 'Guest session · Edit name & photo'
                        : `${authEmail || email || 'Local profile'} · Edit photo & profile`}
                    </div>
                  </div>
                </div>
                <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
              </button>

              {(onSignInGoogle || onSignOutGoogle) && (
                <div className="px-4 sm:px-5 py-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {authUid ? 'Google Cloud Sync' : 'Cloud Account Sync'}
                        </span>
                        {authUid && syncStatus && (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              syncStatus.phase === 'syncing'
                                ? 'bg-white text-black border-white'
                                : syncStatus.phase === 'retrying'
                                ? 'bg-white/15 text-white border-white/40'
                                : syncStatus.phase === 'offline'
                                ? 'bg-black text-white/75 border-white/25'
                                : 'bg-white/10 text-white/90 border-white/20'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                syncStatus.phase === 'syncing'
                                  ? 'bg-black animate-pulse'
                                  : syncStatus.phase === 'synced'
                                  ? 'bg-white'
                                  : 'bg-white/55'
                              }`}
                            />
                            <span>{syncStatus.label}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50 truncate mt-0.5">
                        {authUid
                          ? syncStatus?.errorMessage
                            ? syncStatus.errorMessage
                            : syncStatus?.lastSyncedAt
                            ? `${authEmail || 'Google account'} · Last synced ${new Date(
                                syncStatus.lastSyncedAt
                              ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : `Syncing profile, library & playback for ${authEmail || 'your account'}`
                          : 'Sign in with Google to sync across Android, iOS & Web'}
                      </div>
                    </div>
                    {authUid ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onSyncNow && (
                          <button
                            type="button"
                            disabled={syncStatus?.phase === 'syncing'}
                            onClick={() => void onSyncNow()}
                            className="px-3 py-1.5 rounded-full bg-white text-black text-[11px] font-extrabold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {syncStatus?.phase === 'syncing' ? 'Syncing' : 'Sync Now'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onSignOutGoogle?.()}
                          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onSignInGoogle?.()}
                        className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all shrink-0"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </div>
              )}

              {onOpenDevices && (
                <button
                  type="button"
                  onClick={onOpenDevices}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center shrink-0">
                      <DevicesGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          Account Devices
                        </span>
                        {authUid && (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold text-white/85 tabular-nums">
                            {accountDeviceCount} synced
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50 truncate mt-0.5">
                        {authUid
                          ? 'View active devices, transfer playback & manage handoff'
                          : 'Sign in with Google to see connected Android & Web devices'}
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
                </button>
              )}

              {onResetOnboarding && (
                <button
                  type="button"
                  onClick={onResetOnboarding}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center shrink-0">
                      <RotateGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">
                        Reset Onboarding
                      </div>
                      <div className="text-[11px] font-bold text-white/75 truncate mt-0.5">
                        Re-run the 6-step setup for this {providerLabel} account
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
                </button>
              )}

              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={() => void onSwitchAccount()}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.07] transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center shrink-0">
                      <UserGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">
                        Switch Account
                      </div>
                      <div className="text-[11px] text-white/50 truncate mt-0.5">
                        Sign in or switch listener profile without losing data
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
                </button>
              )}
            </div>
          </section>

          {/* GROUP 2: AI & SMART PLAYBACK */}
          <section aria-label="AI and Smart Playback" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              AI &amp; Smart Playback
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <AiSparklesGlyph className="w-4 h-4" active={aiSmartShuffleEnabled || aiRecommendationsEnabled} />,
                'AI Smart Shuffle & Recommendations',
                `Smart Shuffle ${aiSmartShuffleEnabled ? 'On' : 'Off'} · Recommendations ${aiRecommendationsEnabled ? 'On' : 'Off'} · ${aiDiscoveryLevel}`,
                'ai'
              )}
            </div>
          </section>

          {/* GROUP 3: PLAYBACK & SOUND */}
          <section aria-label="Playback and Sound" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Playback &amp; Sound
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <EqSlidersGlyph className="w-4 h-4" />,
                'Equalizer',
                `Preset: ${eqPreset} (${eqBands.map((b) => (b > 0 ? `+${b}` : b)).join(' / ')} dB)`,
                'equalizer'
              )}
              {renderHubRow(
                <WifiAudioGlyph className="w-4 h-4" />,
                'Audio Quality',
                `Wi-Fi: ${wifiQuality} · Cellular: ${dataSaver ? 'Low' : cellularQuality} · Downloads: ${downloadQuality}`,
                'audio-quality'
              )}
              {renderHubRow(
                <DiscGlyph className="w-4 h-4" />,
                'Playback Behavior',
                `Crossfade ${crossfadeSeconds === 0 ? 'Off' : `${crossfadeSeconds}s`} · Gapless ${gaplessPlayback ? 'On' : 'Off'} · Autoplay ${autoplay ? 'On' : 'Off'}`,
                'playback'
              )}
              {renderHubRow(
                <ClockGlyph className="w-4 h-4" />,
                'Sleep Timer',
                sleepSummary === 'Off'
                  ? 'Off · Automatically pause playback'
                  : `Active: ${sleepSummary}`,
                'sleep-timer'
              )}
            </div>
          </section>

          {/* GROUP 3: REELS & INTERFACE */}
          <section aria-label="Reels and Interface" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Reels &amp; Interface
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <ReelsFilmGlyph className="w-4 h-4" />,
                'Music Reels',
                `${reelsAutoScroll ? 'Auto-scroll' : 'Manual loop'} · ${reelsDurationSeconds}s clips`,
                'reels'
              )}
              {renderHubRow(
                <HapticsSparkGlyph className="w-4 h-4" />,
                'Haptics & Player UI',
                `Visual pulses ${hapticsEnabled ? 'On' : 'Off'} · Mini-player swipe ${miniSwipeEnabled ? 'On' : 'Off'}`,
                'interface'
              )}
            </div>
          </section>

          {/* GROUP 4: STORAGE & DATA */}
          <section aria-label="Storage and Data" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Storage &amp; Data
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <DownloadGlyph className="w-4 h-4" />,
                'Offline Mode & Downloads',
                `${isOffline ? 'Offline Mode Active' : 'Online'} · ${downloadOverCellular ? 'Wi-Fi & Cellular' : 'Wi-Fi only'}`,
                'data-downloads'
              )}
              {renderHubRow(
                <StorageDriveGlyph className="w-4 h-4" />,
                'Storage & Cache',
                `${usedMb} MB of 1 GB used · ${downloadedCount} offline songs`,
                'storage'
              )}
            </div>
          </section>

          {/* GROUP 4.5: ALLOW ACCESS */}
          <section aria-label="Allow Access" className="space-y-2">
            <h2 className="px-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">
              Allow Access
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <ExplicitShieldGlyph className="w-4 h-4" />,
                'Allow Access & Permissions',
                `Notifications: ${notifPermission === 'granted' ? 'Allowed' : 'Off'} · Persistent Storage: ${storagePersisted ? 'Granted' : 'Standard'}`,
                'permissions'
              )}
            </div>
          </section>

          {/* GROUP 5: CONTENT, PRIVACY & SUPPORT */}
          <section aria-label="Content, Privacy and Support" className="space-y-2">
            <h2 className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
              Content, Privacy &amp; Support
            </h2>
            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              {renderHubRow(
                <GlobeGlyph className="w-4 h-4" />,
                'Content & Lyrics',
                `${language} · Lyrics ${showLyricsEnabled ? 'On' : 'Off'} · Explicit ${explicitAllowed ? 'Allowed' : 'Blocked'}`,
                'content'
              )}
              {renderHubRow(
                <ActivityGlyph className="w-4 h-4" />,
                'Listening Activity & Privacy',
                privateSession
                  ? 'Private session active'
                  : trackActivity
                  ? `Recording activity (${recentCount} recent)`
                  : 'Activity recording paused',
                'privacy'
              )}
              {renderHubRow(
                <BellGlyph className="w-4 h-4" />,
                'Notifications',
                `New Releases ${notifyNewReleases ? 'On' : 'Off'} · App Updates ${notifyAppUpdates ? 'On' : 'Off'}`,
                'notifications'
              )}
              {renderHubRow(
                <HelpGlyph className="w-4 h-4" />,
                'Help & About',
                'Help Center, Terms & Privacy Policy',
                'help'
              )}
            </div>
          </section>

          {/* Bottom Log Out Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onSwitchAccount) {
                  void onSwitchAccount();
                } else {
                  void onSignOutGoogle?.();
                  setLoggedOutNotice(true);
                }
              }}
              className="w-full rounded-full bg-white text-black py-3.5 px-6 flex items-center justify-center gap-2 text-sm font-extrabold shadow-[0_12px_30px_rgba(255,255,255,0.16)] hover:bg-white/90 active:scale-[0.99] transition-all"
            >
              <LogoutGlyph className="w-4 h-4 text-[#DC2626]" />
              <span className="text-[#DC2626]">Log Out</span>
            </button>
          </div>
        </>
      )}

      {/* SUB-PAGE 1: EDIT PROFILE & PROFILE IMAGE */}
      {activePage === 'profile' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Profile & Photo',
            isGuest
              ? 'Update your display name and profile picture on this device.'
              : 'Update your display name, email, and profile picture across ATHER.'
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateProfile(
                draftName.trim() || (isGuest ? 'Guest Listener' : 'Listener'),
                isGuest ? '' : draftEmail.trim(),
                draftImageUrl,
                draftPreset
              );
              scheduleNoticeClear(setProfileSavedNotice, 2600);
            }}
            className="space-y-5"
          >
            {/* Avatar Editing Card */}
            <div className="rounded-3xl bg-[#111114] border border-white/20 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="relative self-start">
                  <ProfileAvatar
                    displayName={draftName || displayName}
                    imageUrl={draftImageUrl}
                    preset={draftPreset}
                    className="w-24 h-24 border-2 border-white/25 shadow-xl"
                  />
                  <button
                    type="button"
                    aria-label="Upload profile photo"
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center border-2 border-[#141416] shadow-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    <CameraGlyph className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1">
                  <div className="text-sm font-extrabold text-white">Profile Picture</div>
                  <p className="text-xs text-white/75 font-bold leading-relaxed">
                    Upload a custom photo or choose one of the monochrome studio avatars below.
                  </p>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      readImageFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all"
                    >
                      <ImagePlusGlyph className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>

                    {draftImageUrl && (
                      <button
                        type="button"
                        onClick={() => setDraftImageUrl(null)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
                      >
                        <RotateGlyph className="w-3.5 h-3.5" />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  Studio Avatar Presets
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                  {AVATAR_PRESETS.map((p) => {
                    const selected = !draftImageUrl && draftPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDraftImageUrl(null);
                          setDraftPreset(p.id);
                        }}
                        className={`flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl border transition-all ${
                          selected
                            ? 'bg-white/10 border-white text-white'
                            : 'bg-black/60 border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <ProfileAvatar
                          displayName={draftName || displayName}
                          preset={p.id}
                          className="w-9 h-9 sm:w-10 sm:h-10 border border-white/15"
                        />
                        <span className="text-[10px] sm:text-[11px] font-bold truncate max-w-full">
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Name & Account Identity Fields */}
            <div className="rounded-3xl bg-[#111114] border border-white/20 p-5 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/75 flex items-center gap-1.5">
                  <UserGlyph className="w-3.5 h-3.5" />
                  <span>Display Name</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full rounded-2xl bg-black border border-white/15 px-4 py-3 text-base sm:text-sm font-semibold text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                />
              </div>

              {isGuest ? (
                <div className="rounded-2xl bg-black/75 border border-white/10 px-4 py-3 space-y-1">
                  <div className="text-xs font-bold text-white/85">
                    Guest Account — No email linked
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Guest sessions stay strictly on this device. Use Switch Account or Cloud Account Sync to sign in with Google or an email address.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/75">
                    Email Address
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full rounded-2xl bg-black border border-white/15 px-4 py-3 text-base sm:text-sm font-semibold text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs font-semibold text-white/70">
                  {profileSavedNotice ? 'Profile changes saved.' : ''}
                </span>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SUB-PAGE 2: AUDIO QUALITY */}
      {activePage === 'audio-quality' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Audio Quality',
            'Choose bitrate and lossless streaming tiers across connections.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            {[
              {
                label: 'Wi-Fi Streaming',
                desc: 'Maximum clarity on home and studio networks',
                value: wifiQuality,
                setter: setWifiQuality,
              },
              {
                label: 'Cellular Streaming',
                desc: dataSaver
                  ? 'Overridden to Low while Data Saver is active'
                  : 'Streaming quality over 4G / 5G',
                value: dataSaver ? ('Low' as QualityTier) : cellularQuality,
                setter: setCellularQuality,
              },
              {
                label: 'Offline Downloads',
                desc: 'Audio quality saved to device storage',
                value: downloadQuality,
                setter: setDownloadQuality,
              },
            ].map((row) => (
              <div key={row.label} className="p-4 sm:p-5 space-y-3">
                <div>
                  <div className="text-sm font-extrabold text-white">{row.label}</div>
                  <div className="text-xs text-white/50 mt-0.5">{row.desc}</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {(['Low', 'Normal', 'High'] as const).map((tier) => {
                    const active = row.value === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => row.setter(tier)}
                        className={`py-2.5 px-2 sm:px-3 rounded-2xl border text-center transition-all ${
                          active
                            ? 'bg-white text-black border-white font-extrabold'
                            : 'bg-black text-white/75 border-white/15 font-bold hover:border-white/35'
                        }`}
                      >
                        <div className="text-xs">{tier}</div>
                        <div
                          className={`text-[9.5px] sm:text-[10px] mt-0.5 truncate ${
                            active ? 'text-black/65' : 'text-white/45'
                          }`}
                        >
                          {tier === 'Low'
                            ? '96 kbps'
                            : tier === 'Normal'
                            ? '160 kbps'
                            : '24-bit Lossless'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Spatial &amp; Hi-Res Output
                </div>
                <div className="text-xs text-white/50 mt-0.5">
                  Preserve uncompressed studio stereo imaging when available
                </div>
              </div>
              <ToggleSwitch
                checked={losslessSpatial}
                onChange={() => setLosslessSpatial((v) => !v)}
                label="Spatial and Hi-Res Output"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE AI: AI SMART SHUFFLE & AI RECOMMENDATIONS */}
      {activePage === 'ai' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'AI & Smart Playback',
            'Control Gemini-powered queue sequencing and personalized Home recommendations.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                  <ShuffleGlyph className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white">AI Smart Shuffle</div>
                  <div className="text-xs text-white/50">
                    Intelligently sequence your queue for seamless mood and tempo flow when Shuffle is enabled
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={aiSmartShuffleEnabled}
                onChange={onToggleAiSmartShuffle}
                label="AI Smart Shuffle"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                  <AiSparklesGlyph className="w-4 h-4" active={aiRecommendationsEnabled} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white">AI Recommendations</div>
                  <div className="text-xs text-white/50">
                    Display personalized AI track picks on your Home feed tailored to your taste
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={aiRecommendationsEnabled}
                onChange={onToggleAiRecommendations}
                label="AI Recommendations"
              />
            </div>

            <div className="p-5 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-white">Discovery Balance</div>
                <div className="text-xs text-white/50 mt-0.5">
                  Guide how adventurous AI Smart Shuffle and Recommendations should be
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['Familiar Hits', 'Balanced', 'Deep Cuts'] as const).map((tier) => {
                  const active = aiDiscoveryLevel === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => onChangeAiDiscoveryLevel(tier)}
                      className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all ${
                        active
                          ? 'bg-white text-black border-white font-extrabold'
                          : 'bg-black text-white/75 border-white/15 hover:border-white/35'
                      }`}
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">Live AI Engine Status</div>
                  <div className="text-xs text-white/75 font-bold mt-0.5">
                    {isOffline
                      ? 'Unavailable while offline — reconnect to refresh AI picks'
                      : aiRecLoading
                      ? 'Generating personalized picks with Gemini...'
                      : aiRecError
                      ? aiRecError
                      : aiRecommendations.length > 0
                      ? `${aiRecHeadline ?? 'AI Curated Mix'} · ${aiRecommendations.length} picks ready on Home`
                      : 'Tap Refresh Picks to generate AI recommendations'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isOffline || aiRecLoading}
                  onClick={onRefreshAiRecommendations}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold disabled:opacity-40 hover:bg-white/90 active:scale-95 transition-all shrink-0"
                >
                  {aiRecLoading ? 'Generating...' : 'Refresh Picks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 3: EQUALIZER & SOUND */}
      {activePage === 'equalizer' && (() => {
        const points = eqBands.map((gain, i) => ({
          x: 24 + (i * 272) / (eqBands.length - 1),
          y: 60 - (gain / 12) * 42,
        }));
        const linePath = points.reduce((acc, pt, idx) => {
          if (idx === 0) return `M ${pt.x} ${pt.y}`;
          const prev = points[idx - 1];
          const midX = (prev.x + pt.x) / 2;
          return `${acc} C ${midX} ${prev.y}, ${midX} ${pt.y}, ${pt.x} ${pt.y}`;
        }, '');
        const areaPath = `${linePath} L ${points[points.length - 1].x} 112 L ${points[0].x} 112 Z`;

        return (
          <div className="space-y-6">
            {renderSubPageHeader(
              'Equalizer',
              'Shape frequency response with studio presets, live curve preview, and custom bands.'
            )}

            <div className="rounded-3xl bg-[#111114] border border-white/20 p-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">Sound Presets</div>
                  <div className="text-xs text-white/50 mt-0.5">
                    Active curve: {eqPreset}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectEqPreset('Flat')}
                  className="px-3.5 py-1.5 rounded-full bg-black border border-white/15 text-xs font-bold text-white/80 hover:text-white hover:border-white/35 transition-colors"
                >
                  Reset Flat
                </button>
              </div>

              {/* Live SVG Frequency Curve Visualizer */}
              <div className="rounded-2xl bg-black border border-white/10 p-3.5 space-y-2">
                <svg
                  viewBox="0 0 320 120"
                  className="w-full h-28 overflow-visible"
                  aria-label="Equalizer frequency response curve"
                >
                  <defs>
                    <linearGradient id="eqCurveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Reference horizontal lines (+12, 0, -12 dB) */}
                  <line x1="20" y1="18" x2="300" y2="18" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="20" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.18)" />
                  <line x1="20" y1="102" x2="300" y2="102" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

                  <path d={areaPath} fill="url(#eqCurveFill)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points.map((pt, i) => (
                    <g key={EQ_BANDS[i]}>
                      <circle cx={pt.x} cy={pt.y} r="4.5" fill="#FFFFFF" />
                      <circle cx={pt.x} cy={pt.y} r="2" fill="#000000" />
                    </g>
                  ))}
                </svg>
                <div className="flex items-center justify-between px-2 text-[10px] font-bold text-white/45 tabular-nums">
                  {EQ_BANDS.map((band) => (
                    <span key={band}>{band}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'Flat',
                    'Bass Boost',
                    'Pop',
                    'Rock',
                    'Vocal',
                    'Electronic',
                    'Late Night',
                  ] as const
                ).map((preset) => {
                  const active = eqPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectEqPreset(preset)}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white/75 border-white/15 hover:border-white/35'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-black border border-white/10 p-4 space-y-3.5">
                {EQ_BANDS.map((band, idx) => (
                  <div key={band} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-bold text-white/70 tabular-nums">
                      {band}
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      aria-label={`${band} gain`}
                      value={eqBands[idx]}
                      onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                      className="flex-1 accent-white cursor-pointer"
                    />
                    <span className="w-12 text-right text-xs font-bold tabular-nums text-white">
                      {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]} dB
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SpeakerVolumeGlyph className="w-4 h-4 text-white/75 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Volume Normalization
                    </div>
                    <div className="text-xs text-white/50">
                      Maintain balanced loudness across albums and playlists
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={volumeNormalization}
                  onChange={() => setVolumeNormalization((v) => !v)}
                  label="Volume Normalization"
                />
              </div>

              <div className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">Mono Audio</div>
                  <div className="text-xs text-white/50">
                    Combine left and right stereo channels into one signal
                  </div>
                </div>
                <ToggleSwitch
                  checked={monoAudio}
                  onChange={() => setMonoAudio((v) => !v)}
                  label="Mono Audio"
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-PAGE 4: PLAYBACK BEHAVIOR */}
      {activePage === 'playback' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Playback Behavior',
            'Customize track transitions, gapless playback, and queue autoplay.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">Crossfade</div>
                  <div className="text-xs text-white/50">
                    Smoothly blend the end of one song into the next
                  </div>
                </div>
                <span className="text-sm font-extrabold tabular-nums text-white">
                  {crossfadeSeconds === 0 ? 'Off' : `${crossfadeSeconds}s`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                aria-label="Crossfade duration in seconds"
                value={crossfadeSeconds}
                onChange={(e) => onChangeCrossfade(Number(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-medium text-white/40 tabular-nums">
                <span>0s</span>
                <span>6s</span>
                <span>12s</span>
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">Gapless Playback</div>
                <div className="text-xs text-white/50">
                  Eliminate pauses between consecutive album tracks
                </div>
              </div>
              <ToggleSwitch
                checked={gaplessPlayback}
                onChange={onToggleGapless}
                label="Gapless Playback"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <RadioStreamGlyph className="w-4 h-4 text-white/75 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white">Autoplay</div>
                  <div className="text-xs text-white/50">
                    Keep playing recommended music when your queue ends
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={autoplay}
                onChange={onToggleAutoplay}
                label="Autoplay"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Open Player When Selecting a Song
                </div>
                <div className="text-xs text-white/50">
                  Automatically expand the full-screen player on tap
                </div>
              </div>
              <ToggleSwitch
                checked={openPlayerOnTap}
                onChange={onToggleOpenPlayerOnTap}
                label="Open Player When Selecting a Song"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 5: SLEEP TIMER */}
      {activePage === 'sleep-timer' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Sleep Timer',
            'Automatically pause audio playback after a set duration.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Current Status
                </div>
                <div className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
                  {sleepTimerEndOfTrack
                    ? 'Pauses at end of current track'
                    : sleepTimerRemainingSeconds !== null &&
                      sleepTimerRemainingSeconds > 0
                    ? `Pauses in ${formatTimerCountdown(sleepTimerRemainingSeconds)}`
                    : 'Timer Off'}
                </div>
              </div>
              {(sleepTimerEndOfTrack ||
                (sleepTimerRemainingSeconds !== null &&
                  sleepTimerRemainingSeconds > 0)) && (
                <button
                  type="button"
                  onClick={() => onSetSleepTimerMinutes(null)}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all"
                >
                  Cancel Timer
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'Off', mins: null as number | null },
                { label: '15 Minutes', mins: 15 },
                { label: '30 Minutes', mins: 30 },
                { label: '45 Minutes', mins: 45 },
                { label: '1 Hour', mins: 60 },
              ].map((opt) => {
                const isOff = opt.mins === null;
                const active = isOff
                  ? !sleepTimerEndOfTrack &&
                    (sleepTimerRemainingSeconds === null ||
                      sleepTimerRemainingSeconds <= 0)
                  : !sleepTimerEndOfTrack &&
                    sleepTimerRemainingSeconds !== null &&
                    Math.ceil(sleepTimerRemainingSeconds / 60) === opt.mins;

                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onSetSleepTimerMinutes(opt.mins)}
                    className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'bg-black text-white/80 border-white/15 hover:border-white/35'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onSetSleepTimerEndOfTrack}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all ${
                  sleepTimerEndOfTrack
                    ? 'bg-white text-black border-white'
                    : 'bg-black text-white/80 border-white/15 hover:border-white/35'
                }`}
              >
                End of Track
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 6: MUSIC REELS PREFERENCES */}
      {activePage === 'reels' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Music Reels',
            'Control continuous auto-scrolling, clip timing, and music handoff in Reels.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Auto-Scroll When Reel Ends
                </div>
                <div className="text-xs text-white/50">
                  Smoothly advance continuously through the Reels stream
                </div>
              </div>
              <ToggleSwitch
                checked={reelsAutoScroll}
                onChange={onToggleReelsAutoScroll}
                label="Auto-Scroll When Reel Ends"
              />
            </div>

            <div className="p-5 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Reel Preview Duration
                </div>
                <div className="text-xs text-white/50 mt-0.5">
                  How long each visual reel plays before advancing
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[8, 12, 15, 20].map((sec) => {
                  const active = reelsDurationSeconds === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeReelsDuration(sec)}
                      className={`py-2.5 rounded-2xl border text-xs font-bold tabular-nums transition-all ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white/75 border-white/15 hover:border-white/35'
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Auto-Pause Music on Reels
                </div>
                <div className="text-xs text-white/50">
                  Pause background music playback when switching to Reels
                </div>
              </div>
              <ToggleSwitch
                checked={reelsAutoPauseMusic}
                onChange={onToggleReelsAutoPauseMusic}
                label="Auto-Pause Music on Reels"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 7: HAPTICS & PLAYER UI */}
      {activePage === 'interface' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Haptics & Player UI',
            'Tune tactile visual feedback, mini-player gestures, and player lighting.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Tactile Visual Pulses
                </div>
                <div className="text-xs text-white/50">
                  Subtle Framer Motion cover art and transport button pulse animations
                </div>
              </div>
              <ToggleSwitch
                checked={hapticsEnabled}
                onChange={onToggleHaptics}
                label="Tactile Visual Pulses"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Swipe Away Paused Mini-Player
                </div>
                <div className="text-xs text-white/50">
                  Allow horizontal swipe dismissal of the mini-player pill when paused
                </div>
              </div>
              <ToggleSwitch
                checked={miniSwipeEnabled}
                onChange={onToggleMiniSwipe}
                label="Swipe Away Paused Mini-Player"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Ambient Glow in Lyrics View
                </div>
                <div className="text-xs text-white/50">
                  Low-saturation artwork ambient illumination while viewing lyrics
                </div>
              </div>
              <ToggleSwitch
                checked={lyricsGlowEnabled}
                onChange={onToggleLyricsGlow}
                label="Ambient Glow in Lyrics View"
              />
            </div>

            {onUpdateLookPrefs && (
              <>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-white">
                        Glass Surface Opacity
                      </div>
                      <div className="text-xs text-white/50">
                        Customize floating navigation &amp; mini-player translucency for your account
                      </div>
                    </div>
                    <span className="text-sm font-extrabold tabular-nums text-white">
                      {Math.round(lookPrefs.glassOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.55}
                    max={1}
                    step={0.05}
                    aria-label="Glass surface opacity"
                    value={lookPrefs.glassOpacity}
                    onChange={(e) =>
                      onUpdateLookPrefs({ glassOpacity: Number(e.target.value) })
                    }
                    className="w-full accent-white cursor-pointer"
                  />
                </div>

                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Compact Discovery Tiles
                    </div>
                    <div className="text-xs text-white/50">
                      Tighter vertical spacing across shelves and library lists
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={lookPrefs.compactTiles}
                    onChange={() =>
                      onUpdateLookPrefs({ compactTiles: !lookPrefs.compactTiles })
                    }
                    label="Compact Discovery Tiles"
                  />
                </div>

                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      Spring Navigation Motion
                    </div>
                    <div className="text-xs text-white/50">
                      Fluid elastic spring transition on navigation bar &amp; player surfaces
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={lookPrefs.springMotion}
                    onChange={() =>
                      onUpdateLookPrefs({ springMotion: !lookPrefs.springMotion })
                    }
                    label="Spring Navigation Motion"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-PAGE 8: OFFLINE MODE, DATA SAVER & DOWNLOADS */}
      {activePage === 'data-downloads' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Offline Mode & Downloads',
            'Automatically switch to downloads without internet or toggle Offline Mode manually.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isOffline
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {isOffline ? (
                    <WifiOffGlyph className="w-4 h-4" />
                  ) : (
                    <WifiOnGlyph className="w-4 h-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white">
                    {!isNetworkOnline
                      ? 'No Internet Connection'
                      : manualOfflineMode
                      ? 'Offline Mode Enabled'
                      : 'Connected Online'}
                  </div>
                  <div className="text-xs text-white/50 truncate">
                    {isOffline
                      ? `Playing from ${downloadedCount} downloaded ${downloadedCount === 1 ? 'song' : 'songs'}`
                      : 'Full catalog streaming and cross-device sync active'}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/65 shrink-0">
                {isOffline ? 'Offline' : 'Online'}
              </span>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">Offline Mode</div>
                <div className="text-xs text-white/50">
                  Play only downloaded songs and switch to Downloads automatically
                </div>
              </div>
              <ToggleSwitch
                checked={manualOfflineMode || !isNetworkOnline}
                onChange={onToggleManualOfflineMode}
                label="Offline Mode"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">Data Saver</div>
                <div className="text-xs text-white/50">
                  Reduce streaming bitrate when using mobile data
                </div>
              </div>
              <ToggleSwitch
                checked={dataSaver}
                onChange={() => setDataSaver((v) => !v)}
                label="Data Saver"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Download Over Cellular
                </div>
                <div className="text-xs text-white/50">
                  {downloadOverCellular
                    ? 'Offline downloads allowed on mobile data and Wi-Fi'
                    : 'Restrict offline downloads to Wi-Fi only'}
                </div>
              </div>
              <ToggleSwitch
                checked={downloadOverCellular}
                onChange={() => setDownloadOverCellular((v) => !v)}
                label="Download Over Cellular"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Auto-Download Liked Songs
                </div>
                <div className="text-xs text-white/50">
                  Automatically save songs offline whenever you tap Heart
                </div>
              </div>
              <ToggleSwitch
                checked={autoDownloadFavorites}
                onChange={onToggleAutoDownloadFavorites}
                label="Auto-Download Liked Songs"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 9: STORAGE & CACHE */}
      {activePage === 'storage' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Storage & Cache',
            'Inspect offline song storage and free up temporary audio cache.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 p-5 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white">Device Storage Used</span>
                <span className="text-white/65 tabular-nums">
                  {usedMb} MB of 1,024 MB
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${downloadsPct}%` }}
                />
                <div
                  className="h-full bg-white/40 transition-all duration-300"
                  style={{ width: `${cachePct}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-white/60 pt-1 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white inline-block" />
                  Offline Downloads: {downloadsMb} MB ({downloadedCount}{' '}
                  {downloadedCount === 1 ? 'track' : 'tracks'})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block" />
                  Audio Cache: {cacheMb} MB
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setCacheMb(0);
                  scheduleNoticeClear(setCacheClearedNotice, 2400);
                }}
                disabled={cacheMb === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-black text-xs font-extrabold disabled:opacity-40 hover:bg-white/90 active:scale-95 transition-all"
              >
                <TrashGlyph className="w-3.5 h-3.5" />
                <span>{cacheClearedNotice ? 'Cache Cleared' : 'Clear Cache'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearAllDownloads();
                  scheduleNoticeClear(setDownloadsClearedNotice, 2400);
                }}
                disabled={downloadedCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-black border border-white/20 text-white text-xs font-bold disabled:opacity-40 hover:border-white/45 active:scale-95 transition-all"
              >
                <TrashGlyph className="w-3.5 h-3.5" />
                <span>
                  {downloadsClearedNotice
                    ? 'Downloads Removed'
                    : 'Remove All Downloads'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 10: CONTENT & LYRICS */}
      {activePage === 'content' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Content & Lyrics',
            'Filter explicit tracks, configure lyrics display, and choose app language.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ExplicitShieldGlyph className="w-4 h-4 text-white/75 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <span>Explicit Content</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-white/15 text-white/85">
                      E
                    </span>
                  </div>
                  <div className="text-xs text-white/50">
                    {explicitAllowed
                      ? 'Allow tracks labeled explicit during playback'
                      : 'Block tracks labeled explicit'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={explicitAllowed}
                onChange={onToggleExplicit}
                label="Explicit Content"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LyricsGlyph className="w-4 h-4 text-white/75 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white">Show Lyrics</div>
                  <div className="text-xs text-white/50">
                    Enable time-synced lyrics on the full-screen player
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={showLyricsEnabled}
                onChange={onToggleShowLyrics}
                label="Show Lyrics"
              />
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <GlobeGlyph className="w-4 h-4 text-white/75" />
                <span>App Language</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => {
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`py-2.5 px-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition-colors ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white/75 border-white/15 hover:border-white/35'
                      }`}
                    >
                      <span>{lang}</span>
                      {active && <CheckGlyph className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 11: LISTENING ACTIVITY & PRIVACY */}
      {activePage === 'privacy' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Listening Activity & Privacy',
            'Control recent play history tracking and private listening sessions.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Record Listening Activity
                </div>
                <div className="text-xs text-white/50">
                  Save played songs to your Library → Activity recents
                </div>
              </div>
              <ToggleSwitch
                checked={trackActivity}
                onChange={onToggleTrackActivity}
                label="Record Listening Activity"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Private Session
                </div>
                <div className="text-xs text-white/50">
                  Listen temporarily without updating your recent taste profile
                </div>
              </div>
              <ToggleSwitch
                checked={privateSession}
                onChange={onTogglePrivateSession}
                label="Private Session"
              />
            </div>

            <div className="p-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Recent Listening History
                </div>
                <div className="text-xs text-white/50 tabular-nums">
                  {recentCount} recently played {recentCount === 1 ? 'track' : 'tracks'} stored
                </div>
              </div>
              <button
                type="button"
                disabled={recentCount === 0}
                onClick={() => {
                  onClearRecentHistory();
                  scheduleNoticeClear(setHistoryClearedNotice, 2400);
                }}
                className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold disabled:opacity-40 hover:bg-white/90 active:scale-95 transition-all shrink-0"
              >
                {historyClearedNotice ? 'Cleared' : 'Clear History'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 12: NOTIFICATIONS */}
      {activePage === 'notifications' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Notifications',
            'Choose which artist releases and app updates you want to hear about.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">New Releases</div>
                <div className="text-xs text-white/50">
                  Alerts when artists you listen to drop new singles or albums
                </div>
              </div>
              <ToggleSwitch
                checked={notifyNewReleases}
                onChange={() => setNotifyNewReleases((v) => !v)}
                label="New Releases notifications"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  Playlist &amp; Mix Updates
                </div>
                <div className="text-xs text-white/50">
                  Notifications when curated collections refresh with new tracks
                </div>
              </div>
              <ToggleSwitch
                checked={notifyMixUpdates}
                onChange={() => setNotifyMixUpdates((v) => !v)}
                label="Playlist and Mix updates"
              />
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">App Updates</div>
                <div className="text-xs text-white/50">
                  Feature announcements and audio engine improvements
                </div>
              </div>
              <ToggleSwitch
                checked={notifyAppUpdates}
                onChange={() => setNotifyAppUpdates((v) => !v)}
                label="App Updates notifications"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 13: HELP & ABOUT */}
      {activePage === 'help' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Help & About',
            'Support resources, terms, privacy details, and app information.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <HelpGlyph className="w-4 h-4 text-white/75" />
                <span>Help Center</span>
              </div>
              <p className="text-xs text-white/65 leading-relaxed">
                Manage offline downloads, lossless audio tiers, queue ordering, Sleep Timer, Reels auto-scroll, and custom playlist covers directly inside ATHER. Contact support at help@ather.audio.
              </p>
            </div>

            <div className="p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <DocumentGlyph className="w-4 h-4 text-white/75" />
                <span>Terms &amp; Privacy Policy</span>
              </div>
              <p className="text-xs text-white/65 leading-relaxed">
                Your playlists, offline downloads, profile photo, and listening preferences stay private to your session. You can pause or clear listening history anytime under Listening Activity &amp; Privacy.
              </p>
            </div>

            <div className="p-5 flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold text-white">ATHER Audio</span>
              <span className="text-xs font-semibold text-white/50 tabular-nums">
                Version 2.4 · Lossless Engine
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 14: ALLOW ACCESS & PERMISSIONS */}
      {activePage === 'permissions' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'Allow Access',
            'Manage device permissions for notifications and persistent offline storage.'
          )}

          <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15 overflow-hidden">
            <div className="p-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">Offline Storage Persistence</div>
                <div className="text-xs text-white/50 mt-0.5">
                  Prevents the browser from evicting your downloaded offline songs
                </div>
              </div>
              {storagePersisted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-extrabold shrink-0">
                  <CheckGlyph className="w-3.5 h-3.5" />
                  <span>Protected</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestPersistentStorage()}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all shrink-0"
                >
                  Allow Storage
                </button>
              )}
            </div>

            <div className="p-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">Push Notifications</div>
                <div className="text-xs text-white/50 mt-0.5">
                  Release alerts and mix updates from artists you follow
                </div>
              </div>
              {notifPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-extrabold shrink-0">
                  <CheckGlyph className="w-3.5 h-3.5" />
                  <span>Allowed</span>
                </span>
              ) : notifPermission === 'unsupported' ? (
                <span className="text-xs font-semibold text-white/45 shrink-0">
                  Unsupported
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestNotificationPermission()}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all shrink-0"
                >
                  Allow Alerts
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

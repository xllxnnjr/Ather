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
  'english (us)',
  'spanish',
  'french',
  'german',
  'japanese',
  'korean',
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
  accountDeviceCount?: number;
  onOpenDevices?: () => void;
  wifiQuality?: QualityTier;
  onChangeWifiQuality?: (tier: QualityTier) => void;
  cellularQuality?: QualityTier;
  onChangeCellularQuality?: (tier: QualityTier) => void;
  downloadQuality?: QualityTier;
  onChangeDownloadQuality?: (tier: QualityTier) => void;
  losslessSpatial?: boolean;
  onToggleLosslessSpatial?: () => void;
  volumeNormalization?: boolean;
  onToggleVolumeNormalization?: () => void;
  monoAudio?: boolean;
  onToggleMonoAudio?: () => void;
  dataSaver?: boolean;
  onToggleDataSaver?: () => void;
  downloadOverCellular?: boolean;
  onToggleDownloadOverCellular?: () => void;
  language?: string;
  onChangeLanguage?: (lang: string) => void;
  notifyNewReleases?: boolean;
  onToggleNotifyNewReleases?: () => void;
  notifyMixUpdates?: boolean;
  onToggleNotifyMixUpdates?: () => void;
  notifyAppUpdates?: boolean;
  onToggleNotifyAppUpdates?: () => void;
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
    className={`relative w-12 h-7 rounded-full p-0.5 border transition-colors shrink-0 ${
      checked ? 'bg-white border-white' : 'bg-[#141418] border-[#2A2A32]'
    }`}
  >
    <span
      className={`block w-5 h-5 rounded-full border border-[#242429] transition-transform duration-200 ${
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
  accountDeviceCount = 0,
  onOpenDevices,
  wifiQuality: wifiQualityProp,
  onChangeWifiQuality,
  cellularQuality: cellularQualityProp,
  onChangeCellularQuality,
  downloadQuality: downloadQualityProp,
  onChangeDownloadQuality,
  losslessSpatial: losslessSpatialProp,
  onToggleLosslessSpatial,
  volumeNormalization: volumeNormalizationProp,
  onToggleVolumeNormalization,
  monoAudio: monoAudioProp,
  onToggleMonoAudio,
  dataSaver: dataSaverProp,
  onToggleDataSaver,
  downloadOverCellular: downloadOverCellularProp,
  onToggleDownloadOverCellular,
  language: languageProp,
  onChangeLanguage,
  notifyNewReleases: notifyNewReleasesProp,
  onToggleNotifyNewReleases,
  notifyMixUpdates: notifyMixUpdatesProp,
  onToggleNotifyMixUpdates,
  notifyAppUpdates: notifyAppUpdatesProp,
  onToggleNotifyAppUpdates,
}) => {
  const isGuest = accountProvider === 'guest';
  const providerLabel =
    accountProvider === 'google'
      ? 'google'
      : accountProvider === 'apple'
      ? 'apple'
      : accountProvider === 'email'
      ? 'email'
      : 'guest';

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

  // Playback & Audio sub-page controls (controlled by App.tsx with safe fallback)
  const [localWifiQuality, setLocalWifiQuality] = useState<QualityTier>('High');
  const [localCellularQuality, setLocalCellularQuality] = useState<QualityTier>('Normal');
  const [localDownloadQuality, setLocalDownloadQuality] = useState<QualityTier>('High');
  const [localLosslessSpatial, setLocalLosslessSpatial] = useState(true);
  const [localVolumeNormalization, setLocalVolumeNormalization] = useState(true);
  const [localMonoAudio, setLocalMonoAudio] = useState(false);

  const [localDataSaver, setLocalDataSaver] = useState(false);
  const [localDownloadOverCellular, setLocalDownloadOverCellular] = useState(false);
  const [cacheMb, setCacheMb] = useState(148);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [downloadsClearedNotice, setDownloadsClearedNotice] = useState(false);

  const [localLanguage, setLocalLanguage] = useState<string>('english (us)');
  const [historyClearedNotice, setHistoryClearedNotice] = useState(false);

  const [localNotifyNewReleases, setLocalNotifyNewReleases] = useState(true);
  const [localNotifyMixUpdates, setLocalNotifyMixUpdates] = useState(true);
  const [localNotifyAppUpdates, setLocalNotifyAppUpdates] = useState(false);
  const [loggedOutNotice, setLoggedOutNotice] = useState(false);

  const wifiQuality = wifiQualityProp ?? localWifiQuality;
  const setWifiQuality = (q: QualityTier) => {
    if (onChangeWifiQuality) onChangeWifiQuality(q);
    else setLocalWifiQuality(q);
  };
  const cellularQuality = cellularQualityProp ?? localCellularQuality;
  const setCellularQuality = (q: QualityTier) => {
    if (onChangeCellularQuality) onChangeCellularQuality(q);
    else setLocalCellularQuality(q);
  };
  const downloadQuality = downloadQualityProp ?? localDownloadQuality;
  const setDownloadQuality = (q: QualityTier) => {
    if (onChangeDownloadQuality) onChangeDownloadQuality(q);
    else setLocalDownloadQuality(q);
  };
  const losslessSpatial = losslessSpatialProp ?? localLosslessSpatial;
  const toggleLosslessSpatial = () => {
    if (onToggleLosslessSpatial) onToggleLosslessSpatial();
    else setLocalLosslessSpatial((v) => !v);
  };
  const volumeNormalization = volumeNormalizationProp ?? localVolumeNormalization;
  const toggleVolumeNormalization = () => {
    if (onToggleVolumeNormalization) onToggleVolumeNormalization();
    else setLocalVolumeNormalization((v) => !v);
  };
  const monoAudio = monoAudioProp ?? localMonoAudio;
  const toggleMonoAudio = () => {
    if (onToggleMonoAudio) onToggleMonoAudio();
    else setLocalMonoAudio((v) => !v);
  };
  const dataSaver = dataSaverProp ?? localDataSaver;
  const toggleDataSaver = () => {
    if (onToggleDataSaver) onToggleDataSaver();
    else setLocalDataSaver((v) => !v);
  };
  const downloadOverCellular = downloadOverCellularProp ?? localDownloadOverCellular;
  const toggleDownloadOverCellular = () => {
    if (onToggleDownloadOverCellular) onToggleDownloadOverCellular();
    else setLocalDownloadOverCellular((v) => !v);
  };
  const language = languageProp ?? localLanguage;
  const setLanguage = (lang: string) => {
    if (onChangeLanguage) onChangeLanguage(lang);
    else setLocalLanguage(lang);
  };
  const notifyNewReleases = notifyNewReleasesProp ?? localNotifyNewReleases;
  const toggleNotifyNewReleases = () => {
    if (onToggleNotifyNewReleases) onToggleNotifyNewReleases();
    else setLocalNotifyNewReleases((v) => !v);
  };
  const notifyMixUpdates = notifyMixUpdatesProp ?? localNotifyMixUpdates;
  const toggleNotifyMixUpdates = () => {
    if (onToggleNotifyMixUpdates) onToggleNotifyMixUpdates();
    else setLocalNotifyMixUpdates((v) => !v);
  };
  const notifyAppUpdates = notifyAppUpdatesProp ?? localNotifyAppUpdates;
  const toggleNotifyAppUpdates = () => {
    if (onToggleNotifyAppUpdates) onToggleNotifyAppUpdates();
    else setLocalNotifyAppUpdates((v) => !v);
  };

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
    ? 'end of track'
    : sleepTimerRemainingSeconds !== null && sleepTimerRemainingSeconds > 0
    ? formatTimerCountdown(sleepTimerRemainingSeconds)
    : 'off';

  const renderSubPageHeader = (title: string, subtitle: string) => (
    <div className="space-y-3 pt-1">
      <button
        type="button"
        onClick={() => setActivePage('hub')}
        className="ather-depth-pill inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform min-h-[44px]"
      >
        <ChevronLeftGlyph className="w-4 h-4" />
        <span>settings</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-[#A1A1AA] font-bold mt-1">{subtitle}</p>
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
      className="ather-depth-row rounded-2xl w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-colors text-left min-h-[56px]"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="w-9 h-9 rounded-full bg-[#141418] border border-[#242429] flex items-center justify-center text-white shrink-0">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-white truncate">{title}</div>
          <div className="text-xs font-bold text-[#A1A1AA] truncate mt-0.5">{summary}</div>
        </div>
      </div>
      <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
    </button>
  );

  return (
    <div ref={topAnchorRef} className="max-w-2xl mx-auto space-y-6">
      {/* MAIN SETTINGS HUB */}
      {activePage === 'hub' && (
        <>
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                settings
              </h1>
              <p className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                account, playback, offline storage &amp; preferences
              </p>
            </div>
            <span className="ather-depth-pill px-3 py-1 rounded-full text-xs font-extrabold text-white tabular-nums shrink-0">
              {playlistCount} playlists · {favoriteCount} liked
            </span>
          </div>

          {loggedOutNotice && (
            <div className="rounded-3xl bg-white text-black border border-white px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-extrabold">signed out of Ather</div>
                <div className="text-xs font-bold text-black/75 mt-0.5">
                  tap sign back in to continue listening as {displayName.toLowerCase()}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLoggedOutNotice(false)}
                className="px-4 py-2 rounded-full bg-black text-white border border-black text-xs font-extrabold shrink-0 hover:opacity-90 active:scale-95 transition-transform"
              >
                sign back in
              </button>
            </div>
          )}

          {/* GROUP 1: ACCOUNT */}
          <section aria-label="account" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              account
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                className="ather-depth-row rounded-2xl w-full flex items-center justify-between gap-4 p-4 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ProfileAvatar
                    displayName={displayName}
                    imageUrl={profileImageUrl}
                    preset={avatarPreset}
                    className="w-13 h-13 border border-[#242429] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-white truncate">
                      {displayName.toLowerCase()}
                    </div>
                    <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
                      {isGuest
                        ? 'guest session · edit name & photo'
                        : `${(authEmail || email || 'local profile').toLowerCase()} · edit photo & profile`}
                    </div>
                  </div>
                </div>
                <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
              </button>

              {onOpenDevices && (
                <button
                  type="button"
                  onClick={onOpenDevices}
                  className="ather-depth-row rounded-2xl w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-colors text-left min-h-[52px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[#141418] border border-[#242429] text-white flex items-center justify-center shrink-0">
                      <DevicesGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-white">
                          active devices
                        </span>
                        {authUid && (
                          <span className="text-[11px] font-extrabold text-[#A1A1AA] tabular-nums">
                            · {accountDeviceCount} active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-[#A1A1AA] truncate mt-0.5">
                        {authUid
                          ? 'view active devices and choose where to play'
                          : 'sign in with google to see connected android & web devices'}
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                </button>
              )}

              {onResetOnboarding && (
                <button
                  type="button"
                  onClick={onResetOnboarding}
                  className="ather-depth-row rounded-2xl w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-colors text-left min-h-[52px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[#141418] border border-[#242429] text-white flex items-center justify-center shrink-0">
                      <RotateGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white">
                        reset onboarding
                      </div>
                      <div className="text-[11px] font-bold text-[#A1A1AA] truncate mt-0.5">
                        re-run the setup for this {providerLabel} account
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                </button>
              )}

              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={() => void onSwitchAccount()}
                  className="ather-depth-row rounded-2xl w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-colors text-left min-h-[52px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[#141418] border border-[#242429] text-white flex items-center justify-center shrink-0">
                      <UserGlyph className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-white">
                        switch account
                      </div>
                      <div className="text-[11px] font-bold text-[#A1A1AA] truncate mt-0.5">
                        sign in or switch listener profile without losing data
                      </div>
                    </div>
                  </div>
                  <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
                </button>
              )}
            </div>
          </section>

          {/* GROUP 2: AI & SMART PLAYBACK */}
          <section aria-label="ai and smart playback" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              ai &amp; smart playback
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <AiSparklesGlyph className="w-4 h-4" active={aiSmartShuffleEnabled || aiRecommendationsEnabled} />,
                'ai smart shuffle & recommendations',
                `smart shuffle ${aiSmartShuffleEnabled ? 'on' : 'off'} · recommendations ${aiRecommendationsEnabled ? 'on' : 'off'} · ${aiDiscoveryLevel.toLowerCase()}`,
                'ai'
              )}
            </div>
          </section>

          {/* GROUP 3: PLAYBACK & SOUND */}
          <section aria-label="playback and sound" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              playback &amp; sound
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <EqSlidersGlyph className="w-4 h-4" />,
                'equalizer',
                `preset: ${eqPreset.toLowerCase()} (${eqBands.map((b) => (b > 0 ? `+${b}` : b)).join(' / ')} db)`,
                'equalizer'
              )}
              {renderHubRow(
                <WifiAudioGlyph className="w-4 h-4" />,
                'audio quality',
                `wi-fi: ${wifiQuality.toLowerCase()} · cellular: ${(dataSaver ? 'Low' : cellularQuality).toLowerCase()} · downloads: ${downloadQuality.toLowerCase()}`,
                'audio-quality'
              )}
              {renderHubRow(
                <DiscGlyph className="w-4 h-4" />,
                'playback behavior',
                `crossfade ${crossfadeSeconds === 0 ? 'off' : `${crossfadeSeconds}s`} · gapless ${gaplessPlayback ? 'on' : 'off'} · autoplay ${autoplay ? 'on' : 'off'}`,
                'playback'
              )}
              {renderHubRow(
                <ClockGlyph className="w-4 h-4" />,
                'sleep timer',
                sleepSummary === 'off'
                  ? 'off · automatically pause playback'
                  : `active: ${sleepSummary}`,
                'sleep-timer'
              )}
            </div>
          </section>

          {/* GROUP 3: REELS & INTERFACE */}
          <section aria-label="reels and interface" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              reels &amp; interface
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <ReelsFilmGlyph className="w-4 h-4" />,
                'music reels',
                `${reelsAutoScroll ? 'auto-scroll' : 'manual loop'} · ${reelsDurationSeconds}s clips`,
                'reels'
              )}
              {renderHubRow(
                <HapticsSparkGlyph className="w-4 h-4" />,
                'haptics & player ui',
                `visual pulses ${hapticsEnabled ? 'on' : 'off'} · mini-player swipe ${miniSwipeEnabled ? 'on' : 'off'}`,
                'interface'
              )}
            </div>
          </section>

          {/* GROUP 4: STORAGE & DATA */}
          <section aria-label="storage and data" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              storage &amp; data
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <DownloadGlyph className="w-4 h-4" />,
                'offline mode & downloads',
                `${isOffline ? 'offline mode active' : 'online'} · ${downloadOverCellular ? 'wi-fi & cellular' : 'wi-fi only'}`,
                'data-downloads'
              )}
              {renderHubRow(
                <StorageDriveGlyph className="w-4 h-4" />,
                'storage & cache',
                `${usedMb} mb of 1 gb used · ${downloadedCount} offline songs`,
                'storage'
              )}
            </div>
          </section>

          {/* GROUP 4.5: ALLOW ACCESS */}
          <section aria-label="allow access" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              allow access
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <ExplicitShieldGlyph className="w-4 h-4" />,
                'allow access & permissions',
                `notifications: ${notifPermission === 'granted' ? 'allowed' : 'off'} · persistent storage: ${storagePersisted ? 'granted' : 'standard'}`,
                'permissions'
              )}
            </div>
          </section>

          {/* GROUP 5: CONTENT, PRIVACY & SUPPORT */}
          <section aria-label="content, privacy and support" className="space-y-2.5">
            <h2 className="px-2 text-xs font-extrabold tracking-[0.06em] text-[#A1A1AA]">
              content, privacy &amp; support
            </h2>
            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              {renderHubRow(
                <GlobeGlyph className="w-4 h-4" />,
                'content & lyrics',
                `${language.toLowerCase()} · lyrics ${showLyricsEnabled ? 'on' : 'off'} · explicit ${explicitAllowed ? 'allowed' : 'blocked'}`,
                'content'
              )}
              {renderHubRow(
                <ActivityGlyph className="w-4 h-4" />,
                'listening activity & privacy',
                privateSession
                  ? 'private session active'
                  : trackActivity
                  ? `recording activity (${recentCount} recent)`
                  : 'activity recording paused',
                'privacy'
              )}
              {renderHubRow(
                <BellGlyph className="w-4 h-4" />,
                'notifications',
                `new releases ${notifyNewReleases ? 'on' : 'off'} · app updates ${notifyAppUpdates ? 'on' : 'off'}`,
                'notifications'
              )}
              {renderHubRow(
                <HelpGlyph className="w-4 h-4" />,
                'help & about',
                'help center, terms & privacy policy',
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
              className="ather-depth-btn w-full rounded-full py-3.5 px-6 flex items-center justify-center gap-2 text-sm font-extrabold text-white active:scale-[0.99] transition-transform min-h-[44px]"
            >
              <LogoutGlyph className="w-4 h-4 text-white" />
              <span>log out</span>
            </button>
          </div>
        </>
      )}

      {/* SUB-PAGE 1: EDIT PROFILE & PROFILE IMAGE */}
      {activePage === 'profile' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'profile & photo',
            isGuest
              ? 'update your display name and profile picture on this device.'
              : 'update your display name, email, and profile picture across Ather.'
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateProfile(
                draftName.trim() || (isGuest ? 'guest listener' : 'listener'),
                isGuest ? '' : draftEmail.trim(),
                draftImageUrl,
                draftPreset
              );
              scheduleNoticeClear(setProfileSavedNotice, 2600);
            }}
            className="space-y-5"
          >
            {/* Avatar Editing Card */}
            <div className="ather-depth-card rounded-3xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="relative self-start">
                  <ProfileAvatar
                    displayName={draftName || displayName}
                    imageUrl={draftImageUrl}
                    preset={draftPreset}
                    className="w-24 h-24 border border-[#242429]"
                  />
                  <button
                    type="button"
                    aria-label="upload profile photo"
                    onClick={() => photoInputRef.current?.click()}
                    className="ather-acid-btn absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                  >
                    <CameraGlyph className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1">
                  <div className="text-sm font-extrabold text-white">profile picture</div>
                  <p className="text-xs text-[#A1A1AA] font-bold leading-relaxed">
                    upload a custom photo or choose one of the studio avatars below.
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
                      className="ather-acid-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
                    >
                      <ImagePlusGlyph className="w-3.5 h-3.5" />
                      <span>upload photo</span>
                    </button>

                    {draftImageUrl && (
                      <button
                        type="button"
                        onClick={() => setDraftImageUrl(null)}
                        className="ather-depth-pill inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white text-xs font-bold transition-colors"
                      >
                        <RotateGlyph className="w-3.5 h-3.5" />
                        <span>remove photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#242429] space-y-2.5">
                <div className="text-xs font-extrabold tracking-wider text-[#A1A1AA]">
                  studio avatar presets
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
                        className={`flex flex-col items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl border transition-colors ${
                          selected
                            ? 'bg-white text-black border-white'
                            : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                        }`}
                      >
                        <ProfileAvatar
                          displayName={draftName || displayName}
                          preset={p.id}
                          className="w-9 h-9 sm:w-10 sm:h-10 border border-[#242429]"
                        />
                        <span className="text-[10px] sm:text-[11px] font-extrabold truncate max-w-full">
                          {p.label.toLowerCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Name & Account Identity Fields */}
            <div className="ather-depth-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#A1A1AA] flex items-center gap-1.5">
                  <UserGlyph className="w-3.5 h-3.5 text-white" />
                  <span>display name</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="enter display name"
                  className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-3 text-base sm:text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>

              {isGuest ? (
                <div className="ather-depth-row rounded-2xl px-4 py-3 space-y-1">
                  <div className="text-xs font-extrabold text-white">
                    guest account — no email linked
                  </div>
                  <p className="text-[11px] font-bold text-[#A1A1AA] leading-relaxed">
                    guest sessions stay strictly on this device. use switch account to sign in with google or an email address.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#A1A1AA]">
                    email address
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    placeholder="enter email address"
                    className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-3 text-base sm:text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs font-bold text-white">
                  {profileSavedNotice ? 'profile changes saved.' : ''}
                </span>
                <button
                  type="submit"
                  className="ather-acid-btn px-6 py-2.5 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
                >
                  save profile
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
            'audio quality',
            'choose bitrate and lossless streaming tiers across connections.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            {[
              {
                label: 'wi-fi streaming',
                desc: 'maximum clarity on home and studio networks',
                value: wifiQuality,
                setter: setWifiQuality,
              },
              {
                label: 'cellular streaming',
                desc: dataSaver
                  ? 'overridden to low while data saver is active'
                  : 'streaming quality over 4g / 5g',
                value: dataSaver ? ('Low' as QualityTier) : cellularQuality,
                setter: setCellularQuality,
              },
              {
                label: 'offline downloads',
                desc: 'audio quality saved to device storage',
                value: downloadQuality,
                setter: setDownloadQuality,
              },
            ].map((row) => (
              <div key={row.label} className="ather-depth-row rounded-2xl p-4 space-y-3">
                <div>
                  <div className="text-sm font-extrabold text-white">{row.label}</div>
                  <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">{row.desc}</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {(['Low', 'Normal', 'High'] as const).map((tier) => {
                    const active = row.value === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => row.setter(tier)}
                        className={`py-2.5 px-2 sm:px-3 rounded-2xl border text-center transition-colors ${
                          active
                            ? 'bg-white text-black border-white font-extrabold'
                            : 'bg-[#141418] text-[#A1A1AA] border-[#242429] font-bold hover:text-white'
                        }`}
                      >
                        <div className="text-xs">{tier.toLowerCase()}</div>
                        <div
                          className={`text-[9.5px] sm:text-[10px] font-bold mt-0.5 truncate ${
                            active ? 'text-black/75' : 'text-[#A1A1AA]'
                          }`}
                        >
                          {tier === 'Low'
                            ? '96 kbps'
                            : tier === 'Normal'
                            ? '160 kbps'
                            : '24-bit lossless'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="ather-depth-row rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  spatial &amp; hi-res output
                </div>
                <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                  preserve uncompressed studio stereo imaging when available
                </div>
              </div>
              <ToggleSwitch
                checked={losslessSpatial}
                onChange={toggleLosslessSpatial}
                label="spatial and hi-res output"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE AI: AI SMART SHUFFLE & AI RECOMMENDATIONS */}
      {activePage === 'ai' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'ai & smart playback',
            'control smart queue sequencing and personalized home recommendations.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[#141418] border border-[#242429] text-white flex items-center justify-center shrink-0">
                  <ShuffleGlyph className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white">ai smart shuffle</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    intelligently sequence your queue for seamless mood and tempo flow when shuffle is enabled
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={aiSmartShuffleEnabled}
                onChange={onToggleAiSmartShuffle}
                label="ai smart shuffle"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[#141418] border border-[#242429] text-white flex items-center justify-center shrink-0">
                  <AiSparklesGlyph className="w-4 h-4" active={aiRecommendationsEnabled} />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-white">ai recommendations</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    display personalized ai track picks on your home feed tailored to your taste
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={aiRecommendationsEnabled}
                onChange={onToggleAiRecommendations}
                label="ai recommendations"
              />
            </div>

            <div className="ather-depth-row rounded-2xl p-4 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-white">discovery balance</div>
                <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                  guide how adventurous ai smart shuffle and recommendations should be
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
                      className={`py-2.5 px-3 rounded-2xl border text-xs font-extrabold transition-colors ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                      }`}
                    >
                      {tier.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ather-depth-row rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">live ai engine status</div>
                  <div className="text-xs text-[#A1A1AA] font-bold mt-0.5">
                    {isOffline
                      ? 'unavailable while offline — reconnect to refresh ai picks'
                      : aiRecLoading
                      ? 'generating personalized picks...'
                      : aiRecError
                      ? aiRecError.toLowerCase()
                      : aiRecommendations.length > 0
                      ? `${(aiRecHeadline ?? 'ai curated mix').toLowerCase()} · ${aiRecommendations.length} picks ready on home`
                      : 'tap refresh picks to generate ai recommendations'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isOffline || aiRecLoading}
                  onClick={onRefreshAiRecommendations}
                  className="ather-acid-btn px-4 py-2 rounded-full text-xs font-extrabold disabled:opacity-40 active:scale-95 transition-transform shrink-0"
                >
                  {aiRecLoading ? 'generating...' : 'refresh picks'}
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
              'equalizer',
              'shape frequency response with studio presets, live curve preview, and custom bands.'
            )}

            <div className="ather-depth-card rounded-3xl p-5 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">sound presets</div>
                  <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                    active curve: {eqPreset.toLowerCase()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectEqPreset('Flat')}
                  className="ather-depth-pill px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white transition-colors"
                >
                  reset flat
                </button>
              </div>

              {/* Live SVG Frequency Curve Visualizer */}
              <div className="rounded-2xl bg-[#141418] border border-[#242429] p-3.5 space-y-2">
                <svg
                  viewBox="0 0 320 120"
                  className="w-full h-28 overflow-visible"
                  aria-label="equalizer frequency response curve"
                >
                  <defs>
                    <linearGradient id="eqCurveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {/* Reference horizontal lines (+12, 0, -12 dB) */}
                  <line x1="20" y1="18" x2="300" y2="18" stroke="rgba(161,161,170,0.22)" strokeDasharray="3 3" />
                  <line x1="20" y1="60" x2="300" y2="60" stroke="rgba(161,161,170,0.38)" />
                  <line x1="20" y1="102" x2="300" y2="102" stroke="rgba(161,161,170,0.22)" strokeDasharray="3 3" />

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
                      <circle cx={pt.x} cy={pt.y} r="5" fill="#FFFFFF" stroke="#000000" strokeWidth="1.5" />
                      <circle cx={pt.x} cy={pt.y} r="1.8" fill="#000000" />
                    </g>
                  ))}
                </svg>
                <div className="flex items-center justify-between px-2 text-[10px] font-bold text-[#A1A1AA] tabular-nums">
                  {EQ_BANDS.map((band) => (
                    <span key={band}>{band.toLowerCase()}</span>
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
                      className={`px-3.5 py-2 rounded-full text-xs font-extrabold border transition-colors ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                      }`}
                    >
                      {preset.toLowerCase()}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-[#141418] border border-[#242429] p-4 space-y-3.5">
                {EQ_BANDS.map((band, idx) => (
                  <div key={band} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-bold text-[#A1A1AA] tabular-nums">
                      {band.toLowerCase()}
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      aria-label={`${band.toLowerCase()} gain`}
                      value={eqBands[idx]}
                      onChange={(e) => handleEqBandChange(idx, Number(e.target.value))}
                      className="flex-1 accent-white cursor-pointer"
                    />
                    <span className="w-12 text-right text-xs font-extrabold tabular-nums text-white">
                      {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]} db
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
              <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <SpeakerVolumeGlyph className="w-4 h-4 text-white shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      volume normalization
                    </div>
                    <div className="text-xs font-bold text-[#A1A1AA]">
                      maintain balanced loudness across albums and playlists
                    </div>
                  </div>
                </div>
                <ToggleSwitch
                  checked={volumeNormalization}
                  onChange={toggleVolumeNormalization}
                  label="volume normalization"
                />
              </div>

              <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">mono audio</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    combine left and right stereo channels into one signal
                  </div>
                </div>
                <ToggleSwitch
                  checked={monoAudio}
                  onChange={toggleMonoAudio}
                  label="mono audio"
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
            'playback behavior',
            'customize track transitions, gapless playback, and queue autoplay.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-white">crossfade</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    smoothly blend the end of one song into the next
                  </div>
                </div>
                <span className="text-sm font-extrabold tabular-nums text-white">
                  {crossfadeSeconds === 0 ? 'off' : `${crossfadeSeconds}s`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                aria-label="crossfade duration in seconds"
                value={crossfadeSeconds}
                onChange={(e) => onChangeCrossfade(Number(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-bold text-[#A1A1AA] tabular-nums">
                <span>0s</span>
                <span>6s</span>
                <span>12s</span>
              </div>
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">gapless playback</div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  eliminate pauses between consecutive album tracks
                </div>
              </div>
              <ToggleSwitch
                checked={gaplessPlayback}
                onChange={onToggleGapless}
                label="gapless playback"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <RadioStreamGlyph className="w-4 h-4 text-white shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white">autoplay</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    keep playing recommended music when your queue ends
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={autoplay}
                onChange={onToggleAutoplay}
                label="autoplay"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  open player when selecting a song
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  automatically expand the full-screen player on tap
                </div>
              </div>
              <ToggleSwitch
                checked={openPlayerOnTap}
                onChange={onToggleOpenPlayerOnTap}
                label="open player when selecting a song"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 5: SLEEP TIMER */}
      {activePage === 'sleep-timer' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'sleep timer',
            'automatically pause audio playback after a set duration.'
          )}

          <div className="ather-depth-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#242429]">
              <div>
                <div className="text-xs font-extrabold tracking-wider text-[#A1A1AA]">
                  current status
                </div>
                <div className="text-lg font-extrabold text-white mt-0.5 tabular-nums">
                  {sleepTimerEndOfTrack
                    ? 'pauses at end of current track'
                    : sleepTimerRemainingSeconds !== null &&
                      sleepTimerRemainingSeconds > 0
                    ? `pauses in ${formatTimerCountdown(sleepTimerRemainingSeconds)}`
                    : 'timer off'}
                </div>
              </div>
              {(sleepTimerEndOfTrack ||
                (sleepTimerRemainingSeconds !== null &&
                  sleepTimerRemainingSeconds > 0)) && (
                <button
                  type="button"
                  onClick={() => onSetSleepTimerMinutes(null)}
                  className="ather-acid-btn px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-transform"
                >
                  cancel timer
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'off', mins: null as number | null },
                { label: '15 minutes', mins: 15 },
                { label: '30 minutes', mins: 30 },
                { label: '45 minutes', mins: 45 },
                { label: '1 hour', mins: 60 },
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
                    className={`py-3 px-4 rounded-2xl border text-xs font-extrabold transition-colors min-h-[44px] ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onSetSleepTimerEndOfTrack}
                className={`py-3 px-4 rounded-2xl border text-xs font-extrabold transition-colors min-h-[44px] ${
                  sleepTimerEndOfTrack
                    ? 'bg-white text-black border-white'
                    : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                }`}
              >
                end of track
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 6: MUSIC REELS PREFERENCES */}
      {activePage === 'reels' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'music reels',
            'control continuous auto-scrolling, clip timing, and music switching in reels.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  auto-scroll when reel ends
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  smoothly advance continuously through the reels stream
                </div>
              </div>
              <ToggleSwitch
                checked={reelsAutoScroll}
                onChange={onToggleReelsAutoScroll}
                label="auto-scroll when reel ends"
              />
            </div>

            <div className="ather-depth-row rounded-2xl p-4 space-y-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  reel preview duration
                </div>
                <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                  how long each visual reel plays before advancing
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
                      className={`py-2.5 rounded-2xl border text-xs font-extrabold tabular-nums transition-colors min-h-[44px] ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  auto-pause music on reels
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  pause background music playback when switching to reels
                </div>
              </div>
              <ToggleSwitch
                checked={reelsAutoPauseMusic}
                onChange={onToggleReelsAutoPauseMusic}
                label="auto-pause music on reels"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 7: HAPTICS & PLAYER UI */}
      {activePage === 'interface' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'haptics & player ui',
            'tune tactile visual feedback, mini-player gestures, and player lighting.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  tactile visual pulses
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  subtle cover art and transport button pulse animations
                </div>
              </div>
              <ToggleSwitch
                checked={hapticsEnabled}
                onChange={onToggleHaptics}
                label="tactile visual pulses"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  swipe away paused mini-player
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  allow horizontal swipe dismissal of the mini-player pill when paused
                </div>
              </div>
              <ToggleSwitch
                checked={miniSwipeEnabled}
                onChange={onToggleMiniSwipe}
                label="swipe away paused mini-player"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  ambient glow in lyrics view
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  low-saturation artwork ambient illumination while viewing lyrics
                </div>
              </div>
              <ToggleSwitch
                checked={lyricsGlowEnabled}
                onChange={onToggleLyricsGlow}
                label="ambient glow in lyrics view"
              />
            </div>

            {onUpdateLookPrefs && (
              <>
                <div className="ather-depth-row rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-white">
                        surface contrast depth
                      </div>
                      <div className="text-xs font-bold text-[#A1A1AA]">
                        customize floating navigation &amp; mini-player surface density for your account
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
                    aria-label="surface contrast depth"
                    value={lookPrefs.glassOpacity}
                    onChange={(e) =>
                      onUpdateLookPrefs({ glassOpacity: Number(e.target.value) })
                    }
                    className="w-full accent-white cursor-pointer"
                  />
                </div>

                <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      compact discovery tiles
                    </div>
                    <div className="text-xs font-bold text-[#A1A1AA]">
                      tighter vertical spacing across shelves and library lists
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={lookPrefs.compactTiles}
                    onChange={() =>
                      onUpdateLookPrefs({ compactTiles: !lookPrefs.compactTiles })
                    }
                    label="compact discovery tiles"
                  />
                </div>

                <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      spring navigation motion
                    </div>
                    <div className="text-xs font-bold text-[#A1A1AA]">
                      fluid transition on navigation bar &amp; player surfaces
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={lookPrefs.springMotion}
                    onChange={() =>
                      onUpdateLookPrefs({ springMotion: !lookPrefs.springMotion })
                    }
                    label="spring navigation motion"
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
            'offline mode & downloads',
            'automatically switch to downloads without internet or toggle offline mode manually.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${
                    isOffline
                      ? 'bg-white text-black border-white'
                      : 'bg-[#141418] text-white border-[#242429]'
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
                      ? 'no internet connection'
                      : manualOfflineMode
                      ? 'offline mode enabled'
                      : 'connected online'}
                  </div>
                  <div className="text-xs font-bold text-[#A1A1AA] truncate">
                    {isOffline
                      ? `playing from ${downloadedCount} downloaded ${downloadedCount === 1 ? 'song' : 'songs'}`
                      : 'full catalog streaming and playback active'}
                  </div>
                </div>
              </div>
              <span className="ather-depth-pill px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider text-white shrink-0">
                {isOffline ? 'offline' : 'online'}
              </span>
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">offline mode</div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  play only downloaded songs and switch to downloads automatically
                </div>
              </div>
              <ToggleSwitch
                checked={manualOfflineMode || !isNetworkOnline}
                onChange={onToggleManualOfflineMode}
                label="offline mode"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">data saver</div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  reduce streaming bitrate when using mobile data
                </div>
              </div>
              <ToggleSwitch
                checked={dataSaver}
                onChange={toggleDataSaver}
                label="data saver"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  download over cellular
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  {downloadOverCellular
                    ? 'offline downloads allowed on mobile data and wi-fi'
                    : 'restrict offline downloads to wi-fi only'}
                </div>
              </div>
              <ToggleSwitch
                checked={downloadOverCellular}
                onChange={toggleDownloadOverCellular}
                label="download over cellular"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  auto-download liked songs
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  automatically save songs offline whenever you tap heart
                </div>
              </div>
              <ToggleSwitch
                checked={autoDownloadFavorites}
                onChange={onToggleAutoDownloadFavorites}
                label="auto-download liked songs"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 9: STORAGE & CACHE */}
      {activePage === 'storage' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'storage & cache',
            'inspect offline song storage and free up temporary audio cache.'
          )}

          <div className="ather-depth-card rounded-3xl p-5 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-white">device storage used</span>
                <span className="text-[#A1A1AA] tabular-nums">
                  {usedMb} mb of 1,024 mb
                </span>
              </div>

              <div className="w-full h-3.5 rounded-full bg-[#141418] border border-[#242429] overflow-hidden flex">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${downloadsPct}%` }}
                />
                <div
                  className="h-full bg-[#A1A1AA] transition-all duration-300"
                  style={{ width: `${cachePct}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-[#A1A1AA] pt-1 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#242429] inline-block" />
                  offline downloads: {downloadsMb} mb ({downloadedCount}{' '}
                  {downloadedCount === 1 ? 'track' : 'tracks'})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A1A1AA] border border-[#242429] inline-block" />
                  audio cache: {cacheMb} mb
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#242429]">
              <button
                type="button"
                onClick={() => {
                  setCacheMb(0);
                  scheduleNoticeClear(setCacheClearedNotice, 2400);
                }}
                disabled={cacheMb === 0}
                className="ather-acid-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-extrabold disabled:opacity-40 active:scale-95 transition-transform"
              >
                <TrashGlyph className="w-3.5 h-3.5" />
                <span>{cacheClearedNotice ? 'cache cleared' : 'clear cache'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClearAllDownloads();
                  scheduleNoticeClear(setDownloadsClearedNotice, 2400);
                }}
                disabled={downloadedCount === 0}
                className="ather-depth-pill inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-xs font-extrabold disabled:opacity-40 active:scale-95 transition-transform"
              >
                <TrashGlyph className="w-3.5 h-3.5 text-[#E4E4E7]" />
                <span>
                  {downloadsClearedNotice
                    ? 'downloads removed'
                    : 'remove all downloads'}
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
            'content & lyrics',
            'filter explicit tracks, configure lyrics display, and choose app language.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ExplicitShieldGlyph className="w-4 h-4 text-white shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <span>explicit content</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-white text-black border border-white">
                      e
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    {explicitAllowed
                      ? 'allow tracks labeled explicit during playback'
                      : 'block tracks labeled explicit'}
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={explicitAllowed}
                onChange={onToggleExplicit}
                label="explicit content"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LyricsGlyph className="w-4 h-4 text-white shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white">show lyrics</div>
                  <div className="text-xs font-bold text-[#A1A1AA]">
                    enable time-synced lyrics on the full-screen player
                  </div>
                </div>
              </div>
              <ToggleSwitch
                checked={showLyricsEnabled}
                onChange={onToggleShowLyrics}
                label="show lyrics"
              />
            </div>

            <div className="ather-depth-row rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <GlobeGlyph className="w-4 h-4 text-white" />
                <span>app language</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => {
                  const active = language.toLowerCase() === lang.toLowerCase();
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`py-2.5 px-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-between transition-colors min-h-[44px] ${
                        active
                          ? 'bg-white text-black border-white'
                          : 'bg-[#141418] text-[#A1A1AA] border-[#242429] hover:text-white'
                      }`}
                    >
                      <span>{lang.toLowerCase()}</span>
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
            'listening activity & privacy',
            'control recent play history tracking and private listening sessions.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  record listening activity
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  save played songs to your library → activity recents
                </div>
              </div>
              <ToggleSwitch
                checked={trackActivity}
                onChange={onToggleTrackActivity}
                label="record listening activity"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  private session
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  listen temporarily without updating your recent taste profile
                </div>
              </div>
              <ToggleSwitch
                checked={privateSession}
                onChange={onTogglePrivateSession}
                label="private session"
              />
            </div>

            <div className="ather-depth-row rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  recent listening history
                </div>
                <div className="text-xs font-bold text-[#A1A1AA] tabular-nums">
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
                className="ather-acid-btn px-4 py-2 rounded-full text-xs font-extrabold disabled:opacity-40 active:scale-95 transition-transform shrink-0"
              >
                {historyClearedNotice ? 'cleared' : 'clear history'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 12: NOTIFICATIONS */}
      {activePage === 'notifications' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'notifications',
            'choose which artist releases and app updates you want to hear about.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">new releases</div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  alerts when artists you listen to drop new singles or albums
                </div>
              </div>
              <ToggleSwitch
                checked={notifyNewReleases}
                onChange={toggleNotifyNewReleases}
                label="new releases notifications"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">
                  playlist &amp; mix updates
                </div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  notifications when curated collections refresh with new tracks
                </div>
              </div>
              <ToggleSwitch
                checked={notifyMixUpdates}
                onChange={toggleNotifyMixUpdates}
                label="playlist and mix updates"
              />
            </div>

            <div className="ather-depth-row rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-white">app updates</div>
                <div className="text-xs font-bold text-[#A1A1AA]">
                  feature announcements and audio engine improvements
                </div>
              </div>
              <ToggleSwitch
                checked={notifyAppUpdates}
                onChange={toggleNotifyAppUpdates}
                label="app updates notifications"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 13: HELP & ABOUT */}
      {activePage === 'help' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'help & about',
            'support resources, terms, privacy details, and app information.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <HelpGlyph className="w-4 h-4 text-white" />
                <span>help center</span>
              </div>
              <p className="text-xs font-bold text-[#A1A1AA] leading-relaxed">
                manage offline downloads, lossless audio tiers, queue ordering, sleep timer, reels auto-scroll, and custom playlist covers directly inside Ather. contact support at help@ather.audio.
              </p>
            </div>

            <div className="ather-depth-row rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <DocumentGlyph className="w-4 h-4 text-white" />
                <span>terms &amp; privacy policy</span>
              </div>
              <p className="text-xs font-bold text-[#A1A1AA] leading-relaxed">
                your playlists, offline downloads, profile photo, and listening preferences stay private to your session. you can pause or clear listening history anytime under listening activity &amp; privacy.
              </p>
            </div>

            <div className="ather-depth-row rounded-2xl p-4 flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold text-white">Ather audio</span>
              <span className="text-xs font-bold text-white tabular-nums">
                version 2.4 · lossless engine
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PAGE 14: ALLOW ACCESS & PERMISSIONS */}
      {activePage === 'permissions' && (
        <div className="space-y-6">
          {renderSubPageHeader(
            'allow access',
            'manage device permissions for notifications and persistent offline storage.'
          )}

          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5 overflow-hidden">
            <div className="ather-depth-row rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">offline storage persistence</div>
                <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                  prevents the browser from evicting your downloaded offline songs
                </div>
              </div>
              {storagePersisted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black border border-white text-xs font-extrabold shrink-0">
                  <CheckGlyph className="w-3.5 h-3.5" />
                  <span>protected</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestPersistentStorage()}
                  className="ather-acid-btn px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-transform shrink-0"
                >
                  allow storage
                </button>
              )}
            </div>

            <div className="ather-depth-row rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">push notifications</div>
                <div className="text-xs font-bold text-[#A1A1AA] mt-0.5">
                  release alerts and mix updates from artists you follow
                </div>
              </div>
              {notifPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black border border-white text-xs font-extrabold shrink-0">
                  <CheckGlyph className="w-3.5 h-3.5" />
                  <span>allowed</span>
                </span>
              ) : notifPermission === 'unsupported' ? (
                <span className="text-xs font-bold text-[#A1A1AA] shrink-0">
                  unsupported
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestNotificationPermission()}
                  className="ather-acid-btn px-4 py-2 rounded-full text-xs font-extrabold active:scale-95 transition-transform shrink-0"
                >
                  allow alerts
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

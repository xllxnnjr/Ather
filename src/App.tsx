import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AiSparklesGlyph,
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  WifiOffGlyph,
  WifiOnGlyph,
} from './components/AppIcons';
import {
  HomeNavIcon,
  LibraryNavIcon,
  NavIconProps,
  ProfileNavIcon,
  ReelsNavIcon,
  SearchNavIcon,
} from './components/NavIcons';
import { AtherLogoMark } from './components/AtherLogoMark';
import { AuthGateScreen } from './components/AuthGateScreen';
import {
  BrowserAudioOutputOption,
  DeviceHandoffSheet,
} from './components/DeviceHandoffSheet';
import { OnboardingGuard } from './components/OnboardingGuard';
import { PlayerOverlay } from './components/PlayerOverlay';
import { AvatarPreset, ProfileAvatar } from './components/ProfileAvatar';
import { SettingUpAtherScreen } from './components/SettingUpAtherScreen';
import { ShowcaseArtwork } from './components/ShowcaseArtwork';
import { SignInLoadingScreen } from './components/SignInLoadingScreen';
import { TrackInfoModal } from './components/TrackInfoModal';
import { AlbumDetailScreen } from './components/screens/AlbumDetailScreen';
import { ArtistDetailScreen } from './components/screens/ArtistDetailScreen';
import { CollectionDetailScreen } from './components/screens/CollectionDetailScreen';
import { HomeScreen } from './components/screens/HomeScreen';
import { LibraryScreen, PlayHistoryEntry } from './components/screens/LibraryScreen';
import {
  EQ_PRESET_VALUES,
  EqPreset,
  ProfileSettingsScreen,
} from './components/screens/ProfileSettingsScreen';
import { ReelsScreen } from './components/screens/ReelsScreen';
import { SearchScreen } from './components/screens/SearchScreen';
import {
  HomeShelfDetail,
  ShelfDetailScreen,
} from './components/screens/ShelfDetailScreen';
import type { User } from 'firebase/auth';
import { pickGradientArtwork } from './data/showcaseCatalog';
import {
  signInWithGooglePopup,
  signOutFirebase,
  subscribeToAuth,
} from './firebase';
import {
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  ActiveAccountIdentity,
  LOCAL_SYNC_NEEDED_EVENT,
  getActiveAccount,
  getCanonicalAccountScopeId,
  getDefaultAiSettings,
  getDefaultAppPreferences,
  getDefaultProfile,
  getSyncMeta,
  hasCompletedAccountOnboarding,
  readAccountJson,
  recordFavoriteMutation,
  recordHistoryCleared,
  recordPlaylistDeletion,
  sanitizeAccountId,
  setAccountOnboardingCompleted,
  setActiveAccount,
  touchSyncSection,
  writeAccountJson,
} from './services/accountStorage';
import { fetchDeezerArtistJsonp } from './services/artistInfoApi';
import { audioEngine } from './services/audioEngine';
import {
  fetchAudiusTrending,
  resolveFullAudiusTrack,
  searchAudiusTracks,
} from './services/audiusApi';
import {
  CloudSyncStatus,
  cloudSync,
  getCloudSyncStatus,
  subscribeCloudSyncStatus,
} from './services/cloudSync';
import {
  RegisteredDevice,
  RemoteCommandType,
  SharedPlaybackState,
  computeExactPositionSec,
  deviceHandoff,
  getLocalDeviceId,
  publishSharedPlayback,
  removeRegisteredDevice,
  sendRemoteControlCommand,
  transferPlaybackToDevice,
} from './services/deviceHandoff';
import {
  fetchAppleCharts,
  fetchRichItunesCatalog,
  searchItunesTracks,
} from './services/itunesApi';
import {
  notifyActivityStatsChanged,
  resetActivityStatsMemory,
  syncActivityStatsFromCloud,
} from './services/listeningStats';
import {
  UserLookPreferences,
  clearAccountSessionState,
  getActiveUserId,
  getCurrentUserLook,
  setActiveUserId,
  subscribeUserLook,
  updateUserLookPreferences,
} from './services/userScope';
import {
  LIVE_FEED_TTL_MS,
  clearMusicFeedCaches,
  fetchPersonalizedReelsPool,
  fetchYouTubeMusicHomeShelves,
  getLiveNewReleases,
  isOfficialArtistTrack,
  isValidArtistName,
  resolveFullYouTubeTrack,
  searchFreeYouTubeSongs,
  searchRealSongs,
} from './services/musicApi';
import {
  clearAllOfflineTrackBlobs,
  removeOfflineTrackBlob,
  saveTrackOffline,
} from './services/offlineDownloads';
import { QueueScope, queueManager } from './services/queueManager';
import {
  getPersonalizedSeedTerms,
  getRankedCategories,
  loadUserMusicProfile,
  recordSearchAffinity,
  recordTrackInteraction,
} from './services/tasteProfile';
import {
  AiDiscoveryLevel,
  AiRecommendationEntry,
  AlbumItem,
  ArtworkStyle,
  CollectionItem,
  FeaturedArtistItem,
  HomeShelfCard,
  RepeatMode,
  ShowcaseTrack,
  UserPlaylist,
} from './types/music';

type AppTab = 'home' | 'search' | 'reels' | 'library' | 'profile';

const NAV_ITEMS: {
  id: AppTab;
  label: string;
  icon: React.ComponentType<NavIconProps>;
}[] = [
  { id: 'home', label: 'Home', icon: HomeNavIcon },
  { id: 'search', label: 'Search', icon: SearchNavIcon },
  { id: 'reels', label: 'Reels', icon: ReelsNavIcon },
  { id: 'library', label: 'Library', icon: LibraryNavIcon },
  { id: 'profile', label: 'Profile', icon: ProfileNavIcon },
];

function buildLiveCollections(
  audiusTracks: ShowcaseTrack[],
  chartSongs: ShowcaseTrack[],
  newReleaseTracks: ShowcaseTrack[] = [],
  forYouQuickPicks: ShowcaseTrack[] = []
): CollectionItem[] {
  const defs: {
    id: string;
    titleLines: [string, string];
    subtitle: string;
    description: string;
    badge: string;
    theme: CollectionItem['theme'];
    slice: ShowcaseTrack[];
  }[] = [
    {
      id: 'apple-top-25',
      titleLines: ['TOP SONGS', 'CHARTS'],
      subtitle: `${chartSongs.slice(0, 15).length} most played chart hits`,
      description: 'Live Top Songs chart curated with crisp high-res audio.',
      badge: 'Live Charts',
      theme: 'light-offwhite',
      slice: chartSongs.slice(0, 15),
    },
    {
      id: 'for-you-mix',
      titleLines: ['FOR YOU', 'QUICK PICKS'],
      subtitle: 'Tuned to your taste profile',
      description: 'Personalized tracks built from your artists, genres, and recent plays.',
      badge: 'Personalized',
      theme: 'dark-indigo',
      slice: forYouQuickPicks.slice(0, 15),
    },
    {
      id: 'new-drops-mix',
      titleLines: ['NEW', 'RELEASES'],
      subtitle: 'Latest drops out this week',
      description: 'Fresh official singles and album highlights added right away.',
      badge: 'New Drops',
      theme: 'dark-lime',
      slice: newReleaseTracks.slice(0, 15),
    },
    {
      id: 'audius-top-global',
      titleLines: ['TRENDING', 'STREAMS'],
      subtitle: `${audiusTracks.slice(0, 12).length} trending full streams`,
      description: 'Full-length trending tracks climbing global listening charts.',
      badge: 'Trending Now',
      theme: 'light-offwhite',
      slice: audiusTracks.slice(0, 12),
    },
    {
      id: 'audius-fresh-drops',
      titleLines: ['FRESH', 'DISCOVERIES'],
      subtitle: 'Rising independent releases',
      description: 'Independent cuts surfacing from emerging artists worldwide.',
      badge: 'Rising Picks',
      theme: 'dark-lime',
      slice: audiusTracks.slice(8, 20),
    },
    {
      id: 'late-night-pulse',
      titleLines: ['LATE NIGHT', 'PULSE'],
      subtitle: 'After-hours rotation & deep cuts',
      description: 'Hand-picked evening groove selections across R&B, hip hop, and soul.',
      badge: 'After Hours',
      theme: 'dark-indigo',
      slice: (chartSongs.length > 10 ? chartSongs.slice(10, 24) : forYouQuickPicks.slice(4, 16)),
    },
  ];

  return defs
    .filter((d) => d.slice.length > 0)
    .map((d) => ({
      id: d.id,
      titleLines: d.titleLines,
      subtitle: d.subtitle,
      description: d.description,
      badge: d.badge,
      theme: d.theme,
      artwork: d.slice[0].artwork,
      coverUrl: d.slice[0].coverUrl,
      trackIds: d.slice.map((t) => t.id),
    }));
}

function mergeUniqueTracks(...lists: ShowcaseTrack[][]): ShowcaseTrack[] {
  const seen = new Set<string>();
  const out: ShowcaseTrack[] = [];
  for (const list of lists) {
    for (const track of list) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        out.push(track);
      }
    }
  }
  return out;
}

export default function App() {
  const [activeAccount, setActiveAccountState] =
    useState<ActiveAccountIdentity | null>(() => getActiveAccount());
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    const acct = getActiveAccount();
    return acct ? hasCompletedAccountOnboarding(acct.id) : false;
  });
  const [showSetupTransition, setShowSetupTransition] = useState<boolean>(false);
  const handleSetupFinished = useCallback(() => {
    setShowSetupTransition(false);
  }, []);
  const [authTransition, setAuthTransition] = useState<{
    account: ActiveAccountIdentity;
    stage: 'signing-in' | 'syncing';
  } | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    getCloudSyncStatus()
  );
  const [settingsDevicesOpen, setSettingsDevicesOpen] = useState<boolean>(false);
  const [settingsBrowserOutputs, setSettingsBrowserOutputs] = useState<
    BrowserAudioOutputOption[]
  >([
    {
      id: 'default',
      name: 'This Device',
      spec: 'Browser Audio Output',
    },
  ]);
  const [activeSettingsOutputId, setActiveSettingsOutputId] =
    useState<string>('default');
  const hydratedAccountIdRef = useRef<string | null>(activeAccount?.id ?? null);
  const suppressNextAutoPushRef = useRef<boolean>(true);
  const authTransitionLockRef = useRef<boolean>(false);
  const forceNextFeedRefreshRef = useRef<boolean>(false);
  const [lookPrefs, setLookPrefs] = useState<UserLookPreferences>(() =>
    getCurrentUserLook()
  );

  useEffect(() => {
    return subscribeUserLook((nextLook) => {
      setLookPrefs(nextLook);
    });
  }, []);

  useEffect(() => {
    return subscribeCloudSyncStatus((next) => {
      setSyncStatus(next);
    });
  }, []);

  useEffect(() => {
    if (!settingsDevicesOpen || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => {
        if (cancelled) return;
        const outputs = list
          .filter((d) => d.kind === 'audiooutput' && d.deviceId)
          .map((d, idx) => ({
            id: d.deviceId,
            name: d.label || (idx === 0 ? 'System Default Output' : `Audio Output ${idx + 1}`),
            spec: 'Live Browser Output',
          }));
        setSettingsBrowserOutputs(
          outputs.length > 0
            ? outputs
            : [
                {
                  id: 'default',
                  name: 'This Device',
                  spec: 'Browser Audio Output',
                },
              ]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsBrowserOutputs([
            {
              id: 'default',
              name: 'This Device',
              spec: 'Browser Audio Output',
            },
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [settingsDevicesOpen]);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionItem | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumItem | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<HomeShelfDetail | null>(null);
  const [trackInfoModalTrack, setTrackInfoModalTrack] =
    useState<ShowcaseTrack | null>(null);
  const [requestedLibrarySubTab, setRequestedLibrarySubTab] = useState<{
    tab: 'playlists' | 'downloads' | 'artists' | 'activity';
    tick: number;
  } | null>(null);

  // Per-account Equalizer State
  const [eqState, setEqState] = useState<{ preset: EqPreset; bands: number[] }>(
    () => {
      const acctId = getActiveAccount()?.id;
      const parsed = readAccountJson<{ preset?: EqPreset; bands?: number[] }>(
        'eqState',
        {},
        acctId
      );
      if (
        parsed.preset &&
        Array.isArray(parsed.bands) &&
        parsed.bands.length === 5
      ) {
        return { preset: parsed.preset, bands: parsed.bands };
      }
      return { preset: 'Flat', bands: [...EQ_PRESET_VALUES.Flat] };
    }
  );

  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('eqState', eqState, activeAccount.id);
  }, [eqState, activeAccount]);

  // Per-account AI Smart Shuffle & Recommendations Settings (disabled by default)
  const [aiSettings, setAiSettings] = useState<{
    smartShuffle: boolean;
    recommendations: boolean;
    discoveryLevel: AiDiscoveryLevel;
  }>(() => {
    const acctId = getActiveAccount()?.id;
    const defaults = getDefaultAiSettings();
    const parsed = readAccountJson<
      Partial<{
        smartShuffle: boolean;
        recommendations: boolean;
        discoveryLevel: AiDiscoveryLevel;
      }>
    >('aiSettings', {}, acctId);
    return {
      smartShuffle: parsed.smartShuffle ?? defaults.smartShuffle,
      recommendations: parsed.recommendations ?? defaults.recommendations,
      discoveryLevel:
        (parsed.discoveryLevel as AiDiscoveryLevel) ??
        (defaults.discoveryLevel as AiDiscoveryLevel),
    };
  });

  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('aiSettings', aiSettings, activeAccount.id);
  }, [aiSettings, activeAccount]);

  // Real-time connectivity + Spotify-style Bottom Popup Offline/Online Indicator
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [manualOfflineMode, setManualOfflineMode] = useState<boolean>(false);
  const [onlinePopupVisible, setOnlinePopupVisible] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [onlinePopupLabel, setOnlinePopupLabel] = useState<string>('Online');
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const offlineNoticeTimerRef = useRef<number | null>(null);
  const onlinePopupTimerRef = useRef<number | null>(null);

  // Per-account Downloaded Tracks Map
  const [downloadedTracksMap, setDownloadedTracksMap] = useState<
    Record<string, ShowcaseTrack>
  >(() => {
    const acctId = getActiveAccount()?.id;
    const saved = readAccountJson<Record<string, ShowcaseTrack>>(
      'downloadedTracksMap',
      {},
      acctId
    );
    return saved && typeof saved === 'object' ? saved : {};
  });

  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('downloadedTracksMap', downloadedTracksMap, activeAccount.id);
  }, [downloadedTracksMap, activeAccount]);

  const downloadedIds = useMemo(
    () => new Set(Object.keys(downloadedTracksMap)),
    [downloadedTracksMap]
  );

  // Dynamic Track Registry (100% live tracks + saved offline tracks + restored session)
  const initialAudioSnapshot = useMemo(() => audioEngine.getSnapshot(), []);
  const initialRestoredTrack = useMemo(() => audioEngine.getRestoredTrack(), []);

  const [tracksById, setTracksById] = useState<Record<string, ShowcaseTrack>>(
    () => {
      const seed: Record<string, ShowcaseTrack> = { ...downloadedTracksMap };
      if (initialRestoredTrack) {
        seed[initialRestoredTrack.id] = initialRestoredTrack;
      }
      for (const qTrack of queueManager.getState().tracks) {
        if (!seed[qTrack.id]) seed[qTrack.id] = qTrack;
      }
      return seed;
    }
  );
  const tracksByIdRef = useRef<Record<string, ShowcaseTrack>>(tracksById);
  useEffect(() => {
    tracksByIdRef.current = tracksById;
  }, [tracksById]);

  const registerTracks = useCallback((tracks: ShowcaseTrack[]) => {
    if (tracks.length === 0) return;
    setTracksById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const track of tracks) {
        const existing = next[track.id];
        if (!existing) {
          next[track.id] = track;
          changed = true;
        } else if (
          track.streamStatus === 'full' &&
          existing.streamStatus !== 'full'
        ) {
          next[track.id] = { ...existing, ...track };
          changed = true;
        }
      }
      if (changed) {
        tracksByIdRef.current = next;
        return next;
      }
      return prev;
    });
  }, []);

  const resolveTrack = useCallback(
    (trackId: string): ShowcaseTrack | undefined =>
      tracksById[trackId] ?? downloadedTracksMap[trackId],
    [tracksById, downloadedTracksMap]
  );

  const allTracks = useMemo(() => Object.values(tracksById), [tracksById]);

  // Live Discovery Feeds State (Apple RSS + iTunes + Audius + Free YouTube + Podcasts/Audiobooks)
  const [allFeedTracks, setAllFeedTracks] = useState<ShowcaseTrack[]>([]);
  const [popularTracks, setPopularTracks] = useState<ShowcaseTrack[]>([]);
  const [audiusTrendingTracks, setAudiusTrendingTracks] = useState<
    ShowcaseTrack[]
  >([]);
  const [chartSongTracks, setChartSongTracks] = useState<ShowcaseTrack[]>([]);
  const [forYouQuickPicks, setForYouQuickPicks] = useState<ShowcaseTrack[]>([]);
  const [albumsForYou, setAlbumsForYou] = useState<AlbumItem[]>([]);
  const [trendingShelfTracks, setTrendingShelfTracks] = useState<ShowcaseTrack[]>([]);
  const [newReleaseTracks, setNewReleaseTracks] = useState<ShowcaseTrack[]>([]);
  const [newReleaseAlbums, setNewReleaseAlbums] = useState<AlbumItem[]>([]);
  const [knownAlbums, setKnownAlbums] = useState<AlbumItem[]>([]);
  const [featuredArtists, setFeaturedArtists] = useState<FeaturedArtistItem[]>(
    []
  );
  const [homeCategories, setHomeCategories] = useState<string[]>(() =>
    getRankedCategories()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [reelsTracks, setReelsTracks] = useState<ShowcaseTrack[]>([]);
  const [refreshingReels, setRefreshingReels] = useState<boolean>(false);
  const [feedLoading, setFeedLoading] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const feedSeqRef = useRef<number>(0);
  const lastFeedFetchedAtRef = useRef<number>(0);

  // Unified Audio Engine + Scoped Queue State (hydrated from saved session if present)
  const userInteractedTrackRef = useRef<boolean>(
    Boolean(initialAudioSnapshot.trackId)
  );
  const activeTrackIdRef = useRef<string | null>(
    initialAudioSnapshot.trackId
  );

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(
    initialAudioSnapshot.trackId
  );
  useEffect(() => {
    activeTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(
    initialAudioSnapshot.currentTime || 0
  );
  const [audioDuration, setAudioDuration] = useState<number>(
    initialAudioSnapshot.duration || initialRestoredTrack?.duration || 0
  );
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    const acctId = getActiveAccount()?.id;
    const saved = readAccountJson<string[]>('favorites', [], acctId);
    return new Set(Array.isArray(saved) ? saved : []);
  });
  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('favorites', Array.from(favoriteIds), activeAccount.id);
  }, [favoriteIds, activeAccount]);

  const [recentTrackIds, setRecentTrackIds] = useState<string[]>(() => {
    const acctId = getActiveAccount()?.id;
    const saved = readAccountJson<string[]>('recentIds', [], acctId);
    return Array.isArray(saved) ? saved.slice(0, 5) : [];
  });
  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('recentIds', recentTrackIds, activeAccount.id);
  }, [recentTrackIds, activeAccount]);

  const [playHistory, setPlayHistory] = useState<PlayHistoryEntry[]>(() => {
    const acctId = getActiveAccount()?.id;
    const saved = readAccountJson<PlayHistoryEntry[]>('playHistory', [], acctId);
    return Array.isArray(saved) ? saved : [];
  });
  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('playHistory', playHistory, activeAccount.id);
  }, [playHistory, activeAccount]);

  const [playlists, setPlaylists] = useState<UserPlaylist[]>(() => {
    const acctId = getActiveAccount()?.id;
    const saved = readAccountJson<UserPlaylist[]>('playlists', [], acctId);
    return Array.isArray(saved) ? saved : [];
  });
  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson('playlists', playlists, activeAccount.id);
  }, [playlists, activeAccount]);

  const [queueTrackIds, setQueueTrackIds] = useState<string[]>(() =>
    queueManager.getState().tracks.map((t) => t.id)
  );
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [accountDevices, setAccountDevices] = useState<RegisteredDevice[]>([]);
  const [sharedPlayback, setSharedPlayback] = useState<SharedPlaybackState | null>(
    null
  );
  const lastHandledCmdIdRef = useRef<string | null>(null);

  const prevFirebaseUidRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((user) => {
      const verifiedFirebaseUid = user?.emailVerified ? user.uid : null;
      const prevUid = prevFirebaseUidRef.current;
      prevFirebaseUidRef.current = verifiedFirebaseUid;
      setAuthUser(user);

      if (prevUid && prevUid !== verifiedFirebaseUid) {
        deviceHandoff.stop();
      }

      const currentAcct = getActiveAccount();
      const isGoogleAccount = currentAcct?.provider === 'google';
      const effectiveVerifiedUid =
        isGoogleAccount &&
        verifiedFirebaseUid &&
        (!currentAcct?.uid || currentAcct.uid === verifiedFirebaseUid)
          ? verifiedFirebaseUid
          : null;
      const resolvedScope =
        effectiveVerifiedUid ?? getCanonicalAccountScopeId(currentAcct);
      setActiveUserId(resolvedScope);
      audioEngine.setCurrentUid(resolvedScope);

      if (effectiveVerifiedUid) {
        void syncActivityStatsFromCloud(effectiveVerifiedUid).catch(
          () => undefined
        );
      }
    });
  }, []);

  // Live Gemini AI Engine state
  const [aiRecLoading, setAiRecLoading] = useState<boolean>(false);
  const [aiRecHeadline, setAiRecHeadline] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<
    AiRecommendationEntry[]
  >([]);
  const [aiRecError, setAiRecError] = useState<string | null>(null);
  const [aiShuffleLoading, setAiShuffleLoading] = useState<boolean>(false);
  const [aiShuffleNote, setAiShuffleNote] = useState<string | null>(null);
  const [aiShuffleError, setAiShuffleError] = useState<string | null>(null);

  // Per-account Profile state
  const initialProfile = useMemo(() => {
    const acct = getActiveAccount();
    return readAccountJson('profile', getDefaultProfile(acct), acct?.id);
  }, []);
  const [displayName, setDisplayName] = useState<string>(
    initialProfile.displayName || 'Listener'
  );
  const [handle, setHandle] = useState<string>(initialProfile.handle || '@listener');
  const [email, setEmail] = useState<string>(() => {
    const acct = getActiveAccount();
    return acct?.provider === 'guest' ? '' : initialProfile.email || '';
  });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    initialProfile.profileImageUrl ?? null
  );
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(
    initialProfile.avatarPreset ?? 'studio'
  );

  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    writeAccountJson(
      'profile',
      {
        displayName,
        handle,
        email: activeAccount.provider === 'guest' ? '' : email,
        profileImageUrl,
        avatarPreset,
      },
      activeAccount.id
    );
  }, [displayName, handle, email, profileImageUrl, avatarPreset, activeAccount]);

  const initialPrefs = useMemo(() => {
    const acct = getActiveAccount();
    return readAccountJson('preferences', getDefaultAppPreferences(), acct?.id);
  }, []);
  const [autoplay, setAutoplay] = useState<boolean>(initialPrefs.autoplay);
  const [showLyricsEnabled, setShowLyricsEnabled] = useState<boolean>(
    initialPrefs.showLyricsEnabled
  );
  const [explicitAllowed, setExplicitAllowed] = useState<boolean>(
    initialPrefs.explicitAllowed
  );
  const [crossfadeSeconds, setCrossfadeSeconds] = useState<number>(
    initialPrefs.crossfadeSeconds ?? 4
  );
  const [gaplessPlayback, setGaplessPlayback] = useState<boolean>(
    initialPrefs.gaplessPlayback ?? true
  );
  const [openPlayerOnTap, setOpenPlayerOnTap] = useState<boolean>(
    initialPrefs.openPlayerOnTap ?? true
  );
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(
    initialPrefs.hapticsEnabled
  );
  const [miniSwipeEnabled, setMiniSwipeEnabled] = useState<boolean>(
    initialPrefs.miniSwipeEnabled ?? true
  );
  const [lyricsGlowEnabled, setLyricsGlowEnabled] = useState<boolean>(
    initialPrefs.lyricsGlowEnabled
  );
  const [reelsAutoScroll, setReelsAutoScroll] = useState<boolean>(
    initialPrefs.reelsAutoScroll ?? true
  );
  const [reelsDurationSeconds, setReelsDurationSeconds] = useState<number>(
    initialPrefs.reelsDurationSeconds ?? 12
  );
  const [reelsAutoPauseMusic, setReelsAutoPauseMusic] = useState<boolean>(
    initialPrefs.reelsAutoPauseMusic ?? true
  );
  const [trackActivity, setTrackActivity] = useState<boolean>(
    initialPrefs.trackActivity ?? true
  );
  const [privateSession, setPrivateSession] = useState<boolean>(
    initialPrefs.privateSession ?? false
  );
  const [autoDownloadFavorites, setAutoDownloadFavorites] = useState<boolean>(
    initialPrefs.autoDownloadFavorites ?? false
  );

  useEffect(() => {
    if (!activeAccount || hydratedAccountIdRef.current !== activeAccount.id) return;
    const prevPrefs = readAccountJson(
      'preferences',
      getDefaultAppPreferences(),
      activeAccount.id
    );
    writeAccountJson(
      'preferences',
      {
        ...prevPrefs,
        autoplay,
        explicitAllowed,
        showLyricsEnabled,
        hapticsEnabled,
        lyricsGlowEnabled,
        crossfadeSeconds,
        gaplessPlayback,
        openPlayerOnTap,
        miniSwipeEnabled,
        reelsAutoScroll,
        reelsDurationSeconds,
        reelsAutoPauseMusic,
        trackActivity,
        privateSession,
        autoDownloadFavorites,
      },
      activeAccount.id
    );
  }, [
    autoplay,
    explicitAllowed,
    showLyricsEnabled,
    hapticsEnabled,
    lyricsGlowEnabled,
    crossfadeSeconds,
    gaplessPlayback,
    openPlayerOnTap,
    miniSwipeEnabled,
    reelsAutoScroll,
    reelsDurationSeconds,
    reelsAutoPauseMusic,
    trackActivity,
    privateSession,
    autoDownloadFavorites,
    activeAccount,
  ]);

  useEffect(() => {
    audioEngine.setTrackingEnabled(trackActivity && !privateSession);
  }, [trackActivity, privateSession]);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<
    number | null
  >(null);
  const [sleepTimerEndOfTrack, setSleepTimerEndOfTrack] =
    useState<boolean>(false);

  const [playerOpen, setPlayerOpen] = useState<boolean>(false);
  const [miniPlayerDismissed, setMiniPlayerDismissed] =
    useState<boolean>(false);
  const [miniDragX, setMiniDragX] = useState<number>(0);
  const [isDraggingMini, setIsDraggingMini] = useState<boolean>(false);
  const miniSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    swiped: boolean;
  } | null>(null);
  const justSwipedRef = useRef<boolean>(false);

  // Sliding thumb state for bottom navigation bar
  const navRef = useRef<HTMLElement>(null);
  const bottomDockRef = useRef<HTMLDivElement>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState<number>(176);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumbStyle, setThumbStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  const measureNavThumb = useCallback(() => {
    const activeEl = tabRefs.current[activeTab];
    if (!activeEl) return;
    setThumbStyle({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
      ready: true,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    measureNavThumb();
    const navEl = navRef.current;
    if (!navEl) return;
    const observer = new ResizeObserver(() => {
      measureNavThumb();
    });
    observer.observe(navEl);
    Object.values(tabRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    window.addEventListener('resize', measureNavThumb);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureNavThumb);
    };
  }, [measureNavThumb]);

  useLayoutEffect(() => {
    const dockEl = bottomDockRef.current;
    if (!dockEl) return;
    const updateHeight = () => {
      const h = Math.ceil(dockEl.getBoundingClientRect().height);
      if (h > 0) setBottomDockHeight(h);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dockEl);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const currentTrack = useMemo<ShowcaseTrack | null>(() => {
    if (!currentTrackId) return null;
    return tracksById[currentTrackId] ?? downloadedTracksMap[currentTrackId] ?? null;
  }, [tracksById, downloadedTracksMap, currentTrackId]);

  const effectiveDuration =
    audioDuration > 0 && Number.isFinite(audioDuration)
      ? audioDuration
      : currentTrack?.duration ?? 0;

  const collections = useMemo(
    () =>
      buildLiveCollections(
        audiusTrendingTracks,
        chartSongTracks,
        newReleaseTracks,
        forYouQuickPicks
      ),
    [audiusTrendingTracks, chartSongTracks, newReleaseTracks, forYouQuickPicks]
  );

  const forYouCards = useMemo<HomeShelfCard[]>(() => {
    const source =
      forYouQuickPicks.length > 0
        ? forYouQuickPicks
        : chartSongTracks.length > 0
        ? chartSongTracks
        : popularTracks;
    return source.slice(0, 14).map((t) => ({
      id: `fy-${t.id}`,
      title: t.title,
      artist: t.artist,
      subtitle: t.artist,
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
  }, [forYouQuickPicks, chartSongTracks, popularTracks]);

  const albumCards = useMemo<HomeShelfCard[]>(() => {
    const source = albumsForYou.length > 0 ? albumsForYou : knownAlbums;
    return source.slice(0, 14).map((alb) => ({
      id: `albcard-${alb.id}`,
      title: alb.title,
      artist: alb.artist,
      subtitle: alb.year ? `${alb.artist} · ${alb.year}` : alb.artist,
      badge: 'Album',
      artwork: alb.artwork,
      coverUrl: alb.coverUrl,
      albumId: alb.id,
      albumItem: alb,
    }));
  }, [albumsForYou, knownAlbums]);

  const trendingCards = useMemo<HomeShelfCard[]>(() => {
    const pool = mergeUniqueTracks(
      trendingShelfTracks,
      chartSongTracks,
      audiusTrendingTracks
    );
    return pool.slice(0, 14).map((t) => ({
      id: `trd-${t.id}`,
      title: t.title,
      artist: t.artist,
      subtitle: t.artist,
      badge: t.source === 'youtube' ? 'Viral' : 'Charting',
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
  }, [trendingShelfTracks, chartSongTracks, audiusTrendingTracks]);

  const newReleaseCards = useMemo<HomeShelfCard[]>(() => {
    const albumEntries: HomeShelfCard[] = newReleaseAlbums.slice(0, 6).map((alb) => ({
      id: `nra-${alb.id}`,
      title: alb.title,
      artist: alb.artist,
      subtitle: alb.artist,
      badge: 'New Album',
      artwork: alb.artwork,
      coverUrl: alb.coverUrl,
      albumId: alb.id,
      albumItem: alb,
    }));
    const trackEntries: HomeShelfCard[] = newReleaseTracks.slice(0, 12).map((t) => ({
      id: `nrt-${t.id}`,
      title: t.title,
      artist: t.artist,
      subtitle: t.artist,
      badge: 'New Drop',
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
    return [...albumEntries.slice(0, 4), ...trackEntries].slice(0, 16);
  }, [newReleaseAlbums, newReleaseTracks]);

  const exploreCards = useMemo<HomeShelfCard[]>(() => {
    const pool = mergeUniqueTracks(audiusTrendingTracks, popularTracks);
    return pool.slice(0, 12).map((t) => ({
      id: `exp-${t.id}`,
      title: t.title,
      artist: t.artist,
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
  }, [audiusTrendingTracks, popularTracks]);

  const pushRecentTrack = useCallback(
    (trackId: string) => {
      if (!trackActivity || privateSession) return;
      touchSyncSection('history', activeAccount?.id);
      setRecentTrackIds((prev) =>
        [trackId, ...prev.filter((id) => id !== trackId)].slice(0, 5)
      );
      setPlayHistory((prev) =>
        [{ trackId, playedAt: Date.now() }, ...prev].slice(0, 400)
      );
    },
    [trackActivity, privateSession, activeAccount?.id]
  );

  const isOffline = !isNetworkOnline || manualOfflineMode;
  const prevOfflineRef = useRef<boolean>(isOffline);

  const showOfflineNotice = useCallback((msg: string) => {
    setOfflineNotice(msg);
    if (offlineNoticeTimerRef.current) {
      window.clearTimeout(offlineNoticeTimerRef.current);
    }
    offlineNoticeTimerRef.current = window.setTimeout(() => {
      setOfflineNotice(null);
    }, 2800);
  }, []);

  const triggerOnlineBottomPopup = useCallback((label: string) => {
    setOnlinePopupLabel(label);
    setOnlinePopupVisible(true);
    if (onlinePopupTimerRef.current) {
      window.clearTimeout(onlinePopupTimerRef.current);
    }
    onlinePopupTimerRef.current = window.setTimeout(() => {
      setOnlinePopupVisible(false);
    }, 3200);
  }, []);

  useEffect(() => {
    if (!isOffline) {
      onlinePopupTimerRef.current = window.setTimeout(() => {
        setOnlinePopupVisible(false);
      }, 2800);
    }
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (offlineNoticeTimerRef.current) {
        window.clearTimeout(offlineNoticeTimerRef.current);
      }
      if (onlinePopupTimerRef.current) {
        window.clearTimeout(onlinePopupTimerRef.current);
      }
    };
  }, [isOffline]);

  // Automatically switch to Downloads when offline; notify on reconnect
  useEffect(() => {
    const wasOffline = prevOfflineRef.current;
    prevOfflineRef.current = isOffline;

    if (isOffline && !wasOffline) {
      setOnlinePopupVisible(false);
      setSelectedArtist(null);
      setSelectedAlbum(null);
      setSelectedCollection(null);
      setActiveTab('library');
      setRequestedLibrarySubTab({ tab: 'downloads', tick: Date.now() });

      const downloadedList = Object.values(downloadedTracksMap);
      if (downloadedList.length > 0) {
        const currentInDownloads = currentTrackId
          ? downloadedList.findIndex((t) => t.id === currentTrackId)
          : -1;
        queueManager.setScopedQueue({
          scope: 'downloads',
          contextId: 'downloads',
          tracks: downloadedList,
          startIndex: currentInDownloads >= 0 ? currentInDownloads : 0,
        });
      }

      if (!currentTrackId || !downloadedIds.has(currentTrackId)) {
        if (downloadedList.length > 0) {
          setCurrentTrackId(downloadedList[0].id);
          setCurrentTime(0);
          setMiniPlayerDismissed(false);
        } else {
          audioEngine.pause();
        }
      }
    } else if (!isOffline && wasOffline) {
      triggerOnlineBottomPopup('Back online');
      const qState = queueManager.getState();
      if (qState.tracks.length <= 1 && allFeedTracks.length > 0) {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: allFeedTracks,
          startIndex: 0,
        });
      }
    }
  }, [
    isOffline,
    downloadedIds,
    downloadedTracksMap,
    currentTrackId,
    triggerOnlineBottomPopup,
    allFeedTracks,
  ]);

  // Fetch Rich Live Discovery Feeds + YouTube Music-Style Dynamic Shelves
  const loadDiscoveryFeeds = useCallback(
    async (forceRefresh = false) => {
      if (!activeAccount || !onboardingCompleted) return;
      const seq = ++feedSeqRef.current;
      setFeedLoading(true);
      setFeedError(null);
      try {
        const musicProfile = loadUserMusicProfile();
        const topArtistsFromProfile = Array.from(
          new Set([
            ...musicProfile.followedArtists,
            ...(musicProfile.onboardingArtists ?? []),
            ...Object.entries(musicProfile.artistScores)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([name]) => name),
          ])
        )
          .filter((name) => isValidArtistName(name))
          .slice(0, 8);

        const topGenresFromProfile = Array.from(
          new Set([
            ...(musicProfile.onboardingGenres ?? []),
            ...Object.entries(musicProfile.genreScores)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([genre]) => genre),
          ])
        ).slice(0, 6);

        const [itunesRes, audiusRes, chartsRes, shelvesRes] =
          await Promise.allSettled([
            fetchRichItunesCatalog(),
            fetchAudiusTrending(20),
            fetchAppleCharts(),
            fetchYouTubeMusicHomeShelves({
              followedArtists: musicProfile.followedArtists,
              topArtists: topArtistsFromProfile,
              topGenres: topGenresFromProfile,
              forceRefresh,
            }),
          ]);
        if (seq !== feedSeqRef.current) return;

        const itunesTracks =
          itunesRes.status === 'fulfilled' ? itunesRes.value : [];
        const audiusTracks =
          audiusRes.status === 'fulfilled' ? audiusRes.value : [];
        const chartSongs =
          chartsRes.status === 'fulfilled' ? chartsRes.value.songTracks : [];
        const chartAlbums =
          chartsRes.status === 'fulfilled' ? chartsRes.value.albums : [];
        const shelves = shelvesRes.status === 'fulfilled' ? shelvesRes.value : null;

        if (shelves) {
          setForYouQuickPicks(shelves.forYouQuickPicks);
          setAlbumsForYou(shelves.albumsForYou);
          setTrendingShelfTracks(shelves.trendingTracks);
          setNewReleaseTracks(shelves.newReleaseTracks);
          setNewReleaseAlbums(shelves.newReleaseAlbums);
          lastFeedFetchedAtRef.current = shelves.fetchedAt || Date.now();
        } else {
          lastFeedFetchedAtRef.current = Date.now();
        }

        const blended = mergeUniqueTracks(
          chartSongs,
          shelves?.forYouQuickPicks ?? [],
          shelves?.trendingTracks ?? [],
          shelves?.newReleaseTracks ?? [],
          itunesTracks,
          audiusTracks
        );

        if (blended.length === 0) {
          setFeedError('Unable to reach live music services right now.');
          return;
        }

        registerTracks(blended);
        setAudiusTrendingTracks(audiusTracks);
        setChartSongTracks(chartSongs);
        setKnownAlbums([
          ...(shelves?.albumsForYou ?? []),
          ...(shelves?.newReleaseAlbums ?? []),
          ...chartAlbums,
        ]);
        setAllFeedTracks(blended);
        setPopularTracks(blended);

        if (queueManager.getState().tracks.length === 0) {
          queueManager.setScopedQueue({
            scope: 'general',
            contextId: null,
            tracks: blended,
            startIndex: 0,
          });
        }

        if (shelves && shelves.topArtists.length > 0) {
          setFeaturedArtists(shelves.topArtists);
        } else {
          const artistSeed = new Map<string, FeaturedArtistItem>();
          for (const t of blended) {
            if (artistSeed.size >= 10) break;
            const primaryArtist = t.artist.split(/,|feat\.|ft\.|&/i)[0].trim();
            if (
              !primaryArtist ||
              !isValidArtistName(primaryArtist) ||
              artistSeed.has(primaryArtist.toLowerCase())
            ) {
              continue;
            }
            artistSeed.set(primaryArtist.toLowerCase(), {
              artist: primaryArtist,
              subtitle: t.genre || t.category,
              artwork: pickGradientArtwork(primaryArtist),
              coverUrl: t.coverUrl,
            });
          }
          const initialArtists = Array.from(artistSeed.values());
          setFeaturedArtists(initialArtists);

        void Promise.allSettled(
          initialArtists.map((a) => fetchDeezerArtistJsonp(a.artist))
        ).then((results) => {
          if (seq !== feedSeqRef.current) return;
          setFeaturedArtists((prev) =>
            prev.map((item, idx) => {
              const res = results[idx];
              if (
                res &&
                res.status === 'fulfilled' &&
                res.value &&
                res.value.photoUrl
              ) {
                return {
                  ...item,
                  coverUrl: res.value.photoUrl,
                };
              }
              return item;
            })
          );
        });
      }
    } catch (err) {
      if (seq !== feedSeqRef.current) return;
      setFeedError(
        err instanceof Error
          ? err.message
          : 'Failed to load live music feeds.'
      );
      } finally {
        if (seq === feedSeqRef.current) {
          setFeedLoading(false);
        }
      }
    },
    [activeAccount, onboardingCompleted, registerTracks]
  );

  const silentRefreshTimeSyncedFeeds = useCallback(async () => {
    if (isOffline) return;
    try {
      const musicProfile = loadUserMusicProfile();
      const topArtistsFromProfile = Object.entries(musicProfile.artistScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name]) => name);
      const topGenresFromProfile = Object.entries(musicProfile.genreScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([genre]) => genre);

      const [freshReleasesRes, freshShelvesRes] = await Promise.allSettled([
        getLiveNewReleases({
          followedArtists: musicProfile.followedArtists,
          topGenres: topGenresFromProfile,
          forceRefresh: true,
        }),
        fetchYouTubeMusicHomeShelves({
          followedArtists: musicProfile.followedArtists,
          topArtists: topArtistsFromProfile,
          topGenres: topGenresFromProfile,
          forceRefresh: true,
        }),
      ]);

      if (freshReleasesRes.status === 'fulfilled') {
        const nr = freshReleasesRes.value;
        registerTracks(nr.tracks);
        if (nr.tracks.length > 0) setNewReleaseTracks(nr.tracks);
        if (nr.albums.length > 0) setNewReleaseAlbums(nr.albums);
      }

      if (freshShelvesRes.status === 'fulfilled') {
        const shelves = freshShelvesRes.value;
        registerTracks(
          mergeUniqueTracks(
            shelves.forYouQuickPicks,
            shelves.trendingTracks,
            shelves.newReleaseTracks
          )
        );
        if (shelves.forYouQuickPicks.length > 0) {
          setForYouQuickPicks(shelves.forYouQuickPicks);
        }
        if (shelves.albumsForYou.length > 0) {
          setAlbumsForYou(shelves.albumsForYou);
        }
        if (shelves.trendingTracks.length > 0) {
          setTrendingShelfTracks(shelves.trendingTracks);
        }
        if (shelves.topArtists.length > 0) {
          setFeaturedArtists(shelves.topArtists);
        }
      }
      lastFeedFetchedAtRef.current = Date.now();
    } catch {
      // keep existing live feed on background refresh failure
    }
  }, [isOffline, registerTracks]);

  const refreshPersonalizedReels = useCallback(async () => {
    if (isOffline || !activeAccount || !onboardingCompleted) return;
    setRefreshingReels(true);
    try {
      const profile = loadUserMusicProfile();
      const seeds = getPersonalizedSeedTerms(profile);
      const freshPool = await fetchPersonalizedReelsPool(
        seeds,
        profile.recentlySeenTrackIds
      );
      if (freshPool.length > 0) {
        registerTracks(freshPool);
        setReelsTracks(freshPool);
      }
    } finally {
      setRefreshingReels(false);
    }
  }, [activeAccount, isOffline, onboardingCompleted, registerTracks]);

  const loadMorePersonalizedReels = useCallback(
    async (excludeIds: string[]): Promise<ShowcaseTrack[]> => {
      if (isOffline) return [];
      const profile = loadUserMusicProfile();
      const seeds = getPersonalizedSeedTerms(profile);
      const mergedExclude = Array.from(
        new Set([...excludeIds, ...profile.recentlySeenTrackIds])
      );
      const freshPool = await fetchPersonalizedReelsPool(seeds, mergedExclude);
      if (freshPool.length > 0) {
        registerTracks(freshPool);
      }
      return freshPool;
    },
    [isOffline, registerTracks]
  );

  const handleSelectCategory = useCallback(
    async (category: string) => {
      setSelectedCategory(category);
      if (category === 'All') {
        if (allFeedTracks.length > 0) {
          setPopularTracks(allFeedTracks);
          setFeedError(null);
          setFeedLoading(false);
        } else {
          await loadDiscoveryFeeds();
        }
        return;
      }

      const seq = ++feedSeqRef.current;
      setFeedLoading(true);
      setFeedError(null);
      try {
        const musicProfile = loadUserMusicProfile();
        const preferredArtists = new Set(
          [
            ...musicProfile.followedArtists,
            ...(musicProfile.onboardingArtists ?? []),
          ].map((a) => a.toLowerCase())
        );

        const [ytRes, realRes, itunesRes, audiusRes] = await Promise.allSettled([
          searchFreeYouTubeSongs(`${category} music`, {
            maxResults: 18,
            genreLabel: category,
          }),
          searchRealSongs(category, 40),
          searchItunesTracks(category, 50),
          searchAudiusTracks(category, 25),
        ]);
        if (seq !== feedSeqRef.current) return;

        const ytTracks = ytRes.status === 'fulfilled' ? ytRes.value : [];
        const realTracks =
          realRes.status === 'fulfilled' ? realRes.value : [];
        const itunesTracks =
          itunesRes.status === 'fulfilled' ? itunesRes.value : [];
        const audiusTracks =
          audiusRes.status === 'fulfilled' ? audiusRes.value : [];
        const mergedRaw = mergeUniqueTracks(
          ytTracks,
          realTracks,
          itunesTracks,
          audiusTracks
        );
        const filteredOfficial = mergedRaw.filter((t) =>
          isOfficialArtistTrack(t, category)
        );
        const candidates =
          filteredOfficial.length > 0 ? filteredOfficial : mergedRaw;

        const ranked = [...candidates].sort((a, b) => {
          const aFav = preferredArtists.has(
            a.artist.split(/,|feat\.|ft\.|&/i)[0].trim().toLowerCase()
          )
            ? 1
            : 0;
          const bFav = preferredArtists.has(
            b.artist.split(/,|feat\.|ft\.|&/i)[0].trim().toLowerCase()
          )
            ? 1
            : 0;
          return bFav - aFav;
        });

        registerTracks(ranked);
        setPopularTracks(ranked);
      } catch (err) {
        if (seq !== feedSeqRef.current) return;
        setFeedError(
          err instanceof Error
            ? err.message
            : `Failed to fetch ${category} tracks.`
        );
      } finally {
        if (seq === feedSeqRef.current) {
          setFeedLoading(false);
        }
      }
    },
    [allFeedTracks, loadDiscoveryFeeds, registerTracks]
  );

  useEffect(() => {
    if (!activeAccount || !onboardingCompleted) return;
    const shouldForce = forceNextFeedRefreshRef.current;
    forceNextFeedRefreshRef.current = false;
    void loadDiscoveryFeeds(shouldForce);
    void refreshPersonalizedReels();
  }, [
    activeAccount?.id,
    onboardingCompleted,
    loadDiscoveryFeeds,
    refreshPersonalizedReels,
  ]);

  // Silently re-sync live Trending & New Releases when returning after 30+ minutes
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        !isOffline &&
        Date.now() - lastFeedFetchedAtRef.current >= LIVE_FEED_TTL_MS
      ) {
        void silentRefreshTimeSyncedFeeds();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOffline, silentRefreshTimeSyncedFeeds]);

  // Automatic Background Full-Track Upgrade Resolver
  const ensureFullTrack = useCallback(
    async (track: ShowcaseTrack): Promise<ShowcaseTrack> => {
      if (track.streamStatus === 'full' && (track.youtubeVideoId || track.streamUrl)) {
        return track;
      }
      if (isOffline) return track;

      const ytUpgraded = await resolveFullYouTubeTrack(track);
      const resolved =
        ytUpgraded.youtubeVideoId || ytUpgraded.streamStatus === 'full'
          ? ytUpgraded
          : await resolveFullAudiusTrack(ytUpgraded);
      registerTracks([resolved]);
      queueManager.syncTrackMetadata(resolved);
      setDownloadedTracksMap((prev) =>
        prev[resolved.id] ? { ...prev, [resolved.id]: resolved } : prev
      );
      return resolved;
    },
    [isOffline, registerTracks]
  );

  const fetchAiRecommendations = useCallback(async () => {
    const liveCatalog = Object.values(tracksByIdRef.current)
      .slice(0, 60)
      .map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        category: t.category,
      }));
    if (isOffline || !aiSettings.recommendations || liveCatalog.length === 0) {
      return;
    }

    setAiRecLoading(true);
    setAiRecError(null);
    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentTrackIds,
          favoriteIds: Array.from(favoriteIds),
          discoveryLevel: aiSettings.discoveryLevel,
          catalog: liveCatalog,
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setAiRecError('AI recommendations require the hosted backend server.');
        return;
      }
      const data = (await response.json()) as {
        headline?: string;
        recommendations?: AiRecommendationEntry[];
        error?: string;
      };
      if (!response.ok) {
        setAiRecError(data.error ?? 'Failed to fetch AI recommendations.');
        return;
      }
      setAiRecHeadline(data.headline ?? 'AI Recommendations');
      setAiRecommendations(
        Array.isArray(data.recommendations) ? data.recommendations : []
      );
    } catch (error) {
      setAiRecError(
        error instanceof Error
          ? error.message
          : 'Unable to reach AI recommendations service.'
      );
    } finally {
      setAiRecLoading(false);
    }
  }, [
    isOffline,
    aiSettings.recommendations,
    aiSettings.discoveryLevel,
    recentTrackIds,
    favoriteIds,
  ]);

  const lastFetchedDiscoveryRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !aiSettings.recommendations ||
      isOffline ||
      allFeedTracks.length === 0
    ) {
      return;
    }
    const key = `${aiSettings.discoveryLevel}::${allFeedTracks.length > 0}`;
    if (lastFetchedDiscoveryRef.current === key) return;
    lastFetchedDiscoveryRef.current = key;
    void fetchAiRecommendations();
  }, [
    aiSettings.recommendations,
    aiSettings.discoveryLevel,
    isOffline,
    allFeedTracks.length,
    fetchAiRecommendations,
  ]);

  const runAiSmartShuffle = useCallback(
    async (candidateIds: string[], startTrackId?: string) => {
      const liveCatalog = Object.values(tracksByIdRef.current)
        .slice(0, 60)
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          category: t.category,
        }));
      if (
        isOffline ||
        !aiSettings.smartShuffle ||
        candidateIds.length === 0 ||
        liveCatalog.length === 0
      ) {
        return;
      }
      setAiShuffleLoading(true);
      setAiShuffleError(null);
      try {
        const response = await fetch('/api/ai/smart-shuffle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentTrackId: startTrackId ?? currentTrackId,
            seedTrackIds: candidateIds.slice(0, 5),
            candidateTrackIds: candidateIds,
            favoriteIds: Array.from(favoriteIds),
            recentTrackIds,
            discoveryLevel: aiSettings.discoveryLevel,
            catalog: liveCatalog,
          }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setAiShuffleError('AI Smart Shuffle requires the hosted backend server.');
          setAiShuffleNote(null);
          return;
        }
        const data = (await response.json()) as {
          orderedTrackIds?: string[];
          note?: string;
          error?: string;
        };
        if (!response.ok) {
          setAiShuffleError(data.error ?? 'AI Smart Shuffle failed.');
          setAiShuffleNote(null);
          return;
        }
        if (
          Array.isArray(data.orderedTrackIds) &&
          data.orderedTrackIds.length > 0
        ) {
          const orderedTracks = data.orderedTrackIds
            .map((id) => tracksByIdRef.current[id] ?? downloadedTracksMap[id])
            .filter((t): t is ShowcaseTrack => Boolean(t));
          if (orderedTracks.length > 0) {
            queueManager.replaceUpcoming(orderedTracks);
          }
          setAiShuffleNote(data.note ?? 'AI Smart Shuffle sequenced your queue');
        }
      } catch (error) {
        setAiShuffleError(
          error instanceof Error
            ? error.message
            : 'Unable to reach AI Smart Shuffle service.'
        );
      } finally {
        setAiShuffleLoading(false);
      }
    },
    [
      isOffline,
      aiSettings.smartShuffle,
      aiSettings.discoveryLevel,
      currentTrackId,
      favoriteIds,
      recentTrackIds,
    ]
  );

  const playResolvedTrack = useCallback(
    (track: ShowcaseTrack, seekTo?: number, openPlayer = false) => {
      registerTracks([track]);
      userInteractedTrackRef.current = true;
      activeTrackIdRef.current = track.id;
      setCurrentTrackId(track.id);
      setAudioError(null);
      setMiniPlayerDismissed(false);
      pushRecentTrack(track.id);

      if (trackActivity && !privateSession) {
        const updatedProfile = recordTrackInteraction(track, 2);
        setHomeCategories(getRankedCategories(updatedProfile));
      }

      if (openPlayer && openPlayerOnTap) {
        setPlayerOpen(true);
      }

      setAudioDuration(track.duration);
      setCurrentTime(seekTo ?? 0);
      void audioEngine.playTrack(track, seekTo ?? 0);

      // Background metadata hydration for smoother instant skips
      if (!track.youtubeVideoId && !isOffline) {
        void ensureFullTrack(track);
      }
    },
    [
      registerTracks,
      pushRecentTrack,
      trackActivity,
      privateSession,
      openPlayerOnTap,
      isOffline,
      ensureFullTrack,
    ]
  );

  // Sync unified audioEngine snapshots & scoped queueManager state
  useEffect(() => {
    const unsubAudio = audioEngine.subscribe((snap) => {
      setIsPlaying(snap.isPlaying);
      setIsBuffering(snap.isBuffering);
      setCurrentTime(snap.currentTime);
      if (snap.duration > 0) {
        setAudioDuration(snap.duration);
      }
      setAudioError(snap.error);
    });

    const unsubQueue = queueManager.subscribe((qState) => {
      setQueueTrackIds(qState.tracks.map((t) => t.id));
      setShuffle(qState.shuffle);
      setRepeatMode(qState.repeatMode);
    });

    return () => {
      unsubAudio();
      unsubQueue();
    };
  }, []);

  // Preload upcoming track in active scoped queue for gapless transitions
  useEffect(() => {
    if (isOffline) return;
    const st = queueManager.getState();
    const upcoming = st.tracks[st.currentIndex + 1];
    if (upcoming) {
      audioEngine.preloadTrack(upcoming);
    }
  }, [currentTrackId, queueTrackIds, isOffline]);

  const sleepTimerEndRef = useRef(sleepTimerEndOfTrack);
  useEffect(() => {
    sleepTimerEndRef.current = sleepTimerEndOfTrack;
  }, [sleepTimerEndOfTrack]);

  useEffect(() => {
    audioEngine.setOnEnded(() => {
      if (sleepTimerEndRef.current) {
        setSleepTimerEndOfTrack(false);
        audioEngine.pause();
        return;
      }

      const next = queueManager.resolveNextTrack(allFeedTracks, false);
      if (next) {
        if (isOffline && !downloadedIds.has(next.id)) {
          audioEngine.pause();
          return;
        }
        playResolvedTrack(next, 0, false);
        return;
      }

      // Strictly respect Album / Playlist / Downloads queue bounds
      const currentScope = queueManager.getState().scope;
      if (currentScope !== 'general' || !autoplay) {
        audioEngine.pause();
        return;
      }

      // Optional general discovery autoplay when queue ends
      const nextFallback = allFeedTracks.find((t) => t.id !== activeTrackIdRef.current);
      if (nextFallback && !isOffline) {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: allFeedTracks,
          startIndex: allFeedTracks.findIndex((t) => t.id === nextFallback.id),
        });
        playResolvedTrack(nextFallback, 0, false);
      } else {
        audioEngine.pause();
      }
    });

    return () => {
      audioEngine.setOnEnded(null);
    };
  }, [allFeedTracks, autoplay, downloadedIds, isOffline, playResolvedTrack]);

  const handleTogglePlay = useCallback(() => {
    if (!currentTrackId) {
      const firstTrack = allFeedTracks[0] ?? Object.values(tracksByIdRef.current)[0];
      if (firstTrack) {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: [
            firstTrack,
            ...allFeedTracks.filter((t) => t.id !== firstTrack.id),
          ],
          startIndex: 0,
        });
        playResolvedTrack(firstTrack, 0, false);
      }
      return;
    }

    if (isOffline && !downloadedIds.has(currentTrackId)) {
      const firstDownloaded = Array.from(downloadedIds)[0];
      if (firstDownloaded) {
        const found =
          tracksByIdRef.current[firstDownloaded] ??
          downloadedTracksMap[firstDownloaded];
        if (found) {
          queueManager.setScopedQueue({
            scope: 'downloads',
            contextId: 'downloads',
            tracks: Object.values(downloadedTracksMap),
            startIndex: 0,
          });
          playResolvedTrack(found, 0, false);
        }
      } else {
        showOfflineNotice('No downloaded tracks available offline');
      }
      return;
    }

    const track =
      tracksByIdRef.current[currentTrackId] ?? downloadedTracksMap[currentTrackId];
    if (!track) return;

    const snap = audioEngine.getSnapshot();
    if (snap.trackId !== track.id) {
      playResolvedTrack(track, currentTime, false);
      return;
    }

    userInteractedTrackRef.current = true;
    setMiniPlayerDismissed(false);
    audioEngine.togglePlay();
  }, [
    isOffline,
    downloadedIds,
    downloadedTracksMap,
    currentTrackId,
    currentTime,
    allFeedTracks,
    playResolvedTrack,
    showOfflineNotice,
  ]);

  const playScopedTrackList = useCallback(
    (
      scope: QueueScope,
      contextId: string | null,
      tracks: ShowcaseTrack[],
      startIndex = 0,
      openPlayer = true
    ) => {
      const filtered = isOffline
        ? tracks.filter((t) => downloadedIds.has(t.id))
        : tracks;
      if (filtered.length === 0) {
        if (isOffline) {
          showOfflineNotice('Unavailable offline — saved downloads only');
        }
        return;
      }

      registerTracks(filtered);
      const requestedTrack = tracks[startIndex];
      const mappedIdx = requestedTrack
        ? Math.max(0, filtered.findIndex((t) => t.id === requestedTrack.id))
        : Math.max(0, Math.min(startIndex, filtered.length - 1));

      const chosen = queueManager.setScopedQueue({
        scope,
        contextId,
        tracks: filtered,
        startIndex: mappedIdx,
      });

      if (chosen) {
        playResolvedTrack(chosen, 0, openPlayer);
      }
    },
    [
      isOffline,
      downloadedIds,
      registerTracks,
      showOfflineNotice,
      playResolvedTrack,
    ]
  );

  const handleSelectTrack = useCallback(
    (
      trackOrId: string | ShowcaseTrack,
      openPlayer = false,
      seekTo?: number
    ) => {
      const targetTrack =
        typeof trackOrId === 'string'
          ? tracksByIdRef.current[trackOrId] ?? downloadedTracksMap[trackOrId]
          : trackOrId;
      if (!targetTrack) return;

      if (isOffline && !downloadedIds.has(targetTrack.id)) {
        showOfflineNotice('Unavailable offline — saved downloads only');
        return;
      }

      const isSameTrack = targetTrack.id === currentTrackId;
      const snap = audioEngine.getSnapshot();
      if (
        isSameTrack &&
        seekTo === undefined &&
        isPlaying &&
        snap.trackId === targetTrack.id
      ) {
        if (openPlayer && openPlayerOnTap) {
          setPlayerOpen(true);
        }
        return;
      }

      const currentQueue = queueManager.getState();
      if (currentQueue.tracks.some((t) => t.id === targetTrack.id)) {
        queueManager.setCurrentTrackById(targetTrack.id);
      } else {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: [
            targetTrack,
            ...allFeedTracks.filter((t) => t.id !== targetTrack.id),
          ],
          startIndex: 0,
        });
      }

      playResolvedTrack(targetTrack, seekTo, openPlayer);
    },
    [
      currentTrackId,
      isPlaying,
      openPlayerOnTap,
      isOffline,
      downloadedIds,
      downloadedTracksMap,
      allFeedTracks,
      showOfflineNotice,
      playResolvedTrack,
    ]
  );

  const handleSeek = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(0, Math.min(effectiveDuration, nextTime));
      audioEngine.seekTo(clamped);
      setCurrentTime(clamped);
    },
    [effectiveDuration]
  );

  const handleOpenArtist = useCallback((artistName: string) => {
    setPlayerOpen(false);
    setSelectedCollection(null);
    setSelectedAlbum(null);
    setSelectedShelf(null);
    setSelectedArtist(artistName);
  }, []);

  const handleShuffleTrackIds = useCallback(
    (trackIds: string[]) => {
      const playableIds = isOffline
        ? trackIds.filter((id) => downloadedIds.has(id))
        : trackIds;
      if (playableIds.length === 0) {
        if (isOffline) {
          showOfflineNotice('Unavailable offline — saved downloads only');
        }
        return;
      }

      const resolvedTracks = playableIds
        .map((id) => tracksByIdRef.current[id] ?? downloadedTracksMap[id])
        .filter((t): t is ShowcaseTrack => Boolean(t));
      if (resolvedTracks.length === 0) return;

      const randomIdx = Math.floor(Math.random() * resolvedTracks.length);
      const target = resolvedTracks[randomIdx];

      queueManager.setScopedQueue({
        scope: 'general',
        contextId: null,
        tracks: resolvedTracks,
        startIndex: randomIdx,
      });
      queueManager.setShuffle(true);

      if (target) {
        playResolvedTrack(target, 0, false);
      }
      if (aiSettings.smartShuffle && !isOffline) {
        void runAiSmartShuffle(playableIds, target?.id);
      }
    },
    [
      isOffline,
      downloadedIds,
      downloadedTracksMap,
      showOfflineNotice,
      aiSettings.smartShuffle,
      runAiSmartShuffle,
      playResolvedTrack,
    ]
  );

  const handleToggleShuffle = useCallback(() => {
    const next = queueManager.toggleShuffle();
    if (next && aiSettings.smartShuffle && !isOffline) {
      const qTracks = queueManager.getState().tracks;
      const candidateIds =
        qTracks.length > 1
          ? qTracks.map((t) => t.id)
          : allFeedTracks.map((t) => t.id);
      void runAiSmartShuffle(candidateIds, currentTrackId ?? undefined);
    } else if (!next) {
      setAiShuffleNote(null);
      setAiShuffleError(null);
    }
  }, [
    aiSettings.smartShuffle,
    isOffline,
    allFeedTracks,
    currentTrackId,
    runAiSmartShuffle,
  ]);

  const handleNextTrack = useCallback(() => {
    const next = queueManager.getNextTrack(true);
    if (!next) {
      audioEngine.pause();
      return;
    }
    if (isOffline && !downloadedIds.has(next.id)) {
      audioEngine.pause();
      return;
    }
    playResolvedTrack(next, 0, false);
  }, [isOffline, downloadedIds, playResolvedTrack]);

  const handlePrevTrack = useCallback(() => {
    const res = queueManager.getPreviousTrack(currentTime);
    if (res.action === 'restart') {
      handleSeek(0);
      return;
    }
    if (res.action === 'track' && res.track) {
      if (isOffline && !downloadedIds.has(res.track.id)) {
        audioEngine.pause();
        return;
      }
      playResolvedTrack(res.track, 0, false);
    }
  }, [currentTime, handleSeek, isOffline, downloadedIds, playResolvedTrack]);

  // Wire lock-screen / headset MediaSession skip controls & intent-aware queue taste context
  useEffect(() => {
    audioEngine.setNavigationCallbacks({
      onPrevious: handlePrevTrack,
      onNext: handleNextTrack,
    });
  }, [handlePrevTrack, handleNextTrack]);

  useEffect(() => {
    const profile = loadUserMusicProfile();
    queueManager.setTasteContext({
      topGenres: Array.from(
        new Set([
          ...(profile.onboardingGenres ?? []),
          ...homeCategories.filter((c) => c !== 'All'),
        ])
      ).slice(0, 8),
      followedArtists: Array.from(
        new Set([...profile.followedArtists, ...(profile.onboardingArtists ?? [])])
      ),
      likedTrackIds: Array.from(favoriteIds),
    });
  }, [activeAccount?.id, onboardingCompleted, homeCategories, favoriteIds]);

  const handleMoveQueueTrack = useCallback(
    (fromIndex: number, toIndex: number) => {
      const qTracks = queueManager.getState().tracks;
      const dragTrack = qTracks[fromIndex];
      const targetTrack = qTracks[toIndex];
      if (!dragTrack || !targetTrack) return;
      queueManager.reorderUpcomingById(dragTrack.id, targetTrack.id);
    },
    []
  );

  const handleRemoveFromQueue = useCallback((index: number) => {
    const qTracks = queueManager.getState().tracks;
    const target = qTracks[index];
    if (target) {
      queueManager.removeTrackById(target.id);
    }
  }, []);

  const handleAddToQueue = useCallback(
    (trackOrId: string | ShowcaseTrack) => {
      const track =
        typeof trackOrId === 'string'
          ? tracksByIdRef.current[trackOrId] ?? downloadedTracksMap[trackOrId]
          : trackOrId;
      if (track) {
        registerTracks([track]);
        queueManager.addToQueue(track);
      }
    },
    [downloadedTracksMap, registerTracks]
  );

  const handleClearUpcoming = useCallback(() => {
    queueManager.clearUpcoming();
  }, []);

  const handleResetQueue = useCallback(() => {
    if (allFeedTracks.length === 0) return;
    const idx = currentTrackId
      ? Math.max(0, allFeedTracks.findIndex((t) => t.id === currentTrackId))
      : 0;
    queueManager.setScopedQueue({
      scope: 'general',
      contextId: null,
      tracks: allFeedTracks,
      startIndex: idx,
    });
  }, [allFeedTracks, currentTrackId]);

  const handleToggleDownload = useCallback(
    async (trackOrId: string | ShowcaseTrack) => {
      const track =
        typeof trackOrId === 'string'
          ? tracksByIdRef.current[trackOrId] ?? downloadedTracksMap[trackOrId]
          : trackOrId;
      if (!track) return;

      const accountScopeUid = getCanonicalAccountScopeId(activeAccount);
      if (downloadedTracksMap[track.id]) {
        setDownloadedTracksMap((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
        void removeOfflineTrackBlob(track.id, accountScopeUid);
        return;
      }

      const resolved = await ensureFullTrack(track);
      setDownloadedTracksMap((prev) => ({ ...prev, [resolved.id]: resolved }));
      void saveTrackOffline(resolved, accountScopeUid);
    },
    [activeAccount, downloadedTracksMap, ensureFullTrack]
  );

  const handleToggleFavorite = useCallback(
    (trackId: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        const adding = !next.has(trackId);
        recordFavoriteMutation(trackId, adding, activeAccount?.id);
        if (adding) {
          next.add(trackId);
          const target = tracksByIdRef.current[trackId] ?? downloadedTracksMap[trackId];
          if (target && trackActivity && !privateSession) {
            const updatedProf = recordTrackInteraction(target, 3);
            setHomeCategories(getRankedCategories(updatedProf));
          }
          if (autoDownloadFavorites && target) {
            void handleToggleDownload(target);
          }
        } else {
          next.delete(trackId);
        }
        return next;
      });
    },
    [
      activeAccount?.id,
      autoDownloadFavorites,
      downloadedTracksMap,
      handleToggleDownload,
      privateSession,
      trackActivity,
    ]
  );

  const handleCreatePlaylist = useCallback(
    (
      name: string,
      description: string,
      trackIds: string[],
      cover?: { coverArtwork?: ArtworkStyle; coverImageUrl?: string }
    ): UserPlaylist => {
      touchSyncSection('playlists', activeAccount?.id);
      const created: UserPlaylist = {
        id: `pl-${Date.now()}`,
        name,
        description,
        trackIds,
        updatedAt: 'Updated just now',
        updatedAtMs: Date.now(),
        coverArtwork: cover?.coverArtwork,
        coverImageUrl: cover?.coverImageUrl,
      };
      setPlaylists((prev) => [created, ...prev]);
      return created;
    },
    [activeAccount?.id]
  );

  const handleUpdatePlaylist = useCallback(
    (
      playlistId: string,
      updates: {
        name?: string;
        description?: string;
        trackIds?: string[];
        coverArtwork?: ArtworkStyle;
        coverImageUrl?: string;
      }
    ) => {
      touchSyncSection('playlists', activeAccount?.id);
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? {
                ...pl,
                ...updates,
                updatedAt: 'Updated just now',
                updatedAtMs: Date.now(),
              }
            : pl
        )
      );
    },
    [activeAccount?.id]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      recordPlaylistDeletion(playlistId, activeAccount?.id);
      setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
    },
    [activeAccount?.id]
  );

  const handleAddTrackToPlaylist = useCallback(
    async (playlistId: string, trackOrId: string | ShowcaseTrack) => {
      const track =
        typeof trackOrId === 'string'
          ? tracksByIdRef.current[trackOrId] ?? downloadedTracksMap[trackOrId]
          : trackOrId;
      if (!track) return;

      const resolved = await ensureFullTrack(track);
      touchSyncSection('playlists', activeAccount?.id);
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId && !pl.trackIds.includes(resolved.id)
            ? {
                ...pl,
                trackIds: [...pl.trackIds, resolved.id],
                updatedAt: 'Updated just now',
                updatedAtMs: Date.now(),
              }
            : pl
        )
      );
    },
    [activeAccount?.id, downloadedTracksMap, ensureFullTrack]
  );

  const handleCycleRepeat = useCallback(() => {
    queueManager.cycleRepeatMode();
  }, []);

  // Live 1s Sleep Timer countdown
  useEffect(() => {
    if (
      sleepTimerRemainingSeconds === null ||
      sleepTimerRemainingSeconds <= 0 ||
      !isPlaying
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setSleepTimerRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          audioEngine.pause();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepTimerRemainingSeconds, isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (e.key === 'Escape') {
        if (trackInfoModalTrack) setTrackInfoModalTrack(null);
        else if (playerOpen) setPlayerOpen(false);
        else if (selectedAlbum) setSelectedAlbum(null);
        else if (selectedArtist) setSelectedArtist(null);
        else if (selectedCollection) setSelectedCollection(null);
        else if (selectedShelf) setSelectedShelf(null);
        return;
      }
      if (e.code === 'Space' && !isInput && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    trackInfoModalTrack,
    playerOpen,
    selectedAlbum,
    selectedArtist,
    selectedCollection,
    selectedShelf,
    handleTogglePlay,
  ]);

  // Complete per-account isolation, teardown & hydration
  const hydrateStateForAccount = useCallback(
    (
      acct: ActiveAccountIdentity | null,
      options?: { preserveNavigation?: boolean }
    ) => {
      hydratedAccountIdRef.current = null;
      suppressNextAutoPushRef.current = true;
      const prevScopeUid = getActiveUserId();
      const acctId = acct?.id ?? null;
      const nextScopeUid = getCanonicalAccountScopeId(acct);

      // Tear down previous account listeners/playback/stats cleanly when switching accounts
      if (!options?.preserveNavigation) {
        deviceHandoff.stop();
        if (prevScopeUid && prevScopeUid !== nextScopeUid) {
          clearAccountSessionState(prevScopeUid);
        } else if (!nextScopeUid) {
          clearAccountSessionState(prevScopeUid);
        }
        resetActivityStatsMemory();
        clearMusicFeedCaches();
        setAccountDevices([]);
        setSharedPlayback(null);
        setAllFeedTracks([]);
        setPopularTracks([]);
        setAudiusTrendingTracks([]);
        setChartSongTracks([]);
        setForYouQuickPicks([]);
        setAlbumsForYou([]);
        setTrendingShelfTracks([]);
        setNewReleaseTracks([]);
        setNewReleaseAlbums([]);
        setKnownAlbums([]);
        setFeaturedArtists([]);
        setReelsTracks([]);
        setAiRecommendations([]);
        setAiRecHeadline(null);
      }

      setActiveUserId(nextScopeUid);
      audioEngine.setCurrentUid(nextScopeUid);

      if (!acct || !acctId) {
        audioEngine.resetForAccountSwitch();
        queueManager.reset();
        setFavoriteIds(new Set());
        setRecentTrackIds([]);
        setPlayHistory([]);
        setPlaylists([]);
        setDownloadedTracksMap({});
        userInteractedTrackRef.current = false;
        activeTrackIdRef.current = null;
        setCurrentTrackId(null);
        setCurrentTime(0);
        setAudioDuration(0);
        setPlayerOpen(false);
        setSelectedCollection(null);
        setSelectedAlbum(null);
        setSelectedArtist(null);
        setSelectedShelf(null);
        setActiveTab('home');
        return;
      }

      const nextProfile = readAccountJson('profile', getDefaultProfile(acct), acctId);
      setDisplayName(nextProfile.displayName || 'Listener');
      setHandle(nextProfile.handle || '@listener');
      setEmail(acct.provider === 'guest' ? '' : nextProfile.email || '');
      setProfileImageUrl(nextProfile.profileImageUrl ?? null);
      setAvatarPreset(nextProfile.avatarPreset ?? 'studio');

      const nextPrefs = readAccountJson('preferences', getDefaultAppPreferences(), acctId);
      setAutoplay(nextPrefs.autoplay);
      setShowLyricsEnabled(nextPrefs.showLyricsEnabled);
      setExplicitAllowed(nextPrefs.explicitAllowed);
      setCrossfadeSeconds(nextPrefs.crossfadeSeconds ?? 4);
      setGaplessPlayback(nextPrefs.gaplessPlayback ?? true);
      setOpenPlayerOnTap(nextPrefs.openPlayerOnTap ?? true);
      setHapticsEnabled(nextPrefs.hapticsEnabled);
      setMiniSwipeEnabled(nextPrefs.miniSwipeEnabled ?? true);
      setLyricsGlowEnabled(nextPrefs.lyricsGlowEnabled);
      setReelsAutoScroll(nextPrefs.reelsAutoScroll ?? true);
      setReelsDurationSeconds(nextPrefs.reelsDurationSeconds ?? 12);
      setReelsAutoPauseMusic(nextPrefs.reelsAutoPauseMusic ?? true);
      setTrackActivity(nextPrefs.trackActivity ?? true);
      setPrivateSession(nextPrefs.privateSession ?? false);
      setAutoDownloadFavorites(nextPrefs.autoDownloadFavorites ?? false);

      const nextAiDefaults = getDefaultAiSettings();
      const nextAi = readAccountJson<
        Partial<{
          smartShuffle: boolean;
          recommendations: boolean;
          discoveryLevel: AiDiscoveryLevel;
        }>
      >('aiSettings', {}, acctId);
      setAiSettings({
        smartShuffle: nextAi.smartShuffle ?? nextAiDefaults.smartShuffle,
        recommendations: nextAi.recommendations ?? nextAiDefaults.recommendations,
        discoveryLevel:
          (nextAi.discoveryLevel as AiDiscoveryLevel) ??
          (nextAiDefaults.discoveryLevel as AiDiscoveryLevel),
      });

      const nextEq = readAccountJson<{ preset?: EqPreset; bands?: number[] }>(
        'eqState',
        {},
        acctId
      );
      setEqState(
        nextEq.preset && Array.isArray(nextEq.bands) && nextEq.bands.length === 5
          ? { preset: nextEq.preset, bands: nextEq.bands }
          : { preset: 'Flat', bands: [...EQ_PRESET_VALUES.Flat] }
      );

      const nextDownloads = readAccountJson<Record<string, ShowcaseTrack>>(
        'downloadedTracksMap',
        {},
        acctId
      );
      setDownloadedTracksMap(
        nextDownloads && typeof nextDownloads === 'object' ? nextDownloads : {}
      );

      const nextFavs = readAccountJson<string[]>('favorites', [], acctId);
      setFavoriteIds(new Set(Array.isArray(nextFavs) ? nextFavs : []));

      const nextRecents = readAccountJson<string[]>('recentIds', [], acctId);
      setRecentTrackIds(Array.isArray(nextRecents) ? nextRecents.slice(0, 5) : []);

      const nextPlayHist = readAccountJson<PlayHistoryEntry[]>(
        'playHistory',
        [],
        acctId
      );
      setPlayHistory(Array.isArray(nextPlayHist) ? nextPlayHist : []);

      const nextPlaylists = readAccountJson<UserPlaylist[]>('playlists', [], acctId);
      setPlaylists(Array.isArray(nextPlaylists) ? nextPlaylists : []);

      setHomeCategories(getRankedCategories(loadUserMusicProfile()));
      if (!options?.preserveNavigation) {
        setSelectedCollection(null);
        setSelectedAlbum(null);
        setSelectedArtist(null);
        setSelectedShelf(null);
        setActiveTab('home');

        const restoredTrack = audioEngine.reloadSessionForActiveAccount(nextScopeUid);
        notifyActivityStatsChanged(nextScopeUid);
        const snap = audioEngine.getSnapshot();
        if (restoredTrack) {
          registerTracks([restoredTrack]);
          userInteractedTrackRef.current = true;
          activeTrackIdRef.current = restoredTrack.id;
          setCurrentTrackId(restoredTrack.id);
          setCurrentTime(snap.currentTime);
          setAudioDuration(snap.duration || restoredTrack.duration);
          setMiniPlayerDismissed(false);
        } else {
          userInteractedTrackRef.current = false;
          activeTrackIdRef.current = null;
          setCurrentTrackId(null);
          setCurrentTime(0);
          setAudioDuration(0);
          setPlayerOpen(false);
        }
      } else {
        notifyActivityStatsChanged(nextScopeUid);
      }

      window.setTimeout(() => {
        hydratedAccountIdRef.current = acctId;
      }, 0);
    },
    [registerTracks]
  );

  // Listen for active account changes across components
  useEffect(() => {
    const onAccountChanged = () => {
      const acct = getActiveAccount();
      setActiveAccountState(acct);
      setOnboardingCompleted(acct ? hasCompletedAccountOnboarding(acct.id) : false);
      hydrateStateForAccount(acct);
    };
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, onAccountChanged);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, onAccountChanged);
    };
  }, [hydrateStateForAccount]);

  const verifiedUid =
    authUser?.emailVerified &&
    activeAccount?.provider === 'google' &&
    (!activeAccount.uid || activeAccount.uid === authUser.uid)
      ? authUser.uid
      : null;
  const verifiedAuthEmail = verifiedUid ? (authUser?.email ?? null) : null;

  const activeAccountRef = useRef<ActiveAccountIdentity | null>(activeAccount);
  useEffect(() => {
    activeAccountRef.current = activeAccount;
  }, [activeAccount]);

  const completeSignInFlow = useCallback(
    async (acct: ActiveAccountIdentity) => {
      authTransitionLockRef.current = true;
      setAuthTransition({ account: acct, stage: 'signing-in' });
      setActiveAccountState(acct);
      setOnboardingCompleted(hasCompletedAccountOnboarding(acct.id));
      hydrateStateForAccount(acct);

      try {
        await new Promise((r) => window.setTimeout(r, 420));
        if (acct.provider === 'google' && acct.uid) {
          setAuthTransition({ account: acct, stage: 'syncing' });
          await Promise.all([
            cloudSync.hydrateOnSignIn(acct.uid, acct.id),
            new Promise((r) => window.setTimeout(r, 520)),
          ]);
          setOnboardingCompleted(hasCompletedAccountOnboarding(acct.id));
          hydrateStateForAccount(acct, { preserveNavigation: true });
        }
      } finally {
        authTransitionLockRef.current = false;
        setAuthTransition(null);
      }
    },
    [hydrateStateForAccount]
  );

  // Real-time Bidirectional Google Cloud Sync Engine (onSnapshot + offline queue + retries)
  useEffect(() => {
    if (
      !verifiedUid ||
      !activeAccount ||
      activeAccount.provider !== 'google' ||
      activeAccount.uid !== verifiedUid
    ) {
      cloudSync.stop();
      return;
    }

    const accountSnapshot = activeAccount;
    cloudSync.start(verifiedUid, accountSnapshot.id, () => {
      setOnboardingCompleted(hasCompletedAccountOnboarding(accountSnapshot.id));
      hydrateStateForAccount(accountSnapshot, { preserveNavigation: true });
    });

    if (!authTransitionLockRef.current) {
      void cloudSync
        .hydrateOnSignIn(verifiedUid, accountSnapshot.id)
        .then((merged) => {
          if (!merged) return;
          setOnboardingCompleted(hasCompletedAccountOnboarding(accountSnapshot.id));
          hydrateStateForAccount(accountSnapshot, { preserveNavigation: true });
        })
        .catch(() => undefined);
    }

    return () => {
      cloudSync.stop();
    };
  }, [verifiedUid, activeAccount?.id, activeAccount?.provider, activeAccount?.uid, hydrateStateForAccount]);

  // Debounced cloud push whenever synced account data changes locally
  useEffect(() => {
    if (
      !verifiedUid ||
      !activeAccount ||
      activeAccount.provider !== 'google' ||
      activeAccount.uid !== verifiedUid
    ) {
      return;
    }
    if (hydratedAccountIdRef.current !== activeAccount.id) return;
    if (cloudSync.isApplyingRemoteUpdate()) return;

    if (suppressNextAutoPushRef.current) {
      suppressNextAutoPushRef.current = false;
      if (getSyncMeta(activeAccount.id).pendingSync) {
        cloudSync.schedulePush(verifiedUid, activeAccount.id);
      }
      return;
    }

    cloudSync.schedulePush(verifiedUid, activeAccount.id);
  }, [
    verifiedUid,
    activeAccount,
    onboardingCompleted,
    displayName,
    handle,
    email,
    profileImageUrl,
    avatarPreset,
    playlists,
    favoriteIds,
    aiSettings,
    eqState,
    recentTrackIds,
    playHistory,
    autoplay,
    explicitAllowed,
    showLyricsEnabled,
    hapticsEnabled,
    lyricsGlowEnabled,
    crossfadeSeconds,
    gaplessPlayback,
    openPlayerOnTap,
    miniSwipeEnabled,
    reelsAutoScroll,
    reelsDurationSeconds,
    reelsAutoPauseMusic,
    trackActivity,
    privateSession,
    autoDownloadFavorites,
  ]);

  // Listen for mutations from secondary modules (e.g. tasteProfile, SearchScreen) to auto-sync
  useEffect(() => {
    const onLocalSyncNeeded = () => {
      if (
        !verifiedUid ||
        !activeAccount ||
        activeAccount.provider !== 'google' ||
        activeAccount.uid !== verifiedUid
      ) {
        return;
      }
      if (hydratedAccountIdRef.current !== activeAccount.id) return;
      if (cloudSync.isApplyingRemoteUpdate()) return;
      cloudSync.schedulePush(verifiedUid, activeAccount.id);
    };
    window.addEventListener(LOCAL_SYNC_NEEDED_EVENT, onLocalSyncNeeded);
    return () => {
      window.removeEventListener(LOCAL_SYNC_NEEDED_EVENT, onLocalSyncNeeded);
    };
  }, [verifiedUid, activeAccount]);

  const isPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Cross-Device Registration, Heartbeat, and Shared Playback Listener
  useEffect(() => {
    if (!verifiedUid || !activeAccount || activeAccount.provider !== 'google') {
      deviceHandoff.stop();
      setAccountDevices([]);
      setSharedPlayback(null);
      return;
    }
    deviceHandoff.start(verifiedUid, {
      getIsPlaying: () => isPlayingRef.current,
      onDevices: setAccountDevices,
      onSharedPlayback: setSharedPlayback,
    });
    return () => {
      deviceHandoff.stop();
    };
  }, [verifiedUid, activeAccount?.id, activeAccount?.provider]);

  useEffect(() => {
    if (!verifiedUid) return;
    deviceHandoff.triggerHeartbeat(isPlaying);
  }, [verifiedUid, isPlaying]);

  // Publish active local playback to Firestore so other devices see live status
  useEffect(() => {
    if (!verifiedUid || !currentTrack) return;
    const localId = getLocalDeviceId(verifiedUid);
    const activeHolder = sharedPlayback?.activeDeviceId;
    if (activeHolder && activeHolder !== localId) {
      return;
    }
    const timer = window.setTimeout(() => {
      void publishSharedPlayback(verifiedUid, {
        track: currentTrack,
        isPlaying,
        positionSec: audioEngine.getCurrentTime(),
        durationSec: effectiveDuration,
      }).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [verifiedUid, currentTrack, isPlaying, effectiveDuration, sharedPlayback?.activeDeviceId]);

  // Handle incoming remote handoff/control commands targeted at this device
  useEffect(() => {
    if (!sharedPlayback) return;
    const localId = getLocalDeviceId(verifiedUid);
    if (
      sharedPlayback.activeDeviceId &&
      sharedPlayback.activeDeviceId !== localId &&
      sharedPlayback.isPlaying &&
      isPlaying
    ) {
      audioEngine.pause();
    }

    const cmd = sharedPlayback.remoteCommand;
    if (!cmd || cmd.targetDeviceId !== localId || cmd.id === lastHandledCmdIdRef.current) {
      return;
    }
    lastHandledCmdIdRef.current = cmd.id;

    if (cmd.type === 'claim') {
      const targetTrack = sharedPlayback.track;
      if (targetTrack) {
        registerTracks([targetTrack]);
        const pos = cmd.seekSec ?? computeExactPositionSec(sharedPlayback);
        if (sharedPlayback.isPlaying) {
          playResolvedTrack(targetTrack, pos, false);
        } else {
          userInteractedTrackRef.current = true;
          activeTrackIdRef.current = targetTrack.id;
          setCurrentTrackId(targetTrack.id);
          setCurrentTime(pos);
          setAudioDuration(targetTrack.duration);
          audioEngine.loadPausedTrackAtPosition(targetTrack, pos);
        }
      }
    } else if (cmd.type === 'play') {
      if (!isPlaying) handleTogglePlay();
    } else if (cmd.type === 'pause') {
      audioEngine.pause();
    } else if (cmd.type === 'seek' && cmd.seekSec !== undefined) {
      handleSeek(cmd.seekSec);
    } else if (cmd.type === 'next') {
      handleNextTrack();
    } else if (cmd.type === 'prev') {
      handlePrevTrack();
    }
  }, [
    sharedPlayback,
    isPlaying,
    registerTracks,
    playResolvedTrack,
    handleTogglePlay,
    handleSeek,
    handleNextTrack,
    handlePrevTrack,
  ]);

  const handleClaimPlaybackHere = useCallback(async () => {
    if (!verifiedUid) return;
    const targetTrack = sharedPlayback?.track ?? currentTrack;
    if (!targetTrack) return;
    const exactPos = computeExactPositionSec(sharedPlayback);
    registerTracks([targetTrack]);
    playResolvedTrack(targetTrack, exactPos, false);
    await publishSharedPlayback(verifiedUid, {
      track: targetTrack,
      isPlaying: true,
      positionSec: exactPos,
      durationSec: targetTrack.duration || effectiveDuration,
    });
  }, [
    verifiedUid,
    sharedPlayback,
    currentTrack,
    registerTracks,
    playResolvedTrack,
    effectiveDuration,
  ]);

  const handleTransferPlaybackToDevice = useCallback(
    async (device: RegisteredDevice) => {
      if (!verifiedUid || !currentTrack) return;
      const pos = audioEngine.getCurrentTime();
      audioEngine.pause();
      await transferPlaybackToDevice(verifiedUid, device.id, device.name, {
        track: currentTrack,
        isPlaying: true,
        positionSec: pos,
        durationSec: effectiveDuration,
      });
    },
    [verifiedUid, currentTrack, effectiveDuration]
  );

  const handleSendRemoteCommand = useCallback(
    async (targetDeviceId: string, command: RemoteCommandType) => {
      if (!verifiedUid) return;
      await sendRemoteControlCommand(verifiedUid, targetDeviceId, command);
    },
    [verifiedUid]
  );

  const handleRemoveDevice = useCallback(
    async (device: RegisteredDevice) => {
      if (!verifiedUid) return;
      await removeRegisteredDevice(verifiedUid, device.id);
    },
    [verifiedUid]
  );

  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  const isReelsView =
    activeTab === 'reels' &&
    !selectedAlbum &&
    !selectedArtist;

  useEffect(() => {
    if (isReelsView) {
      audioEngine.pause();
    }
  }, [isReelsView]);

  if (authTransition) {
    return (
      <SignInLoadingScreen
        provider={authTransition.account.provider}
        displayName={authTransition.account.displayName}
        email={authTransition.account.email}
        profileImageUrl={authTransition.account.photoUrl}
        stage={authTransition.stage}
      />
    );
  }

  if (!activeAccount) {
    return (
      <AuthGateScreen
        onAuthenticated={(acct) => {
          void completeSignInFlow(acct);
        }}
      />
    );
  }

  if (!onboardingCompleted) {
    return (
      <OnboardingGuard
        account={activeAccount}
        onComplete={() => {
          touchSyncSection('onboarding', activeAccount.id);
          touchSyncSection('taste', activeAccount.id);
          touchSyncSection('profile', activeAccount.id);
          clearMusicFeedCaches();
          hydrateStateForAccount(activeAccount);
          forceNextFeedRefreshRef.current = true;
          setOnboardingCompleted(true);
          setShowSetupTransition(true);
          if (verifiedUid && activeAccount.provider === 'google') {
            cloudSync.schedulePush(verifiedUid, activeAccount.id, true);
          }
        }}
      >
        {null}
      </OnboardingGuard>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-black text-white overflow-hidden flex flex-col">
      {showSetupTransition && (
        <SettingUpAtherScreen
          displayName={displayName}
          avatarPreset={avatarPreset}
          profileImageUrl={profileImageUrl}
          onFinished={handleSetupFinished}
        />
      )}

      {/* Subtle Monochrome Studio Glow */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.03) 0%, transparent 48%)',
        }}
      />

      {/* Upper Menu Bar */}
      {!isReelsView && (
        <header className="fixed top-0 left-0 right-0 z-30 w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
          <div
            style={{ backgroundColor: `rgba(14, 14, 17, ${Math.max(0.95, lookPrefs.glassOpacity)})` }}
            className="pointer-events-auto max-w-[1120px] mx-auto rounded-full backdrop-blur-xl border border-white/25 px-4 sm:px-5 h-14 flex items-center justify-between shadow-[0_12px_32px_rgba(0,0,0,0.85)]"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setActiveTab('home');
                setSelectedArtist(null);
                setSelectedAlbum(null);
                setSelectedCollection(null);
                setSelectedShelf(null);
              }}
              className="pl-0.5 flex items-center gap-2.5 text-lg sm:text-xl font-black tracking-tight text-white hover:opacity-85 transition-opacity"
            >
              <AtherLogoMark className="w-7 h-7 rounded-lg border border-white/25" />
              <span>ATHER</span>
            </motion.button>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                aria-label="Open profile"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                onClick={() => {
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedCollection(null);
                  setSelectedShelf(null);
                  setActiveTab('profile');
                }}
                className="w-9 h-9 rounded-full overflow-hidden border border-white/35 bg-[#1C1C1F] hover:border-white/75 transition-colors shrink-0 shadow-md"
              >
                <ProfileAvatar
                  displayName={displayName}
                  imageUrl={profileImageUrl}
                  preset={avatarPreset}
                  className="w-full h-full"
                />
              </motion.button>
            </div>
          </div>
        </header>
      )}

      {/* Main Scrollable Viewport Content */}
      <main
        className={`flex-1 min-h-0 w-full ${
          isReelsView
            ? 'overflow-hidden'
            : 'overflow-y-auto overflow-x-hidden no-scrollbar'
        }`}
      >
        {isReelsView ? (
          <ReelsScreen
            playlists={playlists}
            allTracks={allTracks}
            reelsTracks={reelsTracks}
            resolveTrack={resolveTrack}
            downloadedIds={downloadedIds}
            feedLoading={feedLoading}
            refreshingReels={refreshingReels}
            onRefreshReels={() => void refreshPersonalizedReels()}
            onLoadMoreReels={loadMorePersonalizedReels}
            isOffline={isOffline}
            isPaused={playerOpen}
            autoScroll={reelsAutoScroll}
            clipDurationSeconds={reelsDurationSeconds}
            bottomClearance={bottomDockHeight}
            onSelectTrack={handleSelectTrack}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onToggleDownload={handleToggleDownload}
            onEnsureFullTrack={ensureFullTrack}
            onOpenArtist={handleOpenArtist}
          />
        ) : (
          <div
            className="max-w-[1120px] mx-auto ather-page-shell"
            style={{
              paddingBottom: `calc(max(${bottomDockHeight + 28}px, 128px))`,
            }}
          >
            {selectedAlbum ? (
              <AlbumDetailScreen
                album={selectedAlbum}
                currentTrack={currentTrack}
                allTracks={allTracks}
                resolveTrack={resolveTrack}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                downloadedIds={downloadedIds}
                onBack={() => setSelectedAlbum(null)}
                onRegisterTracks={registerTracks}
                onSelectTrack={handleSelectTrack}
                onSelectAlbumTrack={(tracks, startIdx, albumId) =>
                  playScopedTrackList('album', albumId, tracks, startIdx, true)
                }
                onTogglePlay={handleTogglePlay}
                onToggleFavorite={handleToggleFavorite}
                onToggleDownload={handleToggleDownload}
                onShufflePlay={handleShuffleTrackIds}
                onOpenArtist={handleOpenArtist}
              />
            ) : selectedArtist ? (
              <ArtistDetailScreen
                artistName={selectedArtist}
                currentTrack={currentTrack}
                allTracks={allTracks}
                knownAlbums={knownAlbums}
                resolveTrack={resolveTrack}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                downloadedIds={downloadedIds}
                playlists={playlists}
                onBack={() => setSelectedArtist(null)}
                onRegisterTracks={registerTracks}
                onSelectTrack={handleSelectTrack}
                onSelectArtistTrack={(tracks, startIdx, artistName) =>
                  playScopedTrackList('artist', artistName, tracks, startIdx, true)
                }
                onTogglePlay={handleTogglePlay}
                onToggleFavorite={handleToggleFavorite}
                onToggleDownload={handleToggleDownload}
                onShufflePlay={handleShuffleTrackIds}
                onOpenAlbum={(album) => setSelectedAlbum(album)}
                onAddToQueue={handleAddToQueue}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
              />
            ) : activeTab === 'home' && selectedCollection ? (
              <CollectionDetailScreen
                collection={selectedCollection}
                currentTrack={currentTrack}
                allTracks={allTracks}
                resolveTrack={resolveTrack}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                downloadedIds={downloadedIds}
                playlists={playlists}
                onBack={() => setSelectedCollection(null)}
                onSelectTrack={handleSelectTrack}
                onSelectCollectionTrack={(tracks, startIdx, collectionId) =>
                  playScopedTrackList('playlist', collectionId, tracks, startIdx, true)
                }
                onTogglePlay={handleTogglePlay}
                onToggleFavorite={handleToggleFavorite}
                onToggleDownload={handleToggleDownload}
                onShufflePlay={handleShuffleTrackIds}
                onOpenArtist={handleOpenArtist}
                onAddToQueue={handleAddToQueue}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
              />
            ) : activeTab === 'home' && selectedShelf ? (
              <ShelfDetailScreen
                shelf={selectedShelf}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                resolveTrack={resolveTrack}
                onBack={() => setSelectedShelf(null)}
                onPlayAll={(tracks, startIdx = 0) =>
                  playScopedTrackList(
                    'playlist',
                    `shelf:${selectedShelf.id}`,
                    tracks,
                    startIdx,
                    true
                  )
                }
                onShufflePlay={handleShuffleTrackIds}
                onTogglePlay={handleTogglePlay}
                onOpenAlbum={(album) => {
                  setSelectedArtist(null);
                  setSelectedCollection(null);
                  setSelectedAlbum(album);
                }}
                onOpenArtist={handleOpenArtist}
                onOpenTrackInfo={(t) => setTrackInfoModalTrack(t)}
              />
            ) : activeTab === 'home' ? (
              <HomeScreen
                displayName={displayName}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                isOffline={isOffline}
                categories={homeCategories}
                popularTracks={popularTracks}
                featuredArtists={featuredArtists}
                collections={collections}
                forYouCards={forYouCards}
                albumCards={albumCards}
                trendingCards={trendingCards}
                newReleaseCards={newReleaseCards}
                exploreCards={exploreCards}
                selectedCategory={selectedCategory}
                feedLoading={feedLoading}
                feedError={feedError}
                onSelectCategory={(cat) => void handleSelectCategory(cat)}
                onRetryFeed={() => void handleSelectCategory(selectedCategory)}
                resolveTrack={resolveTrack}
                aiRecommendationsEnabled={aiSettings.recommendations}
                aiRecHeadline={aiRecHeadline}
                aiRecommendations={aiRecommendations}
                aiRecLoading={aiRecLoading}
                aiRecError={aiRecError}
                onRefreshAiRecommendations={() => void fetchAiRecommendations()}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onOpenCollection={(col) => {
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedShelf(null);
                  setSelectedCollection(col);
                }}
                onOpenAlbum={(album) => {
                  setSelectedArtist(null);
                  setSelectedCollection(null);
                  setSelectedShelf(null);
                  setSelectedAlbum(album);
                }}
                onOpenArtist={handleOpenArtist}
                onOpenTrackInfo={(t) => setTrackInfoModalTrack(t)}
                onOpenShelf={(shelf) => {
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedCollection(null);
                  setSelectedShelf(shelf);
                }}
              />
            ) : activeTab === 'search' ? (
              <SearchScreen
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                isOffline={isOffline}
                allTracks={allTracks}
                playlists={playlists}
                favoriteIds={favoriteIds}
                downloadedIds={downloadedIds}
                onRegisterTracks={registerTracks}
                onSelectTrack={handleSelectTrack}
                onTogglePlay={handleTogglePlay}
                onOpenArtist={handleOpenArtist}
                onOpenAlbum={(album) => {
                  setSelectedArtist(null);
                  setSelectedCollection(null);
                  setSelectedShelf(null);
                  setSelectedAlbum(album);
                }}
                onRecordSearch={(term, topHit) => {
                  touchSyncSection('history', activeAccount.id);
                  if (trackActivity && !privateSession) {
                    const updatedProf = recordSearchAffinity(term, topHit);
                    touchSyncSection('taste', activeAccount.id);
                    setHomeCategories(getRankedCategories(updatedProf));
                  }
                  if (verifiedUid && activeAccount.provider === 'google') {
                    cloudSync.schedulePush(verifiedUid, activeAccount.id);
                  }
                }}
                onToggleFavorite={handleToggleFavorite}
                onToggleDownload={handleToggleDownload}
                onAddToQueue={handleAddToQueue}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
              />
            ) : activeTab === 'profile' ? (
              <ProfileSettingsScreen
                authUid={verifiedUid}
                authEmail={verifiedAuthEmail}
                accountProvider={activeAccount.provider}
                syncStatus={syncStatus}
                onSyncNow={() => cloudSync.flushPush(true)}
                accountDeviceCount={accountDevices.length}
                onOpenDevices={() => setSettingsDevicesOpen(true)}
                onSignInGoogle={async () => {
                  const user = await signInWithGooglePopup();
                  const linked: ActiveAccountIdentity = {
                    id: sanitizeAccountId(`google:${user.uid}`),
                    provider: 'google',
                    uid: user.uid,
                    displayName:
                      user.displayName || user.email?.split('@')[0] || 'ATHER Listener',
                    email: user.email || '',
                    photoUrl: user.photoURL || undefined,
                  };
                  setAccountOnboardingCompleted(true, linked.id);
                  setActiveAccount(linked);
                  await completeSignInFlow(linked);
                }}
                onSignOutGoogle={async () => {
                  cloudSync.stop();
                  deviceHandoff.stop();
                  await signOutFirebase();
                }}
                onResetOnboarding={() => {
                  touchSyncSection('onboarding', activeAccount.id);
                  setAccountOnboardingCompleted(false, activeAccount.id);
                  setOnboardingCompleted(false);
                }}
                onSwitchAccount={async () => {
                  const prevScope = getCanonicalAccountScopeId(activeAccount);
                  cloudSync.stop();
                  deviceHandoff.stop();
                  audioEngine.resetForAccountSwitch();
                  queueManager.reset();
                  resetActivityStatsMemory();
                  clearMusicFeedCaches();
                  clearAccountSessionState(prevScope);
                  if (authUser) {
                    await signOutFirebase().catch(() => undefined);
                  }
                  setActiveAccount(null);
                  setActiveAccountState(null);
                  setOnboardingCompleted(false);
                }}
                displayName={displayName}
                email={activeAccount.provider === 'guest' ? '' : email}
                profileImageUrl={profileImageUrl}
                avatarPreset={avatarPreset}
                onUpdateProfile={(nextName, nextEmail, nextImg, nextPreset) => {
                  touchSyncSection('profile', activeAccount.id);
                  setDisplayName(nextName);
                  setEmail(activeAccount.provider === 'guest' ? '' : nextEmail);
                  setProfileImageUrl(nextImg);
                  setAvatarPreset(nextPreset);
                }}
                downloadedCount={downloadedIds.size}
                playlistCount={playlists.length}
                favoriteCount={favoriteIds.size}
                recentCount={recentTrackIds.length}
                autoplay={autoplay}
                onToggleAutoplay={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setAutoplay((v) => !v);
                }}
                showLyricsEnabled={showLyricsEnabled}
                onToggleShowLyrics={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setShowLyricsEnabled((v) => !v);
                }}
                explicitAllowed={explicitAllowed}
                onToggleExplicit={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setExplicitAllowed((v) => !v);
                }}
                crossfadeSeconds={crossfadeSeconds}
                onChangeCrossfade={(secs) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setCrossfadeSeconds(secs);
                }}
                gaplessPlayback={gaplessPlayback}
                onToggleGapless={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setGaplessPlayback((v) => !v);
                }}
                openPlayerOnTap={openPlayerOnTap}
                onToggleOpenPlayerOnTap={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setOpenPlayerOnTap((v) => !v);
                }}
                hapticsEnabled={hapticsEnabled}
                onToggleHaptics={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setHapticsEnabled((v) => !v);
                }}
                miniSwipeEnabled={miniSwipeEnabled}
                onToggleMiniSwipe={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setMiniSwipeEnabled((v) => !v);
                }}
                lyricsGlowEnabled={lyricsGlowEnabled}
                onToggleLyricsGlow={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setLyricsGlowEnabled((v) => !v);
                }}
                reelsAutoScroll={reelsAutoScroll}
                onToggleReelsAutoScroll={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsAutoScroll((v) => !v);
                }}
                reelsDurationSeconds={reelsDurationSeconds}
                onChangeReelsDuration={(secs) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsDurationSeconds(secs);
                }}
                reelsAutoPauseMusic={reelsAutoPauseMusic}
                onToggleReelsAutoPauseMusic={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsAutoPauseMusic((v) => !v);
                }}
                trackActivity={trackActivity}
                onToggleTrackActivity={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setTrackActivity((v) => !v);
                }}
                privateSession={privateSession}
                onTogglePrivateSession={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setPrivateSession((v) => !v);
                }}
                onClearRecentHistory={() => {
                  recordHistoryCleared(activeAccount.id);
                  setRecentTrackIds([]);
                  setPlayHistory([]);
                }}
                autoDownloadFavorites={autoDownloadFavorites}
                onToggleAutoDownloadFavorites={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setAutoDownloadFavorites((v) => !v);
                }}
                onClearAllDownloads={() => {
                  setDownloadedTracksMap({});
                  void clearAllOfflineTrackBlobs(
                    getCanonicalAccountScopeId(activeAccount)
                  );
                }}
                sleepTimerRemainingSeconds={sleepTimerRemainingSeconds}
                sleepTimerEndOfTrack={sleepTimerEndOfTrack}
                onSetSleepTimerMinutes={(mins) => {
                  setSleepTimerEndOfTrack(false);
                  setSleepTimerRemainingSeconds(
                    mins === null ? null : mins * 60
                  );
                }}
                onSetSleepTimerEndOfTrack={() => {
                  setSleepTimerRemainingSeconds(null);
                  setSleepTimerEndOfTrack(true);
                }}
                isOffline={isOffline}
                isNetworkOnline={isNetworkOnline}
                manualOfflineMode={manualOfflineMode}
                onToggleManualOfflineMode={() =>
                  setManualOfflineMode((v) => !v)
                }
                eqPreset={eqState.preset}
                eqBands={eqState.bands}
                onSelectEqPreset={(preset) => {
                  touchSyncSection('eq', activeAccount.id);
                  setEqState({
                    preset,
                    bands: [...EQ_PRESET_VALUES[preset]],
                  });
                }}
                onChangeEqBand={(index, value) => {
                  touchSyncSection('eq', activeAccount.id);
                  setEqState((prev) => ({
                    preset: 'Custom',
                    bands: prev.bands.map((v, i) => (i === index ? value : v)),
                  }));
                }}
                aiSmartShuffleEnabled={aiSettings.smartShuffle}
                onToggleAiSmartShuffle={() => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    smartShuffle: !prev.smartShuffle,
                  }));
                }}
                aiRecommendationsEnabled={aiSettings.recommendations}
                onToggleAiRecommendations={() => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    recommendations: !prev.recommendations,
                  }));
                }}
                aiDiscoveryLevel={aiSettings.discoveryLevel}
                onChangeAiDiscoveryLevel={(level) => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    discoveryLevel: level,
                  }));
                }}
                aiRecLoading={aiRecLoading}
                aiRecHeadline={aiRecHeadline}
                aiRecommendations={aiRecommendations}
                aiRecError={aiRecError}
                onRefreshAiRecommendations={() => void fetchAiRecommendations()}
                lookPrefs={lookPrefs}
                onUpdateLookPrefs={(patch) => {
                  void updateUserLookPreferences(
                    patch,
                    getCanonicalAccountScopeId(activeAccount)
                  ).catch(() => undefined);
                }}
              />
            ) : (
              <LibraryScreen
                mode="library"
                uid={verifiedUid}
                displayName={displayName}
                profileImageUrl={profileImageUrl}
                avatarPreset={avatarPreset}
                isOffline={isOffline}
                requestedSubTab={requestedLibrarySubTab}
                currentTrack={currentTrack}
                allTracks={allTracks}
                resolveTrack={resolveTrack}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                downloadedIds={downloadedIds}
                recentTrackIds={recentTrackIds}
                playHistory={playHistory}
                playlists={playlists}
                onRegisterTracks={registerTracks}
                onSelectTrack={handleSelectTrack}
                onSelectPlaylistTrack={(tracks, startIdx, playlistId) =>
                  playScopedTrackList('playlist', playlistId, tracks, startIdx, true)
                }
                onSelectDownloadTrack={(tracks, startIdx) =>
                  playScopedTrackList('downloads', 'downloads', tracks, startIdx, true)
                }
                onTogglePlay={handleTogglePlay}
                onToggleFavorite={handleToggleFavorite}
                onToggleDownload={handleToggleDownload}
                onOpenArtist={handleOpenArtist}
                onCreatePlaylist={handleCreatePlaylist}
                onUpdatePlaylist={handleUpdatePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onShufflePlay={handleShuffleTrackIds}
              />
            )}
          </div>
        )}
      </main>

      {/* Bottom Floating Mini-Player + Connectivity Strip + Navigation Bar */}
      <div
        ref={bottomDockRef}
        className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        {offlineNotice && (
          <div className="pointer-events-auto max-w-md w-full rounded-full bg-white text-black px-4 py-2 flex items-center justify-between gap-2 text-xs font-extrabold shadow-[0_10px_28px_rgba(0,0,0,0.75)]">
            <span className="flex items-center gap-2 truncate">
              <WifiOffGlyph className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{offlineNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setOfflineNotice(null);
                setActiveTab('library');
                setRequestedLibrarySubTab({ tab: 'downloads', tick: Date.now() });
              }}
              className="underline shrink-0"
            >
              Downloads
            </button>
          </div>
        )}

        {currentTrack &&
          activeTab !== 'reels' &&
          !miniPlayerDismissed && (
            <div
              role="button"
              tabIndex={0}
              aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Open player.${
                !isPlaying ? ' Swipe horizontally to dismiss.' : ''
              }`}
              onPointerDown={(e) => {
                if (isPlaying || !miniSwipeEnabled) return;
                if ((e.target as HTMLElement).closest('button')) return;
                miniSwipeRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  swiped: false,
                };
                setIsDraggingMini(true);
              }}
              onPointerMove={(e) => {
                const swipe = miniSwipeRef.current;
                if (
                  !swipe ||
                  swipe.pointerId !== e.pointerId ||
                  isPlaying ||
                  !miniSwipeEnabled
                ) {
                  return;
                }
                const dx = e.clientX - swipe.startX;
                const dy = e.clientY - swipe.startY;
                if (
                  !swipe.swiped &&
                  Math.abs(dx) > 8 &&
                  Math.abs(dx) > Math.abs(dy)
                ) {
                  swipe.swiped = true;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                }
                if (swipe.swiped) {
                  setMiniDragX(dx);
                }
              }}
              onPointerUp={(e) => {
                const swipe = miniSwipeRef.current;
                if (!swipe || swipe.pointerId !== e.pointerId) return;
                miniSwipeRef.current = null;
                setIsDraggingMini(false);

                if (swipe.swiped) {
                  justSwipedRef.current = true;
                  window.setTimeout(() => {
                    justSwipedRef.current = false;
                  }, 120);

                  const dx = e.clientX - swipe.startX;
                  if (Math.abs(dx) >= 75) {
                    setMiniDragX(dx > 0 ? 420 : -420);
                    window.setTimeout(() => {
                      setMiniPlayerDismissed(true);
                      setMiniDragX(0);
                    }, 180);
                  } else {
                    setMiniDragX(0);
                  }
                }
              }}
              onPointerCancel={() => {
                miniSwipeRef.current = null;
                setIsDraggingMini(false);
                setMiniDragX(0);
              }}
              onClick={() => {
                if (justSwipedRef.current) return;
                setPlayerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlayerOpen(true);
                }
              }}
              style={{
                backgroundColor: `rgba(14, 14, 17, ${Math.max(0.95, lookPrefs.glassOpacity)})`,
                transform: `translate3d(${miniDragX}px, 0, 0)`,
                opacity: Math.max(0, 1 - Math.abs(miniDragX) / 260),
                transition: isDraggingMini
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.32, 1.28, 0.36, 1), opacity 0.2s ease',
              }}
              className={`pointer-events-auto relative overflow-hidden max-w-md w-full rounded-full backdrop-blur-xl border border-white/25 px-3 ${
                lookPrefs.compactTiles ? 'py-2' : 'py-2.5'
              } flex items-center gap-3 cursor-pointer shadow-[0_14px_34px_rgba(0,0,0,0.85)] hover:border-white/40 active:scale-[0.99] select-none ${
                !isPlaying ? 'touch-pan-y' : ''
              }`}
            >
              <motion.div
                key={currentTrack.id}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-white/20"
              >
                <ShowcaseArtwork
                  style={currentTrack.artwork}
                  coverUrl={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  preferGradientFallback={currentTrack.isAudius}
                  compact={true}
                  className="w-full h-full"
                />
              </motion.div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold text-white truncate leading-tight">
                  {currentTrack.title}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenArtist(currentTrack.artist);
                  }}
                  className="block max-w-full text-[11px] font-bold text-white/75 hover:text-white hover:underline truncate mt-0.5 leading-tight text-left transition-colors"
                >
                  {currentTrack.artist}
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <motion.button
                  type="button"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.84 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_16px_rgba(255,255,255,0.22)]"
                >
                  {isPlaying ? (
                    <PauseGlyph className="w-4 h-4" />
                  ) : (
                    <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  aria-label="Next track"
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.84 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextTrack();
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <NextGlyph className="w-4 h-4" />
                </motion.button>
              </div>

              {/* 2px Monochrome Hairline Progress Bar */}
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/12 rounded-full overflow-hidden pointer-events-none"
              >
                <div
                  className="h-full bg-white rounded-full transition-[width] duration-200 linear"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

        {/* AI Smart Shuffle Status Popup */}
        <AnimatePresence>
          {(aiShuffleError || (aiShuffleLoading && !playerOpen)) && (
            <motion.div
              key="ai-shuffle-popup"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-auto max-w-[480px] w-full rounded-full bg-[#111114] border border-white/25 px-4 py-1.5 flex items-center justify-between gap-2 text-[11px] font-extrabold text-white shadow-[0_10px_28px_rgba(0,0,0,0.85)]"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <AiSparklesGlyph className="w-3.5 h-3.5 shrink-0" active={true} />
                <span className="truncate">
                  {aiShuffleLoading
                    ? 'Sequencing queue with AI Smart Shuffle...'
                    : aiShuffleError}
                </span>
              </span>
              {aiShuffleError && (
                <button
                  type="button"
                  onClick={() => setAiShuffleError(null)}
                  className="underline shrink-0 text-white/75 hover:text-white"
                >
                  Dismiss
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Online / Offline Connectivity Indicator */}
        <AnimatePresence>
          {(isOffline || onlinePopupVisible) && !isReelsView && (
            <motion.div
              key={isOffline ? 'connectivity-offline' : 'connectivity-online'}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto max-w-[480px] w-full rounded-2xl px-4 py-2 flex items-center justify-between gap-3 text-xs font-extrabold border shadow-[0_12px_32px_rgba(0,0,0,0.85)] ${
                !isOffline
                  ? 'bg-white text-black border-white'
                  : 'bg-[#111114] text-white border-white/25'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {!isOffline ? (
                  <WifiOnGlyph className="w-4 h-4 shrink-0" />
                ) : (
                  <WifiOffGlyph className="w-4 h-4 text-white/85 shrink-0" />
                )}
                <span className="truncate">
                  {!isOffline
                    ? onlinePopupLabel
                    : !isNetworkOnline
                    ? 'No internet connection · Offline mode'
                    : 'Offline mode · Playing downloads'}
                </span>
              </div>

              {isOffline ? (
                <div className="flex items-center gap-2 shrink-0">
                  {activeTab !== 'library' && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('library');
                        setRequestedLibrarySubTab({
                          tab: 'downloads',
                          tick: Date.now(),
                        });
                      }}
                      className="underline text-white hover:text-white/80 text-[11px]"
                    >
                      Downloads
                    </button>
                  )}
                  {isNetworkOnline && manualOfflineMode && (
                    <button
                      type="button"
                      onClick={() => setManualOfflineMode(false)}
                      className="px-2.5 py-0.5 rounded-full bg-white text-black text-[11px] font-extrabold"
                    >
                      Go Online
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-black/65 shrink-0">
                  Connected
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Dark Pill Navigation Bar */}
        <nav
          ref={navRef}
          aria-label="Primary navigation"
          style={{ backgroundColor: `rgba(14, 14, 17, ${Math.max(0.95, lookPrefs.glassOpacity)})` }}
          className="pointer-events-auto relative max-w-[480px] w-full rounded-full backdrop-blur-xl border border-white/25 p-1.5 sm:p-2 flex items-center justify-between shadow-[0_14px_38px_rgba(0,0,0,0.88)]"
        >
          <div
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 sm:top-2 sm:bottom-2 left-0 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.22)] pointer-events-none"
            style={{
              transform: `translate3d(${thumbStyle.left}px, 0, 0)`,
              width: `${thumbStyle.width}px`,
              opacity: thumbStyle.ready ? 1 : 0,
              transition: lookPrefs.springMotion
                ? 'transform 0.45s cubic-bezier(0.32, 1.28, 0.36, 1), width 0.38s cubic-bezier(0.32, 1.28, 0.36, 1), opacity 0.2s ease'
                : 'transform 0.2s ease-out, width 0.18s ease-out, opacity 0.15s ease',
            }}
          />

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[item.id] = el;
                }}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 480, damping: 24 }}
                onClick={() => {
                  setActiveTab(item.id);
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedCollection(null);
                  setSelectedShelf(null);
                }}
                className={`relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 rounded-full transition-colors duration-200 touch-manipulation ${
                  active
                    ? 'text-black px-3 sm:px-5 py-2 sm:py-2.5 font-extrabold'
                    : 'text-white/80 hover:text-white w-10 sm:w-12 h-10 sm:h-11 font-extrabold'
                }`}
              >
                <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px] shrink-0" active={active} />
                {active && (
                  <span className="text-xs sm:text-[13px] font-extrabold whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* Full-Viewport Now Playing Player Overlay */}
      {currentTrack && (
        <PlayerOverlay
          isOpen={playerOpen}
          onClose={() => setPlayerOpen(false)}
          track={currentTrack}
          allTracks={allTracks}
          resolveTrack={resolveTrack}
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          audioError={audioError}
          currentTime={currentTime}
          duration={effectiveDuration}
          shuffle={shuffle}
          repeatMode={repeatMode}
          isFavorite={favoriteIds.has(currentTrack.id)}
          isDownloaded={downloadedIds.has(currentTrack.id)}
          queueTrackIds={queueTrackIds}
          aiSmartShuffleEnabled={aiSettings.smartShuffle}
          aiShuffleLoading={aiShuffleLoading}
          aiShuffleNote={aiShuffleNote}
          aiShuffleError={aiShuffleError}
          showLyricsEnabled={showLyricsEnabled}
          hapticsEnabled={hapticsEnabled}
          lyricsGlowEnabled={lyricsGlowEnabled}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          onToggleShuffle={handleToggleShuffle}
          onCycleRepeat={handleCycleRepeat}
          onToggleFavorite={() => handleToggleFavorite(currentTrack.id)}
          onToggleDownload={() => void handleToggleDownload(currentTrack)}
          onSelectTrack={(id) => handleSelectTrack(id)}
          onMoveQueueTrack={handleMoveQueueTrack}
          onRemoveFromQueue={handleRemoveFromQueue}
          onAddToQueue={handleAddToQueue}
          onClearUpcoming={handleClearUpcoming}
          onResetQueue={handleResetQueue}
          onOpenArtist={handleOpenArtist}
          onOpenTrackInfo={(t) => setTrackInfoModalTrack(t)}
          signedInUid={verifiedUid}
          accountDevices={accountDevices}
          sharedPlayback={sharedPlayback}
          onClaimPlaybackHere={handleClaimPlaybackHere}
          onTransferPlaybackToDevice={handleTransferPlaybackToDevice}
          onSendRemoteCommand={handleSendRemoteCommand}
          onRemoveDevice={handleRemoveDevice}
        />
      )}

      {/* Account Devices Sheet launched from Settings */}
      {settingsDevicesOpen && (
        <DeviceHandoffSheet
          onClose={() => setSettingsDevicesOpen(false)}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          browserOutputs={settingsBrowserOutputs}
          activeBrowserOutputId={activeSettingsOutputId}
          onSelectBrowserOutput={(deviceId) => {
            setActiveSettingsOutputId(deviceId);
            setSettingsDevicesOpen(false);
          }}
          signedInUid={verifiedUid}
          accountDevices={accountDevices}
          sharedPlayback={sharedPlayback}
          onClaimHere={handleClaimPlaybackHere}
          onTransferToDevice={handleTransferPlaybackToDevice}
          onSendRemoteCommand={handleSendRemoteCommand}
          onRemoveDevice={handleRemoveDevice}
        />
      )}

      {/* Shared MusicBrainz Song & Artist Info Modal */}
      <TrackInfoModal
        track={trackInfoModalTrack}
        onClose={() => setTrackInfoModalTrack(null)}
        isFavorite={
          trackInfoModalTrack ? favoriteIds.has(trackInfoModalTrack.id) : false
        }
        isDownloaded={
          trackInfoModalTrack
            ? downloadedIds.has(trackInfoModalTrack.id)
            : false
        }
        onPlayFullTrack={(t) => {
          void ensureFullTrack(t).then((upgraded) =>
            playResolvedTrack(upgraded, 0, true)
          );
        }}
        onToggleFavorite={handleToggleFavorite}
        onToggleDownload={(t) => void handleToggleDownload(t)}
        onAddToQueue={handleAddToQueue}
        onOpenArtist={(artist) => {
          setTrackInfoModalTrack(null);
          handleOpenArtist(artist);
        }}
      />
    </div>
  );
}

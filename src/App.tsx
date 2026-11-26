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
  searchAudiusTracks,
} from './services/audiusApi';
import { cloudSync } from './services/cloudSync';
import {
  AudioQualityTier,
  resolveFullAudioStream,
} from './services/simpmusicStreamResolver';
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
  fetchAtherHomeShelves,
  fetchPersonalizedReelsPool,
  getCachedCategorySongs,
  getLiveNewReleases,
  isOfficialArtistTrack,
  isValidArtistName,
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
  { id: 'home', label: 'home', icon: HomeNavIcon },
  { id: 'search', label: 'search', icon: SearchNavIcon },
  { id: 'reels', label: 'reels', icon: ReelsNavIcon },
  { id: 'library', label: 'library', icon: LibraryNavIcon },
  { id: 'profile', label: 'profile', icon: ProfileNavIcon },
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
      titleLines: ['top songs', 'charts'],
      subtitle: `${chartSongs.slice(0, 15).length} most played chart hits`,
      description: 'live top songs chart curated with crisp high-res audio.',
      badge: 'live charts',
      theme: 'light-offwhite',
      slice: chartSongs.slice(0, 15),
    },
    {
      id: 'for-you-mix',
      titleLines: ['for you', 'quick picks'],
      subtitle: 'tuned to your taste profile',
      description: 'personalized tracks built from your artists, genres, and recent plays.',
      badge: 'personalized',
      theme: 'dark-indigo',
      slice: forYouQuickPicks.slice(0, 15),
    },
    {
      id: 'new-drops-mix',
      titleLines: ['new', 'releases'],
      subtitle: 'latest drops out this week',
      description: 'fresh official singles and album highlights added right away.',
      badge: 'new drops',
      theme: 'dark-lime',
      slice: newReleaseTracks.slice(0, 15),
    },
    {
      id: 'audius-top-global',
      titleLines: ['trending', 'streams'],
      subtitle: `${audiusTracks.slice(0, 12).length} trending full streams`,
      description: 'full-length trending tracks climbing global listening charts.',
      badge: 'trending now',
      theme: 'light-offwhite',
      slice: audiusTracks.slice(0, 12),
    },
    {
      id: 'audius-fresh-drops',
      titleLines: ['fresh', 'discoveries'],
      subtitle: 'rising independent releases',
      description: 'independent cuts surfacing from emerging artists worldwide.',
      badge: 'rising picks',
      theme: 'dark-lime',
      slice: audiusTracks.slice(8, 20),
    },
    {
      id: 'late-night-pulse',
      titleLines: ['late night', 'pulse'],
      subtitle: 'after-hours rotation & deep cuts',
      description: 'hand-picked evening groove selections across r&b, hip hop, and soul.',
      badge: 'after hours',
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
  const [settingsDevicesOpen, setSettingsDevicesOpen] = useState<boolean>(false);
  const [settingsBrowserOutputs, setSettingsBrowserOutputs] = useState<
    BrowserAudioOutputOption[]
  >([
    {
      id: 'default',
      name: 'this device',
      spec: 'browser audio output',
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
            name: d.label?.toLowerCase() || (idx === 0 ? 'system default output' : `audio output ${idx + 1}`),
            spec: 'live browser output',
          }));
        setSettingsBrowserOutputs(
          outputs.length > 0
            ? outputs
            : [
                {
                  id: 'default',
                  name: 'this device',
                  spec: 'browser audio output',
                },
              ]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsBrowserOutputs([
            {
              id: 'default',
              name: 'this device',
              spec: 'browser audio output',
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
  const [onlinePopupLabel, setOnlinePopupLabel] = useState<string>('online');
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

  // live discovery feeds state (apple itunes rss + itunes search + audius)
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
    initialProfile.displayName || 'listener'
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
  const [wifiQuality, setWifiQuality] = useState<AudioQualityTier>(
    (initialPrefs.wifiQuality as AudioQualityTier) ?? 'High'
  );
  const [cellularQuality, setCellularQuality] = useState<AudioQualityTier>(
    (initialPrefs.cellularQuality as AudioQualityTier) ?? 'Normal'
  );
  const [downloadQuality, setDownloadQuality] = useState<AudioQualityTier>(
    (initialPrefs.downloadQuality as AudioQualityTier) ?? 'High'
  );
  const [losslessSpatial, setLosslessSpatial] = useState<boolean>(
    initialPrefs.losslessSpatial ?? true
  );
  const [volumeNormalization, setVolumeNormalization] = useState<boolean>(
    initialPrefs.volumeNormalization ?? true
  );
  const [monoAudio, setMonoAudio] = useState<boolean>(
    initialPrefs.monoAudio ?? false
  );
  const [dataSaver, setDataSaver] = useState<boolean>(
    initialPrefs.dataSaver ?? false
  );
  const [downloadOverCellular, setDownloadOverCellular] = useState<boolean>(
    initialPrefs.downloadOverCellular ?? false
  );
  const [language, setLanguage] = useState<string>(
    (initialPrefs.language || 'english (us)').toLowerCase()
  );
  const [notifyNewReleases, setNotifyNewReleases] = useState<boolean>(
    initialPrefs.notifyNewReleases ?? true
  );
  const [notifyMixUpdates, setNotifyMixUpdates] = useState<boolean>(
    initialPrefs.notifyMixUpdates ?? true
  );
  const [notifyAppUpdates, setNotifyAppUpdates] = useState<boolean>(
    initialPrefs.notifyAppUpdates ?? false
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
        wifiQuality,
        cellularQuality,
        downloadQuality,
        losslessSpatial,
        volumeNormalization,
        monoAudio,
        dataSaver,
        downloadOverCellular,
        language,
        notifyNewReleases,
        notifyMixUpdates,
        notifyAppUpdates,
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
    wifiQuality,
    cellularQuality,
    downloadQuality,
    losslessSpatial,
    volumeNormalization,
    monoAudio,
    dataSaver,
    downloadOverCellular,
    language,
    notifyNewReleases,
    notifyMixUpdates,
    notifyAppUpdates,
    activeAccount,
  ]);

  const effectiveStreamQuality = useMemo<AudioQualityTier>(() => {
    const connType =
      typeof navigator !== 'undefined'
        ? ((navigator as unknown as { connection?: { type?: string } }).connection?.type ?? '')
        : '';
    if (connType === 'cellular') {
      return dataSaver ? 'Low' : cellularQuality;
    }
    return wifiQuality;
  }, [wifiQuality, cellularQuality, dataSaver]);

  useEffect(() => {
    audioEngine.setPreferredQualityTier(effectiveStreamQuality);
    audioEngine.setEqBands(eqState.bands);
    audioEngine.setVolumeNormalization(volumeNormalization);
    audioEngine.setMonoAudio(monoAudio);
    audioEngine.setCrossfadeSeconds(crossfadeSeconds);
    audioEngine.setGaplessPlayback(gaplessPlayback);
  }, [
    effectiveStreamQuality,
    eqState.bands,
    volumeNormalization,
    monoAudio,
    crossfadeSeconds,
    gaplessPlayback,
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

  // Bottom dock height measurement for scroll clearance
  const bottomDockRef = useRef<HTMLDivElement>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState<number>(176);

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

  const filterExplicitTracks = useCallback(
    (list: ShowcaseTrack[]) =>
      explicitAllowed ? list : list.filter((t) => !t.explicit),
    [explicitAllowed]
  );

  const playableFeedTracks = useMemo(
    () => filterExplicitTracks(allFeedTracks),
    [filterExplicitTracks, allFeedTracks]
  );

  const visiblePopularTracks = useMemo(
    () => filterExplicitTracks(popularTracks),
    [filterExplicitTracks, popularTracks]
  );

  const visibleReelsTracks = useMemo(
    () => filterExplicitTracks(reelsTracks),
    [filterExplicitTracks, reelsTracks]
  );

  const collections = useMemo(
    () =>
      buildLiveCollections(
        filterExplicitTracks(audiusTrendingTracks),
        filterExplicitTracks(chartSongTracks),
        filterExplicitTracks(newReleaseTracks),
        filterExplicitTracks(forYouQuickPicks)
      ),
    [
      filterExplicitTracks,
      audiusTrendingTracks,
      chartSongTracks,
      newReleaseTracks,
      forYouQuickPicks,
    ]
  );

  const forYouCards = useMemo<HomeShelfCard[]>(() => {
    const source = filterExplicitTracks(
      forYouQuickPicks.length > 0
        ? forYouQuickPicks
        : chartSongTracks.length > 0
        ? chartSongTracks
        : popularTracks
    );
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
  }, [filterExplicitTracks, forYouQuickPicks, chartSongTracks, popularTracks]);

  const albumCards = useMemo<HomeShelfCard[]>(() => {
    const source = albumsForYou.length > 0 ? albumsForYou : knownAlbums;
    return source.slice(0, 14).map((alb) => ({
      id: `albcard-${alb.id}`,
      title: alb.title,
      artist: alb.artist,
      subtitle: alb.year ? `${alb.artist} · ${alb.year}` : alb.artist,
      artwork: alb.artwork,
      coverUrl: alb.coverUrl,
      albumId: alb.id,
      albumItem: alb,
    }));
  }, [albumsForYou, knownAlbums]);

  const trendingCards = useMemo<HomeShelfCard[]>(() => {
    const pool = filterExplicitTracks(
      mergeUniqueTracks(
        trendingShelfTracks,
        chartSongTracks,
        audiusTrendingTracks
      )
    );
    return pool.slice(0, 14).map((t) => ({
      id: `trd-${t.id}`,
      title: t.title,
      artist: t.artist,
      subtitle: t.artist,
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
  }, [
    filterExplicitTracks,
    trendingShelfTracks,
    chartSongTracks,
    audiusTrendingTracks,
  ]);

  const newReleaseCards = useMemo<HomeShelfCard[]>(() => {
    const albumEntries: HomeShelfCard[] = newReleaseAlbums.slice(0, 6).map((alb) => ({
      id: `nra-${alb.id}`,
      title: alb.title,
      artist: alb.artist,
      subtitle: alb.artist,
      artwork: alb.artwork,
      coverUrl: alb.coverUrl,
      albumId: alb.id,
      albumItem: alb,
    }));
    const trackEntries: HomeShelfCard[] = filterExplicitTracks(newReleaseTracks)
      .slice(0, 12)
      .map((t) => ({
        id: `nrt-${t.id}`,
        title: t.title,
        artist: t.artist,
        subtitle: t.artist,
        artwork: t.artwork,
        coverUrl: t.coverUrl,
        trackId: t.id,
        track: t,
      }));
    return [...albumEntries.slice(0, 4), ...trackEntries].slice(0, 16);
  }, [filterExplicitTracks, newReleaseAlbums, newReleaseTracks]);

  const exploreCards = useMemo<HomeShelfCard[]>(() => {
    const pool = filterExplicitTracks(
      mergeUniqueTracks(audiusTrendingTracks, popularTracks)
    );
    return pool.slice(0, 12).map((t) => ({
      id: `exp-${t.id}`,
      title: t.title,
      artist: t.artist,
      artwork: t.artwork,
      coverUrl: t.coverUrl,
      trackId: t.id,
      track: t,
    }));
  }, [filterExplicitTracks, audiusTrendingTracks, popularTracks]);

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
      triggerOnlineBottomPopup('back online');
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

  // fetch rich live discovery feeds & seasonal home shelves via itunes + apple rss + audius
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
            fetchAtherHomeShelves({
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
          if (shelves.dynamicCategories?.length) {
            const rankedProfileCats = getRankedCategories(musicProfile).filter(
              (c) => c !== 'all'
            );
            const mergedCats = Array.from(
              new Set([
                'all',
                ...shelves.dynamicCategories.map((c) => c.toLowerCase()),
                ...rankedProfileCats,
              ])
            ).slice(0, 9);
            setHomeCategories(mergedCats);
          }
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
          setFeedError('unable to reach live music services right now.');
          return;
        }

        registerTracks(blended);
        if (shelves?.categoryTracksMap) {
          registerTracks(Object.values(shelves.categoryTracksMap).flat());
        }
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
              subtitle: (t.genre || t.category).toLowerCase(),
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
            ? err.message.toLowerCase()
            : 'failed to load live music feeds.'
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
        fetchAtherHomeShelves({
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
      const normCat = category.trim().toLowerCase();
      setSelectedCategory(normCat);
      if (normCat === 'all') {
        if (allFeedTracks.length > 0) {
          setPopularTracks(allFeedTracks);
          setFeedError(null);
          setFeedLoading(false);
        } else {
          await loadDiscoveryFeeds();
        }
        return;
      }

      const prewarmed = getCachedCategorySongs(normCat);
      if (prewarmed.length > 0) {
        registerTracks(prewarmed);
        setPopularTracks(prewarmed);
        setFeedError(null);
        setFeedLoading(false);
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

        const [realRes, itunesRes, audiusRes] = await Promise.allSettled([
          searchRealSongs(normCat, 40),
          searchItunesTracks(normCat, 50),
          searchAudiusTracks(normCat, 25),
        ]);
        if (seq !== feedSeqRef.current) return;

        const realTracks =
          realRes.status === 'fulfilled' ? realRes.value : [];
        const itunesTracks =
          itunesRes.status === 'fulfilled' ? itunesRes.value : [];
        const audiusTracks =
          audiusRes.status === 'fulfilled' ? audiusRes.value : [];
        const mergedRaw = mergeUniqueTracks(
          realTracks,
          itunesTracks,
          audiusTracks
        );
        const filteredOfficial = mergedRaw.filter((t) =>
          isOfficialArtistTrack(t, normCat)
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
            ? err.message.toLowerCase()
            : `failed to fetch ${normCat} tracks.`
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

  // automatic background full-track resolver via SimpMusic InnerTube + fallbacks
  const ensureFullTrack = useCallback(
    async (track: ShowcaseTrack): Promise<ShowcaseTrack> => {
      if (
        track.streamStatus === 'full' &&
        track.streamUrl &&
        track.streamSource !== 'itunes-preview'
      ) {
        return track;
      }
      if (isOffline) return track;

      const stream = await resolveFullAudioStream(track, effectiveStreamQuality);
      if (!stream) return track;

      const resolved: ShowcaseTrack = {
        ...track,
        streamUrl: stream.streamUrl,
        streamSource: stream.source,
        streamStatus:
          stream.source !== 'itunes-preview'
            ? 'full'
            : track.previewUrl
            ? 'preview-only'
            : 'unresolved',
        duration:
          stream.durationSec > 0
            ? Math.max(track.duration, stream.durationSec)
            : track.duration,
        isAudius: stream.source === 'audius' ? true : track.isAudius,
      };
      registerTracks([resolved]);
      queueManager.syncTrackMetadata(resolved);
      setDownloadedTracksMap((prev) =>
        prev[resolved.id] ? { ...prev, [resolved.id]: resolved } : prev
      );
      return resolved;
    },
    [isOffline, effectiveStreamQuality, registerTracks]
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
        setAiRecError('ai recommendations require the hosted backend server.');
        return;
      }
      const data = (await response.json()) as {
        headline?: string;
        recommendations?: AiRecommendationEntry[];
        error?: string;
      };
      if (!response.ok) {
        setAiRecError((data.error ?? 'failed to fetch ai recommendations.').toLowerCase());
        return;
      }
      setAiRecHeadline((data.headline ?? 'ai recommendations').toLowerCase());
      setAiRecommendations(
        Array.isArray(data.recommendations) ? data.recommendations : []
      );
    } catch (error) {
      setAiRecError(
        error instanceof Error
          ? error.message.toLowerCase()
          : 'unable to reach ai recommendations service.'
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
          setAiShuffleError('ai smart shuffle requires the hosted backend server.');
          setAiShuffleNote(null);
          return;
        }
        const data = (await response.json()) as {
          orderedTrackIds?: string[];
          note?: string;
          error?: string;
        };
        if (!response.ok) {
          setAiShuffleError((data.error ?? 'ai smart shuffle failed.').toLowerCase());
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
          setAiShuffleNote((data.note ?? 'ai smart shuffle sequenced your queue').toLowerCase());
        }
      } catch (error) {
        setAiShuffleError(
          error instanceof Error
            ? error.message.toLowerCase()
            : 'unable to reach ai smart shuffle service.'
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

      // background full-stream hydration for smoother playback & instant skips
      if (track.streamStatus !== 'full' && !isOffline) {
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

      const next = queueManager.resolveNextTrack(playableFeedTracks, false);
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
      const nextFallback = playableFeedTracks.find((t) => t.id !== activeTrackIdRef.current);
      if (nextFallback && !isOffline) {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: playableFeedTracks,
          startIndex: playableFeedTracks.findIndex((t) => t.id === nextFallback.id),
        });
        playResolvedTrack(nextFallback, 0, false);
      } else {
        audioEngine.pause();
      }
    });

    return () => {
      audioEngine.setOnEnded(null);
    };
  }, [playableFeedTracks, autoplay, downloadedIds, isOffline, playResolvedTrack]);

  const handleTogglePlay = useCallback(() => {
    if (!currentTrackId) {
      const firstTrack = playableFeedTracks[0] ?? Object.values(tracksByIdRef.current).find((t) => explicitAllowed || !t.explicit);
      if (firstTrack) {
        queueManager.setScopedQueue({
          scope: 'general',
          contextId: null,
          tracks: [
            firstTrack,
            ...playableFeedTracks.filter((t) => t.id !== firstTrack.id),
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
        showOfflineNotice('no downloaded tracks available offline');
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
    playableFeedTracks,
    explicitAllowed,
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
      const explicitSafe = filterExplicitTracks(tracks);
      const filtered = isOffline
        ? explicitSafe.filter((t) => downloadedIds.has(t.id))
        : explicitSafe;
      if (filtered.length === 0) {
        if (isOffline) {
          showOfflineNotice('unavailable offline — saved downloads only');
        } else if (!explicitAllowed && tracks.length > 0) {
          showOfflineNotice('explicit content blocked in settings');
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
      filterExplicitTracks,
      explicitAllowed,
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

      if (!explicitAllowed && targetTrack.explicit) {
        showOfflineNotice('explicit content blocked in settings');
        return;
      }

      if (isOffline && !downloadedIds.has(targetTrack.id)) {
        showOfflineNotice('unavailable offline — saved downloads only');
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
            ...playableFeedTracks.filter((t) => t.id !== targetTrack.id),
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
      explicitAllowed,
      isOffline,
      downloadedIds,
      downloadedTracksMap,
      playableFeedTracks,
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
          showOfflineNotice('unavailable offline — saved downloads only');
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
          : playableFeedTracks.map((t) => t.id);
      void runAiSmartShuffle(candidateIds, currentTrackId ?? undefined);
    } else if (!next) {
      setAiShuffleNote(null);
      setAiShuffleError(null);
    }
  }, [
    aiSettings.smartShuffle,
    isOffline,
    playableFeedTracks,
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
          ...homeCategories.filter((c) => c.toLowerCase() !== 'all'),
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
    if (playableFeedTracks.length === 0) return;
    const idx = currentTrackId
      ? Math.max(0, playableFeedTracks.findIndex((t) => t.id === currentTrackId))
      : 0;
    queueManager.setScopedQueue({
      scope: 'general',
      contextId: null,
      tracks: playableFeedTracks,
      startIndex: idx,
    });
  }, [playableFeedTracks, currentTrackId]);

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

      if (isOffline) {
        showOfflineNotice('connect to internet to download songs');
        return;
      }

      const connType =
        typeof navigator !== 'undefined'
          ? ((navigator as unknown as { connection?: { type?: string } }).connection?.type ?? '')
          : '';
      if (!downloadOverCellular && connType === 'cellular') {
        showOfflineNotice('cellular downloads disabled in settings');
        return;
      }

      const resolved = await ensureFullTrack(track);
      if (
        resolved.streamStatus !== 'full' ||
        !resolved.streamUrl ||
        resolved.streamSource === 'itunes-preview'
      ) {
        showOfflineNotice('full track stream unavailable for download');
        return;
      }

      const res = await saveTrackOffline(resolved, accountScopeUid, downloadQuality);
      if (res.ok) {
        setDownloadedTracksMap((prev) => ({ ...prev, [resolved.id]: { ...resolved } }));
      } else {
        showOfflineNotice(res.error || 'download failed');
      }
    },
    [
      activeAccount,
      downloadedTracksMap,
      isOffline,
      downloadOverCellular,
      downloadQuality,
      ensureFullTrack,
      showOfflineNotice,
    ]
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
        updatedAt: 'updated just now',
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
                updatedAt: 'updated just now',
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
                updatedAt: 'updated just now',
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
      setDisplayName(nextProfile.displayName || 'listener');
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
      setWifiQuality((nextPrefs.wifiQuality as AudioQualityTier) ?? 'High');
      setCellularQuality((nextPrefs.cellularQuality as AudioQualityTier) ?? 'Normal');
      setDownloadQuality((nextPrefs.downloadQuality as AudioQualityTier) ?? 'High');
      setLosslessSpatial(nextPrefs.losslessSpatial ?? true);
      setVolumeNormalization(nextPrefs.volumeNormalization ?? true);
      setMonoAudio(nextPrefs.monoAudio ?? false);
      setDataSaver(nextPrefs.dataSaver ?? false);
      setDownloadOverCellular(nextPrefs.downloadOverCellular ?? false);
      setLanguage((nextPrefs.language || 'english (us)').toLowerCase());
      setNotifyNewReleases(nextPrefs.notifyNewReleases ?? true);
      setNotifyMixUpdates(nextPrefs.notifyMixUpdates ?? true);
      setNotifyAppUpdates(nextPrefs.notifyAppUpdates ?? false);

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
    wifiQuality,
    cellularQuality,
    downloadQuality,
    losslessSpatial,
    volumeNormalization,
    monoAudio,
    dataSaver,
    downloadOverCellular,
    language,
    notifyNewReleases,
    notifyMixUpdates,
    notifyAppUpdates,
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
      const targetTrack = currentTrack ?? sharedPlayback?.track;
      if (!verifiedUid || !targetTrack) return;
      const pos = currentTrack
        ? audioEngine.getCurrentTime()
        : computeExactPositionSec(sharedPlayback);
      audioEngine.pause();
      await transferPlaybackToDevice(verifiedUid, device.id, device.name, {
        track: targetTrack,
        isPlaying: true,
        positionSec: pos,
        durationSec: targetTrack.duration || effectiveDuration,
      });
    },
    [verifiedUid, currentTrack, sharedPlayback, effectiveDuration]
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
    if (isReelsView && reelsAutoPauseMusic) {
      audioEngine.pause();
    }
  }, [isReelsView, reelsAutoPauseMusic]);

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

  if (!showSetupTransition && feedLoading && allFeedTracks.length === 0 && !isOffline && !feedError) {
    return (
      <div className="fixed inset-0 h-[100dvh] z-40 bg-black text-white flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex flex-col items-center gap-5 max-w-xs w-full text-center">
          <motion.div
            initial={{ scale: 0.92, opacity: 0.8 }}
            animate={{ scale: [0.96, 1.04, 0.96], opacity: 1 }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="ather-depth-card w-16 h-16 rounded-2xl flex items-center justify-center"
          >
            <AtherLogoMark className="w-11 h-11 rounded-xl" />
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black tracking-tight text-white">Ather</h1>
            <p className="text-xs font-bold text-[#A1A1AA]">loading your music...</p>
          </div>
          <div className="w-40 h-1.5 rounded-full bg-[#141418] border border-[#242429] overflow-hidden">
            <motion.div
              className="h-full w-1/2 rounded-full bg-white"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>
    );
  }

  const scheduleImmediateCloudSync = () => {
    if (verifiedUid && activeAccount?.provider === 'google') {
      cloudSync.schedulePush(verifiedUid, activeAccount.id, true);
    }
  };

  const activeNavIdx = Math.max(
    0,
    NAV_ITEMS.findIndex((i) => i.id === activeTab)
  );

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

      {/* upper menu bar */}
      {!isReelsView && (
        <header className="fixed top-0 left-0 right-0 z-30 w-full pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
          <div className="ather-depth-bar pointer-events-auto max-w-[1120px] mx-auto rounded-full px-4 sm:px-5 h-14 flex items-center justify-between">
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
              <AtherLogoMark className="w-7 h-7 rounded-lg border border-[#242429]" />
              <span>Ather</span>
            </motion.button>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                aria-label="open profile"
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
                className="ather-depth-btn w-9 h-9 rounded-full overflow-hidden shrink-0"
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
            reelsTracks={visibleReelsTracks}
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
                popularTracks={visiblePopularTracks}
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
                accountDeviceCount={accountDevices.length}
                onOpenDevices={() => setSettingsDevicesOpen(true)}
                onSignInGoogle={async () => {
                  const user = await signInWithGooglePopup();
                  const linked: ActiveAccountIdentity = {
                    id: sanitizeAccountId(`google:${user.uid}`),
                    provider: 'google',
                    uid: user.uid,
                    displayName:
                      user.displayName || user.email?.split('@')[0] || 'ather listener',
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
                  scheduleImmediateCloudSync();
                }}
                downloadedCount={downloadedIds.size}
                playlistCount={playlists.length}
                favoriteCount={favoriteIds.size}
                recentCount={recentTrackIds.length}
                autoplay={autoplay}
                onToggleAutoplay={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setAutoplay((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                showLyricsEnabled={showLyricsEnabled}
                onToggleShowLyrics={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setShowLyricsEnabled((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                explicitAllowed={explicitAllowed}
                onToggleExplicit={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setExplicitAllowed((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                crossfadeSeconds={crossfadeSeconds}
                onChangeCrossfade={(secs) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setCrossfadeSeconds(secs);
                  scheduleImmediateCloudSync();
                }}
                gaplessPlayback={gaplessPlayback}
                onToggleGapless={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setGaplessPlayback((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                openPlayerOnTap={openPlayerOnTap}
                onToggleOpenPlayerOnTap={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setOpenPlayerOnTap((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                hapticsEnabled={hapticsEnabled}
                onToggleHaptics={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setHapticsEnabled((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                miniSwipeEnabled={miniSwipeEnabled}
                onToggleMiniSwipe={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setMiniSwipeEnabled((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                lyricsGlowEnabled={lyricsGlowEnabled}
                onToggleLyricsGlow={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setLyricsGlowEnabled((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                reelsAutoScroll={reelsAutoScroll}
                onToggleReelsAutoScroll={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsAutoScroll((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                reelsDurationSeconds={reelsDurationSeconds}
                onChangeReelsDuration={(secs) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsDurationSeconds(secs);
                  scheduleImmediateCloudSync();
                }}
                reelsAutoPauseMusic={reelsAutoPauseMusic}
                onToggleReelsAutoPauseMusic={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setReelsAutoPauseMusic((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                trackActivity={trackActivity}
                onToggleTrackActivity={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setTrackActivity((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                privateSession={privateSession}
                onTogglePrivateSession={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setPrivateSession((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                onClearRecentHistory={() => {
                  recordHistoryCleared(activeAccount.id);
                  setRecentTrackIds([]);
                  setPlayHistory([]);
                  scheduleImmediateCloudSync();
                }}
                autoDownloadFavorites={autoDownloadFavorites}
                onToggleAutoDownloadFavorites={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setAutoDownloadFavorites((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                onClearAllDownloads={() => {
                  setDownloadedTracksMap({});
                  void clearAllOfflineTrackBlobs(
                    getCanonicalAccountScopeId(activeAccount)
                  );
                }}
                wifiQuality={wifiQuality}
                onChangeWifiQuality={(tier) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setWifiQuality(tier);
                  scheduleImmediateCloudSync();
                }}
                cellularQuality={cellularQuality}
                onChangeCellularQuality={(tier) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setCellularQuality(tier);
                  scheduleImmediateCloudSync();
                }}
                downloadQuality={downloadQuality}
                onChangeDownloadQuality={(tier) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setDownloadQuality(tier);
                  scheduleImmediateCloudSync();
                }}
                losslessSpatial={losslessSpatial}
                onToggleLosslessSpatial={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setLosslessSpatial((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                volumeNormalization={volumeNormalization}
                onToggleVolumeNormalization={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setVolumeNormalization((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                monoAudio={monoAudio}
                onToggleMonoAudio={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setMonoAudio((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                dataSaver={dataSaver}
                onToggleDataSaver={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setDataSaver((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                downloadOverCellular={downloadOverCellular}
                onToggleDownloadOverCellular={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setDownloadOverCellular((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                language={language}
                onChangeLanguage={(lang) => {
                  touchSyncSection('preferences', activeAccount.id);
                  setLanguage(lang.toLowerCase());
                  scheduleImmediateCloudSync();
                }}
                notifyNewReleases={notifyNewReleases}
                onToggleNotifyNewReleases={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setNotifyNewReleases((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                notifyMixUpdates={notifyMixUpdates}
                onToggleNotifyMixUpdates={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setNotifyMixUpdates((v) => !v);
                  scheduleImmediateCloudSync();
                }}
                notifyAppUpdates={notifyAppUpdates}
                onToggleNotifyAppUpdates={() => {
                  touchSyncSection('preferences', activeAccount.id);
                  setNotifyAppUpdates((v) => !v);
                  scheduleImmediateCloudSync();
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
                  scheduleImmediateCloudSync();
                }}
                onChangeEqBand={(index, value) => {
                  touchSyncSection('eq', activeAccount.id);
                  setEqState((prev) => ({
                    preset: 'Custom',
                    bands: prev.bands.map((v, i) => (i === index ? value : v)),
                  }));
                  scheduleImmediateCloudSync();
                }}
                aiSmartShuffleEnabled={aiSettings.smartShuffle}
                onToggleAiSmartShuffle={() => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    smartShuffle: !prev.smartShuffle,
                  }));
                  scheduleImmediateCloudSync();
                }}
                aiRecommendationsEnabled={aiSettings.recommendations}
                onToggleAiRecommendations={() => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    recommendations: !prev.recommendations,
                  }));
                  scheduleImmediateCloudSync();
                }}
                aiDiscoveryLevel={aiSettings.discoveryLevel}
                onChangeAiDiscoveryLevel={(level) => {
                  touchSyncSection('ai', activeAccount.id);
                  setAiSettings((prev) => ({
                    ...prev,
                    discoveryLevel: level,
                  }));
                  scheduleImmediateCloudSync();
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
          <div className="pointer-events-auto max-w-md w-full rounded-full bg-white text-black border border-[#242429] px-4 py-2 flex items-center justify-between gap-2 text-xs font-extrabold">
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
              downloads
            </button>
          </div>
        )}

        {currentTrack &&
          activeTab !== 'reels' &&
          !miniPlayerDismissed && (
            <div
              role="button"
              tabIndex={0}
              aria-label={`now playing: ${currentTrack.title.toLowerCase()} by ${currentTrack.artist.toLowerCase()}. open player.${
                !isPlaying ? ' swipe horizontally to dismiss.' : ''
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
                transform: `translate3d(${miniDragX}px, 0, 0)`,
                opacity: Math.max(0, 1 - Math.abs(miniDragX) / 260),
                transition: isDraggingMini
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.32, 1.28, 0.36, 1), opacity 0.2s ease',
              }}
              className={`ather-depth-bar pointer-events-auto relative overflow-hidden max-w-md w-full rounded-full px-3 ${
                lookPrefs.compactTiles ? 'py-2' : 'py-2.5'
              } flex items-center gap-3 cursor-pointer active:scale-[0.99] select-none ${
                !isPlaying ? 'touch-pan-y' : ''
              }`}
            >
              <motion.div
                key={currentTrack.id}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[#242429]"
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
                  {currentTrack.title.toLowerCase()}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenArtist(currentTrack.artist);
                  }}
                  className="block max-w-full text-[11px] font-bold text-[#A1A1AA] hover:text-white hover:underline truncate mt-0.5 leading-tight text-left transition-colors"
                >
                  {currentTrack.artist.toLowerCase()}
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <motion.button
                  type="button"
                  aria-label={isPlaying ? 'pause' : 'play'}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.84 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}
                  className="ather-acid-btn w-10 h-10 rounded-full flex items-center justify-center"
                >
                  {isPlaying ? (
                    <PauseGlyph className="w-4 h-4" />
                  ) : (
                    <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  aria-label="next track"
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.84 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextTrack();
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#141418] transition-colors"
                >
                  <NextGlyph className="w-4 h-4" />
                </motion.button>
              </div>

              {/* 2px White Hairline Progress Bar */}
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#141418] rounded-full overflow-hidden pointer-events-none"
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
              className="ather-depth-pill pointer-events-auto max-w-[480px] w-full rounded-full px-4 py-1.5 flex items-center justify-between gap-2 text-[11px] font-extrabold text-white"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <AiSparklesGlyph className="w-3.5 h-3.5 shrink-0 text-white" active={true} />
                <span className="truncate">
                  {aiShuffleLoading
                    ? 'sequencing queue with ai smart shuffle...'
                    : aiShuffleError}
                </span>
              </span>
              {aiShuffleError && (
                <button
                  type="button"
                  onClick={() => setAiShuffleError(null)}
                  className="underline shrink-0 text-white hover:text-[#A1A1AA]"
                >
                  dismiss
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* online / offline connectivity indicator */}
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
              className={`pointer-events-auto max-w-[480px] w-full rounded-2xl px-4 py-2 flex items-center justify-between gap-3 text-xs font-extrabold border ${
                !isOffline
                  ? 'bg-white text-black border-[#242429]'
                  : 'bg-[#141418] text-white border-[#2A2A32]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {!isOffline ? (
                  <WifiOnGlyph className="w-4 h-4 shrink-0" />
                ) : (
                  <WifiOffGlyph className="w-4 h-4 text-white shrink-0" />
                )}
                <span className="truncate">
                  {!isOffline
                    ? onlinePopupLabel
                    : !isNetworkOnline
                    ? 'no internet connection · offline mode'
                    : 'offline mode · playing downloads'}
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
                      className="underline text-white hover:text-[#A1A1AA] text-[11px]"
                    >
                      downloads
                    </button>
                  )}
                  {isNetworkOnline && manualOfflineMode && (
                    <button
                      type="button"
                      onClick={() => setManualOfflineMode(false)}
                      className="ather-acid-btn px-2.5 py-0.5 rounded-full text-[11px] font-extrabold"
                    >
                      go online
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-extrabold tracking-wider text-black/80 shrink-0">
                  connected
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* floating monochrome pill navigation bar */}
        <nav
          aria-label="primary navigation"
          className="ather-depth-bar pointer-events-auto relative max-w-[480px] w-full rounded-full p-1.5 grid grid-cols-5 items-center"
        >
          <div
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 bottom-1.5 w-[calc((100%-12px)/5)] rounded-full bg-white pointer-events-none"
            style={{
              transform: `translate3d(${activeNavIdx * 100}%, 0, 0)`,
              transition: lookPrefs.springMotion
                ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'transform 120ms ease-out',
            }}
          />

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                onClick={() => {
                  setActiveTab(item.id);
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedCollection(null);
                  setSelectedShelf(null);
                }}
                className={`relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1.5 rounded-full text-[10px] font-extrabold transition-colors duration-150 touch-manipulation active:scale-95 ${
                  active
                    ? 'text-black'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" active={active} />
                <span className="leading-none truncate max-w-full">
                  {item.label}
                </span>
              </button>
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

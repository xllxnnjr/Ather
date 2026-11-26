import { CategoryPill, ShowcaseTrack } from '../types/music';
import {
  dispatchLocalAccountSyncNeeded,
  getAccountSliceKey,
  touchSyncSection,
} from './accountStorage';
import { clearMusicFeedCaches, isValidArtistName } from './musicApi';

const MAX_RECENT_IDS = 120;

export const STARTER_GENRE_DEFAULTS = [
  'Hip Hop',
  'Pop',
  'R&B',
  'Electronic',
  'Afrobeats',
] as const;

export const CORE_CATEGORY_PILLS: CategoryPill[] = [
  'All',
  'Party',
  'Blues',
  'Sad',
  'Hip Hop',
];

export interface UserMusicProfile {
  genreScores: Record<string, number>;
  artistScores: Record<string, number>;
  followedArtists: string[];
  onboardingGenres: string[];
  onboardingArtists: string[];
  recentlySeenTrackIds: string[];
  updatedAt: string;
}

function getProfileStorageKey(): string {
  return getAccountSliceKey('userMusicProfile');
}

function defaultProfile(): UserMusicProfile {
  return {
    genreScores: {
      'Hip Hop': 4,
      Pop: 3,
      'R&B': 3,
      Electronic: 2,
      Afrobeats: 2,
    },
    artistScores: {},
    followedArtists: [],
    onboardingGenres: [],
    onboardingArtists: [],
    recentlySeenTrackIds: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadUserMusicProfile(): UserMusicProfile {
  if (typeof window === 'undefined') return defaultProfile();
  try {
    const raw = window.localStorage.getItem(getProfileStorageKey());
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<UserMusicProfile>;
    return {
      genreScores:
        parsed.genreScores && typeof parsed.genreScores === 'object'
          ? { ...defaultProfile().genreScores, ...parsed.genreScores }
          : defaultProfile().genreScores,
      artistScores:
        parsed.artistScores && typeof parsed.artistScores === 'object'
          ? parsed.artistScores
          : {},
      followedArtists: Array.isArray(parsed.followedArtists)
        ? parsed.followedArtists.filter(
            (a): a is string => typeof a === 'string' && isValidArtistName(a)
          )
        : [],
      onboardingGenres: Array.isArray(parsed.onboardingGenres)
        ? parsed.onboardingGenres.filter((g): g is string => typeof g === 'string')
        : [],
      onboardingArtists: Array.isArray(parsed.onboardingArtists)
        ? parsed.onboardingArtists.filter(
            (a): a is string => typeof a === 'string' && isValidArtistName(a)
          )
        : [],
      recentlySeenTrackIds: Array.isArray(parsed.recentlySeenTrackIds)
        ? parsed.recentlySeenTrackIds.filter((id): id is string => typeof id === 'string')
        : [],
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return defaultProfile();
  }
}

export function saveUserMusicProfile(profile: UserMusicProfile) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getProfileStorageKey(),
      JSON.stringify({
        ...profile,
        updatedAt: new Date().toISOString(),
      })
    );
    touchSyncSection('taste');
    dispatchLocalAccountSyncNeeded();
  } catch {
    // Ignore storage quota errors
  }
}

export function seedOnboardingTasteProfile(
  selectedGenres: string[],
  selectedArtists: string[]
): UserMusicProfile {
  const base = loadUserMusicProfile();
  const nextGenres: Record<string, number> = {};
  const cleanGenres = selectedGenres.map((g) => g.trim()).filter(Boolean);

  cleanGenres.forEach((clean, idx) => {
    nextGenres[clean] = Math.max(25 - idx, (base.genreScores[clean] ?? 0) + 20);
  });
  for (const [k, v] of Object.entries(base.genreScores)) {
    if (!(k in nextGenres)) {
      nextGenres[k] = v;
    }
  }

  const cleanArtists = selectedArtists
    .map((a) => a.trim())
    .filter((a) => isValidArtistName(a));
  const nextArtists: Record<string, number> = { ...base.artistScores };
  cleanArtists.forEach((clean, idx) => {
    nextArtists[clean] = Math.max(25 - idx, (nextArtists[clean] ?? 0) + 20);
  });

  const followed = Array.from(new Set([...cleanArtists, ...base.followedArtists]));

  const next: UserMusicProfile = {
    ...base,
    genreScores: nextGenres,
    artistScores: nextArtists,
    followedArtists: followed,
    onboardingGenres: cleanGenres,
    onboardingArtists: cleanArtists,
    updatedAt: new Date().toISOString(),
  };
  saveUserMusicProfile(next);
  clearMusicFeedCaches();
  return next;
}

function normalizeGenreLabel(raw?: string): string | null {
  if (!raw) return null;
  const g = raw.trim();
  if (!g || g.toLowerCase() === 'music' || g.toLowerCase() === 'top chart') {
    return null;
  }
  const low = g.toLowerCase();
  if (low.includes('hip') || low.includes('rap') || low.includes('trap')) return 'Hip Hop';
  if (low.includes('r&b') || low.includes('soul')) return 'R&B';
  if (low.includes('afro')) return 'Afrobeats';
  if (low.includes('elect') || low.includes('dance') || low.includes('house')) return 'Electronic';
  if (low.includes('pop')) return 'Pop';
  if (low.includes('blue')) return 'Blues';
  if (low.includes('rock')) return 'Rock';
  if (low.includes('latin')) return 'Latin';
  if (low.includes('indie') || low.includes('alt')) return 'Alternative';
  return g;
}

function bumpAffinity(
  profile: UserMusicProfile,
  artist: string | undefined,
  genre: string | undefined,
  weight: number
): UserMusicProfile {
  const nextGenreScores = { ...profile.genreScores };
  const nextArtistScores = { ...profile.artistScores };

  const cleanGenre = normalizeGenreLabel(genre);
  if (cleanGenre) {
    nextGenreScores[cleanGenre] = (nextGenreScores[cleanGenre] ?? 0) + weight;
  }

  const cleanArtist = artist?.split(/,|feat\.|ft\.|&/i)[0]?.trim();
  if (cleanArtist && isValidArtistName(cleanArtist)) {
    nextArtistScores[cleanArtist] = (nextArtistScores[cleanArtist] ?? 0) + weight;
  }

  return {
    ...profile,
    genreScores: nextGenreScores,
    artistScores: nextArtistScores,
  };
}

export function recordTrackInteraction(
  track: Pick<ShowcaseTrack, 'id' | 'artist' | 'genre' | 'category'>,
  weight = 2
): UserMusicProfile {
  const current = loadUserMusicProfile();
  const updated = bumpAffinity(
    current,
    track.artist,
    track.genre || track.category,
    weight
  );
  const nextSeen = [
    track.id,
    ...updated.recentlySeenTrackIds.filter((id) => id !== track.id),
  ].slice(0, MAX_RECENT_IDS);

  const finalProfile: UserMusicProfile = {
    ...updated,
    recentlySeenTrackIds: nextSeen,
  };
  saveUserMusicProfile(finalProfile);
  return finalProfile;
}

export function recordSearchAffinity(query: string, topHit?: ShowcaseTrack): UserMusicProfile {
  const current = loadUserMusicProfile();
  let next = current;
  if (topHit) {
    next = bumpAffinity(next, topHit.artist, topHit.genre || topHit.category, 2);
  } else {
    const q = query.trim();
    if (q.length >= 2) {
      const normalizedGenre = normalizeGenreLabel(q);
      if (normalizedGenre) {
        next = bumpAffinity(next, undefined, normalizedGenre, 2);
      } else if (isValidArtistName(q)) {
        next = bumpAffinity(next, q, undefined, 1);
      }
    }
  }
  saveUserMusicProfile(next);
  return next;
}

export function toggleFollowedArtistInProfile(
  artistName: string,
  artistGenres: string[] = []
): { profile: UserMusicProfile; isFollowing: boolean } {
  const current = loadUserMusicProfile();
  const trimmed = artistName.trim();
  const low = trimmed.toLowerCase();
  const exists = current.followedArtists.some((a) => a.toLowerCase() === low);

  let nextFollowed: string[];
  let nextProfile = { ...current };

  if (exists) {
    nextFollowed = current.followedArtists.filter((a) => a.toLowerCase() !== low);
  } else {
    nextFollowed = isValidArtistName(trimmed)
      ? [trimmed, ...current.followedArtists]
      : current.followedArtists;
    nextProfile = bumpAffinity(nextProfile, trimmed, artistGenres[0], 4);
    for (const extraGenre of artistGenres.slice(1, 3)) {
      nextProfile = bumpAffinity(nextProfile, undefined, extraGenre, 2);
    }
  }

  nextProfile = {
    ...nextProfile,
    followedArtists: nextFollowed,
  };
  saveUserMusicProfile(nextProfile);
  return { profile: nextProfile, isFollowing: !exists };
}

export function isArtistFollowedInProfile(
  artistName: string,
  profile?: UserMusicProfile
): boolean {
  const p = profile ?? loadUserMusicProfile();
  const low = artistName.trim().toLowerCase();
  return p.followedArtists.some((a) => a.toLowerCase() === low);
}

export function markReelsSeen(trackIds: string[]): UserMusicProfile {
  const current = loadUserMusicProfile();
  const merged = Array.from(
    new Set([...trackIds, ...current.recentlySeenTrackIds])
  ).slice(0, MAX_RECENT_IDS);
  const next = { ...current, recentlySeenTrackIds: merged };
  saveUserMusicProfile(next);
  return next;
}

/**
 * Builds the ranked category chips starting with "All", followed immediately by the
 * user's onboarding / highest-affinity genres and core discovery categories.
 */
export function getRankedCategories(profile?: UserMusicProfile): string[] {
  const p = profile ?? loadUserMusicProfile();
  const coreDiscovery = ['hip hop', 'pop', 'r&b', 'electronic', 'afrobeats', 'party', 'blues', 'sad'];
  const scoreMap = new Map<string, number>();
  for (const [k, v] of Object.entries(p.genreScores)) {
    const low = k.trim().toLowerCase();
    if (!low || low === 'all') continue;
    scoreMap.set(low, Math.max(scoreMap.get(low) ?? 0, v));
  }

  const allNames = Array.from(
    new Set([
      ...p.onboardingGenres.map((g) => g.trim().toLowerCase()).filter(Boolean),
      ...Array.from(scoreMap.keys()),
      ...coreDiscovery,
    ])
  ).filter((g) => g !== 'all');

  allNames.sort((a, b) => (scoreMap.get(b) ?? 0) - (scoreMap.get(a) ?? 0));
  return ['all', ...allNames.slice(0, 8)];
}

/**
 * Returns seed query terms tailored to user's taste profile & onboarding selections
 * for fresh Reels & Home shelves.
 */
export function getPersonalizedSeedTerms(profile?: UserMusicProfile): string[] {
  const p = profile ?? loadUserMusicProfile();
  const topArtists = Object.entries(p.artistScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const topGenres = Object.entries(p.genreScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);

  const combined = Array.from(
    new Set([
      ...p.onboardingArtists,
      ...p.followedArtists.slice(0, 4),
      ...topArtists,
      ...p.onboardingGenres,
      ...topGenres,
      ...STARTER_GENRE_DEFAULTS,
    ])
  ).filter((term) => term.trim().length > 1);

  return combined.slice(0, 12);
}

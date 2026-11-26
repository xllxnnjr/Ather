import { ShowcaseTrack } from '../types/music';
import { isOfficialArtistTrack } from './musicApi';
import { loadUserMusicProfile } from './tasteProfile';

export interface NextSongSelectionOptions {
  currentTrack: ShowcaseTrack | null;
  candidatePool: ShowcaseTrack[];
  preferredGenres: string[];
  recentTrackIds: string[];
  aiShuffleEnabled?: boolean;
  aiRecommendationsEnabled?: boolean;
}

const ONBOARDING_STORAGE_KEY = 'ather_onboarding_v1';

const GENRE_KEYWORDS: Record<string, string[]> = {
  'hip hop': ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'boom bap'],
  'r&b': ['r&b', 'rnb', 'soul', 'neo-soul', 'neo soul', 'contemporary r&b'],
  pop: ['pop', 'synthpop', 'electropop', 'dance pop', 'indie pop'],
  afrobeats: ['afrobeats', 'afropop', 'amapiano', 'afro'],
  electronic: ['electronic', 'house', 'edm', 'techno', 'uk garage', 'ambient'],
  alternative: ['alternative', 'indie', 'alt', 'dream pop', 'shoegaze'],
  rock: ['rock', 'alt-rock', 'indie rock', 'punk', 'metal', 'grunge'],
  latin: ['latin', 'reggaeton', 'urbano', 'bachata', 'salsa'],
  blues: ['blues', 'jazz', 'soul', 'funk'],
  party: ['party', 'dance', 'club', 'electronic', 'afrobeats'],
  sad: ['sad', 'acoustic', 'singer-songwriter', 'ballad', 'folk', 'ambient'],
  'k-pop': ['k-pop', 'kpop', 'korean pop'],
};

export function readStoredOnboardingGenres(): string[] {
  const collected: string[] = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { preferredGenres?: string[] };
        if (Array.isArray(parsed?.preferredGenres)) {
          for (const g of parsed.preferredGenres) {
            if (typeof g === 'string' && g.trim()) collected.push(g.trim());
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  const taste = loadUserMusicProfile();
  if (Array.isArray(taste.onboardingGenres)) {
    for (const g of taste.onboardingGenres) {
      if (typeof g === 'string' && g.trim() && !collected.includes(g.trim())) {
        collected.push(g.trim());
      }
    }
  }
  return collected;
}

function matchesGenreTerm(haystack: string, genre: string): boolean {
  const lowerGenre = genre.trim().toLowerCase();
  if (!lowerGenre) return false;
  if (haystack.includes(lowerGenre)) return true;
  const aliases = GENRE_KEYWORDS[lowerGenre];
  if (!aliases) return false;
  return aliases.some((alias) => haystack.includes(alias));
}

export function scoreTrackForOnboardingGenres(
  track: ShowcaseTrack,
  options: Pick<
    NextSongSelectionOptions,
    'currentTrack' | 'preferredGenres' | 'recentTrackIds' | 'aiShuffleEnabled' | 'aiRecommendationsEnabled'
  >
): number {
  let score = 0;
  const trackText = `${track.genre || ''} ${track.category || ''} ${track.album || ''}`.toLowerCase();
  const trackArtist = (track.artist || '').toLowerCase();

  // Onboarding & taste genres carry primary weight
  const genres = options.preferredGenres.length > 0 ? options.preferredGenres : readStoredOnboardingGenres();
  for (let i = 0; i < genres.length; i += 1) {
    if (matchesGenreTerm(trackText, genres[i])) {
      score += 30 - Math.min(10, i * 2);
    }
  }

  // Current playing track cohesion (same genre/category, avoid back-to-back exact same artist when pool allows)
  if (options.currentTrack) {
    const curGenre = (options.currentTrack.genre || options.currentTrack.category || '').toLowerCase();
    const curArtist = (options.currentTrack.artist || '').toLowerCase();
    if (curGenre && matchesGenreTerm(trackText, curGenre)) {
      score += 18;
    }
    if (curArtist && trackArtist === curArtist) {
      score -= 8; // keep variety flowing
    }
  }

  // Taste profile followed artists / top artists boost
  const taste = loadUserMusicProfile();
  for (const favArtist of taste.followedArtists || []) {
    if (favArtist && trackArtist.includes(favArtist.toLowerCase())) {
      score += 14;
    }
  }

  // Light AI boost only when user explicitly turns AI features ON (default OFF)
  if (options.aiShuffleEnabled || options.aiRecommendationsEnabled) {
    const topGenreKeys = Object.entries(taste.genreScores || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);
    for (const g of topGenreKeys) {
      if (matchesGenreTerm(trackText, g)) score += 10;
    }
  }

  // Ready stream bonus
  if (track.streamStatus === 'full' || track.streamUrl) {
    score += 4;
  }

  // Heavy penalty for recently played tracks
  const recentIndex = options.recentTrackIds.indexOf(track.id);
  if (recentIndex !== -1) {
    score -= Math.max(20, 70 - recentIndex * 5);
  }

  // Controlled jitter so consecutive plays feel fresh while honoring genre rankings
  return score + Math.random() * 5;
}

export function pickNextSongBySetupGenres(
  options: NextSongSelectionOptions
): ShowcaseTrack | null {
  const { currentTrack, candidatePool, recentTrackIds } = options;
  if (!Array.isArray(candidatePool) || candidatePool.length === 0) return null;

  const currentId = currentTrack?.id;
  const recentSet = new Set(recentTrackIds.slice(0, 12));

  const validOfficial = candidatePool.filter(
    (t) => t && t.id !== currentId && isOfficialArtistTrack(t)
  );
  const pool =
    validOfficial.length > 0
      ? validOfficial
      : candidatePool.filter((t) => t && t.id !== currentId);

  if (pool.length === 0) return null;

  const nonRecent = pool.filter((t) => !recentSet.has(t.id));
  const selectionPool = nonRecent.length > 0 ? nonRecent : pool;

  const scored = selectionPool
    .map((track) => ({
      track,
      score: scoreTrackForOnboardingGenres(track, options),
    }))
    .sort((a, b) => b.score - a.score);

  const topBucket = scored.slice(0, Math.min(3, scored.length));
  return topBucket[Math.floor(Math.random() * topBucket.length)]?.track ?? scored[0].track;
}

import { pickGradientArtwork } from '../data/showcaseCatalog';
import {
  CategoryPill,
  LyricLine,
  ShowcaseTrack,
} from '../types/music';

export const AUDIUS_API_BASE = 'https://discoveryprovider.audius.co/v1';
export const AUDIUS_APP_NAME = 'Ather';
export const LRCLIB_API_BASE = 'https://lrclib.net/api';

interface AudiusRawArtwork {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
}

interface AudiusRawUser {
  id?: string;
  name?: string;
  handle?: string;
}

export interface AudiusRawTrack {
  id?: string | number;
  title?: string;
  duration?: number;
  genre?: string;
  mood?: string;
  play_count?: number;
  release_date?: string;
  artwork?: AudiusRawArtwork | null;
  user?: AudiusRawUser | null;
}

interface AudiusTracksResponse {
  data?: AudiusRawTrack[];
}

interface LrclibGetResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

function sanitizeImageUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return undefined;
}

function normalizeCategory(
  rawGenre?: string,
  rawMood?: string,
  override?: string
): string {
  if (override) return override.toLowerCase();
  const combined = `${rawGenre ?? ''} ${rawMood ?? ''}`.toLowerCase();
  if (combined.includes('hip') || combined.includes('rap') || combined.includes('trap')) {
    return 'hip hop';
  }
  if (combined.includes('blue') || combined.includes('jazz') || combined.includes('soul')) {
    return 'blues';
  }
  if (
    combined.includes('sad') ||
    combined.includes('ambient') ||
    combined.includes('acoustic') ||
    combined.includes('melanchol')
  ) {
    return 'sad';
  }
  return rawGenre?.trim().toLowerCase() || 'party';
}

export function getAudiusStreamUrl(trackId: string): string {
  return `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(
    trackId
  )}/stream?app_name=${AUDIUS_APP_NAME}`;
}

export function mapAudiusTrack(
  raw: AudiusRawTrack,
  categoryOverride?: CategoryPill
): ShowcaseTrack | null {
  if (!raw || raw.id === undefined || raw.id === null) return null;
  const id = `audius-${String(raw.id)}`;
  const rawId = String(raw.id);
  const title = raw.title?.trim();
  if (!title) return null;
  const artist = (raw.user?.name?.trim() || raw.user?.handle?.trim() || '').trim();
  if (
    !artist ||
    artist.length < 2 ||
    /^(artist|unknown|various artists|independent artist|none|n\/a)$/i.test(artist)
  ) {
    return null;
  }
  const coverUrl = sanitizeImageUrl(
    raw.artwork?.['480x480'] || raw.artwork?.['150x150']
  );
  const duration =
    typeof raw.duration === 'number' &&
    Number.isFinite(raw.duration) &&
    raw.duration > 0
      ? Math.round(raw.duration)
      : 0;

  return {
    id,
    audiusId: rawId,
    title,
    artist,
    album: raw.genre?.trim() || 'audius',
    duration,
    durationMs: duration * 1000,
    fullDuration: duration,
    category: normalizeCategory(raw.genre, raw.mood, categoryOverride),
    genre: raw.genre?.trim() || undefined,
    artwork: pickGradientArtwork(id + title),
    coverUrl,
    streamUrl: getAudiusStreamUrl(rawId),
    releaseDate: raw.release_date ?? undefined,
    source: 'audius',
    isAudius: true,
    streamStatus: 'full',
    playCount: typeof raw.play_count === 'number' ? raw.play_count : undefined,
    accentColor: '#FFFFFF',
    glowColor: '#FFFFFF',
    secondaryGlowColor: '#A1A1AA',
    lyrics: [],
  };
}

export async function fetchAudiusTrending(limit = 20): Promise<ShowcaseTrack[]> {
  const url = `${AUDIUS_API_BASE}/tracks/trending?app_name=${AUDIUS_APP_NAME}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Audius trending request failed (${response.status})`);
  }
  const payload = (await response.json()) as AudiusTracksResponse;
  const list = Array.isArray(payload.data) ? payload.data : [];
  return list
    .map((item) => mapAudiusTrack(item))
    .filter((t): t is ShowcaseTrack => t !== null);
}

export async function searchAudiusTracks(
  query: string,
  limit = 25,
  categoryOverride?: CategoryPill
): Promise<ShowcaseTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(
    trimmed
  )}&app_name=${AUDIUS_APP_NAME}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Audius search request failed (${response.status})`);
  }
  const payload = (await response.json()) as AudiusTracksResponse;
  const list = Array.isArray(payload.data) ? payload.data : [];
  return list
    .map((item) => mapAudiusTrack(item, categoryOverride))
    .filter((t): t is ShowcaseTrack => t !== null);
}

function normalizeTokenText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/feat\.|ft\./g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(target: string, candidate: string): number {
  const a = normalizeTokenText(target);
  const b = normalizeTokenText(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const aWords = new Set(a.split(' ').filter((w) => w.length > 1));
  const bWords = new Set(b.split(' ').filter((w) => w.length > 1));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let shared = 0;
  aWords.forEach((w) => {
    if (bWords.has(w)) shared += 1;
  });
  return shared / Math.max(aWords.size, bWords.size);
}

export async function resolveFullAudiusTrack(
  track: ShowcaseTrack
): Promise<ShowcaseTrack> {
  if (track.streamUrl && track.streamStatus === 'full') {
    return track;
  }

  const cleanTitle =
    track.title.replace(/\s*[\[(][^)\]]*[\])]\s*/g, ' ').trim() || track.title;
  const query = `${cleanTitle} ${track.artist}`.trim();

  try {
    const url = `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(
      query
    )}&app_name=${AUDIUS_APP_NAME}&limit=5`;
    const response = await fetch(url);
    if (!response.ok) {
      return { ...track, streamStatus: 'preview-only' };
    }
    const payload = (await response.json()) as AudiusTracksResponse;
    const candidates = (Array.isArray(payload.data) ? payload.data : [])
      .map((raw) => mapAudiusTrack(raw))
      .filter((t): t is ShowcaseTrack => t !== null);

    let bestMatch: ShowcaseTrack | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const titleScore = tokenOverlapScore(track.title, candidate.title);
      const artistScore = tokenOverlapScore(track.artist, candidate.artist);
      const combinedScore = titleScore * 0.65 + artistScore * 0.35;
      if (titleScore >= 0.5 && (artistScore >= 0.4 || titleScore >= 0.85)) {
        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestMatch = candidate;
        }
      }
    }

    if (bestMatch && bestMatch.streamUrl) {
      const resolvedDuration =
        bestMatch.duration > 0 ? bestMatch.duration : track.duration;
      return {
        ...track,
        audiusId: bestMatch.audiusId,
        streamUrl: bestMatch.streamUrl,
        fullDuration: resolvedDuration,
        duration: resolvedDuration,
        durationMs: resolvedDuration * 1000,
        isAudius: true,
        streamStatus: 'full',
      };
    }

    return { ...track, streamStatus: 'preview-only' };
  } catch {
    return { ...track, streamStatus: 'preview-only' };
  }
}

export function parseLrcSyncedLyrics(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = lrc.split(/\r?\n/);
  const tagRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of rawLines) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(rawLine)) !== null) {
      const mins = Number(match[1]);
      const secs = Number(match[2]);
      const fracRaw = match[3] ?? '0';
      const frac =
        fracRaw.length === 3
          ? Number(fracRaw) / 1000
          : fracRaw.length === 2
          ? Number(fracRaw) / 100
          : Number(fracRaw) / 10;
      const totalSeconds = mins * 60 + secs + frac;
      if (Number.isFinite(totalSeconds)) {
        timestamps.push(totalSeconds);
      }
    }

    if (timestamps.length === 0) continue;
    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;

    for (const time of timestamps) {
      lines.push({ time, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

export interface FetchedLyricsResult {
  syncedLyrics: LyricLine[];
  plainLyrics: string | null;
}

export async function fetchTrackLyrics(
  title: string,
  artist: string
): Promise<FetchedLyricsResult> {
  const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || title.trim();
  const cleanArtist = artist.trim();
  const url = `${LRCLIB_API_BASE}/get?track_name=${encodeURIComponent(
    cleanTitle
  )}&artist_name=${encodeURIComponent(cleanArtist)}`;

  const response = await fetch(url);
  if (response.ok) {
    const data = (await response.json()) as LrclibGetResponse;
    const synced =
      typeof data.syncedLyrics === 'string' && data.syncedLyrics.trim().length > 0
        ? parseLrcSyncedLyrics(data.syncedLyrics)
        : [];
    const plain =
      typeof data.plainLyrics === 'string' && data.plainLyrics.trim().length > 0
        ? data.plainLyrics.trim()
        : null;
    if (synced.length > 0 || plain) {
      return { syncedLyrics: synced, plainLyrics: plain };
    }
  } else if (response.status !== 404) {
    throw new Error(`Lyrics lookup failed (${response.status})`);
  }

  const searchUrl = `${LRCLIB_API_BASE}/search?track_name=${encodeURIComponent(
    cleanTitle
  )}&artist_name=${encodeURIComponent(cleanArtist)}`;
  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    return { syncedLyrics: [], plainLyrics: null };
  }
  const matches = (await searchResponse.json()) as LrclibGetResponse[];
  if (!Array.isArray(matches) || matches.length === 0) {
    return { syncedLyrics: [], plainLyrics: null };
  }
  const firstWithLyrics =
    matches.find((m) => m.syncedLyrics?.trim() || m.plainLyrics?.trim()) ?? matches[0];
  return {
    syncedLyrics:
      typeof firstWithLyrics?.syncedLyrics === 'string' &&
      firstWithLyrics.syncedLyrics.trim().length > 0
        ? parseLrcSyncedLyrics(firstWithLyrics.syncedLyrics)
        : [],
    plainLyrics:
      typeof firstWithLyrics?.plainLyrics === 'string' &&
      firstWithLyrics.plainLyrics.trim().length > 0
        ? firstWithLyrics.plainLyrics.trim()
        : null,
  };
}

import { doesArtistNameMatch, pickGradientArtwork } from '../data/showcaseCatalog';
import {
  fetchDeezerAlbumCoverJsonp,
  fetchDeezerArtistJsonp,
} from './artistInfoApi';
import {
  fetchAppleCharts,
  lookupItunesAlbum,
  mapItunesSong as mapRawItunesSong,
  upgradeItunesArtwork,
} from './itunesApi';
import {
  AlbumItem,
  CategoryPill,
  CollectionItem,
  FeaturedArtistItem,
  LyricLine,
  LyricsLookupResult,
  SearchAllResults,
  SearchArtistResult,
  ShowcaseTrack,
  SyncedLyricLine,
} from '../types/music';

const ITUNES_API_BASE = 'https://itunes.apple.com';
const LRCLIB_API_BASE = 'https://lrclib.net/api';

const LYRICS_CACHE_KEY = 'ather_lrclib_cache_v1';
const NEW_RELEASES_CACHE_KEY = 'ather_live_new_releases_v2';
const HOME_SHELVES_CACHE_KEY = 'ather_home_snapshot_v1';
const HOME_SESSION_CACHE_KEY = 'ather_home_snapshot_session_v1';
const CATEGORY_SESSION_CACHE_KEY = 'ather_cat_songs_v1';
export const LIVE_FEED_TTL_MS = 30 * 60 * 1000;

export { upgradeItunesArtwork };

export interface DynamicDateContext {
  currentYear: number;
  currentMonthName: string;
  currentDateKey: string;
  nowMs: number;
}

export function getDynamicDateContext(now = new Date()): DynamicDateContext {
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const yyyy = String(currentYear);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return {
    currentYear,
    currentMonthName,
    currentDateKey: `${yyyy}-${mm}-${dd}`,
    nowMs: now.getTime(),
  };
}

const lyricsMemoryCache = new Map<string, LyricsLookupResult>();
const categorySongsMemoryCache = new Map<string, ShowcaseTrack[]>();

let newReleasesMemoryCache: {
  dateKey: string;
  ts: number;
  tracks: ShowcaseTrack[];
  albums: AlbumItem[];
} | null = null;

let homeShelvesMemoryCache: {
  dateKey: string;
  signature?: string;
  ts: number;
  data: AtherHomeShelves;
} | null = null;

export function clearMusicFeedCaches(): void {
  newReleasesMemoryCache = null;
  homeShelvesMemoryCache = null;
  categorySongsMemoryCache.clear();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(NEW_RELEASES_CACHE_KEY);
      window.localStorage.removeItem(HOME_SHELVES_CACHE_KEY);
      window.sessionStorage?.removeItem(HOME_SESSION_CACHE_KEY);
      window.sessionStorage?.removeItem(CATEGORY_SESSION_CACHE_KEY);
    } catch {
      // ignore storage errors
    }
  }
}

interface ItunesRawItem {
  wrapperType?: string;
  kind?: string;
  collectionType?: string;
  trackId?: number;
  collectionId?: number;
  artistId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  trackExplicitness?: string;
  collectionExplicitness?: string;
  trackCount?: number;
}

interface ItunesSearchResponse {
  resultCount?: number;
  results?: ItunesRawItem[];
}

interface DeezerRawArtist {
  id?: number;
  name?: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
  nb_fan?: number;
}

interface DeezerArtistSearchResponse {
  data?: DeezerRawArtist[];
}

interface LrclibRecord {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

function readLocalCache<T>(storageKey: string): Record<string, T> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, T>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCache<T>(storageKey: string, nextMap: Record<string, T>) {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(nextMap);
    const trimmed = entries.slice(-120);
    window.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // Ignore storage quota issues
  }
}

export function normalizeMusicText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\((feat\.|ft\.|featuring)[^)]*\)/gi, ' ')
    .replace(/\[(official[^[\]]*|lyrics?|audio|hd|4k|explicit|clean|remaster[^[\]]*)\]/gi, ' ')
    .replace(/\((official[^)]*|lyrics?|audio|deluxe[^)]*|expanded[^)]*|remaster[^)]*|explicit)\)/gi, ' ')
    .replace(/-\s*(remaster(ed)?(\s+\d{4})?|single|ep|deluxe).*/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(aRaw: string, bRaw: string): number {
  const a = normalizeMusicText(aRaw);
  const b = normalizeMusicText(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const aTokens = new Set(a.split(' ').filter((w) => w.length > 1));
  const bTokens = new Set(b.split(' ').filter((w) => w.length > 1));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  aTokens.forEach((t) => {
    if (bTokens.has(t)) shared += 1;
  });
  return shared / Math.max(aTokens.size, bTokens.size);
}

function scoreSongSearchRank(track: ShowcaseTrack, query: string): number {
  const q = normalizeMusicText(query);
  const titleNorm = normalizeMusicText(track.title);
  const artistNorm = normalizeMusicText(track.artist);
  let score = 0;
  if (titleNorm === q || artistNorm === q) score += 80;
  else if (titleNorm.startsWith(q) || artistNorm.startsWith(q)) score += 50;
  score += tokenSimilarity(track.title, query) * 35;
  score += tokenSimilarity(track.artist, query) * 30;
  if (track.explicit) score += 6;
  if (track.coverUrl) score += 4;
  return score;
}

const INVALID_ARTIST_NAME_SET = new Set([
  'artist',
  'unknown',
  'unknown artist',
  'various artists',
  'ather',
  'music',
  'official',
  'lyrics',
  'official audio',
  'official video',
  'none',
  'n/a',
  'karaoke',
  'tribute',
  'sound effects',
  'podcast',
  'radio',
]);

export function isValidArtistName(name?: string | null): boolean {
  const clean = (name ?? '').trim();
  if (clean.length < 2) return false;
  const lower = clean.toLowerCase();
  if (INVALID_ARTIST_NAME_SET.has(lower)) return false;
  if (/^(dj|d\.j\.|various\s+artists|karaoke|tribute|sound\s+effects|podcast|mixtape|radio)\b/i.test(lower)) {
    return false;
  }
  if (/^(track|song|episode|album|mix)\s*\d*$/i.test(clean)) return false;
  return true;
}

const NON_OFFICIAL_TRACK_REGEX =
  /\b(dj|d\.j\.|mixtape|radio|podcast|various\s+artists|karaoke|tribute|sound\s+effects|dj\s*(mix|set)|nonstop|megamix|mashup|continuous\s*mix|episode|live\s+set|club\s+mix|bootleg|slowed\s*(\+|&|and)?\s*reverb|sped\s*up|nightcore|8d\s*audio|full\s*album|hour\s*mix|audiobook|type\s*beat|parody|cover\s*version|instrumental\s*cover)\b/i;

export function isOfficialArtistTrack(
  track: Pick<ShowcaseTrack, 'title' | 'artist' | 'duration' | 'genre' | 'album' | 'coverUrl'>,
  userQuery?: string
): boolean {
  if (!track.title?.trim() || !isValidArtistName(track.artist)) {
    return false;
  }
  if (!track.coverUrl || !track.coverUrl.startsWith('http')) {
    return false;
  }
  const q = (userQuery || '').trim().toLowerCase();
  const userAskedForAlt =
    /\b(dj|mixtape|radio|podcast|karaoke|tribute|mix|mashup|slowed|reverb|sped\s*up|nightcore|live|club|bootleg|remix|type\s*beat|instrumental)\b/i.test(
      q
    );

  if (!userAskedForAlt) {
    const combined = `${track.title} ${track.album || ''} ${track.artist || ''}`.trim();
    if (NON_OFFICIAL_TRACK_REGEX.test(combined)) {
      return false;
    }
    if (typeof track.duration === 'number' && track.duration > 480) {
      return false;
    }
  }
  return true;
}

export function capTracksPerArtist(
  tracks: ShowcaseTrack[],
  maxPerArtist = 1
): ShowcaseTrack[] {
  const counts = new Map<string, number>();
  const out: ShowcaseTrack[] = [];
  for (const track of tracks) {
    const primaryArtist =
      track.artist.split(/,|feat\.|ft\.|&|\bx\b/i)[0]?.trim().toLowerCase() ||
      track.artist.trim().toLowerCase();
    if (!primaryArtist) continue;
    const prev = counts.get(primaryArtist) ?? 0;
    if (prev >= maxPerArtist) continue;
    counts.set(primaryArtist, prev + 1);
    out.push(track);
  }
  return out;
}

export async function searchRealSongs(
  query: string,
  limit = 25,
  categoryOverride?: CategoryPill,
  signal?: AbortSignal
): Promise<ShowcaseTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${ITUNES_API_BASE}/search?media=music&entity=song&limit=${Math.min(
    limit,
    50
  )}&explicit=Yes&term=${encodeURIComponent(trimmed)}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`iTunes search failed (${response.status})`);
  }

  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const seen = new Set<string>();
  const tracks: ShowcaseTrack[] = [];

  for (const row of rows) {
    const mapped = mapRawItunesSong(row, categoryOverride);
    if (!mapped || !mapped.previewUrl) continue;
    if (!isOfficialArtistTrack(mapped, trimmed)) continue;
    if (seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    tracks.push(mapped);
  }

  tracks.sort((a, b) => scoreSongSearchRank(b, trimmed) - scoreSongSearchRank(a, trimmed));
  return tracks;
}

export async function searchRealAlbums(
  query: string,
  limit = 20,
  signal?: AbortSignal
): Promise<AlbumItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${ITUNES_API_BASE}/search?media=music&entity=album&limit=${limit}&explicit=Yes&term=${encodeURIComponent(
    trimmed
  )}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const seen = new Set<string>();
  const albums: AlbumItem[] = [];

  for (const row of rows) {
    if (!row.collectionId || !row.collectionName || !row.artistName) continue;
    if (row.collectionExplicitness === 'cleaned') continue;
    if (!isValidArtistName(row.artistName)) continue;
    const cid = String(row.collectionId);
    if (seen.has(cid)) continue;
    seen.add(cid);
    const year = row.releaseDate ? new Date(row.releaseDate).getFullYear() : undefined;
    albums.push({
      id: `itunes-album-${cid}`,
      collectionId: cid,
      title: row.collectionName.trim(),
      artist: row.artistName.trim(),
      year: year && Number.isFinite(year) ? year : undefined,
      releaseDate: row.releaseDate,
      genre: row.primaryGenreName?.trim() || 'album',
      artwork: pickGradientArtwork(cid + row.collectionName),
      coverUrl: upgradeItunesArtwork(row.artworkUrl100),
      description: `${row.artistName.trim()} · ${row.collectionName.trim()}`,
      trackIds: [],
    });
  }
  return albums;
}

export async function lookupAlbumTracks(
  collectionId: string
): Promise<{ album: AlbumItem | null; tracks: ShowcaseTrack[] }> {
  return lookupItunesAlbum(collectionId);
}

/**
 * Resolves full album tracklists directly from iTunes + Deezer high-res artwork.
 */
export async function lookupAlbumDetails(
  album: AlbumItem
): Promise<{ album: AlbumItem | null; tracks: ShowcaseTrack[] }> {
  const cleanSearch = `${album.artist} ${album.title}`.trim();
  const hasNumericId = Boolean(
    album.collectionId &&
      /^\d+$/.test(album.collectionId.replace(/^itunes-album-/, '').trim())
  );

  let resolvedAlbum: AlbumItem | null = null;
  let tracks: ShowcaseTrack[] = [];

  if (hasNumericId && album.collectionId) {
    try {
      const lookup = await lookupAlbumTracks(album.collectionId);
      resolvedAlbum = lookup.album;
      tracks = lookup.tracks;
    } catch {
      // fall through to album search fallback
    }
  }

  if (tracks.length === 0) {
    try {
      const matchedAlbums = await searchRealAlbums(cleanSearch, 5);
      const best =
        matchedAlbums.find(
          (a) =>
            normalizeMusicText(a.title) === normalizeMusicText(album.title) ||
            tokenSimilarity(a.title, album.title) >= 0.65
        ) ?? matchedAlbums[0];
      if (best?.collectionId) {
        const lookup = await lookupAlbumTracks(best.collectionId);
        if (lookup.tracks.length > 0) {
          resolvedAlbum = lookup.album;
          tracks = lookup.tracks;
        }
      }
    } catch {
      // fall through to song query fallback
    }
  }

  if (tracks.length === 0) {
    const fallbackSongs = await searchRealSongs(cleanSearch, 20).catch(() => []);
    tracks = fallbackSongs
      .filter((t) => doesArtistNameMatch(t.artist, album.artist))
      .map((t) => ({ ...t, album: album.title }));
  }

  let resolvedCoverUrl = resolvedAlbum?.coverUrl || album.coverUrl;
  if (!resolvedCoverUrl) {
    resolvedCoverUrl =
      (await fetchDeezerAlbumCoverJsonp(album.artist, album.title)) ||
      tracks[0]?.coverUrl ||
      undefined;
  }

  const finalAlbum: AlbumItem = {
    ...(resolvedAlbum ?? album),
    coverUrl: resolvedCoverUrl,
    trackIds:
      resolvedAlbum?.trackIds?.length
        ? resolvedAlbum.trackIds
        : tracks.map((t) => t.id),
  };

  return { album: finalAlbum, tracks };
}

export async function searchRealArtists(
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<{ artistId: string; name: string; genre?: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${ITUNES_API_BASE}/search?media=music&entity=musicArtist&limit=${limit}&term=${encodeURIComponent(
    trimmed
  )}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as ItunesSearchResponse;
  const rows = Array.isArray(data.results) ? data.results : [];
  return rows
    .filter((r) => Boolean(r.artistId && r.artistName && isValidArtistName(r.artistName)))
    .map((r) => ({
      artistId: String(r.artistId),
      name: r.artistName!.trim(),
      genre: r.primaryGenreName?.trim(),
    }));
}

async function enrichAlbumsWithRealArtwork(
  albums: AlbumItem[]
): Promise<AlbumItem[]> {
  const needsArt = albums.filter((a) => !a.coverUrl);
  if (needsArt.length === 0) return albums;

  const resolvedMap = new Map<string, string>();
  await Promise.allSettled(
    needsArt.slice(0, 10).map(async (alb) => {
      const deezerCover = await fetchDeezerAlbumCoverJsonp(alb.artist, alb.title);
      if (deezerCover) {
        resolvedMap.set(alb.id, deezerCover);
      }
    })
  );

  return albums.map((alb) => {
    const better = resolvedMap.get(alb.id);
    return better ? { ...alb, coverUrl: better } : alb;
  });
}

const deezerPhotoCache = new Map<
  string,
  { name: string; photoUrl?: string; deezerFans?: number } | null
>();

export function fetchDeezerArtistPhoto(
  artistName: string
): Promise<{ name: string; photoUrl?: string; deezerFans?: number } | null> {
  const key = artistName.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (deezerPhotoCache.has(key)) {
    return Promise.resolve(deezerPhotoCache.get(key) ?? null);
  }

  return new Promise((resolve) => {
    const callbackName = `__atherDeezer_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      try {
        delete (window as unknown as Record<string, unknown>)[callbackName];
      } catch {
        (window as unknown as Record<string, unknown>)[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, 2500);

    (window as unknown as Record<string, (data: DeezerArtistSearchResponse) => void>)[
      callbackName
    ] = (payload: DeezerArtistSearchResponse) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();

      const list = Array.isArray(payload?.data) ? payload.data : [];
      const exact =
        list.find((item) => item.name?.trim().toLowerCase() === key) ?? list[0];

      if (!exact) {
        deezerPhotoCache.set(key, null);
        resolve(null);
        return;
      }

      const photoUrl =
        exact.picture_xl || exact.picture_big || exact.picture_medium || undefined;
      const result = {
        name: exact.name?.trim() || artistName,
        photoUrl: photoUrl && photoUrl.startsWith('http') ? photoUrl : undefined,
        deezerFans:
          typeof exact.nb_fan === 'number' && exact.nb_fan > 0
            ? exact.nb_fan
            : undefined,
      };
      deezerPhotoCache.set(key, result);
      resolve(result);
    };

    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(
      artistName.trim()
    )}&output=jsonp&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    document.body.appendChild(script);
  });
}

export async function fetchArtistProfilePhoto(
  artistName: string
): Promise<string> {
  const res = await fetchDeezerArtistPhoto(artistName);
  const raw = res?.photoUrl || '';
  return raw ? raw.replace(/^http:\/\//i, 'https://') : '';
}

export function parseLrcSyncedLines(lrc: string): SyncedLyricLine[] {
  const lines: SyncedLyricLine[] = [];
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

    for (const timeSec of timestamps) {
      lines.push({ timeSec, text, isSynced: true });
    }
  }

  lines.sort((a, b) => a.timeSec - b.timeSec);
  return lines;
}

function buildLyricsResult(record: LrclibRecord | null): LyricsLookupResult {
  if (!record) {
    return { syncedLyrics: [], lines: [], plainLyrics: null, isSynced: false };
  }

  const parsedSynced =
    typeof record.syncedLyrics === 'string' && record.syncedLyrics.trim().length > 0
      ? parseLrcSyncedLines(record.syncedLyrics)
      : [];

  if (parsedSynced.length > 0) {
    const syncedLyrics: LyricLine[] = parsedSynced.map((l) => ({
      time: l.timeSec,
      text: l.text,
    }));
    return {
      syncedLyrics,
      lines: parsedSynced,
      plainLyrics: record.plainLyrics?.trim() || null,
      isSynced: true,
    };
  }

  const plain =
    typeof record.plainLyrics === 'string' && record.plainLyrics.trim().length > 0
      ? record.plainLyrics.trim()
      : null;

  if (plain) {
    const plainLines: SyncedLyricLine[] = plain
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((text) => ({ timeSec: 0, text, isSynced: false }));
    return {
      syncedLyrics: [],
      lines: plainLines,
      plainLyrics: plain,
      isSynced: false,
    };
  }

  return { syncedLyrics: [], lines: [], plainLyrics: null, isSynced: false };
}

function cleanTrackTitleForLyrics(rawTitle: string): string {
  return (
    rawTitle
      .replace(/\((feat\.|ft\.|featuring)[^)]*\)/gi, ' ')
      .replace(/\[(official[^[\]]*|lyrics?|audio|explicit|clean|remaster[^[\]]*)\]/gi, ' ')
      .replace(/\((official[^)]*|lyrics?|audio|deluxe[^)]*|expanded[^)]*|remaster[^)]*)\)/gi, ' ')
      .replace(/-\s*(remaster(ed)?(\s+\d{4})?|single\s+version|radio\s+edit).*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || rawTitle.trim()
  );
}

function cleanArtistForLyrics(rawArtist: string): string {
  return (
    rawArtist
      .split(/,|feat\.|ft\.|&|\bx\b/i)[0]
      ?.replace(/\s+/g, ' ')
      .trim() || rawArtist.trim()
  );
}

export async function fetchSyncedLyrics(
  title: string,
  artist: string,
  durationSec?: number
): Promise<LyricsLookupResult> {
  const cleanTitle = cleanTrackTitleForLyrics(title);
  const cleanArtist = cleanArtistForLyrics(artist);
  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;

  if (lyricsMemoryCache.has(cacheKey)) {
    return lyricsMemoryCache.get(cacheKey)!;
  }

  const storedCache = readLocalCache<{ result: LyricsLookupResult; ts: number }>(
    LYRICS_CACHE_KEY
  );
  const persisted = storedCache[cacheKey];
  if (persisted && Date.now() - persisted.ts < 7 * 24 * 3600 * 1000) {
    lyricsMemoryCache.set(cacheKey, persisted.result);
    return persisted.result;
  }

  const saveAndReturn = (result: LyricsLookupResult) => {
    lyricsMemoryCache.set(cacheKey, result);
    if (result.lines.length > 0 || result.plainLyrics) {
      storedCache[cacheKey] = { result, ts: Date.now() };
      writeLocalCache(LYRICS_CACHE_KEY, storedCache);
    }
    return result;
  };

  const isStrictLyricsMatch = (rec: LrclibRecord): { ok: boolean; titleSim: number; artistSim: number } => {
    const titleSim = tokenSimilarity(cleanTitle, rec.trackName ?? '');
    const artistSim = tokenSimilarity(cleanArtist, rec.artistName ?? '');
    const normArtistReq = normalizeMusicText(cleanArtist);
    const normArtistRec = normalizeMusicText(rec.artistName ?? '');
    const artistContains =
      Boolean(normArtistReq) &&
      Boolean(normArtistRec) &&
      (normArtistRec.includes(normArtistReq) || normArtistReq.includes(normArtistRec));

    if (titleSim < 0.5) return { ok: false, titleSim, artistSim };
    if (artistSim < 0.45 && !artistContains) {
      return { ok: false, titleSim, artistSim };
    }
    if (
      durationSec &&
      durationSec > 45 &&
      typeof rec.duration === 'number' &&
      rec.duration > 0 &&
      Math.abs(durationSec - rec.duration) > 25
    ) {
      return { ok: false, titleSim, artistSim };
    }
    return { ok: true, titleSim, artistSim };
  };

  const durationParam =
    durationSec && Number.isFinite(durationSec) && durationSec > 35
      ? `&duration=${Math.round(durationSec)}`
      : '';

  const getUrl = `${LRCLIB_API_BASE}/get?artist_name=${encodeURIComponent(
    cleanArtist
  )}&track_name=${encodeURIComponent(cleanTitle)}${durationParam}`;

  try {
    const getRes = await fetch(getUrl);
    if (getRes.ok) {
      const record = (await getRes.json()) as LrclibRecord;
      if (isStrictLyricsMatch(record).ok) {
        const parsed = buildLyricsResult(record);
        if (parsed.isSynced || parsed.lines.length > 0) {
          return saveAndReturn(parsed);
        }
      }
    }
  } catch {
    // Fall through to search strategies
  }

  const searchQueries = [
    `${LRCLIB_API_BASE}/search?track_name=${encodeURIComponent(
      cleanTitle
    )}&artist_name=${encodeURIComponent(cleanArtist)}`,
    `${LRCLIB_API_BASE}/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`,
  ];

  const candidates: LrclibRecord[] = [];
  for (const url of searchQueries) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const list = (await res.json()) as LrclibRecord[];
      if (Array.isArray(list) && list.length > 0) {
        candidates.push(...list);
      }
      if (candidates.some((c) => c.syncedLyrics?.trim() && isStrictLyricsMatch(c).ok)) break;
    } catch {
      // continue to next strategy
    }
  }

  if (candidates.length === 0) {
    return saveAndReturn({
      syncedLyrics: [],
      lines: [],
      plainLyrics: null,
      isSynced: false,
    });
  }

  let bestRecord: LrclibRecord | null = null;
  let bestScore = -1;

  for (const item of candidates) {
    const hasSynced = Boolean(item.syncedLyrics?.trim());
    const hasPlain = Boolean(item.plainLyrics?.trim());
    if (!hasSynced && !hasPlain) continue;

    const check = isStrictLyricsMatch(item);
    if (!check.ok) continue;

    let score = check.titleSim * 50 + check.artistSim * 45 + (hasSynced ? 35 : 5);

    if (
      durationSec &&
      durationSec > 35 &&
      typeof item.duration === 'number' &&
      item.duration > 0
    ) {
      const diff = Math.abs(durationSec - item.duration);
      if (diff <= 6) score += 20;
      else if (diff > 15) score -= 20;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRecord = item;
    }
  }

  return saveAndReturn(buildLyricsResult(bestRecord));
}

export function normalizeSearchTypos(raw: string): string {
  return raw
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\btheweeknd\b/gi, 'The Weeknd')
    .replace(/\bdrke\b/gi, 'Drake')
    .replace(/\bemienm\b/gi, 'Eminem')
    .replace(/\bkendrik\b/gi, 'Kendrick')
    .replace(/\bshudder\b/gi, 'shoulder')
    .replace(/\s+/g, ' ')
    .trim();
}

export function doesTrackBelongToArtist(trackArtist: string, targetArtist: string): boolean {
  return doesArtistNameMatch(trackArtist, targetArtist);
}

/**
 * Pure iTunes + Deezer parallel search (100% client-side, Capacitor APK ready).
 */
export async function searchAllMusic(
  query: string,
  signal?: AbortSignal
): Promise<SearchAllResults> {
  const cleaned = normalizeSearchTypos(query);
  if (!cleaned) {
    return { tracks: [], songs: [], artists: [], albums: [] };
  }

  const searchNormalized = cleaned.replace(/\s+[-–—]\s+/g, ' ');

  const [songsRes, artistsRes, albumsRes] = await Promise.allSettled([
    searchRealSongs(searchNormalized, 25, undefined, signal),
    searchRealArtists(searchNormalized, 10, signal),
    searchRealAlbums(searchNormalized, 18, signal),
  ]);

  const itunesTracks = songsRes.status === 'fulfilled' ? songsRes.value : [];
  const rawArtists = artistsRes.status === 'fulfilled' ? artistsRes.value : [];
  const rawItunesAlbums = albumsRes.status === 'fulfilled' ? albumsRes.value : [];

  const dedupedArtistNames = new Map<
    string,
    { artistId: string; name: string; genre?: string; boost: number }
  >();

  for (const a of rawArtists) {
    if (!isValidArtistName(a.name)) continue;
    const k = a.name.trim().toLowerCase();
    if (!dedupedArtistNames.has(k)) {
      dedupedArtistNames.set(k, { ...a, boost: 10 });
    }
  }

  for (const t of itunesTracks.slice(0, 6)) {
    const primary = t.artist.split(/,|feat\.|ft\.|&/i)[0]?.trim();
    if (primary && isValidArtistName(primary) && !dedupedArtistNames.has(primary.toLowerCase())) {
      dedupedArtistNames.set(primary.toLowerCase(), {
        artistId: `derived-${primary.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: primary,
        genre: t.genre,
        boost: 4,
      });
    }
  }

  const qNorm = normalizeMusicText(searchNormalized);
  const sortedArtistCandidates = Array.from(dedupedArtistNames.values())
    .sort((a, b) => {
      const aExact = normalizeMusicText(a.name) === qNorm ? 1 : 0;
      const bExact = normalizeMusicText(b.name) === qNorm ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.boost - a.boost;
    })
    .slice(0, 10);

  const photoResults = await Promise.allSettled(
    sortedArtistCandidates.map((a) => fetchDeezerArtistJsonp(a.name))
  );

  const artists: SearchArtistResult[] = sortedArtistCandidates.map((a, idx) => {
    const photoRes = photoResults[idx];
    const deezer =
      photoRes && photoRes.status === 'fulfilled' ? photoRes.value : null;
    const itunesMatchCover = itunesTracks.find(
      (t) => doesArtistNameMatch(t.artist, a.name) && Boolean(t.coverUrl)
    )?.coverUrl;
    return {
      id: a.artistId,
      name: a.name,
      genre: a.genre,
      photoUrl: deezer?.photoUrl || itunesMatchCover,
      artwork: pickGradientArtwork(a.artistId + a.name),
    };
  });

  artists.sort((a, b) => {
    const aExact = normalizeMusicText(a.name) === qNorm ? 1 : 0;
    const bExact = normalizeMusicText(b.name) === qNorm ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    const aPhoto = a.photoUrl ? 1 : 0;
    const bPhoto = b.photoUrl ? 1 : 0;
    return bPhoto - aPhoto;
  });

  const enrichedAlbums = await enrichAlbumsWithRealArtwork(rawItunesAlbums);

  return {
    tracks: itunesTracks,
    songs: itunesTracks,
    artists,
    albums: enrichedAlbums,
  };
}

export type TopResultItem =
  | { type: 'artist'; score: number; data: SearchArtistResult }
  | { type: 'album'; score: number; data: AlbumItem }
  | { type: 'song'; score: number; data: ShowcaseTrack };

export interface RankedSearchResponse extends SearchAllResults {
  topResult: TopResultItem | null;
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeMatchScore(
  query: string,
  primaryText: string,
  secondaryText = ''
): number {
  const q = normalizeStr(normalizeSearchTypos(query));
  const p = normalizeStr(primaryText);
  const s = normalizeStr(secondaryText);
  if (!q || !p) return 0;

  let score = 0;
  if (p === q) score += 120;
  else if (p.startsWith(q)) score += 85;
  else if (p.includes(q)) score += 60;

  const combined = `${p} ${s}`.trim();
  const tokens = q.split(' ').filter((t) => t.length > 1);
  if (tokens.length > 0) {
    const matchedTokens = tokens.filter((tok) => combined.includes(tok)).length;
    score += Math.round((matchedTokens / tokens.length) * 55);
  }

  return score;
}

const rankedSearchMemoryCache = new Map<
  string,
  { ts: number; data: RankedSearchResponse }
>();
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

function computeRankedResponseFromBundle(
  query: string,
  bundle: SearchAllResults
): RankedSearchResponse {
  const { tracks, songs, artists, albums } = bundle;
  const candidates: TopResultItem[] = [];

  if (artists[0]) {
    const artistScore =
      computeMatchScore(query, artists[0].name) + (artists[0].photoUrl ? 15 : 0);
    candidates.push({ type: 'artist', score: artistScore, data: artists[0] });
  }

  if (albums[0]) {
    const albumScore =
      computeMatchScore(query, albums[0].title, albums[0].artist) + 5;
    candidates.push({ type: 'album', score: albumScore, data: albums[0] });
  }

  const leadSong = songs[0];
  if (leadSong) {
    const songScore =
      computeMatchScore(query, leadSong.title, leadSong.artist) + 12;
    candidates.push({ type: 'song', score: songScore, data: leadSong });
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    topResult: candidates[0] ?? null,
    tracks,
    songs,
    artists,
    albums,
  };
}

export async function getTopSearchResults(
  query: string,
  signal?: AbortSignal
): Promise<RankedSearchResponse> {
  const q = query.trim();
  if (!q) {
    return {
      topResult: null,
      tracks: [],
      songs: [],
      artists: [],
      albums: [],
    };
  }

  const cacheKey = normalizeSearchTypos(q).toLowerCase();
  const cached = rankedSearchMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.data;
  }

  const bundle = await searchAllMusic(q, signal);
  const ranked = computeRankedResponseFromBundle(q, bundle);
  if (ranked.songs.length > 0 || ranked.artists.length > 0 || ranked.albums.length > 0) {
    rankedSearchMemoryCache.set(cacheKey, { ts: Date.now(), data: ranked });
  }
  return ranked;
}

/**
 * Progressive instant search: emits cached exact or prefix hit immediately,
 * fetches fast iTunes songs/artists/albums (limit=25) with AbortSignal,
 * then refines with Deezer artist portraits.
 */
export async function getTopSearchResultsProgressive(
  query: string,
  onUpdate: (
    result: RankedSearchResponse,
    meta: { isFinal: boolean }
  ) => void,
  signal?: AbortSignal
): Promise<RankedSearchResponse> {
  const q = query.trim();
  if (!q) {
    const empty: RankedSearchResponse = {
      topResult: null,
      tracks: [],
      songs: [],
      artists: [],
      albums: [],
    };
    onUpdate(empty, { isFinal: true });
    return empty;
  }

  const cleaned = normalizeSearchTypos(q);
  const cacheKey = cleaned.toLowerCase();
  const cached = rankedSearchMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_CACHE_TTL_MS) {
    onUpdate(cached.data, { isFinal: true });
    return cached.data;
  }

  // Emit prefix match instantaneously while typing
  if (cacheKey.length >= 2) {
    for (const [k, entry] of rankedSearchMemoryCache.entries()) {
      if (cacheKey.startsWith(k) && Date.now() - entry.ts < SEARCH_CACHE_TTL_MS) {
        onUpdate(entry.data, { isFinal: false });
        break;
      }
    }
  }

  const searchNormalized = cleaned.replace(/\s+[-–—]\s+/g, ' ');

  try {
    const [fastSongsRes, fastArtistsRes, fastAlbumsRes] = await Promise.allSettled([
      searchRealSongs(searchNormalized, 25, undefined, signal),
      searchRealArtists(searchNormalized, 8, signal),
      searchRealAlbums(searchNormalized, 14, signal),
    ]);

    if (signal?.aborted) {
      return {
        topResult: null,
        tracks: [],
        songs: [],
        artists: [],
        albums: [],
      };
    }

    const fastSongs = fastSongsRes.status === 'fulfilled' ? fastSongsRes.value : [];
    const fastArtistsRaw =
      fastArtistsRes.status === 'fulfilled' ? fastArtistsRes.value : [];
    const fastAlbums =
      fastAlbumsRes.status === 'fulfilled' ? fastAlbumsRes.value : [];

    const fastArtists: SearchArtistResult[] = fastArtistsRaw.map((a) => ({
      id: a.artistId,
      name: a.name,
      genre: a.genre,
      photoUrl: fastSongs.find((s) => doesArtistNameMatch(s.artist, a.name))
        ?.coverUrl,
      artwork: pickGradientArtwork(a.artistId + a.name),
    }));

    const partial = computeRankedResponseFromBundle(q, {
      tracks: fastSongs,
      songs: fastSongs,
      artists: fastArtists,
      albums: fastAlbums,
    });
    if (fastSongs.length > 0 || fastArtists.length > 0 || fastAlbums.length > 0) {
      onUpdate(partial, { isFinal: false });
    }

    // Upgrade artist portraits cleanly via Deezer JSONP
    const photoResults = await Promise.allSettled(
      fastArtists.map((a) => fetchDeezerArtistJsonp(a.name))
    );
    if (signal?.aborted) {
      return partial;
    }

    const upgradedArtists: SearchArtistResult[] = fastArtists.map((a, idx) => {
      const r = photoResults[idx];
      const dz = r && r.status === 'fulfilled' ? r.value : null;
      return {
        ...a,
        photoUrl: dz?.photoUrl || a.photoUrl,
      };
    });

    const finalResult = computeRankedResponseFromBundle(q, {
      tracks: fastSongs,
      songs: fastSongs,
      artists: upgradedArtists,
      albums: fastAlbums,
    });

    if (
      finalResult.songs.length > 0 ||
      finalResult.artists.length > 0 ||
      finalResult.albums.length > 0
    ) {
      rankedSearchMemoryCache.set(cacheKey, { ts: Date.now(), data: finalResult });
    }
    onUpdate(finalResult, { isFinal: true });
    return finalResult;
  } catch {
    const empty: RankedSearchResponse = {
      topResult: null,
      tracks: [],
      songs: [],
      artists: [],
      albums: [],
    };
    if (!signal?.aborted) {
      onUpdate(empty, { isFinal: true });
    }
    return empty;
  }
}

export async function fetchPersonalizedReelsPool(
  seedTerms: string[],
  excludeTrackIds: string[] = []
): Promise<ShowcaseTrack[]> {
  const uniqueSeeds = Array.from(
    new Set(
      [...seedTerms, 'top hits', 'hip hop', 'r&b', 'pop', 'afrobeats', 'electronic'].filter(
        (s) => s.trim().length > 0
      )
    )
  );

  const shuffledSeeds = [...uniqueSeeds].sort(() => Math.random() - 0.5).slice(0, 4);
  const offsetPool = [0, 6, 12, 20];

  const settled = await Promise.allSettled(
    shuffledSeeds.map(async (term) => {
      const offset = offsetPool[Math.floor(Math.random() * offsetPool.length)];
      const url = `${ITUNES_API_BASE}/search?media=music&entity=song&limit=25&offset=${offset}&explicit=Yes&term=${encodeURIComponent(
        term
      )}`;
      const res = await fetch(url);
      if (!res.ok) return [] as ShowcaseTrack[];
      const payload = (await res.json()) as ItunesSearchResponse;
      const rows = Array.isArray(payload.results) ? payload.results : [];
      return rows
        .map((row) => mapRawItunesSong(row))
        .filter((t): t is ShowcaseTrack =>
          Boolean(t && t.previewUrl && isOfficialArtistTrack(t))
        );
    })
  );

  const excludeSet = new Set(excludeTrackIds);
  const seen = new Set<string>();
  const unseenTracks: ShowcaseTrack[] = [];
  const repeatTracks: ShowcaseTrack[] = [];

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    for (const track of res.value) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      if (excludeSet.has(track.id)) {
        repeatTracks.push(track);
      } else {
        unseenTracks.push(track);
      }
    }
  }

  const shuffleList = (list: ShowcaseTrack[]) => {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return [...shuffleList(unseenTracks), ...shuffleList(repeatTracks)].slice(0, 36);
}

export async function fetchGenreArtworkMap(
  genres: string[]
): Promise<Record<string, string>> {
  const settled = await Promise.allSettled(
    genres.map(async (genre) => {
      const tracks = await searchRealSongs(genre, 5);
      const cover = tracks.find((t) => Boolean(t.coverUrl))?.coverUrl;
      return { genre, cover };
    })
  );

  const map: Record<string, string> = {};
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value.cover) {
      map[res.value.genre] = res.value.cover;
    }
  }
  return map;
}

function dedupeTracksByKey(tracks: ShowcaseTrack[]): ShowcaseTrack[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const out: ShowcaseTrack[] = [];
  for (const t of tracks) {
    if (!t || !t.title || !t.artist) continue;
    const normKey = `${normalizeMusicText(t.artist)}::${normalizeMusicText(t.title)}`;
    if (seenIds.has(t.id) || seenKeys.has(normKey)) continue;
    seenIds.add(t.id);
    seenKeys.add(normKey);
    out.push(t);
  }
  return out;
}

function dedupeAlbums(albums: AlbumItem[]): AlbumItem[] {
  const seen = new Set<string>();
  const out: AlbumItem[] = [];
  for (const alb of albums) {
    if (!alb || !alb.title) continue;
    const key = `${alb.collectionId ?? ''}::${normalizeMusicText(alb.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alb);
  }
  return out;
}

/**
 * Computes seasonal & live-chart-driven category pills (all lowercase).
 */
export function computeDynamicCategories(
  chartTracks: ShowcaseTrack[],
  now = new Date()
): string[] {
  const month = now.getMonth(); // 0..11
  const day = now.getDate();

  const seasonalCategories: string[] = [];
  if (month === 11) {
    seasonalCategories.push('holiday', 'year-end');
  } else if (month === 0 && day <= 15) {
    seasonalCategories.push('new year', 'winter');
  } else if (month === 1 && day <= 18) {
    seasonalCategories.push('love songs', 'r&b');
  } else if (month >= 4 && month <= 7) {
    seasonalCategories.push('summer', 'party');
  } else if (month >= 8 && month <= 10) {
    seasonalCategories.push('chill', 'late night');
  } else {
    seasonalCategories.push('chill', 'workout');
  }

  // Count primary chart genres dynamically
  const freq = new Map<string, number>();
  for (const t of chartTracks) {
    const rawGenre = (t.genre || '').trim().toLowerCase();
    if (!rawGenre || rawGenre === 'music' || rawGenre === 'top chart') continue;
    const normalized =
      rawGenre.includes('hip') || rawGenre.includes('rap')
        ? 'hip hop'
        : rawGenre.includes('r&b') || rawGenre.includes('soul')
        ? 'r&b'
        : rawGenre.includes('dance') || rawGenre.includes('electronic')
        ? 'electronic'
        : rawGenre.includes('pop')
        ? 'pop'
        : rawGenre.includes('country')
        ? 'country'
        : rawGenre.includes('latin')
        ? 'latin'
        : rawGenre.includes('afro')
        ? 'afrobeats'
        : rawGenre.includes('rock')
        ? 'rock'
        : rawGenre;
    freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
  }

  const topChartGenres = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  const defaults = ['hip hop', 'r&b', 'pop', 'electronic', 'afrobeats'];
  const combined = Array.from(
    new Set([
      'all',
      'trending',
      ...seasonalCategories,
      ...topChartGenres,
      ...defaults,
    ])
  );

  return combined.slice(0, 8);
}

function getCategorySearchQuery(category: string): string {
  const c = category.trim().toLowerCase();
  const year = new Date().getFullYear();
  if (c === 'holiday') return `holiday hits ${year}`;
  if (c === 'year-end') return `top hits ${year}`;
  if (c === 'new year') return `party hits ${year}`;
  if (c === 'love songs') return 'r&b love songs';
  if (c === 'summer') return 'summer pop hits';
  if (c === 'late night') return 'late night r&b chill';
  if (c === 'chill') return 'chill indie r&b';
  if (c === 'workout') return 'workout hip hop hits';
  if (c === 'trending') return `top hits ${year}`;
  return c;
}

export async function prewarmCategorySongs(
  categories: string[],
  seedTracks: ShowcaseTrack[] = [],
  forceRefresh = false
): Promise<Record<string, ShowcaseTrack[]>> {
  const result: Record<string, ShowcaseTrack[]> = {};

  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage?.getItem(CATEGORY_SESSION_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ShowcaseTrack[]>;
        if (parsed && typeof parsed === 'object') {
          for (const [k, list] of Object.entries(parsed)) {
            if (Array.isArray(list) && list.length > 0) {
              categorySongsMemoryCache.set(k.toLowerCase(), list);
              result[k.toLowerCase()] = list;
            }
          }
        }
      }
    } catch {
      // ignore sessionStorage issues
    }
  }

  const visible = categories
    .map((c) => c.toLowerCase())
    .filter((c) => c !== 'all');

  const toFetch = visible.filter(
    (c) => forceRefresh || (categorySongsMemoryCache.get(c)?.length ?? 0) === 0
  );

  if (toFetch.length > 0) {
    const settled = await Promise.allSettled(
      toFetch.map(async (cat) => {
        if (cat === 'trending' && seedTracks.length >= 12) {
          return {
            cat,
            tracks: capTracksPerArtist(
              seedTracks.filter((t) => isOfficialArtistTrack(t)),
              1
            ).slice(0, 25),
          };
        }
        const raw = await searchRealSongs(getCategorySearchQuery(cat), 25, cat);
        const filtered = capTracksPerArtist(
          raw.filter((t) => isOfficialArtistTrack(t, cat)),
          2
        ).slice(0, 25);
        return { cat, tracks: filtered };
      })
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value.tracks.length > 0) {
        categorySongsMemoryCache.set(outcome.value.cat, outcome.value.tracks);
        result[outcome.value.cat] = outcome.value.tracks;
      }
    }
  }

  for (const cat of visible) {
    const mem = categorySongsMemoryCache.get(cat);
    if (mem && mem.length > 0) {
      result[cat] = mem;
    }
  }

  if (typeof window !== 'undefined' && Object.keys(result).length > 0) {
    try {
      window.sessionStorage?.setItem(
        CATEGORY_SESSION_CACHE_KEY,
        JSON.stringify(result)
      );
    } catch {
      // ignore quota issues
    }
  }

  return result;
}

export function getCachedCategorySongs(category: string): ShowcaseTrack[] {
  return categorySongsMemoryCache.get(category.toLowerCase()) ?? [];
}

/**
 * Fetches New Releases directly from iTunes Artist Lookup + Apple iTunes RSS Charts.
 */
export async function getLiveNewReleases(options: {
  followedArtists?: string[];
  topGenres?: string[];
  forceRefresh?: boolean;
} = {}): Promise<{
  tracks: ShowcaseTrack[];
  albums: AlbumItem[];
  fetchedAt: number;
  dateKey: string;
}> {
  const { currentYear, currentDateKey, nowMs } = getDynamicDateContext();

  if (
    !options.forceRefresh &&
    newReleasesMemoryCache &&
    newReleasesMemoryCache.dateKey === currentDateKey &&
    nowMs - newReleasesMemoryCache.ts < LIVE_FEED_TTL_MS
  ) {
    return {
      tracks: newReleasesMemoryCache.tracks,
      albums: newReleasesMemoryCache.albums,
      fetchedAt: newReleasesMemoryCache.ts,
      dateKey: currentDateKey,
    };
  }

  if (!options.forceRefresh && typeof window !== 'undefined') {
    const stored = readLocalCache<{
      ts: number;
      tracks: ShowcaseTrack[];
      albums: AlbumItem[];
    }>(NEW_RELEASES_CACHE_KEY);
    const entry = stored[currentDateKey];
    if (entry && nowMs - entry.ts < LIVE_FEED_TTL_MS && entry.tracks.length > 0) {
      newReleasesMemoryCache = {
        dateKey: currentDateKey,
        ts: entry.ts,
        tracks: entry.tracks,
        albums: entry.albums,
      };
      return {
        tracks: entry.tracks,
        albums: entry.albums,
        fetchedAt: entry.ts,
        dateKey: currentDateKey,
      };
    }
  }

  const artistSeeds = (options.followedArtists ?? []).slice(0, 4);
  const cutoffMs = nowMs - 45 * 24 * 60 * 60 * 1000;

  const artistLookupPromise = Promise.allSettled(
    artistSeeds.map(async (artistName) => {
      const artists = await searchRealArtists(artistName, 2);
      const id = artists[0]?.artistId;
      if (!id) return { tracks: [] as ShowcaseTrack[], albums: [] as AlbumItem[] };

      const [albumsRes, songsRes] = await Promise.allSettled([
        fetch(
          `${ITUNES_API_BASE}/lookup?id=${encodeURIComponent(id)}&entity=album&limit=5&sort=recent`
        ).then((r) => (r.ok ? (r.json() as Promise<ItunesSearchResponse>) : { results: [] })),
        fetch(
          `${ITUNES_API_BASE}/lookup?id=${encodeURIComponent(id)}&entity=song&limit=10&sort=recent`
        ).then((r) => (r.ok ? (r.json() as Promise<ItunesSearchResponse>) : { results: [] })),
      ]);

      const rawAlbums =
        albumsRes.status === 'fulfilled' && Array.isArray(albumsRes.value.results)
          ? albumsRes.value.results
          : [];
      const rawSongs =
        songsRes.status === 'fulfilled' && Array.isArray(songsRes.value.results)
          ? songsRes.value.results
          : [];

      const albums: AlbumItem[] = [];
      for (const row of rawAlbums) {
        if (row.wrapperType !== 'collection' || !row.collectionId || !row.collectionName) {
          continue;
        }
        if (row.collectionExplicitness === 'cleaned') continue;
        const relMs = row.releaseDate ? Date.parse(row.releaseDate) : 0;
        if (relMs > 0 && relMs < cutoffMs) continue;
        const cid = String(row.collectionId);
        albums.push({
          id: `itunes-album-${cid}`,
          collectionId: cid,
          title: row.collectionName.trim(),
          artist: row.artistName?.trim() || artistName,
          year: row.releaseDate ? new Date(row.releaseDate).getFullYear() : currentYear,
          releaseDate: row.releaseDate,
          genre: row.primaryGenreName?.trim() || 'new release',
          artwork: pickGradientArtwork(cid + row.collectionName),
          coverUrl: upgradeItunesArtwork(row.artworkUrl100),
          description: `${row.artistName?.trim() || artistName} · ${row.collectionName.trim()}`,
          trackIds: [],
        });
      }

      const tracks: ShowcaseTrack[] = rawSongs
        .filter((r) => r.wrapperType === 'track')
        .map((r) => mapRawItunesSong(r))
        .filter((t): t is ShowcaseTrack => {
          if (!t || !t.previewUrl || !isOfficialArtistTrack(t)) return false;
          const relMs = t.releaseDate ? Date.parse(t.releaseDate) : 0;
          return relMs === 0 || relMs >= cutoffMs;
        });

      return { tracks, albums };
    })
  );

  const [usChartsRes, ukChartsRes, artistDropsRes] = await Promise.allSettled([
    fetchAppleCharts('us'),
    fetchAppleCharts('gb'),
    artistLookupPromise,
  ]);

  const artistTracks: ShowcaseTrack[] = [];
  const artistAlbums: AlbumItem[] = [];
  if (artistDropsRes.status === 'fulfilled') {
    for (const item of artistDropsRes.value) {
      if (item.status === 'fulfilled') {
        artistTracks.push(...item.value.tracks);
        artistAlbums.push(...item.value.albums);
      }
    }
  }

  const usSongs = usChartsRes.status === 'fulfilled' ? usChartsRes.value.songTracks : [];
  const usAlbums = usChartsRes.status === 'fulfilled' ? usChartsRes.value.albums : [];
  const ukSongs = ukChartsRes.status === 'fulfilled' ? ukChartsRes.value.songTracks : [];
  const ukAlbums = ukChartsRes.status === 'fulfilled' ? ukChartsRes.value.albums : [];

  const mergedTracksRaw = dedupeTracksByKey([
    ...artistTracks,
    ...usSongs,
    ...ukSongs,
  ]).filter((t) => isOfficialArtistTrack(t));

  mergedTracksRaw.sort((a, b) => {
    const aMs = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const bMs = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    return bMs - aMs;
  });
  const mergedTracks = capTracksPerArtist(mergedTracksRaw, 1);

  const mergedAlbums = dedupeAlbums([
    ...artistAlbums,
    ...usAlbums,
    ...ukAlbums,
  ]);

  mergedAlbums.sort((a, b) => {
    const aMs = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const bMs = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    return bMs - aMs;
  });

  const freshTs = Date.now();
  newReleasesMemoryCache = {
    dateKey: currentDateKey,
    ts: freshTs,
    tracks: mergedTracks,
    albums: mergedAlbums,
  };

  if (typeof window !== 'undefined' && mergedTracks.length > 0) {
    writeLocalCache(NEW_RELEASES_CACHE_KEY, {
      [currentDateKey]: {
        ts: freshTs,
        tracks: mergedTracks.slice(0, 60),
        albums: mergedAlbums.slice(0, 30),
      },
    });
  }

  return {
    tracks: mergedTracks,
    albums: mergedAlbums,
    fetchedAt: freshTs,
    dateKey: currentDateKey,
  };
}

export interface AtherHomeShelves {
  forYouQuickPicks: ShowcaseTrack[];
  albumsForYou: AlbumItem[];
  trendingTracks: ShowcaseTrack[];
  newReleaseTracks: ShowcaseTrack[];
  newReleaseAlbums: AlbumItem[];
  topArtists: FeaturedArtistItem[];
  dynamicCategories: string[];
  categoryTracksMap: Record<string, ShowcaseTrack[]>;
  fetchedAt: number;
  dateKey: string;
}

export function getCachedAtherHomeShelvesSnapshot(): AtherHomeShelves | null {
  if (homeShelvesMemoryCache?.data?.trendingTracks?.length) {
    return homeShelvesMemoryCache.data;
  }
  if (typeof window === 'undefined') return null;
  try {
    const sessionRaw = window.sessionStorage?.getItem(HOME_SESSION_CACHE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw) as { data?: AtherHomeShelves };
      if (parsed?.data?.trendingTracks?.length) {
        return parsed.data;
      }
    }
    const stored = readLocalCache<{ ts: number; data?: AtherHomeShelves }>(HOME_SHELVES_CACHE_KEY);
    const entries = Object.values(stored || {})
      .filter((e) => e?.data?.trendingTracks?.length)
      .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    if (entries[0]?.data) {
      return entries[0].data;
    }
  } catch {
    // ignore storage read errors
  }
  return null;
}

/**
 * Fetches complete Home shelves and pre-warmed categories strictly from iTunes Search API,
 * Apple iTunes RSS JSON, and Deezer artist portraits. Frozen in memory + sessionStorage so
 * returning to Home never re-fetches or reshuffles unless forceRefresh is true.
 */
export async function fetchAtherHomeShelves(options: {
  followedArtists?: string[];
  topArtists?: string[];
  topGenres?: string[];
  forceRefresh?: boolean;
} = {}): Promise<AtherHomeShelves> {
  const { currentDateKey, nowMs } = getDynamicDateContext();

  const userGenres = Array.from(
    new Set([...(options.topGenres ?? []), 'hip hop', 'r&b', 'pop', 'afrobeats'])
  ).slice(0, 4);
  const userArtists = Array.from(
    new Set(
      [...(options.followedArtists ?? []), ...(options.topArtists ?? [])].filter((a) =>
        isValidArtistName(a)
      )
    )
  ).slice(0, 6);

  const tasteSignature = `${userGenres.join('|')}::${userArtists.join('|')}`.toLowerCase();
  const cacheBucketKey = `${currentDateKey}::${tasteSignature}`;

  if (
    !options.forceRefresh &&
    homeShelvesMemoryCache &&
    homeShelvesMemoryCache.dateKey === currentDateKey &&
    homeShelvesMemoryCache.signature === tasteSignature &&
    nowMs - homeShelvesMemoryCache.ts < LIVE_FEED_TTL_MS
  ) {
    return homeShelvesMemoryCache.data;
  }

  if (!options.forceRefresh && typeof window !== 'undefined') {
    try {
      const sessionRaw = window.sessionStorage?.getItem(HOME_SESSION_CACHE_KEY);
      if (sessionRaw) {
        const parsedSession = JSON.parse(sessionRaw) as {
          dateKey: string;
          signature?: string;
          ts: number;
          data: AtherHomeShelves;
        };
        if (
          parsedSession?.dateKey === currentDateKey &&
          parsedSession?.signature === tasteSignature &&
          nowMs - parsedSession.ts < LIVE_FEED_TTL_MS &&
          parsedSession.data?.trendingTracks?.length > 0
        ) {
          homeShelvesMemoryCache = parsedSession;
          for (const [cat, list] of Object.entries(
            parsedSession.data.categoryTracksMap || {}
          )) {
            categorySongsMemoryCache.set(cat.toLowerCase(), list);
          }
          return parsedSession.data;
        }
      }
    } catch {
      // ignore sessionStorage errors
    }

    const stored = readLocalCache<{
      ts: number;
      signature?: string;
      data: AtherHomeShelves;
    }>(HOME_SHELVES_CACHE_KEY);
    const entry = stored[cacheBucketKey];
    if (
      entry &&
      nowMs - entry.ts < LIVE_FEED_TTL_MS &&
      entry.data?.trendingTracks?.length > 0
    ) {
      homeShelvesMemoryCache = {
        dateKey: currentDateKey,
        signature: tasteSignature,
        ts: entry.ts,
        data: entry.data,
      };
      for (const [cat, list] of Object.entries(
        entry.data.categoryTracksMap || {}
      )) {
        categorySongsMemoryCache.set(cat.toLowerCase(), list);
      }
      return entry.data;
    }
  }

  const artistSeedQueries =
    userArtists.length > 0
      ? userArtists.slice(0, 5)
      : [userGenres[0] ?? 'top hits'];

  const [
    chartsRes,
    newReleasesRes,
    personalizedTracksRes,
    genreAlbumsRes,
    genreTracksRes,
  ] = await Promise.allSettled([
    fetchAppleCharts('us'),
    getLiveNewReleases({
      followedArtists: userArtists,
      topGenres: userGenres,
      forceRefresh: options.forceRefresh,
    }),
    Promise.allSettled(
      artistSeedQueries.map((artistName) => searchRealSongs(artistName, 12))
    ),
    Promise.allSettled([
      ...artistSeedQueries.slice(0, 3).map((artist) => searchRealAlbums(artist, 5)),
      ...userGenres.slice(0, 2).map((genre) => searchRealAlbums(genre, 6)),
    ]),
    Promise.allSettled(
      userGenres.slice(0, 3).map((genre) => searchRealSongs(genre, 10))
    ),
  ]);

  const chartTracks =
    chartsRes.status === 'fulfilled' ? chartsRes.value.songTracks : [];
  const chartAlbums =
    chartsRes.status === 'fulfilled' ? chartsRes.value.albums : [];

  const newReleases =
    newReleasesRes.status === 'fulfilled'
      ? newReleasesRes.value
      : { tracks: [], albums: [], fetchedAt: nowMs, dateKey: currentDateKey };

  const artistItunesTracks: ShowcaseTrack[] = [];
  if (personalizedTracksRes.status === 'fulfilled') {
    for (const r of personalizedTracksRes.value) {
      if (r.status === 'fulfilled') artistItunesTracks.push(...r.value);
    }
  }

  const genreItunesTracks: ShowcaseTrack[] = [];
  if (genreTracksRes.status === 'fulfilled') {
    for (const r of genreTracksRes.value) {
      if (r.status === 'fulfilled') genreItunesTracks.push(...r.value);
    }
  }

  const matchesChosenArtist = (artistStr: string) =>
    userArtists.some((ua) => doesArtistNameMatch(artistStr, ua));

  const chosenArtistTracks = dedupeTracksByKey(artistItunesTracks).filter(
    (t) => isOfficialArtistTrack(t) && matchesChosenArtist(t.artist)
  );

  const trendingTracks = capTracksPerArtist(
    dedupeTracksByKey([
      ...chartTracks,
      ...newReleases.tracks.slice(0, 14),
      ...chosenArtistTracks.slice(0, 8),
    ]).filter((t) => isOfficialArtistTrack(t)),
    1
  );

  const forYouQuickPicks = capTracksPerArtist(
    dedupeTracksByKey([
      ...chosenArtistTracks,
      ...artistItunesTracks,
      ...genreItunesTracks,
      ...chartTracks.slice(0, 14),
    ]).filter((t) => isOfficialArtistTrack(t)),
    2
  );

  const tailGenreAlbums: AlbumItem[] = [];
  if (genreAlbumsRes.status === 'fulfilled') {
    for (const r of genreAlbumsRes.value) {
      if (r.status === 'fulfilled') tailGenreAlbums.push(...r.value);
    }
  }
  const chosenArtistAlbums = tailGenreAlbums.filter(
    (alb) => isValidArtistName(alb.artist) && matchesChosenArtist(alb.artist)
  );
  const albumsForYou = dedupeAlbums([
    ...chosenArtistAlbums,
    ...tailGenreAlbums.filter((alb) => isValidArtistName(alb.artist)),
    ...chartAlbums.filter((alb) => isValidArtistName(alb.artist)),
    ...newReleases.albums.filter((alb) => isValidArtistName(alb.artist)),
  ]);

  const artistSeedMap = new Map<string, FeaturedArtistItem>();
  for (const preferred of userArtists) {
    if (!isValidArtistName(preferred)) continue;
    const matchCover = artistItunesTracks.find(
      (t) => doesArtistNameMatch(t.artist, preferred) && Boolean(t.coverUrl)
    )?.coverUrl;
    if (!artistSeedMap.has(preferred.toLowerCase())) {
      artistSeedMap.set(preferred.toLowerCase(), {
        artist: preferred,
        subtitle: 'your top artist',
        artwork: pickGradientArtwork(preferred),
        coverUrl: matchCover,
      });
    }
  }
  for (const t of [...forYouQuickPicks, ...trendingTracks]) {
    if (artistSeedMap.size >= 14) break;
    const primary = t.artist.split(/,|feat\.|ft\.|&/i)[0]?.trim();
    if (!primary || !isValidArtistName(primary)) continue;
    if (!artistSeedMap.has(primary.toLowerCase())) {
      artistSeedMap.set(primary.toLowerCase(), {
        artist: primary,
        subtitle: (t.genre || t.category).toLowerCase(),
        artwork: pickGradientArtwork(primary),
        coverUrl: t.coverUrl,
      });
    }
  }

  const baseArtists = Array.from(artistSeedMap.values());
  const dynamicCategories = computeDynamicCategories([...chartTracks, ...trendingTracks]);

  // Seed quick initial category map synchronously from already fetched tracks so Home renders fast
  const initialCategoryMap: Record<string, ShowcaseTrack[]> = {};
  for (const cat of dynamicCategories) {
    const key = cat.toLowerCase();
    const cached = categorySongsMemoryCache.get(key);
    if (cached && cached.length > 0) {
      initialCategoryMap[key] = cached;
    } else if (key === 'trending') {
      initialCategoryMap[key] = trendingTracks.slice(0, 20);
      categorySongsMemoryCache.set(key, initialCategoryMap[key]);
    } else {
      const localMatches = [...forYouQuickPicks, ...trendingTracks].filter((t) =>
        `${t.genre || ''} ${t.category || ''}`.toLowerCase().includes(key)
      );
      if (localMatches.length > 0) {
        initialCategoryMap[key] = localMatches;
      }
    }
  }

  // Enrich Deezer portraits & remaining categories with a short 900ms budget, finishing the rest cleanly in background
  const quickEnrichPromise = Promise.all([
    Promise.allSettled(baseArtists.slice(0, 8).map((a) => fetchDeezerArtistPhoto(a.artist))),
    prewarmCategorySongs(dynamicCategories, trendingTracks, Boolean(options.forceRefresh)),
  ]);

  const raceWinner = await Promise.race([
    quickEnrichPromise.then((res) => ({ done: true as const, res })),
    new Promise<{ done: false }>((resolve) =>
      setTimeout(() => resolve({ done: false }), 900)
    ),
  ]);

  let topArtists: FeaturedArtistItem[] = baseArtists;
  let categoryTracksMap: Record<string, ShowcaseTrack[]> = initialCategoryMap;

  if (raceWinner.done) {
    const [deezerPhotos, warmedCats] = raceWinner.res;
    topArtists = baseArtists.map((item, idx) => {
      const res = deezerPhotos[idx];
      const deezer = res && res.status === 'fulfilled' ? res.value : null;
      return {
        ...item,
        coverUrl: deezer?.photoUrl || item.coverUrl,
      };
    });
    if (warmedCats && Object.keys(warmedCats).length > 0) {
      categoryTracksMap = { ...initialCategoryMap, ...warmedCats };
    }
  } else {
    void quickEnrichPromise.then(([deezerPhotos, warmedCats]) => {
      const updatedArtists = baseArtists.map((item, idx) => {
        const res = deezerPhotos[idx];
        const deezer = res && res.status === 'fulfilled' ? res.value : null;
        return {
          ...item,
          coverUrl: deezer?.photoUrl || item.coverUrl,
        };
      });
      if (homeShelvesMemoryCache?.data) {
        homeShelvesMemoryCache.data = {
          ...homeShelvesMemoryCache.data,
          topArtists: updatedArtists,
          categoryTracksMap: {
            ...homeShelvesMemoryCache.data.categoryTracksMap,
            ...warmedCats,
          },
        };
      }
    }).catch(() => undefined);
  }

  const result: AtherHomeShelves = {
    forYouQuickPicks,
    albumsForYou,
    trendingTracks,
    newReleaseTracks: capTracksPerArtist(newReleases.tracks, 1),
    newReleaseAlbums: newReleases.albums,
    topArtists,
    dynamicCategories,
    categoryTracksMap,
    fetchedAt: nowMs,
    dateKey: currentDateKey,
  };

  homeShelvesMemoryCache = {
    dateKey: currentDateKey,
    signature: tasteSignature,
    ts: nowMs,
    data: result,
  };

  if (typeof window !== 'undefined' && trendingTracks.length > 0) {
    try {
      window.sessionStorage?.setItem(
        HOME_SESSION_CACHE_KEY,
        JSON.stringify({
          dateKey: currentDateKey,
          signature: tasteSignature,
          ts: nowMs,
          data: result,
        })
      );
    } catch {
      // ignore sessionStorage quota issues
    }
    writeLocalCache(HOME_SHELVES_CACHE_KEY, {
      [cacheBucketKey]: { ts: nowMs, signature: tasteSignature, data: result },
    });
  }

  return result;
}

export async function searchCollectionTracks(
  seedQueries: string[],
  limit = 16
): Promise<ShowcaseTrack[]> {
  const cleanSeeds = seedQueries.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (cleanSeeds.length === 0) return [];
  const res = await Promise.allSettled(
    cleanSeeds.map((q) => searchRealSongs(q, Math.ceil(limit / cleanSeeds.length) + 4))
  );
  const all: ShowcaseTrack[] = [];
  for (const r of res) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  return capTracksPerArtist(dedupeTracksByKey(all), 2).slice(0, limit);
}

export async function fetchCuratedCollectionDetails(
  item: CollectionItem
): Promise<ShowcaseTrack[]> {
  return searchCollectionTracks([item.subtitle, item.titleLines.join(' ')], 16);
}

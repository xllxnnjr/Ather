import { doesArtistNameMatch, pickGradientArtwork } from '../data/showcaseCatalog';
import {
  fetchDeezerAlbumCoverJsonp,
  fetchDeezerArtistJsonp,
} from './artistInfoApi';
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

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.smnz.de',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
];

const YT_CACHE_KEY = 'ather_yt_candidates_v2';
const LYRICS_CACHE_KEY = 'ather_lrclib_cache_v1';
const NEW_RELEASES_CACHE_KEY = 'ather_live_new_releases_v1';
const HOME_SHELVES_CACHE_KEY = 'ather_ytm_shelves_v2';
export const LIVE_FEED_TTL_MS = 30 * 60 * 1000;

export interface DynamicDateContext {
  currentYear: number;
  currentMonthName: string;
  currentDateKey: string;
  nowMs: number;
}

export function getDynamicDateContext(now = new Date()): DynamicDateContext {
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
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

interface CachedYtEntry {
  ids: string[];
  ts: number;
}

const ytCandidateMemoryCache = new Map<string, string[]>();
const lyricsMemoryCache = new Map<string, LyricsLookupResult>();
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
  data: YouTubeMusicHomeShelves;
} | null = null;

export function clearMusicFeedCaches(): void {
  newReleasesMemoryCache = null;
  homeShelvesMemoryCache = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(NEW_RELEASES_CACHE_KEY);
      window.localStorage.removeItem(HOME_SHELVES_CACHE_KEY);
      window.sessionStorage?.removeItem('ather_home_shelves_session_v1');
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

interface AppleRssEntry {
  id?: string;
  name?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  genres?: { name?: string }[];
  contentAdvisoryRating?: string;
  url?: string;
}

interface AppleRssFeedResponse {
  feed?: {
    title?: string;
    results?: AppleRssEntry[];
  };
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

interface RawYouTubeCandidate {
  videoId: string;
  title: string;
  channelTitle: string;
  verified?: boolean;
  durationSec?: number;
  thumbnailUrl?: string;
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

function getYouTubeApiKey(): string | null {
  const key = (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined)?.trim();
  if (!key || key === 'MY_YOUTUBE_API_KEY') return null;
  return key;
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

export function upgradeItunesArtwork(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return undefined;
  return trimmed
    .replace(/\/\d+x\d+bb(-\d+)?\./, '/600x600bb.')
    .replace('100x100bb', '600x600bb')
    .replace('60x60bb', '600x600bb')
    .replace('30x30bb', '600x600bb');
}

function isCleanCensoredVersion(raw: ItunesRawItem): boolean {
  if (raw.trackExplicitness === 'cleaned') return true;
  const title = (raw.trackName ?? '').toLowerCase();
  return (
    /\[(clean|clean version|edited|censored)\]/.test(title) ||
    /\((clean|clean version|edited|censored|radio edit)\)/.test(title) ||
    /\bclean version\b/.test(title) ||
    /\bradio edit\b/.test(title)
  );
}

function inferCategory(
  genre?: string,
  override?: Exclude<CategoryPill, 'All'>
): Exclude<CategoryPill, 'All'> {
  if (override) return override;
  const g = (genre ?? '').toLowerCase();
  if (g.includes('hip') || g.includes('rap') || g.includes('trap')) return 'Hip Hop';
  if (g.includes('blue') || g.includes('jazz') || g.includes('soul') || g.includes('r&b')) {
    return 'Blues';
  }
  if (g.includes('acoustic') || g.includes('singer') || g.includes('alternative') || g.includes('sad')) {
    return 'Sad';
  }
  return 'Party';
}

export function mapItunesSong(
  raw: ItunesRawItem,
  categoryOverride?: Exclude<CategoryPill, 'All'>
): ShowcaseTrack | null {
  if (
    !raw ||
    !raw.trackId ||
    !raw.trackName?.trim() ||
    !raw.artistName?.trim() ||
    isCleanCensoredVersion(raw)
  ) {
    return null;
  }

  const itunesId = String(raw.trackId);
  const id = `itunes-${itunesId}`;
  const title = raw.trackName.trim();
  const artist = raw.artistName.trim();
  const album = raw.collectionName?.trim() || 'Single';
  const durationMs =
    typeof raw.trackTimeMillis === 'number' && raw.trackTimeMillis > 0
      ? raw.trackTimeMillis
      : undefined;
  const duration = durationMs ? Math.round(durationMs / 1000) : 180;
  const coverUrl = upgradeItunesArtwork(raw.artworkUrl100 || raw.artworkUrl60);

  return {
    id,
    itunesId,
    title,
    artist,
    album,
    collectionId: raw.collectionId ? String(raw.collectionId) : undefined,
    duration,
    durationMs,
    category: inferCategory(raw.primaryGenreName, categoryOverride),
    genre: raw.primaryGenreName?.trim() || undefined,
    artwork: pickGradientArtwork(id + title),
    coverUrl,
    previewUrl: raw.previewUrl?.trim() || undefined,
    releaseDate: raw.releaseDate,
    explicit: raw.trackExplicitness === 'explicit',
    source: 'itunes',
    isAudius: false,
    streamStatus: 'unresolved',
    accentColor: '#FFFFFF',
    glowColor: '#FFFFFF',
    secondaryGlowColor: '#A1A1AA',
    lyrics: [],
  };
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
  'youtube',
  'vevo',
  'topic',
  'ather',
  'music',
  'official',
  'lyrics',
  'official audio',
  'official video',
  'none',
  'n/a',
]);

export function isValidArtistName(name?: string | null): boolean {
  const clean = (name ?? '').trim();
  if (clean.length < 2) return false;
  const lower = clean.toLowerCase();
  if (INVALID_ARTIST_NAME_SET.has(lower)) return false;
  if (/^(track|song|episode|album|mix)\s*\d*$/i.test(clean)) return false;
  return true;
}

const NON_OFFICIAL_TRACK_REGEX =
  /\b(dj\s*(mix|set)|megamix|continuous\s*mix|mashup|slowed\s*(\+|&|and)?\s*reverb|sped\s*up|nightcore|karaoke|instrumental\s*cover|tribute\s*to|8d\s*audio|full\s*album|hour\s*mix|podcast|audiobook|lo-fi\s*beats?\s*to\s*(study|sleep)|type\s*beat|parody|cover\s*version)\b/i;

export function isOfficialArtistTrack(
  track: Pick<ShowcaseTrack, 'title' | 'artist' | 'duration' | 'genre' | 'album'>,
  userQuery?: string
): boolean {
  if (!track.title?.trim() || !isValidArtistName(track.artist)) {
    return false;
  }
  const q = (userQuery || '').trim().toLowerCase();
  const userAskedForAlt =
    /\b(mix|mashup|slowed|reverb|sped\s*up|nightcore|karaoke|podcast|dj\s*set|remix|type\s*beat|instrumental)\b/i.test(
      q
    );

  if (!userAskedForAlt) {
    const combined = `${track.title} ${track.album || ''}`.trim();
    if (NON_OFFICIAL_TRACK_REGEX.test(combined)) {
      return false;
    }
    if (typeof track.duration === 'number' && track.duration > 480) {
      // Allow >8min only if explicitly searched or classical/live prog query
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
  limit = 40,
  categoryOverride?: Exclude<CategoryPill, 'All'>,
  signal?: AbortSignal
): Promise<ShowcaseTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${ITUNES_API_BASE}/search?media=music&entity=song&limit=${Math.min(
    limit,
    100
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
    const mapped = mapItunesSong(row, categoryOverride);
    if (!mapped) continue;
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
  limit = 20
): Promise<AlbumItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${ITUNES_API_BASE}/search?media=music&entity=album&limit=${limit}&explicit=Yes&term=${encodeURIComponent(
    trimmed
  )}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const seen = new Set<string>();
  const albums: AlbumItem[] = [];

  for (const row of rows) {
    if (!row.collectionId || !row.collectionName || !row.artistName) continue;
    if (row.collectionExplicitness === 'cleaned') continue;
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
      genre: row.primaryGenreName?.trim() || 'Album',
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
  const numericId = collectionId.replace(/^itunes-album-/, '').trim();
  const url = `${ITUNES_API_BASE}/lookup?id=${encodeURIComponent(
    numericId
  )}&entity=song&limit=100`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Album lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const collectionRow = rows.find((r) => r.wrapperType === 'collection');
  const tracks = rows
    .filter((r) => r.wrapperType === 'track')
    .map((r) => mapItunesSong(r))
    .filter((t): t is ShowcaseTrack => t !== null);

  if (!collectionRow && tracks.length === 0) {
    return { album: null, tracks: [] };
  }

  const title =
    collectionRow?.collectionName?.trim() || tracks[0]?.album || 'Album';
  const artist =
    collectionRow?.artistName?.trim() || tracks[0]?.artist || 'Artist';
  const releaseDate = collectionRow?.releaseDate || tracks[0]?.releaseDate;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
  const coverUrl =
    upgradeItunesArtwork(collectionRow?.artworkUrl100) || tracks[0]?.coverUrl;

  return {
    album: {
      id: `itunes-album-${numericId}`,
      collectionId: numericId,
      title,
      artist,
      year: year && Number.isFinite(year) ? year : undefined,
      releaseDate,
      genre: collectionRow?.primaryGenreName || tracks[0]?.genre || 'Music',
      artwork: pickGradientArtwork(numericId + title),
      coverUrl,
      description: `${artist} · ${title}`,
      trackIds: tracks.map((t) => t.id),
    },
    tracks,
  };
}

export async function searchRealArtists(
  query: string,
  limit = 10
): Promise<{ artistId: string; name: string; genre?: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `${ITUNES_API_BASE}/search?media=music&entity=musicArtist&limit=${limit}&term=${encodeURIComponent(
    trimmed
  )}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as ItunesSearchResponse;
  const rows = Array.isArray(data.results) ? data.results : [];
  return rows
    .filter((r) => Boolean(r.artistId && r.artistName))
    .map((r) => ({
      artistId: String(r.artistId),
      name: r.artistName!.trim(),
      genre: r.primaryGenreName?.trim(),
    }));
}

function isNativeCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  try {
    return Boolean(w.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 2600): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function queryYouTubeDataApi(searchTerm: string): Promise<RawYouTubeCandidate[]> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) return [];
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=15&q=${encodeURIComponent(
    searchTerm
  )}&key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJsonWithTimeout<{
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
        };
      };
    }[];
  }>(url, 2200);

  if (!data?.items?.length) return [];
  const out: RawYouTubeCandidate[] = [];
  for (const item of data.items) {
    const videoId = item.id?.videoId?.trim();
    const title = item.snippet?.title?.trim();
    if (!videoId || !title) continue;
    out.push({
      videoId,
      title,
      channelTitle: item.snippet?.channelTitle?.trim() || '',
      thumbnailUrl:
        item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
    });
  }
  return out;
}

function parseYouTubeDurationText(text?: string): number | undefined {
  if (!text) return undefined;
  const parts = text
    .split(':')
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

async function scrapeYouTubeSearchHtml(searchTerm: string): Promise<RawYouTubeCandidate[]> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3200);
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`,
      { signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const marker = 'var ytInitialData = ';
    const start = html.indexOf(marker);
    if (start === -1) return [];
    const jsonStart = start + marker.length;
    const end = html.indexOf(';</script>', jsonStart);
    if (end === -1) return [];
    const rawData = JSON.parse(html.slice(jsonStart, end)) as unknown;
    const items: RawYouTubeCandidate[] = [];
    const seen = new Set<string>();

    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object' || items.length >= 20) return;
      if (Array.isArray(node)) {
        for (const el of node) walk(el);
        return;
      }
      const rec = node as Record<string, unknown>;
      if (rec.videoRenderer && typeof rec.videoRenderer === 'object') {
        const vr = rec.videoRenderer as {
          videoId?: string;
          title?: { runs?: { text?: string }[]; simpleText?: string };
          ownerText?: { runs?: { text?: string }[] };
          longBylineText?: { runs?: { text?: string }[] };
          ownerBadges?: Array<{
            metadataBadgeRenderer?: { style?: string; tooltip?: string };
          }>;
          lengthText?: { simpleText?: string };
          thumbnail?: { thumbnails?: { url?: string }[] };
        };
        const videoId = vr.videoId?.trim();
        const title =
          vr.title?.runs?.map((r) => r.text ?? '').join('').trim() ||
          vr.title?.simpleText?.trim();
        const channelTitle =
          vr.ownerText?.runs?.[0]?.text?.trim() ||
          vr.longBylineText?.runs?.[0]?.text?.trim() ||
          '';
        const verified = Boolean(
          vr.ownerBadges?.some((b) => {
            const style = b.metadataBadgeRenderer?.style ?? '';
            const tooltip = b.metadataBadgeRenderer?.tooltip ?? '';
            return (
              style.includes('OFFICIAL_ARTIST') ||
              style.includes('VERIFIED') ||
              /official artist|verified/i.test(tooltip)
            );
          })
        );
        const thumbs = vr.thumbnail?.thumbnails;
        const thumbnailUrl = thumbs?.[thumbs.length - 1]?.url;
        if (videoId && title && !seen.has(videoId)) {
          seen.add(videoId);
          items.push({
            videoId,
            title,
            channelTitle,
            verified,
            durationSec: parseYouTubeDurationText(vr.lengthText?.simpleText),
            thumbnailUrl: thumbnailUrl?.startsWith('http')
              ? thumbnailUrl
              : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          });
        }
        return;
      }
      for (const val of Object.values(rec)) {
        walk(val);
      }
    };

    walk(rawData);
    return items;
  } catch {
    return [];
  }
}

async function queryServerFreeYouTube(searchTerm: string): Promise<RawYouTubeCandidate[]> {
  if (!isNativeCapacitorRuntime()) {
    const url = `/api/youtube/free-search?q=${encodeURIComponent(searchTerm)}`;
    const data = await fetchJsonWithTimeout<{ items?: RawYouTubeCandidate[] }>(url, 2600);
    if (Array.isArray(data?.items) && data.items.length > 0) {
      return data.items;
    }
  }
  return scrapeYouTubeSearchHtml(searchTerm);
}

async function queryPipedMirror(
  baseUrl: string,
  searchTerm: string
): Promise<RawYouTubeCandidate[]> {
  const url = `${baseUrl}/search?q=${encodeURIComponent(
    searchTerm
  )}&filter=music_songs`;
  const data = await fetchJsonWithTimeout<{
    items?: {
      url?: string;
      title?: string;
      uploaderName?: string;
      uploaderVerified?: boolean;
      duration?: number;
      thumbnail?: string;
    }[];
  }>(url, 2200);

  if (!data?.items?.length) return [];
  const out: RawYouTubeCandidate[] = [];
  for (const item of data.items) {
    const rawUrl = item.url ?? '';
    const match = rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ?? rawUrl.match(/\/([a-zA-Z0-9_-]{11})$/);
    const videoId = match?.[1];
    if (!videoId || !item.title) continue;
    out.push({
      videoId,
      title: item.title.trim(),
      channelTitle: item.uploaderName?.trim() || '',
      verified: Boolean(item.uploaderVerified),
      durationSec:
        typeof item.duration === 'number' && item.duration > 0
          ? Math.round(item.duration)
          : undefined,
      thumbnailUrl: item.thumbnail,
    });
  }
  return out;
}

async function queryInvidiousMirror(
  baseUrl: string,
  searchTerm: string
): Promise<RawYouTubeCandidate[]> {
  const url = `${baseUrl}/api/v1/search?q=${encodeURIComponent(
    searchTerm
  )}&type=video`;
  const data = await fetchJsonWithTimeout<
    {
      videoId?: string;
      title?: string;
      author?: string;
      authorVerified?: boolean;
      lengthSeconds?: number;
      videoThumbnails?: { url?: string; quality?: string }[];
    }[]
  >(url, 2200);

  if (!Array.isArray(data) || data.length === 0) return [];
  const out: RawYouTubeCandidate[] = [];
  for (const item of data.slice(0, 15)) {
    if (!item.videoId || !item.title) continue;
    const hqThumb =
      item.videoThumbnails?.find((t) => t.quality === 'high' || t.quality === 'maxres')?.url ??
      item.videoThumbnails?.[0]?.url;
    out.push({
      videoId: item.videoId.trim(),
      title: item.title.trim(),
      channelTitle: item.author?.trim() || '',
      verified: Boolean(item.authorVerified),
      durationSec:
        typeof item.lengthSeconds === 'number' && item.lengthSeconds > 0
          ? Math.round(item.lengthSeconds)
          : undefined,
      thumbnailUrl: hqThumb,
    });
  }
  return out;
}

const STRICT_UNOFFICIAL_KEYWORDS_REGEX =
  /\b(slowed|reverb|sped\s*up|nightcore|8d\s*audio|cover\b|karaoke|instrumental|bootleg|mashup|fan\s*made|lyrics?\s*video|lyric\s*video|reaction|interview|podcast|live\s+at|concert|full\s+album|type\s+beat|extended\s+mix|bass\s*boosted|snippet|leak(ed)?)\b/i;

const UNOFFICIAL_CHANNEL_REGEX =
  /\b(lyrics?|lyric|karaoke|nightcore|slowed|mashup|compilation|dj\s*(mix|set)|fan\s*(channel|page|club)|repost|promotions?|music\s*box|sub\s*espanol|trap\s*nation|chill\s*nation|cloudkid|type\s*beat)\b/i;

function isKnockoffUpload(videoTitle: string, channelTitle: string, userQuery: string): boolean {
  const titleLower = videoTitle.toLowerCase();
  const chanLower = channelTitle.toLowerCase();
  const qLower = userQuery.toLowerCase();

  if (UNOFFICIAL_CHANNEL_REGEX.test(chanLower)) {
    return true;
  }

  const m = titleLower.match(STRICT_UNOFFICIAL_KEYWORDS_REGEX);
  if (m && !qLower.includes(m[1].toLowerCase())) {
    return true;
  }
  if (/\bcover\b/i.test(titleLower) && !/\bcover\b/i.test(qLower)) {
    return true;
  }
  return false;
}

function isOfficialChannelShape(channelTitle: string): {
  isTopic: boolean;
  isVevo: boolean;
  cleanChannel: string;
} {
  const trimmed = channelTitle.trim();
  const isTopic = /\s*-\s*Topic$/i.test(trimmed);
  const isVevo = /VEVO$/i.test(trimmed);
  const cleanChannel = cleanYouTubeChannelName(trimmed);
  return { isTopic, isVevo, cleanChannel };
}

function channelMatchesCreditedArtist(channelTitle: string, expectedArtist: string): boolean {
  const { isTopic, isVevo, cleanChannel } = isOfficialChannelShape(channelTitle);
  const normArtist = normalizeMusicText(expectedArtist);
  const normChannel = normalizeMusicText(cleanChannel);
  if (!normArtist || !normChannel) return false;

  if (doesArtistNameMatch(cleanChannel, expectedArtist)) return true;
  if (normChannel === normArtist) return true;
  if (isTopic && (normChannel.includes(normArtist) || normArtist.includes(normChannel))) return true;
  if (isVevo && (normChannel.includes(normArtist) || normArtist.includes(normChannel))) return true;
  return tokenSimilarity(cleanChannel, expectedArtist) >= 0.65;
}

export function isOfficialArtistUpload(
  candidate: RawYouTubeCandidate,
  expectedArtist?: string,
  expectedTitle?: string,
  expectedDurationSec?: number,
  allowLongDuration = false
): boolean {
  if (!candidate?.videoId || !candidate?.title?.trim()) return false;
  const channel = (candidate.channelTitle || '').trim();
  if (!channel || !isValidArtistName(cleanYouTubeChannelName(channel))) {
    return false;
  }

  const title = candidate.title.trim();
  const queryContext = `${expectedTitle ?? ''} ${expectedArtist ?? ''}`.trim();
  if (isKnockoffUpload(title, channel, queryContext)) {
    return false;
  }

  const { isTopic, isVevo } = isOfficialChannelShape(channel);
  const artist = (expectedArtist ?? '').trim();
  const matchesArtist = artist ? channelMatchesCreditedArtist(channel, artist) : false;

  // Channel authenticity gate
  if (artist) {
    // When looking up a specific artist track, require the uploader to be the official
    // artist's Topic / VEVO / matching artist channel (or verified match).
    const officialMatch =
      (isTopic && matchesArtist) ||
      (isVevo && matchesArtist) ||
      (Boolean(candidate.verified) && matchesArtist) ||
      matchesArtist;
    if (!officialMatch) {
      return false;
    }
  } else {
    // Broad music search: require Topic, VEVO, or verified artist channel
    if (!isTopic && !isVevo && !candidate.verified) {
      return false;
    }
  }

  // Strict remix rule: remixes allowed ONLY if uploaded by official artist channel AND
  // either expectedTitle is that remix or title credits "<Artist> Remix".
  const titleHasRemix = /\bremix\b/i.test(title);
  if (titleHasRemix) {
    const isStrongOfficialChannel = isTopic || isVevo || Boolean(candidate.verified);
    if (!isStrongOfficialChannel) return false;
    const expectedHasRemix = /\bremix\b/i.test(expectedTitle ?? '');
    const titleCreditsArtistRemix =
      artist.length > 1 &&
      new RegExp(`${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*remix|remix.*${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(title);
    if (!expectedHasRemix && !titleCreditsArtistRemix) {
      return false;
    }
  }

  // Duration cross-check against official iTunes/catalog track duration (max ±12s tolerance)
  if (
    typeof expectedDurationSec === 'number' &&
    expectedDurationSec > 0 &&
    typeof candidate.durationSec === 'number' &&
    candidate.durationSec > 0
  ) {
    if (Math.abs(candidate.durationSec - expectedDurationSec) > 12) {
      return false;
    }
  }

  if (!allowLongDuration && typeof candidate.durationSec === 'number' && candidate.durationSec > 0) {
    if (candidate.durationSec < 45 || candidate.durationSec > 600) {
      return false;
    }
  }

  return true;
}

function scoreYouTubeCandidate(
  candidate: RawYouTubeCandidate,
  targetTitle: string,
  targetArtist: string,
  expectedDurationSec?: number,
  allowLongDuration = false
): number {
  if (
    !isOfficialArtistUpload(
      candidate,
      targetArtist,
      targetTitle,
      expectedDurationSec,
      allowLongDuration
    )
  ) {
    return -1000;
  }

  const combinedText = `${candidate.title} ${candidate.channelTitle}`.toLowerCase();
  const { isTopic, isVevo } = isOfficialChannelShape(candidate.channelTitle);
  const matchesArtist = targetArtist
    ? channelMatchesCreditedArtist(candidate.channelTitle, targetArtist)
    : false;

  let score = 0;
  if (isTopic) score += 120;
  else if (isVevo) score += 95;
  else if (candidate.verified && matchesArtist) score += 75;
  else if (matchesArtist) score += 55;
  else if (candidate.verified) score += 35;

  if (combinedText.includes('official audio') || combinedText.includes('provided to youtube')) {
    score += 32;
  } else if (combinedText.includes('official music video') || combinedText.includes('official video')) {
    score += 18;
  }

  if (targetTitle) {
    score += tokenSimilarity(candidate.title, targetTitle) * 40;
  }
  if (targetArtist) {
    score += tokenSimilarity(`${candidate.title} ${candidate.channelTitle}`, targetArtist) * 28;
  }

  if (
    typeof expectedDurationSec === 'number' &&
    expectedDurationSec > 0 &&
    typeof candidate.durationSec === 'number' &&
    candidate.durationSec > 0
  ) {
    const diff = Math.abs(candidate.durationSec - expectedDurationSec);
    score += Math.max(0, 24 - diff * 2);
  }

  if (combinedText.includes('clean version') || combinedText.includes('(clean)')) {
    score -= 60;
  }

  return score;
}

export function filterAndRankOfficialCandidates(
  candidates: RawYouTubeCandidate[],
  expectedTitle: string,
  expectedArtist: string,
  expectedDurationSec?: number,
  allowLongDuration = false
): RawYouTubeCandidate[] {
  return candidates
    .map((cand) => ({
      cand,
      score: scoreYouTubeCandidate(
        cand,
        expectedTitle,
        expectedArtist,
        expectedDurationSec,
        allowLongDuration
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.cand);
}

function splitYouTubeArtistAndTitle(rawTitle: string, fallbackChannel: string): {
  title: string;
  artist: string;
} {
  const cleanedChannel = cleanYouTubeChannelName(fallbackChannel);
  const parts = rawTitle.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts
      .slice(1)
      .join(' - ')
      .replace(/\s*[\[(](Official[^)\]]*|Audio|Video|Lyrics?)[\])]/gi, '')
      .trim();
    if (artist && title && isValidArtistName(artist)) {
      return { title, artist };
    }
  }
  return {
    title:
      rawTitle
        .replace(/\s*[\[(](Official[^)\]]*|Audio|Video|Lyrics?)[\])]/gi, '')
        .trim() || rawTitle,
    artist: cleanedChannel,
  };
}

/**
 * Free YouTube Music Search racing free Piped + Invidious mirrors + YouTube search proxy
 * (plus optional VITE_YOUTUBE_API_KEY) with 2200ms AbortController timeouts.
 * Strictly retains official-artist uploads only and attaches youtubeVideoId directly.
 */
export async function searchFreeYouTubeSongs(
  query: string,
  options: {
    categoryOverride?: Exclude<CategoryPill, 'All'>;
    maxResults?: number;
    allowLongDuration?: boolean;
    releaseDate?: string;
    genreLabel?: string;
    expectedArtist?: string;
  } = {}
): Promise<ShowcaseTrack[]> {
  const cleanedQuery = normalizeSearchTypos(
    query.replace(/\s+[-–—]\s+/g, ' ')
  );
  if (!cleanedQuery) return [];

  const maxResults = options.maxResults ?? 15;
  const allowLong = Boolean(options.allowLongDuration);

  const settled = await Promise.allSettled([
    queryServerFreeYouTube(allowLong ? cleanedQuery : `${cleanedQuery} official audio`),
    queryYouTubeDataApi(`${cleanedQuery} official audio`),
    ...PIPED_INSTANCES.slice(0, 3).map((base) => queryPipedMirror(base, cleanedQuery)),
    ...INVIDIOUS_INSTANCES.slice(0, 2).map((base) => queryInvidiousMirror(base, cleanedQuery)),
  ]);

  const rawList: RawYouTubeCandidate[] = [];
  for (const res of settled) {
    if (res.status === 'fulfilled' && res.value.length > 0) {
      rawList.push(...res.value);
    }
  }

  const dedup = new Map<string, RawYouTubeCandidate>();
  for (const item of rawList) {
    const existing = dedup.get(item.videoId);
    if (!existing || (!existing.verified && item.verified)) {
      dedup.set(item.videoId, item);
    }
  }

  const rankedCandidates = filterAndRankOfficialCandidates(
    Array.from(dedup.values()),
    cleanedQuery,
    options.expectedArtist ?? '',
    undefined,
    allowLong
  );

  const tracks: ShowcaseTrack[] = [];
  for (const cand of rankedCandidates) {
    const { title, artist } = splitYouTubeArtistAndTitle(
      cand.title,
      cand.channelTitle
    );
    if (!isValidArtistName(artist)) continue;
    const id = `yt-${cand.videoId}`;
    const coverUrl =
      cand.thumbnailUrl?.startsWith('http')
        ? cand.thumbnailUrl
        : `https://i.ytimg.com/vi/${cand.videoId}/hqdefault.jpg`;

    tracks.push({
      id,
      youtubeVideoId: cand.videoId,
      youtubeCandidates: [cand.videoId],
      youtubeChannelTitle: cand.channelTitle,
      title,
      artist,
      album: allowLong ? 'Episode' : 'Single',
      duration: cand.durationSec ?? (allowLong ? 1800 : 210),
      category: options.categoryOverride ?? 'Party',
      genre: options.genreLabel || 'Music',
      releaseDate: options.releaseDate,
      artwork: pickGradientArtwork(id + title),
      coverUrl,
      source: 'youtube',
      isAudius: false,
      streamStatus: 'full',
      accentColor: '#FFFFFF',
      glowColor: '#FFFFFF',
      secondaryGlowColor: '#A1A1AA',
      lyrics: [],
    });
    if (tracks.length >= maxResults) break;
  }

  return tracks;
}

export async function searchYouTubeTracks(
  query: string,
  categoryOverride?: Exclude<CategoryPill, 'All'>
): Promise<ShowcaseTrack[]> {
  return searchFreeYouTubeSongs(query, { categoryOverride, maxResults: 15 });
}

export interface YouTubeSearchResultItem {
  id: string;
  videoId: string;
  title: string;
  rawTitle: string;
  artist: string;
  channel: string;
  album: string;
  artwork: string;
  durationSec: number;
  views?: number;
  source: 'youtube';
  track: ShowcaseTrack;
}

const YT_CLEAN_REGEX =
  /(\[clean\]|\(clean\)|clean version|radio edit|\(edited\)|\[edited\]|censored)/i;
const YT_KNOCKOFF_REGEX =
  /(karaoke|instrumental|tribute|parody|knockoff|8d audio|nightcore|slowed|sped up|reverb|cover by|type beat)/i;

function extractYouTubeVideoId(raw?: string): string | null {
  if (!raw) return null;
  const match = raw.match(
    /(?:v=|\/watch\?v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : /^[a-zA-Z0-9_-]{11}$/.test(raw) ? raw : null;
}

function cleanYouTubeChannelName(channel: string): string {
  return channel
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();
}

function parseYouTubeTitleAndArtist(
  rawTitle: string,
  channel: string,
  fallbackQuery: string
): { title: string; artist: string } {
  const stripped = rawTitle
    .replace(
      /\[(Official\s*(Music\s*)?Video|Official\s*Audio|Audio|Lyrics?|Visualizer|HD|4K|Explicit|Clean)\]/gi,
      ''
    )
    .replace(
      /\((Official\s*(Music\s*)?Video|Official\s*Audio|Audio|Lyrics?|Visualizer|HD|4K|Explicit|Clean)\)/gi,
      ''
    )
    .trim();

  const parts = stripped.split(/\s+[-–—|]\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim() || cleanYouTubeChannelName(channel) || fallbackQuery,
      title: parts.slice(1).join(' - ').trim() || stripped || rawTitle,
    };
  }

  return {
    artist: cleanYouTubeChannelName(channel) || fallbackQuery,
    title: stripped || rawTitle,
  };
}

function scoreYouTubeHitRank(
  rawTitle: string,
  channel: string,
  views: number,
  durationSec: number,
  query: string
): number {
  const t = rawTitle.toLowerCase();
  const c = channel.toLowerCase();
  const qTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  let score = 0;
  for (const tok of qTokens) {
    if (t.includes(tok) || c.includes(tok)) score += 18;
  }

  if (c.includes('- topic') || c.includes('vevo')) score += 35;
  if (t.includes('official audio') || t.includes('official video')) score += 25;
  if (durationSec >= 45 && durationSec <= 900) score += 10;
  if (views > 0) score += Math.min(Math.log10(views + 1) * 4, 25);

  if (YT_KNOCKOFF_REGEX.test(t) || YT_CLEAN_REGEX.test(t)) score -= 90;
  return score;
}

function buildYouTubeSearchItem(params: {
  videoId: string;
  rawTitle: string;
  channel: string;
  verified?: boolean;
  artwork: string;
  durationSec: number;
  views?: number;
  album: string;
  query: string;
}): { item: YouTubeSearchResultItem; score: number } | null {
  const {
    videoId,
    rawTitle,
    channel,
    verified,
    artwork,
    durationSec,
    views,
    album,
    query,
  } = params;
  if (!videoId || !rawTitle) return null;
  if (YT_CLEAN_REGEX.test(rawTitle) || YT_KNOCKOFF_REGEX.test(rawTitle)) {
    return null;
  }

  const parsed = parseYouTubeTitleAndArtist(rawTitle, channel, query);
  const { isTopic, isVevo, cleanChannel } = isOfficialChannelShape(channel);
  const channelLikelyArtist =
    cleanChannel.length >= 2 &&
    (doesArtistNameMatch(cleanChannel, parsed.artist) ||
      tokenSimilarity(cleanChannel, query) >= 0.45);
  const effectiveArtist =
    isTopic || isVevo || verified || channelLikelyArtist ? parsed.artist : '';

  if (
    !isOfficialArtistUpload(
      {
        videoId,
        title: rawTitle,
        channelTitle: channel,
        verified: Boolean(verified),
        durationSec: durationSec > 0 ? durationSec : undefined,
      },
      effectiveArtist,
      query
    )
  ) {
    return null;
  }

  const id = `yt-${videoId}`;

  const track: ShowcaseTrack = {
    id,
    youtubeVideoId: videoId,
    youtubeCandidates: [videoId],
    youtubeChannelTitle: channel || undefined,
    title: parsed.title,
    artist: parsed.artist,
    album: album || 'Single',
    duration: durationSec > 0 ? durationSec : 210,
    category: 'Party',
    genre: 'Music',
    artwork: pickGradientArtwork(id + parsed.title),
    coverUrl: artwork,
    source: 'youtube',
    isAudius: false,
    streamStatus: 'full',
    playCount: views && views > 0 ? views : undefined,
    accentColor: '#FFFFFF',
    glowColor: '#FFFFFF',
    secondaryGlowColor: '#A1A1AA',
    lyrics: [],
  };

  if (!isOfficialArtistTrack(track, query)) {
    return null;
  }

  return {
    score: scoreYouTubeHitRank(rawTitle, channel, views ?? 0, durationSec || 180, query),
    item: {
      id,
      videoId,
      title: parsed.title,
      rawTitle,
      artist: parsed.artist,
      channel: cleanYouTubeChannelName(channel) || parsed.artist,
      album: album || 'Single',
      artwork,
      durationSec,
      views,
      source: 'youtube',
      track,
    },
  };
}

/**
 * Search Engine racing free Piped + Invidious mirrors + search proxy (plus optional key)
 * with 2200ms AbortController timeouts. Attaches youtubeVideoId directly for instant playback.
 */
export async function searchYouTubeResults(
  query: string,
  limit = 16
): Promise<YouTubeSearchResultItem[]> {
  const q = normalizeSearchTypos(query.replace(/\s+[-–—]\s+/g, ' '));
  if (!q) return [];

  const ytApiKey = getYouTubeApiKey();
  const tasks: Promise<Array<{ item: YouTubeSearchResultItem; score: number }>>[] = [];

  tasks.push(
    queryServerFreeYouTube(`${q} official audio`).then((items) =>
      items
        .slice(0, limit)
        .map((cand) =>
          buildYouTubeSearchItem({
            videoId: cand.videoId,
            rawTitle: cand.title,
            channel: cand.channelTitle,
            verified: cand.verified,
            artwork:
              cand.thumbnailUrl?.startsWith('http')
                ? cand.thumbnailUrl
                : `https://i.ytimg.com/vi/${cand.videoId}/hqdefault.jpg`,
            durationSec: cand.durationSec ?? 0,
            album: 'Single',
            query: q,
          })
        )
        .filter((x): x is { item: YouTubeSearchResultItem; score: number } => Boolean(x))
    )
  );

  if (ytApiKey) {
    tasks.push(
      fetchJsonWithTimeout<{
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
          };
        }>;
      }>(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=${limit}&q=${encodeURIComponent(
          q
        )}&key=${encodeURIComponent(ytApiKey)}`,
        2200
      ).then((res) =>
        (res?.items || [])
          .map((entry) => {
            const videoId = entry?.id?.videoId?.trim() || '';
            const rawTitle = String(entry?.snippet?.title || '');
            const channel = String(entry?.snippet?.channelTitle || '');
            const artwork =
              entry?.snippet?.thumbnails?.high?.url ||
              entry?.snippet?.thumbnails?.medium?.url ||
              (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
            return buildYouTubeSearchItem({
              videoId,
              rawTitle,
              channel,
              artwork,
              durationSec: 0,
              album: 'Single',
              query: q,
            });
          })
          .filter((x): x is { item: YouTubeSearchResultItem; score: number } => Boolean(x))
      )
    );
  }

  for (const base of PIPED_INSTANCES.slice(0, 4)) {
    tasks.push(
      fetchJsonWithTimeout<
        Array<{ url?: string; title?: string; uploaderName?: string; uploaderVerified?: boolean; duration?: number; views?: number; thumbnail?: string }> |
        { items?: Array<{ url?: string; title?: string; uploaderName?: string; uploaderVerified?: boolean; duration?: number; views?: number; thumbnail?: string }> }
      >(
        `${base}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        2200
      ).then((res) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        return list
          .slice(0, limit)
          .map((entry) => {
            const videoId = extractYouTubeVideoId(entry.url) || '';
            return buildYouTubeSearchItem({
              videoId,
              rawTitle: String(entry.title || ''),
              channel: String(entry.uploaderName || ''),
              verified: Boolean(entry.uploaderVerified),
              artwork:
                entry.thumbnail ||
                (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
              durationSec: Number(entry.duration || 0),
              views: Number(entry.views || 0),
              album: 'Single',
              query: q,
            });
          })
          .filter((x): x is { item: YouTubeSearchResultItem; score: number } => Boolean(x));
      })
    );
  }

  for (const base of INVIDIOUS_INSTANCES) {
    tasks.push(
      fetchJsonWithTimeout<
        Array<{ videoId?: string; title?: string; author?: string; authorVerified?: boolean; lengthSeconds?: number; viewCount?: number }>
      >(
        `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
        2200
      ).then((items) =>
        (Array.isArray(items) ? items : [])
          .slice(0, limit)
          .map((entry) => {
            const videoId = entry.videoId?.trim() || '';
            return buildYouTubeSearchItem({
              videoId,
              rawTitle: String(entry.title || ''),
              channel: String(entry.author || ''),
              verified: Boolean(entry.authorVerified),
              artwork: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
              durationSec: Number(entry.lengthSeconds || 0),
              views: Number(entry.viewCount || 0),
              album: 'Single',
              query: q,
            });
          })
          .filter((x): x is { item: YouTubeSearchResultItem; score: number } => Boolean(x))
      )
    );
  }

  const settled = await Promise.allSettled(tasks);
  const bestByVideoId = new Map<string, { item: YouTubeSearchResultItem; score: number }>();

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      for (const entry of outcome.value) {
        const existing = bestByVideoId.get(entry.item.videoId);
        if (!existing || entry.score > existing.score) {
          bestByVideoId.set(entry.item.videoId, entry);
        }
      }
    }
  }

  return Array.from(bestByVideoId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

function cleanAlbumTitleFromYouTube(rawTitle: string): string {
  return rawTitle
    .replace(
      /\s*[\[(](full\s*album|album|ep|lp|deluxe(\s+edition)?|explicit|official(\s+audio)?|audio|video|hd|4k)[\])]/gi,
      ''
    )
    .replace(/\b(full\s+album|official\s+album)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRawVideoThumbnailUrl(url?: string): boolean {
  if (!url) return true;
  return /i\.ytimg\.com\/vi\//i.test(url);
}

async function enrichAlbumsWithRealArtwork(
  albums: AlbumItem[]
): Promise<AlbumItem[]> {
  const needsArt = albums.filter(
    (a) => !a.coverUrl || isRawVideoThumbnailUrl(a.coverUrl)
  );
  if (needsArt.length === 0) return albums;

  const resolvedMap = new Map<string, string>();
  await Promise.allSettled(
    needsArt.slice(0, 12).map(async (alb) => {
      const term = `${alb.artist} ${alb.title}`.trim();
      const [itunesHits, deezerCover] = await Promise.allSettled([
        searchRealAlbums(term, 3),
        fetchDeezerAlbumCoverJsonp(alb.artist, alb.title),
      ]);
      const itMatch =
        itunesHits.status === 'fulfilled'
          ? itunesHits.value.find(
              (cand) =>
                tokenSimilarity(cand.title, alb.title) >= 0.45 &&
                Boolean(cand.coverUrl)
            ) ?? itunesHits.value.find((cand) => Boolean(cand.coverUrl))
          : undefined;
      const realCover =
        itMatch?.coverUrl ||
        (deezerCover.status === 'fulfilled' ? deezerCover.value : null) ||
        undefined;
      if (realCover) {
        resolvedMap.set(alb.id, realCover);
      }
    })
  );

  return albums.map((alb) => {
    const better = resolvedMap.get(alb.id);
    return better ? { ...alb, coverUrl: better } : alb;
  });
}

/**
 * Searches for matching albums / full-album releases and resolves real square album artwork.
 */
export async function searchYouTubeAlbums(
  query: string,
  limit = 10
): Promise<AlbumItem[]> {
  const q = normalizeSearchTypos(query.replace(/\s+[-–—]\s+/g, ' '));
  if (!q) return [];

  const [rawAlbumCandidates, pipedAlbumRes] = await Promise.allSettled([
    queryServerFreeYouTube(`${q} full album`),
    Promise.any(
      PIPED_INSTANCES.slice(0, 3).map(async (base) => {
        const data = await fetchJsonWithTimeout<{
          items?: Array<{
            url?: string;
            name?: string;
            title?: string;
            uploaderName?: string;
            thumbnail?: string;
          }>;
        }>(`${base}/search?q=${encodeURIComponent(q)}&filter=music_albums`, 2200);
        const list = Array.isArray(data?.items) ? data.items : [];
        if (list.length === 0) throw new Error('empty');
        return list;
      })
    ),
  ]);

  const albums: AlbumItem[] = [];
  const seen = new Set<string>();

  if (pipedAlbumRes.status === 'fulfilled') {
    for (const item of pipedAlbumRes.value) {
      const rawName = (item.name || item.title || '').trim();
      const artist = cleanYouTubeChannelName((item.uploaderName || q).trim()) || q;
      const title = cleanAlbumTitleFromYouTube(rawName) || rawName;
      if (!title || YT_KNOCKOFF_REGEX.test(title) || YT_CLEAN_REGEX.test(title)) continue;
      const key = `${normalizeMusicText(artist)}::${normalizeMusicText(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const idSlug = key.replace(/[^a-z0-9]+/g, '-').slice(0, 48);
      albums.push({
        id: `yt-album-${idSlug}`,
        title,
        artist,
        genre: 'Album',
        artwork: pickGradientArtwork(idSlug + title),
        coverUrl: item.thumbnail?.startsWith('http') ? item.thumbnail : undefined,
        description: `${artist} · ${title}`,
        trackIds: [],
      });
      if (albums.length >= limit) break;
    }
  }

  if (rawAlbumCandidates.status === 'fulfilled') {
    for (const cand of rawAlbumCandidates.value) {
      if (albums.length >= limit) break;
      if (YT_KNOCKOFF_REGEX.test(cand.title) || YT_CLEAN_REGEX.test(cand.title)) continue;
      const parsed = parseYouTubeTitleAndArtist(cand.title, cand.channelTitle, q);
      const title = cleanAlbumTitleFromYouTube(parsed.title) || parsed.title;
      const artist = parsed.artist || q;
      if (!title) continue;
      const key = `${normalizeMusicText(artist)}::${normalizeMusicText(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const idSlug = `yt-album-${cand.videoId}`;
      const coverUrl = cand.thumbnailUrl?.startsWith('http')
        ? cand.thumbnailUrl
        : `https://i.ytimg.com/vi/${cand.videoId}/hqdefault.jpg`;
      albums.push({
        id: idSlug,
        title,
        artist,
        genre: 'Album',
        artwork: pickGradientArtwork(idSlug + title),
        coverUrl,
        description: `${artist} · ${title}`,
        trackIds: [],
      });
    }
  }

  return enrichAlbumsWithRealArtwork(albums.slice(0, limit));
}

/**
 * Resolves album tracklists using both iTunes lookup (when collectionId exists) and YouTube
 * search so every album — including YouTube-discovered releases — loads full playable tracks.
 */
export async function lookupAlbumWithYouTube(
  album: AlbumItem
): Promise<{ album: AlbumItem | null; tracks: ShowcaseTrack[] }> {
  const cleanSearch = `${album.artist} ${album.title}`.trim();
  const hasNumericId = Boolean(
    album.collectionId && /^\d+$/.test(album.collectionId.replace(/^itunes-album-/, '').trim())
  );

  const [itunesRes, ytRes, itunesSearchFallbackRes] = await Promise.allSettled([
    hasNumericId && album.collectionId
      ? lookupAlbumTracks(album.collectionId)
      : Promise.resolve({ album: null, tracks: [] as ShowcaseTrack[] }),
    searchYouTubeResults(cleanSearch, 16),
    !hasNumericId
      ? searchRealAlbums(cleanSearch, 3)
      : Promise.resolve([] as AlbumItem[]),
  ]);

  let resolvedAlbum =
    itunesRes.status === 'fulfilled' ? itunesRes.value.album : null;
  let tracks =
    itunesRes.status === 'fulfilled' ? itunesRes.value.tracks : [];

  if (tracks.length === 0 && itunesSearchFallbackRes.status === 'fulfilled') {
    const matchedAlbum = itunesSearchFallbackRes.value.find(
      (a) =>
        normalizeMusicText(a.title) === normalizeMusicText(album.title) ||
        tokenSimilarity(a.title, album.title) >= 0.7
    );
    if (matchedAlbum?.collectionId) {
      try {
        const lookup = await lookupAlbumTracks(matchedAlbum.collectionId);
        if (lookup.tracks.length > 0) {
          resolvedAlbum = lookup.album;
          tracks = lookup.tracks;
        }
      } catch {
        // continue with YouTube tracklist fallback
      }
    }
  }

  const ytTracks =
    ytRes.status === 'fulfilled'
      ? ytRes.value.map((r) => ({
          ...r.track,
          album: resolvedAlbum?.title || album.title,
        }))
      : [];

  if (tracks.length > 0) {
    const ytByTitle = new Map<string, ShowcaseTrack>();
    for (const yt of ytTracks) {
      const key = normalizeMusicText(yt.title);
      if (!ytByTitle.has(key)) ytByTitle.set(key, yt);
    }

    const enrichedTracks = tracks.map((t) => {
      const normTitle = normalizeMusicText(t.title);
      const exactYt = ytByTitle.get(normTitle);
      const fuzzyYt =
        exactYt ??
        ytTracks.find((yt) => tokenSimilarity(yt.title, t.title) >= 0.72);
      if (fuzzyYt?.youtubeVideoId) {
        return {
          ...t,
          youtubeVideoId: fuzzyYt.youtubeVideoId,
          youtubeCandidates: fuzzyYt.youtubeCandidates ?? [fuzzyYt.youtubeVideoId],
          streamStatus: 'full' as const,
        };
      }
      return t;
    });

    return {
      album: resolvedAlbum ?? album,
      tracks: enrichedTracks,
    };
  }

  const filteredYt = ytTracks.filter((t) => {
    const sameArtist = doesArtistNameMatch(t.artist, album.artist);
    const titleHit =
      tokenSimilarity(t.title, album.title) >= 0.3 ||
      normalizeMusicText(t.title).length > 1;
    return sameArtist || titleHit;
  });

  const finalTracks = (filteredYt.length > 0 ? filteredYt : ytTracks).map((t) => ({
    ...t,
    album: album.title,
  }));

  let resolvedCoverUrl =
    resolvedAlbum?.coverUrl && !isRawVideoThumbnailUrl(resolvedAlbum.coverUrl)
      ? resolvedAlbum.coverUrl
      : album.coverUrl && !isRawVideoThumbnailUrl(album.coverUrl)
      ? album.coverUrl
      : undefined;

  if (!resolvedCoverUrl) {
    resolvedCoverUrl =
      (await fetchDeezerAlbumCoverJsonp(album.artist, album.title)) || undefined;
  }

  const finalAlbum: AlbumItem = {
    ...(resolvedAlbum ?? album),
    coverUrl:
      resolvedCoverUrl ||
      resolvedAlbum?.coverUrl ||
      album.coverUrl ||
      finalTracks[0]?.coverUrl,
    trackIds:
      resolvedAlbum?.trackIds?.length
        ? resolvedAlbum.trackIds
        : finalTracks.map((t) => t.id),
  };

  return {
    album: finalAlbum,
    tracks: finalTracks,
  };
}

/**
 * Searches YouTube for an artist's songs and albums so ArtistDetailScreen always
 * leads with instant-play YouTube results alongside iTunes and Audius discographies.
 */
export async function searchYouTubeArtistDiscography(artistName: string): Promise<{
  tracks: ShowcaseTrack[];
  albums: AlbumItem[];
}> {
  const cleanArtist = artistName.trim();
  if (!cleanArtist) return { tracks: [], albums: [] };

  const [songResultsRes, albumResultsRes] = await Promise.allSettled([
    searchYouTubeResults(cleanArtist, 18),
    searchYouTubeAlbums(cleanArtist, 8),
  ]);

  const artistNorm = normalizeMusicText(cleanArtist);
  const rawYtTracks =
    songResultsRes.status === 'fulfilled' ? songResultsRes.value : [];

  const matchedTracks: ShowcaseTrack[] = [];
  const seenTitles = new Set<string>();

  for (const item of rawYtTracks) {
    const channelNorm = normalizeMusicText(item.channel);
    const titleNorm = normalizeMusicText(item.rawTitle);
    const matchesArtist =
      doesArtistNameMatch(item.artist, cleanArtist) ||
      channelNorm.includes(artistNorm) ||
      titleNorm.includes(artistNorm);
    if (!matchesArtist) continue;

    const cleanTitleKey = normalizeMusicText(item.title);
    if (!cleanTitleKey || seenTitles.has(cleanTitleKey)) continue;
    seenTitles.add(cleanTitleKey);

    matchedTracks.push({
      ...item.track,
      artist: doesArtistNameMatch(item.artist, cleanArtist)
        ? item.artist
        : cleanArtist,
      album: 'Single',
      genre: 'Music',
    });
  }

  const rawAlbums =
    albumResultsRes.status === 'fulfilled' ? albumResultsRes.value : [];
  const matchedAlbums = rawAlbums.filter(
    (alb) =>
      doesArtistNameMatch(alb.artist, cleanArtist) ||
      normalizeMusicText(alb.artist).includes(artistNorm) ||
      normalizeMusicText(alb.title).includes(artistNorm)
  );

  return {
    tracks: matchedTracks,
    albums: matchedAlbums,
  };
}

/**
 * Low-latency YouTube candidate resolver: races /api/youtube/free-search, YouTube Data API,
 * and Piped/Invidious mirrors and resolves immediately as soon as the fastest healthy source
 * returns usable scored video IDs (no blocking on slow/dead mirrors).
 */
export async function resolveYouTubeCandidates(
  title: string,
  artist: string,
  preferredVideoId?: string,
  expectedDurationSec?: number
): Promise<string[]> {
  const cleanTitle = title.replace(/\s*[\[(][^)\]]*[\])]/g, ' ').trim() || title.trim();
  const cleanArtist = artist.split(/,|feat\.|ft\.|&/i)[0].trim() || artist.trim();
  const durBucket =
    typeof expectedDurationSec === 'number' && expectedDurationSec > 0
      ? Math.round(expectedDurationSec / 5) * 5
      : 0;
  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}::${durBucket}`;

  if (ytCandidateMemoryCache.has(cacheKey)) {
    const cached = ytCandidateMemoryCache.get(cacheKey)!;
    if (preferredVideoId && !cached.includes(preferredVideoId)) {
      return [preferredVideoId, ...cached];
    }
    return cached;
  }

  const persisted = readLocalCache<CachedYtEntry>(YT_CACHE_KEY);
  const stored = persisted[cacheKey];
  if (
    stored &&
    Array.isArray(stored.ids) &&
    stored.ids.length > 0 &&
    Date.now() - stored.ts < 7 * 24 * 3600 * 1000
  ) {
    ytCandidateMemoryCache.set(cacheKey, stored.ids);
    if (preferredVideoId && !stored.ids.includes(preferredVideoId)) {
      return [preferredVideoId, ...stored.ids];
    }
    return stored.ids;
  }

  const query = `${cleanArtist} ${cleanTitle} official audio`;
  const shortQuery = `${cleanArtist} ${cleanTitle}`;

  const rankNonEmpty = (items: RawYouTubeCandidate[]): string[] => {
    const ranked = filterAndRankOfficialCandidates(
      items,
      cleanTitle,
      cleanArtist,
      expectedDurationSec,
      false
    ).map((entry) => entry.videoId);
    if (ranked.length === 0) throw new Error('no-usable-candidates');
    return Array.from(new Set(ranked)).slice(0, 6);
  };

  const racers = [
    queryServerFreeYouTube(query).then(rankNonEmpty),
    queryYouTubeDataApi(query).then(rankNonEmpty),
    ...PIPED_INSTANCES.slice(0, 2).map((base) =>
      queryPipedMirror(base, shortQuery).then(rankNonEmpty)
    ),
    ...INVIDIOUS_INSTANCES.slice(0, 2).map((base) =>
      queryInvidiousMirror(base, shortQuery).then(rankNonEmpty)
    ),
  ];

  let ranked: string[] = [];
  try {
    ranked = await Promise.any(racers);
  } catch {
    ranked = [];
  }

  const combined = preferredVideoId
    ? Array.from(new Set([preferredVideoId, ...ranked]))
    : ranked;

  if (combined.length > 0) {
    ytCandidateMemoryCache.set(cacheKey, combined);
    persisted[cacheKey] = { ids: combined, ts: Date.now() };
    writeLocalCache(YT_CACHE_KEY, persisted);
  }

  return combined;
}

export async function resolveFullYouTubeTrack(
  track: ShowcaseTrack
): Promise<ShowcaseTrack> {
  if (
    track.youtubeVideoId &&
    Array.isArray(track.youtubeCandidates) &&
    track.youtubeCandidates.length > 0 &&
    track.streamStatus === 'full'
  ) {
    return track;
  }

  const candidates = await resolveYouTubeCandidates(
    track.title,
    track.artist,
    track.youtubeVideoId,
    track.duration
  );

  if (candidates.length > 0) {
    return {
      ...track,
      youtubeVideoId: candidates[0],
      youtubeCandidates: candidates,
      streamStatus: 'full',
    };
  }

  return {
    ...track,
    streamStatus: track.previewUrl ? 'preview-only' : 'unresolved',
  };
}

async function fetchAppleRssWithFallback(
  proxyUrl: string,
  directUrl: string
): Promise<AppleRssFeedResponse | null> {
  if (!isNativeCapacitorRuntime()) {
    const proxied = await fetchJsonWithTimeout<AppleRssFeedResponse>(proxyUrl, 2600);
    if (proxied?.feed?.results) return proxied;
  }
  return fetchJsonWithTimeout<AppleRssFeedResponse>(directUrl, 3200);
}

export async function fetchAppleTrendingCharts(
  country: 'us' | 'ke' = 'us',
  songLimit = 50,
  albumLimit = 25
): Promise<{
  songTracks: ShowcaseTrack[];
  albums: AlbumItem[];
}> {
  const [songsFeedRes, albumsFeedRes] = await Promise.allSettled([
    fetchAppleRssWithFallback(
      `/api/apple-charts/songs?country=${country}&limit=${songLimit}`,
      `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${songLimit}/songs.json`
    ),
    fetchAppleRssWithFallback(
      `/api/apple-charts/albums?country=${country}&limit=${albumLimit}`,
      `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${albumLimit}/albums.json`
    ),
  ]);

  const songEntries =
    songsFeedRes.status === 'fulfilled' &&
    Array.isArray(songsFeedRes.value?.feed?.results)
      ? songsFeedRes.value.feed.results
      : [];
  const albumEntries =
    albumsFeedRes.status === 'fulfilled' &&
    Array.isArray(albumsFeedRes.value?.feed?.results)
      ? albumsFeedRes.value.feed.results
      : [];

  let songTracks: ShowcaseTrack[] = [];
  if (songEntries.length > 0) {
    const cleanIds = songEntries
      .map((e) => e.id)
      .filter((id): id is string => Boolean(id && /^\d+$/.test(id)));
    if (cleanIds.length > 0) {
      try {
        const res = await fetch(
          `${ITUNES_API_BASE}/lookup?id=${cleanIds.join(',')}&entity=song`
        );
        if (res.ok) {
          const payload = (await res.json()) as ItunesSearchResponse;
          const rows = Array.isArray(payload.results) ? payload.results : [];
          songTracks = rows
            .filter((row) => row.wrapperType === 'track')
            .map((row) => mapItunesSong(row))
            .filter((t): t is ShowcaseTrack => t !== null);
        }
      } catch {
        songTracks = [];
      }
    }
  }

  const albums: AlbumItem[] = albumEntries
    .filter((entry) => Boolean(entry.id && entry.name && entry.artistName))
    .map((entry) => {
      const cid = String(entry.id);
      const parsedYear = entry.releaseDate
        ? new Date(entry.releaseDate).getFullYear()
        : undefined;
      return {
        id: `itunes-album-${cid}`,
        collectionId: cid,
        title: entry.name!.trim(),
        artist: entry.artistName!.trim(),
        year: parsedYear && Number.isFinite(parsedYear) ? parsedYear : undefined,
        releaseDate: entry.releaseDate,
        genre: entry.genres?.[0]?.name || 'Top Chart',
        artwork: pickGradientArtwork(cid + entry.name!),
        coverUrl: upgradeItunesArtwork(entry.artworkUrl100),
        description: `${entry.artistName!.trim()} · ${entry.name!.trim()}`,
        trackIds: [],
      };
    });

  return { songTracks, albums };
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

  // Helper to verify LRCLIB track/artist/duration genuinely belongs to requested track
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

  // Strategy 1: Exact /api/get verified strictly by artist + title + duration
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

  // Strategy 2: LRCLIB /api/search scored by artist similarity, title similarity & duration ±6s
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
 * Unified parallel search putting YouTube search results FIRST across Songs, Artists,
 * and Albums (merged seamlessly with iTunes + Deezer portraits with zero YouTube branding).
 */
export async function searchAllMusic(query: string): Promise<SearchAllResults> {
  const cleaned = normalizeSearchTypos(query);
  if (!cleaned) {
    return { tracks: [], songs: [], artists: [], albums: [] };
  }

  const searchNormalized = cleaned.replace(/\s+[-–—]\s+/g, ' ');

  const [ytResultsRes, songsRes, artistsRes, albumsRes, ytAlbumsRes] =
    await Promise.allSettled([
      searchYouTubeResults(cleaned, 16),
      searchRealSongs(searchNormalized, 30),
      searchRealArtists(searchNormalized, 10),
      searchRealAlbums(searchNormalized, 18),
      searchYouTubeAlbums(cleaned, 8),
    ]);

  const ytItems = ytResultsRes.status === 'fulfilled' ? ytResultsRes.value : [];
  const ytTracks = ytItems.map((r) => r.track);
  const itunesTracks = songsRes.status === 'fulfilled' ? songsRes.value : [];
  const rawArtists = artistsRes.status === 'fulfilled' ? artistsRes.value : [];
  const rawItunesAlbums = albumsRes.status === 'fulfilled' ? albumsRes.value : [];
  const rawYtAlbums = ytAlbumsRes.status === 'fulfilled' ? ytAlbumsRes.value : [];

  const itunesByNormKey = new Map<string, ShowcaseTrack>();
  for (const it of itunesTracks) {
    const key = `${normalizeMusicText(it.artist)}::${normalizeMusicText(it.title)}`;
    if (!itunesByNormKey.has(key)) itunesByNormKey.set(key, it);
  }

  const ytByNormKey = new Map<string, ShowcaseTrack>();
  for (const yt of ytTracks) {
    const key = `${normalizeMusicText(yt.artist)}::${normalizeMusicText(yt.title)}`;
    if (!ytByNormKey.has(key)) ytByNormKey.set(key, yt);
  }

  const mergedTracks: ShowcaseTrack[] = [];
  const seenKeys = new Set<string>();

  // 1. Always place YouTube search results FIRST, enriched with clean album/artwork metadata if matched
  for (const yt of ytTracks) {
    const key = `${normalizeMusicText(yt.artist)}::${normalizeMusicText(yt.title)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const matchingItunes =
      itunesByNormKey.get(key) ??
      itunesTracks.find(
        (it) =>
          tokenSimilarity(it.title, yt.title) >= 0.75 &&
          doesArtistNameMatch(it.artist, yt.artist)
      );

    if (matchingItunes) {
      mergedTracks.push({
        ...yt,
        album: matchingItunes.album || yt.album,
        collectionId: matchingItunes.collectionId,
        coverUrl: matchingItunes.coverUrl || yt.coverUrl,
        previewUrl: matchingItunes.previewUrl,
        releaseDate: matchingItunes.releaseDate,
        genre: matchingItunes.genre || yt.genre,
        explicit: matchingItunes.explicit,
      });
    } else {
      mergedTracks.push(yt);
    }
  }

  // 2. Append remaining non-duplicate catalog songs (pre-attaching matching YouTube IDs if any)
  for (const track of itunesTracks) {
    const key = `${normalizeMusicText(track.artist)}::${normalizeMusicText(track.title)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const matchingYt = ytByNormKey.get(key);
    if (matchingYt?.youtubeVideoId) {
      mergedTracks.push({
        ...track,
        youtubeVideoId: matchingYt.youtubeVideoId,
        youtubeCandidates: [matchingYt.youtubeVideoId],
        streamStatus: 'full',
      });
    } else {
      mergedTracks.push(track);
    }
  }

  // 3. Merge Artists: derive leading artists from YouTube results + iTunes artist search + Deezer portraits
  const dedupedArtistNames = new Map<
    string,
    { artistId: string; name: string; genre?: string; ytRankBoost: number }
  >();

  ytItems.slice(0, 8).forEach((item, idx) => {
    const candidates = [
      item.artist.split(/,|feat\.|ft\.|&/i)[0]?.trim(),
      cleanYouTubeChannelName(item.channel),
    ].filter((n): n is string => Boolean(n && isValidArtistName(n)));

    for (const primary of candidates) {
      const k = primary.toLowerCase();
      if (!dedupedArtistNames.has(k)) {
        dedupedArtistNames.set(k, {
          artistId: `artist-${k.replace(/[^a-z0-9]+/g, '-')}`,
          name: primary,
          genre: 'Artist',
          ytRankBoost: Math.max(0, 10 - idx),
        });
      }
    }
  });

  for (const a of rawArtists) {
    if (!isValidArtistName(a.name)) continue;
    const k = a.name.trim().toLowerCase();
    const existing = dedupedArtistNames.get(k);
    if (!existing) {
      dedupedArtistNames.set(k, { ...a, ytRankBoost: 0 });
    } else if (a.genre && existing.genre === 'Artist') {
      existing.genre = a.genre;
    }
  }

  for (const t of itunesTracks.slice(0, 3)) {
    const primary = t.artist.split(/,|feat\.|ft\.|&/i)[0]?.trim();
    if (primary && isValidArtistName(primary) && !dedupedArtistNames.has(primary.toLowerCase())) {
      dedupedArtistNames.set(primary.toLowerCase(), {
        artistId: `derived-${primary.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: primary,
        genre: t.genre,
        ytRankBoost: 0,
      });
    }
  }

  const qNorm = normalizeMusicText(searchNormalized);
  const sortedArtistCandidates = Array.from(dedupedArtistNames.values())
    .sort((a, b) => {
      const aExact = normalizeMusicText(a.name) === qNorm ? 1 : 0;
      const bExact = normalizeMusicText(b.name) === qNorm ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.ytRankBoost - a.ytRankBoost;
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
    const fallbackCover = mergedTracks.find(
      (t) => doesArtistNameMatch(t.artist, a.name) && Boolean(t.coverUrl)
    )?.coverUrl;
    return {
      id: a.artistId,
      name: a.name,
      genre: a.genre,
      photoUrl: deezer?.photoUrl || itunesMatchCover || fallbackCover,
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

  // 4. Merge Albums: prioritize discovered albums enriched with real iTunes / Deezer square covers
  const mergedAlbums: AlbumItem[] = [];
  const seenAlbums = new Set<string>();
  const itunesAlbumsByKey = new Map<string, AlbumItem>();
  for (const alb of rawItunesAlbums) {
    const key = `${normalizeMusicText(alb.artist)}::${normalizeMusicText(alb.title)}`;
    if (!itunesAlbumsByKey.has(key)) itunesAlbumsByKey.set(key, alb);
  }

  for (const ytAlb of rawYtAlbums) {
    const key = `${normalizeMusicText(ytAlb.artist)}::${normalizeMusicText(ytAlb.title)}`;
    if (seenAlbums.has(key)) continue;
    seenAlbums.add(key);
    const matchingItunes =
      itunesAlbumsByKey.get(key) ??
      rawItunesAlbums.find(
        (cand) =>
          tokenSimilarity(cand.title, ytAlb.title) >= 0.72 &&
          doesArtistNameMatch(cand.artist, ytAlb.artist)
      );
    mergedAlbums.push(matchingItunes ?? ytAlb);
  }

  for (const alb of rawItunesAlbums) {
    const key = `${normalizeMusicText(alb.artist)}::${normalizeMusicText(alb.title)}`;
    if (seenAlbums.has(key)) continue;
    seenAlbums.add(key);
    mergedAlbums.push(alb);
  }

  const enrichedAlbums = await enrichAlbumsWithRealArtwork(mergedAlbums);

  return {
    tracks: mergedTracks,
    songs: mergedTracks,
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
      computeMatchScore(query, leadSong.title, leadSong.artist) +
      (leadSong.youtubeVideoId ? 18 : 0);
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

/**
 * Fetches Songs (YouTube-first), Artists, and Albums with memory caching.
 */
export async function getTopSearchResults(
  query: string
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

  const bundle = await searchAllMusic(q);
  const ranked = computeRankedResponseFromBundle(q, bundle);
  if (ranked.songs.length > 0 || ranked.artists.length > 0 || ranked.albums.length > 0) {
    rankedSearchMemoryCache.set(cacheKey, { ts: Date.now(), data: ranked });
  }
  return ranked;
}

/**
 * Progressive instant Search: emits cached or fast iTunes Songs/Artists/Albums immediately
 * (~150-300ms) while upgrading cleanly in-place with YouTube-resolved tracks & Deezer portraits.
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

  const searchNormalized = cleaned.replace(/\s+[-–—]\s+/g, ' ');
  const ytPromise = searchYouTubeResults(cleaned, 16).catch(() => []);
  const ytAlbumsPromise = searchYouTubeAlbums(cleaned, 8).catch(() => []);

  // Fast tier: iTunes songs/artists/albums with AbortSignal
  try {
    const [fastSongsRes, fastArtistsRes, fastAlbumsRes] = await Promise.allSettled([
      searchRealSongs(searchNormalized, 24, undefined, signal),
      searchRealArtists(searchNormalized, 8),
      searchRealAlbums(searchNormalized, 14),
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

    if (fastSongs.length > 0 || fastArtists.length > 0 || fastAlbums.length > 0) {
      const partial = computeRankedResponseFromBundle(q, {
        tracks: fastSongs,
        songs: fastSongs,
        artists: fastArtists,
        albums: fastAlbums,
      });
      onUpdate(partial, { isFinal: false });
    }
  } catch {
    if (signal?.aborted) {
      return {
        topResult: null,
        tracks: [],
        songs: [],
        artists: [],
        albums: [],
      };
    }
  }

  // Full tier: await YouTube + Deezer portrait enrichment and upgrade cleanly
  const [ytItems, _ytAlbums, fullBundle] = await Promise.all([
    ytPromise,
    ytAlbumsPromise,
    searchAllMusic(q),
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

  void ytItems;
  const finalResult = computeRankedResponseFromBundle(q, fullBundle);
  if (
    finalResult.songs.length > 0 ||
    finalResult.artists.length > 0 ||
    finalResult.albums.length > 0
  ) {
    rankedSearchMemoryCache.set(cacheKey, { ts: Date.now(), data: finalResult });
  }
  onUpdate(finalResult, { isFinal: true });
  return finalResult;
}

/**
 * Fetches fresh randomized 30s iTunes preview tracks tailored to the user's listening profile,
 * prioritizing unseen songs so Reels never get stuck playing the same rotation.
 */
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

  // Pick 4 randomized seeds on every call for variety
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
        .map((row) => mapItunesSong(row))
        .filter((t): t is ShowcaseTrack => Boolean(t && t.previewUrl && isOfficialArtistTrack(t)));
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

/**
 * Fetches live representative cover artwork for Mood & Genre discovery tiles.
 */
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
 * Queries followed/top artists' recent albums & songs from iTunes Lookup,
 * US + KE Apple RSS charts, and dynamic current month/year YouTube drops.
 * Cached by YYYY-MM-DD with 30-minute TTL.
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
  const { currentYear, currentMonthName, currentDateKey, nowMs } =
    getDynamicDateContext();

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
          genre: row.primaryGenreName?.trim() || 'New Release',
          artwork: pickGradientArtwork(cid + row.collectionName),
          coverUrl: upgradeItunesArtwork(row.artworkUrl100),
          description: `${row.artistName?.trim() || artistName} · ${row.collectionName.trim()}`,
          trackIds: [],
        });
      }

      const tracks: ShowcaseTrack[] = rawSongs
        .filter((r) => r.wrapperType === 'track')
        .map((r) => mapItunesSong(r))
        .filter((t): t is ShowcaseTrack => {
          if (!t) return false;
          const relMs = t.releaseDate ? Date.parse(t.releaseDate) : 0;
          return relMs === 0 || relMs >= cutoffMs;
        });

      return { tracks, albums };
    })
  );

  const [usChartsRes, keChartsRes, ytNewRes, artistDropsRes] = await Promise.allSettled([
    fetchAppleTrendingCharts('us', 50, 25),
    fetchAppleTrendingCharts('ke', 25, 15),
    searchFreeYouTubeSongs(
      `new music ${currentMonthName} ${currentYear} official audio`,
      {
        maxResults: 15,
        releaseDate: new Date(nowMs).toISOString(),
        genreLabel: 'New Release',
      }
    ),
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
  const keSongs = keChartsRes.status === 'fulfilled' ? keChartsRes.value.songTracks : [];
  const keAlbums = keChartsRes.status === 'fulfilled' ? keChartsRes.value.albums : [];
  const ytDrops = ytNewRes.status === 'fulfilled' ? ytNewRes.value : [];

  const mergedTracksRaw = dedupeTracksByKey([
    ...artistTracks,
    ...ytDrops,
    ...keSongs,
    ...usSongs,
  ]).filter((t) => isOfficialArtistTrack(t));

  // Sort strictly by newest releaseDate first, and limit to 1 track per artist
  mergedTracksRaw.sort((a, b) => {
    const aMs = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const bMs = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    return bMs - aMs;
  });
  const mergedTracks = capTracksPerArtist(mergedTracksRaw, 1);

  const mergedAlbums = dedupeAlbums([
    ...artistAlbums,
    ...usAlbums,
    ...keAlbums,
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

export interface YouTubeMusicHomeShelves {
  forYouQuickPicks: ShowcaseTrack[];
  albumsForYou: AlbumItem[];
  trendingTracks: ShowcaseTrack[];
  newReleaseTracks: ShowcaseTrack[];
  newReleaseAlbums: AlbumItem[];
  topArtists: FeaturedArtistItem[];
  fetchedAt: number;
  dateKey: string;
}

const HOME_SESSION_CACHE_KEY = 'ather_home_shelves_session_v1';

/**
 * Fetches dynamic YouTube Music-style Browse shelves across Apple RSS, iTunes,
 * Deezer JSONP (borderless circular artist portraits), and free YouTube search.
 * Cached in memory + sessionStorage + localStorage so navigating or reopening never flickers.
 */
export async function fetchYouTubeMusicHomeShelves(options: {
  followedArtists?: string[];
  topArtists?: string[];
  topGenres?: string[];
  forceRefresh?: boolean;
} = {}): Promise<YouTubeMusicHomeShelves> {
  const { currentYear, currentDateKey, nowMs } = getDynamicDateContext();

  const userGenres = Array.from(
    new Set([...(options.topGenres ?? []), 'Hip Hop', 'R&B', 'Pop', 'Afrobeats'])
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
          data: YouTubeMusicHomeShelves;
        };
        if (
          parsedSession?.dateKey === currentDateKey &&
          parsedSession?.signature === tasteSignature &&
          nowMs - parsedSession.ts < LIVE_FEED_TTL_MS &&
          parsedSession.data?.trendingTracks?.length > 0
        ) {
          homeShelvesMemoryCache = parsedSession;
          return parsedSession.data;
        }
      }
    } catch {
      // ignore sessionStorage read issues
    }

    const stored = readLocalCache<{
      ts: number;
      signature?: string;
      data: YouTubeMusicHomeShelves;
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
      return entry.data;
    }
  }

  const artistSeedQueries =
    userArtists.length > 0
      ? userArtists.slice(0, 6)
      : [userGenres[0] ?? 'top hits'];

  const [
    newReleasesRes,
    ytTrendingRes,
    personalizedTracksRes,
    forYouYtRes,
    genreAlbumsRes,
    genreTracksRes,
  ] = await Promise.allSettled([
    getLiveNewReleases({
      followedArtists: userArtists,
      topGenres: userGenres,
      forceRefresh: options.forceRefresh,
    }),
    searchFreeYouTubeSongs(
      `top trending songs official audio ${currentYear}`,
      { maxResults: 18, genreLabel: 'Trending' }
    ),
    Promise.allSettled(
      artistSeedQueries.map((artistName) => searchRealSongs(artistName, 12))
    ),
    Promise.allSettled(
      artistSeedQueries.slice(0, 4).map((artistName) =>
        searchFreeYouTubeSongs(`${artistName} official audio`, {
          maxResults: 8,
          expectedArtist: userArtists.length > 0 ? artistName : undefined,
        })
      )
    ),
    Promise.allSettled([
      ...artistSeedQueries.slice(0, 4).map((artist) => searchRealAlbums(artist, 6)),
      ...userGenres.slice(0, 3).map((genre) => searchRealAlbums(genre, 8)),
    ]),
    Promise.allSettled(
      userGenres.slice(0, 3).map((genre) => searchRealSongs(genre, 10))
    ),
  ]);

  const newReleases =
    newReleasesRes.status === 'fulfilled'
      ? newReleasesRes.value
      : { tracks: [], albums: [], fetchedAt: nowMs, dateKey: currentDateKey };

  const ytTrending = ytTrendingRes.status === 'fulfilled' ? ytTrendingRes.value : [];

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

  const forYouYt: ShowcaseTrack[] = [];
  if (forYouYtRes.status === 'fulfilled') {
    for (const r of forYouYtRes.value) {
      if (r.status === 'fulfilled') forYouYt.push(...r.value);
    }
  }

  // Strictly prioritize tracks matching the user's chosen artists/genres first
  const matchesChosenArtist = (artistStr: string) =>
    userArtists.some((ua) => doesArtistNameMatch(artistStr, ua));

  const chosenArtistTracks = dedupeTracksByKey([
    ...forYouYt,
    ...artistItunesTracks,
  ]).filter((t) => isOfficialArtistTrack(t) && matchesChosenArtist(t.artist));

  const trendingTracks = capTracksPerArtist(
    dedupeTracksByKey([
      ...chosenArtistTracks.slice(0, 10),
      ...newReleases.tracks.slice(0, 14),
      ...ytTrending,
    ]).filter((t) => isOfficialArtistTrack(t)),
    1
  );

  const forYouQuickPicks = capTracksPerArtist(
    dedupeTracksByKey([
      ...chosenArtistTracks,
      ...forYouYt,
      ...artistItunesTracks,
      ...genreItunesTracks,
      ...trendingTracks.slice(0, 12),
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
    ...newReleases.albums.filter((alb) => isValidArtistName(alb.artist)),
  ]);

  // Prioritize ALL chosen user artists first, then enrich with real Deezer / iTunes portraits
  const artistSeedMap = new Map<string, FeaturedArtistItem>();
  for (const preferred of userArtists) {
    if (!isValidArtistName(preferred)) continue;
    const matchCover = artistItunesTracks.find(
      (t) => doesArtistNameMatch(t.artist, preferred) && Boolean(t.coverUrl)
    )?.coverUrl;
    if (!artistSeedMap.has(preferred.toLowerCase())) {
      artistSeedMap.set(preferred.toLowerCase(), {
        artist: preferred,
        subtitle: 'Your Top Artist',
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
        subtitle: t.genre || t.category,
        artwork: pickGradientArtwork(primary),
        coverUrl: t.coverUrl,
      });
    }
  }

  const baseArtists = Array.from(artistSeedMap.values());
  const deezerPhotos = await Promise.allSettled(
    baseArtists.map((a) => fetchDeezerArtistPhoto(a.artist))
  );
  const topArtists: FeaturedArtistItem[] = baseArtists.map((item, idx) => {
    const res = deezerPhotos[idx];
    const deezer = res && res.status === 'fulfilled' ? res.value : null;
    return {
      ...item,
      coverUrl: deezer?.photoUrl || item.coverUrl,
    };
  });

  const result: YouTubeMusicHomeShelves = {
    forYouQuickPicks,
    albumsForYou,
    trendingTracks,
    newReleaseTracks: newReleases.tracks,
    newReleaseAlbums: newReleases.albums,
    topArtists,
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

export async function searchAudioMetaMetadata(
  query: string
): Promise<unknown[]> {
  if (!query.trim() || isNativeCapacitorRuntime()) return [];
  const data = await fetchJsonWithTimeout<{ items?: unknown[]; data?: unknown[] } | unknown[]>(
    `/api/audiometa/search?q=${encodeURIComponent(query.trim())}`,
    2600
  );
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}



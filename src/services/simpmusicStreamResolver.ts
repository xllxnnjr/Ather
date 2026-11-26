import { ShowcaseTrack } from '../types/music';
import { getAudiusStreamUrl, resolveFullAudiusTrack } from './audiusApi';

export type AudioQualityTier = 'Low' | 'Normal' | 'High';

export interface ResolvedAudioStream {
  streamUrl: string;
  source: 'innertube' | 'piped' | 'audius' | 'itunes-preview';
  durationSec: number;
  bitrate?: number;
  mimeType?: string;
}

interface StreamCacheEntry {
  streamUrl: string;
  source: ResolvedAudioStream['source'];
  durationSec: number;
  bitrate?: number;
  mimeType?: string;
  expiresAt: number;
}

const STREAM_CACHE_KEY = 'ather_stream_cache_v1';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (before signed CDN URLs expire)

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.smnz.de',
];

const BLOCKED_TITLE_OR_ARTIST_REGEX =
  /\b(dj\s*(mix|set|remix)?|mixtape|megamix|continuous\s*mix|nonstop|podcast|episode|radio\s*(show|mix)?|various\s*artists|karaoke|tribute|slowed|reverb|sped\s*up|nightcore|8d\s*audio|full\s*album|hour\s*mix|mashup|live\s*set|club\s*mix|bootleg)\b/i;

const memoryStreamCache = new Map<string, StreamCacheEntry>();
const inflightResolutions = new Map<string, Promise<ResolvedAudioStream | null>>();

function normalizeLookupText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\((feat\.|ft\.|featuring)[^)]*\)/gi, ' ')
    .replace(/\[(official[^[\]]*|lyrics?|audio|hd|4k|explicit|clean|remaster[^[\]]*)\]/gi, ' ')
    .replace(/\((official[^)]*|lyrics?|audio|deluxe[^)]*|expanded[^)]*|remaster[^)]*|explicit)\)/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCacheKey(
  track: Pick<ShowcaseTrack, 'id' | 'title' | 'artist'>,
  quality: AudioQualityTier = 'High'
): string {
  return `${track.id}::${normalizeLookupText(track.artist)}::${normalizeLookupText(track.title)}::${quality}`;
}

function readLocalStreamCache(): Record<string, StreamCacheEntry> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STREAM_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StreamCacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalStreamCache(nextMap: Record<string, StreamCacheEntry>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const now = Date.now();
    const freshEntries = Object.entries(nextMap)
      .filter(([, entry]) => entry && entry.streamUrl && entry.expiresAt > now)
      .slice(-140);
    window.localStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(Object.fromEntries(freshEntries)));
  } catch {
    // ignore storage quota errors
  }
}

function getCachedStream(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): ResolvedAudioStream | null {
  const key = buildCacheKey(track, quality);
  const now = Date.now();

  const mem = memoryStreamCache.get(key);
  if (mem && mem.expiresAt > now && mem.streamUrl) {
    return {
      streamUrl: mem.streamUrl,
      source: mem.source,
      durationSec: mem.durationSec,
      bitrate: mem.bitrate,
      mimeType: mem.mimeType,
    };
  }

  const stored = readLocalStreamCache();
  const entry = stored[key];
  if (entry && entry.expiresAt > now && entry.streamUrl) {
    memoryStreamCache.set(key, entry);
    return {
      streamUrl: entry.streamUrl,
      source: entry.source,
      durationSec: entry.durationSec,
      bitrate: entry.bitrate,
      mimeType: entry.mimeType,
    };
  }

  return null;
}

function saveCachedStream(
  track: ShowcaseTrack,
  resolved: ResolvedAudioStream,
  quality: AudioQualityTier = 'High'
): void {
  if (resolved.source === 'itunes-preview') return;
  const key = buildCacheKey(track, quality);
  const entry: StreamCacheEntry = {
    streamUrl: resolved.streamUrl,
    source: resolved.source,
    durationSec: resolved.durationSec,
    bitrate: resolved.bitrate,
    mimeType: resolved.mimeType,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  memoryStreamCache.set(key, entry);

  const stored = readLocalStreamCache();
  stored[key] = entry;
  writeLocalStreamCache(stored);
}

export function clearStreamResolverCache(): void {
  memoryStreamCache.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STREAM_CACHE_KEY);
    } catch {
      // ignore
    }
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 7000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function isStrictOfficialCandidate(
  candidateTitle: string,
  candidateAuthor: string,
  durationSec: number,
  requestedTitle: string
): boolean {
  if (!candidateTitle.trim() || !candidateAuthor.trim()) return false;
  if (durationSec > 480 || (durationSec > 0 && durationSec < 45)) return false;

  const userAskedForAlt = BLOCKED_TITLE_OR_ARTIST_REGEX.test(requestedTitle);
  if (!userAskedForAlt) {
    if (BLOCKED_TITLE_OR_ARTIST_REGEX.test(`${candidateTitle} ${candidateAuthor}`)) {
      return false;
    }
  }
  return true;
}

function tokenMatchScore(a: string, b: string): number {
  const normA = normalizeLookupText(a);
  const normB = normalizeLookupText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;
  const setA = new Set(normA.split(' ').filter((t) => t.length > 1));
  const setB = new Set(normB.split(' ').filter((t) => t.length > 1));
  if (setA.size === 0 || setB.size === 0) return 0;
  let hits = 0;
  setA.forEach((tok) => {
    if (setB.has(tok)) hits += 1;
  });
  return hits / Math.max(setA.size, setB.size);
}

interface InnerTubeVideoCandidate {
  videoId: string;
  title: string;
  author: string;
  durationSec: number;
  score: number;
}

function parseDurationTextToSec(raw?: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const parts = raw
    .trim()
    .split(':')
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function extractInnerTubeSearchCandidates(
  payload: unknown,
  track: ShowcaseTrack
): InnerTubeVideoCandidate[] {
  const candidates: InnerTubeVideoCandidate[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 14) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const obj = node as Record<string, unknown>;

    // WEB_REMIX musicResponsiveListItemRenderer
    const mrlir = obj.musicResponsiveListItemRenderer as Record<string, any> | undefined;
    if (mrlir) {
      const videoId =
        mrlir?.playlistItemData?.videoId ||
        mrlir?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
          ?.playNavigationEndpoint?.watchEndpoint?.videoId;
      if (typeof videoId === 'string' && videoId.length >= 8 && !seen.has(videoId)) {
        const flexCols = Array.isArray(mrlir.flexColumns) ? mrlir.flexColumns : [];
        const title =
          flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
        const subRuns: any[] =
          flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const author = subRuns.map((r) => r?.text || '').join('').split('•')[0]?.trim() || '';
        const lastRun = subRuns[subRuns.length - 1]?.text || '';
        const durationSec = parseDurationTextToSec(lastRun);

        if (isStrictOfficialCandidate(title, author, durationSec, track.title)) {
          const titleSim = tokenMatchScore(track.title, title);
          const artistSim = tokenMatchScore(track.artist, author);
          if (titleSim >= 0.45 && (artistSim >= 0.35 || titleSim >= 0.85)) {
            seen.add(videoId);
            candidates.push({
              videoId,
              title,
              author,
              durationSec,
              score: titleSim * 0.6 + artistSim * 0.4,
            });
          }
        }
      }
    }

    // ANDROID / WEB videoRenderer or compactVideoRenderer
    const vr = (obj.videoRenderer || obj.compactVideoRenderer) as Record<string, any> | undefined;
    if (vr && typeof vr.videoId === 'string' && !seen.has(vr.videoId)) {
      const title =
        vr.title?.runs?.[0]?.text || vr.title?.simpleText || '';
      const author =
        vr.ownerText?.runs?.[0]?.text ||
        vr.longBylineText?.runs?.[0]?.text ||
        vr.shortBylineText?.runs?.[0]?.text ||
        '';
      const durationSec = parseDurationTextToSec(vr.lengthText?.simpleText);
      if (isStrictOfficialCandidate(title, author, durationSec, track.title)) {
        const titleSim = tokenMatchScore(track.title, title);
        const artistSim = tokenMatchScore(track.artist, `${author} ${title}`);
        if (titleSim >= 0.45 && (artistSim >= 0.35 || titleSim >= 0.85)) {
          seen.add(vr.videoId);
          candidates.push({
            videoId: vr.videoId,
            title,
            author,
            durationSec,
            score: titleSim * 0.6 + artistSim * 0.4,
          });
        }
      }
    }

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
        walk(val, depth + 1);
      }
    }
  };

  walk(payload, 0);
  return candidates.sort((a, b) => b.score - a.score);
}

async function searchInnerTubeMusic(track: ShowcaseTrack): Promise<InnerTubeVideoCandidate[]> {
  const cleanTitle = track.title.replace(/\s*[\[(][^)\]]*[\])]\s*/g, ' ').trim() || track.title;
  const query = `${cleanTitle} ${track.artist}`.trim();

  const webRemixPayload = await fetchJsonWithTimeout<unknown>(
    'https://music.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Format-Version': '2',
      },
      body: JSON.stringify({
        query,
        params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D',
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20241118.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    },
    6500
  );

  const ytMusicResults = webRemixPayload
    ? extractInnerTubeSearchCandidates(webRemixPayload, track)
    : [];
  if (ytMusicResults.length > 0) return ytMusicResults;

  const androidSearchPayload = await fetchJsonWithTimeout<unknown>(
    'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${query} official audio`,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.44.38',
            androidSdkVersion: 34,
            hl: 'en',
            gl: 'US',
          },
        },
      }),
    },
    6500
  );

  return androidSearchPayload
    ? extractInnerTubeSearchCandidates(androidSearchPayload, track)
    : [];
}

function pickBestAudioFormat<T extends { url?: string; mimeType?: string; bitrate?: number }>(
  formats: T[],
  quality: AudioQualityTier = 'High'
): T | undefined {
  if (formats.length === 0) return undefined;
  const sorted = [...formats].sort((a, b) => {
    const aMp4 = String(a.mimeType || '').includes('mp4') ? 40_000 : 0;
    const bMp4 = String(b.mimeType || '').includes('mp4') ? 40_000 : 0;
    return Number(b.bitrate || 0) + bMp4 - (Number(a.bitrate || 0) + aMp4);
  });
  if (quality === 'Low') {
    const lowCandidates = [...formats].sort(
      (a, b) => Number(a.bitrate || 0) - Number(b.bitrate || 0)
    );
    return (
      lowCandidates.find((f) => Number(f.bitrate || 0) >= 32_000 && Number(f.bitrate || 0) <= 80_000) ||
      lowCandidates[0]
    );
  }
  if (quality === 'Normal') {
    const normalCandidates = formats.filter(
      (f) => Number(f.bitrate || 0) >= 80_000 && Number(f.bitrate || 0) <= 170_000
    );
    if (normalCandidates.length > 0) {
      return normalCandidates.sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
    }
    return sorted[Math.floor(sorted.length / 2)] || sorted[0];
  }
  return sorted[0];
}

async function extractInnerTubePlayerStream(
  videoId: string,
  fallbackDurationSec: number,
  quality: AudioQualityTier = 'High'
): Promise<ResolvedAudioStream | null> {
  const clients = [
    {
      clientName: 'ANDROID_VR',
      clientVersion: '1.56.21',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12L',
      androidSdkVersion: 32,
      hl: 'en',
      gl: 'US',
    },
    {
      clientName: 'IOS',
      clientVersion: '19.45.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.1.0.22B83',
      hl: 'en',
      gl: 'US',
    },
  ];

  for (const client of clients) {
    const data = await fetchJsonWithTimeout<Record<string, any>>(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client },
        }),
      },
      6500
    );

    const adaptiveFormats: any[] = data?.streamingData?.adaptiveFormats || [];
    const formats: any[] = data?.streamingData?.formats || [];
    const audioFormats = [...adaptiveFormats, ...formats].filter(
      (f) =>
        typeof f?.url === 'string' &&
        f.url.startsWith('https://') &&
        typeof f?.mimeType === 'string' &&
        (f.mimeType.startsWith('audio/mp4') || f.mimeType.startsWith('audio/webm'))
    );

    if (audioFormats.length > 0) {
      const best = pickBestAudioFormat(audioFormats, quality) || audioFormats[0];
      const parsedDur = Number(data?.videoDetails?.lengthSeconds || fallbackDurationSec || 0);
      return {
        streamUrl: best.url,
        source: 'innertube',
        durationSec: Number.isFinite(parsedDur) && parsedDur > 0 ? parsedDur : fallbackDurationSec,
        bitrate: Number(best.bitrate || 0) || undefined,
        mimeType: best.mimeType,
      };
    }
  }

  return null;
}

async function resolveViaPiped(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): Promise<ResolvedAudioStream | null> {
  const cleanTitle = track.title.replace(/\s*[\[(][^)\]]*[\])]\s*/g, ' ').trim() || track.title;
  const query = `${cleanTitle} ${track.artist}`.trim();

  for (const base of PIPED_INSTANCES) {
    const searchData = await fetchJsonWithTimeout<{ items?: any[] }>(
      `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      {},
      5500
    );
    const items = Array.isArray(searchData?.items) ? searchData.items : [];
    const valid = items.filter((item) => {
      const url = typeof item?.url === 'string' ? item.url : '';
      const dur = Number(item?.duration || 0);
      const title = String(item?.title || '');
      const uploader = String(item?.uploaderName || '');
      return (
        url.includes('v=') &&
        isStrictOfficialCandidate(title, uploader, dur, track.title) &&
        tokenMatchScore(track.title, title) >= 0.45
      );
    });

    const top = valid[0];
    if (!top?.url) continue;

    const match = String(top.url).match(/v=([a-zA-Z0-9_-]{8,15})/);
    const videoId = match?.[1];
    if (!videoId) continue;

    const streamData = await fetchJsonWithTimeout<{
      duration?: number;
      audioStreams?: { url?: string; mimeType?: string; bitrate?: number }[];
    }>(`${base}/streams/${encodeURIComponent(videoId)}`, {}, 5500);

    const audioStreams = (streamData?.audioStreams || []).filter(
      (s) => typeof s?.url === 'string' && s.url.startsWith('https://')
    );
    if (audioStreams.length === 0) continue;

    const best = pickBestAudioFormat(audioStreams, quality) || audioStreams[0];
    if (!best?.url) continue;

    const dur = Number(streamData?.duration || top.duration || track.duration || 0);
    return {
      streamUrl: best.url,
      source: 'piped',
      durationSec: dur > 0 ? dur : track.duration || 180,
      bitrate: best.bitrate,
      mimeType: best.mimeType,
    };
  }

  return null;
}

async function resolveViaAudius(track: ShowcaseTrack): Promise<ResolvedAudioStream | null> {
  if (track.audiusId && track.streamUrl) {
    return {
      streamUrl: track.streamUrl,
      source: 'audius',
      durationSec: track.fullDuration || track.duration || 180,
    };
  }
  if (track.audiusId) {
    return {
      streamUrl: getAudiusStreamUrl(track.audiusId),
      source: 'audius',
      durationSec: track.fullDuration || track.duration || 180,
    };
  }
  const audiusTrack = await resolveFullAudiusTrack(track);
  if (audiusTrack.streamStatus === 'full' && audiusTrack.streamUrl) {
    return {
      streamUrl: audiusTrack.streamUrl,
      source: 'audius',
      durationSec: audiusTrack.fullDuration || audiusTrack.duration || track.duration || 180,
    };
  }
  return null;
}

async function performFullResolution(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): Promise<ResolvedAudioStream | null> {
  // 0. If track is already natively Audius full stream
  if (track.source === 'audius' && track.streamUrl && track.streamStatus === 'full') {
    return {
      streamUrl: track.streamUrl,
      source: 'audius',
      durationSec: track.fullDuration || track.duration || 180,
    };
  }

  // 1. Check 4-hour local/memory cache
  const cached = getCachedStream(track, quality);
  if (cached) return cached;

  // 2. SimpMusic-style on-device InnerTube search + player stream extraction
  try {
    const candidates = await searchInnerTubeMusic(track);
    for (const candidate of candidates.slice(0, 3)) {
      const playerStream = await extractInnerTubePlayerStream(
        candidate.videoId,
        candidate.durationSec || track.duration || 180,
        quality
      );
      if (playerStream?.streamUrl) {
        saveCachedStream(track, playerStream, quality);
        return playerStream;
      }
    }
  } catch {
    // proceed to Piped fallback
  }

  // 3. Piped API instances fallback
  try {
    const pipedStream = await resolveViaPiped(track, quality);
    if (pipedStream?.streamUrl) {
      saveCachedStream(track, pipedStream, quality);
      return pipedStream;
    }
  } catch {
    // proceed to Audius fallback
  }

  // 4. Audius full-track stream fallback
  try {
    const audiusStream = await resolveViaAudius(track);
    if (audiusStream?.streamUrl) {
      saveCachedStream(track, audiusStream, quality);
      return audiusStream;
    }
  } catch {
    // proceed to iTunes preview fallback
  }

  // 5. Last resort: iTunes 30s previewUrl
  if (track.previewUrl) {
    return {
      streamUrl: track.previewUrl,
      source: 'itunes-preview',
      durationSec: 30,
    };
  }

  return null;
}

export async function resolveFullAudioStream(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): Promise<ResolvedAudioStream | null> {
  if (!track?.title) return null;

  const cached = getCachedStream(track, quality);
  if (cached) return cached;

  const key = buildCacheKey(track, quality);
  const existing = inflightResolutions.get(key);
  if (existing) return existing;

  const job = performFullResolution(track, quality).finally(() => {
    inflightResolutions.delete(key);
  });
  inflightResolutions.set(key, job);
  return job;
}

export function preloadFullAudioStream(
  track: ShowcaseTrack,
  quality: AudioQualityTier = 'High'
): void {
  if (!track?.id) return;
  if (getCachedStream(track, quality)) return;
  void resolveFullAudioStream(track, quality).catch(() => null);
}

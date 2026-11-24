import { pickGradientArtwork } from '../data/showcaseCatalog';
import { AlbumItem, CategoryPill, ShowcaseTrack } from '../types/music';

const ITUNES_API_BASE = 'https://itunes.apple.com';

export const RICH_CATALOG_ARTISTS = [
  'The Weeknd',
  'Eminem',
  'Kendrick Lamar',
  'Drake',
  'Billie Eilish',
  'SZA',
  'Daft Punk',
  'Frank Ocean',
  'Travis Scott',
  'Dua Lipa',
  'Post Malone',
] as const;

export const RICH_CATALOG_GENRES = [
  'hip hop',
  'electronic',
  'r&b',
  'pop',
  'blues',
  'party',
] as const;

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
    /\(clean(\s+version|\s+edit)?\)/i.test(title) ||
    /\[clean(\s+version|\s+edit)?\]/i.test(title)
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
  if (g.includes('acoustic') || g.includes('singer') || g.includes('alternative')) {
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
  const duration = durationMs ? Math.round(durationMs / 1000) : 30;
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

export async function searchItunesTracks(
  term: string,
  limit = 100,
  categoryOverride?: Exclude<CategoryPill, 'All'>
): Promise<ShowcaseTrack[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const url = `${ITUNES_API_BASE}/search?media=music&entity=song&limit=${limit}&explicit=Yes&term=${encodeURIComponent(
    trimmed
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes search failed (${response.status})`);
  }
  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const seen = new Set<string>();
  const tracks: ShowcaseTrack[] = [];

  for (const row of rows) {
    const mapped = mapItunesSong(row, categoryOverride);
    if (!mapped || !mapped.previewUrl) continue;
    if (seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    tracks.push(mapped);
  }
  return tracks;
}

export async function lookupItunesTracksByIds(
  ids: string[]
): Promise<ShowcaseTrack[]> {
  const cleanIds = ids
    .map((id) => id.replace(/^itunes-/, '').trim())
    .filter((id) => /^\d+$/.test(id));
  if (cleanIds.length === 0) return [];

  const url = `${ITUNES_API_BASE}/lookup?id=${cleanIds.join(',')}&entity=song`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes lookup failed (${response.status})`);
  }
  const payload = (await response.json()) as ItunesSearchResponse;
  const rows = Array.isArray(payload.results) ? payload.results : [];
  return rows
    .filter((row) => row.wrapperType === 'track')
    .map((row) => mapItunesSong(row))
    .filter((t): t is ShowcaseTrack => t !== null && Boolean(t.previewUrl));
}

export async function fetchRichItunesCatalog(): Promise<ShowcaseTrack[]> {
  const terms = [...RICH_CATALOG_ARTISTS, ...RICH_CATALOG_GENRES];
  const buckets: ShowcaseTrack[][] = [];
  const batchSize = 6;

  for (let i = 0; i < terms.length; i += batchSize) {
    const chunk = terms.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      chunk.map((term) => searchItunesTracks(term, 100))
    );
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value.length > 0) {
        buckets.push(res.value.slice(0, 12));
      }
    }
  }

  // Round-robin interleave across artist/genre buckets and deduplicate by track ID
  const seen = new Set<string>();
  const merged: ShowcaseTrack[] = [];
  const maxLen = buckets.reduce((max, b) => Math.max(max, b.length), 0);

  for (let idx = 0; idx < maxLen; idx++) {
    for (const bucket of buckets) {
      const track = bucket[idx];
      if (!track || seen.has(track.id)) continue;
      seen.add(track.id);
      merged.push(track);
    }
  }

  return merged;
}

export async function lookupItunesAlbum(
  collectionId: string
): Promise<{ album: AlbumItem | null; tracks: ShowcaseTrack[] }> {
  const numericId = collectionId.replace(/^itunes-album-/, '').trim();
  const url = `${ITUNES_API_BASE}/lookup?id=${encodeURIComponent(
    numericId
  )}&entity=song&limit=100`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes album lookup failed (${response.status})`);
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

  const album: AlbumItem = {
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
  };

  return { album, tracks };
}

export async function fetchItunesArtistDiscography(artistName: string): Promise<{
  tracks: ShowcaseTrack[];
  albums: AlbumItem[];
}> {
  const normalized = artistName.trim().toLowerCase();
  const [songsRes, albumsRes] = await Promise.allSettled([
    fetch(
      `${ITUNES_API_BASE}/search?media=music&entity=song&limit=50&explicit=Yes&term=${encodeURIComponent(
        artistName
      )}`
    ).then((r) => (r.ok ? (r.json() as Promise<ItunesSearchResponse>) : { results: [] })),
    fetch(
      `${ITUNES_API_BASE}/search?media=music&entity=album&limit=25&explicit=Yes&term=${encodeURIComponent(
        artistName
      )}`
    ).then((r) => (r.ok ? (r.json() as Promise<ItunesSearchResponse>) : { results: [] })),
  ]);

  const rawSongs =
    songsRes.status === 'fulfilled' && Array.isArray(songsRes.value.results)
      ? songsRes.value.results
      : [];
  const rawAlbums =
    albumsRes.status === 'fulfilled' && Array.isArray(albumsRes.value.results)
      ? albumsRes.value.results
      : [];

  const seenTracks = new Set<string>();
  const tracks: ShowcaseTrack[] = [];

  const isStrictArtistMatch = (candidateArtist: string): boolean => {
    const cleanTarget = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = candidateArtist
      .toLowerCase()
      .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\band\b|\bx\b/i)
      .map((p) => p.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const fullClean = candidateArtist.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return fullClean === cleanTarget || parts.includes(cleanTarget);
  };

  for (const row of rawSongs) {
    const mapped = mapItunesSong(row);
    if (!mapped) continue;
    if (!isStrictArtistMatch(mapped.artist)) {
      continue;
    }
    if (seenTracks.has(mapped.id)) continue;
    seenTracks.add(mapped.id);
    tracks.push(mapped);
  }

  const seenAlbums = new Set<string>();
  const albums: AlbumItem[] = [];

  for (const row of rawAlbums) {
    if (!row.collectionId || !row.collectionName || !row.artistName) continue;
    if (row.collectionExplicitness === 'cleaned') continue;
    if (!isStrictArtistMatch(row.artistName)) {
      continue;
    }
    const cid = String(row.collectionId);
    const key = row.collectionName.trim().toLowerCase();
    if (seenAlbums.has(key)) continue;
    seenAlbums.add(key);

    const parsedYear = row.releaseDate
      ? new Date(row.releaseDate).getFullYear()
      : undefined;
    const matchingTrackIds = tracks
      .filter((t) => t.collectionId === cid || t.album.toLowerCase() === key)
      .map((t) => t.id);

    albums.push({
      id: `itunes-album-${cid}`,
      collectionId: cid,
      title: row.collectionName.trim(),
      artist: row.artistName.trim(),
      year: parsedYear && Number.isFinite(parsedYear) ? parsedYear : undefined,
      releaseDate: row.releaseDate,
      genre: row.primaryGenreName?.trim() || 'Music',
      artwork: pickGradientArtwork(cid + row.collectionName),
      coverUrl: upgradeItunesArtwork(row.artworkUrl100),
      description: `${row.artistName.trim()} · ${row.collectionName.trim()}`,
      trackIds: matchingTrackIds,
    });
  }

  return { tracks, albums };
}

const GENERIC_ARTIST_NAMES = new Set([
  'artist',
  'unknown',
  'unknown artist',
  'various artists',
  'youtube',
  'ather',
  'music',
  'official',
  'topic',
]);

async function fetchAppleFeedJson(
  proxyPath: string,
  directUrl: string
): Promise<AppleRssFeedResponse | null> {
  try {
    const res = await fetch(proxyPath);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      return (await res.json()) as AppleRssFeedResponse;
    }
  } catch {
    // Fallback to direct RSS endpoint in Capacitor APK / static build
  }
  try {
    const directRes = await fetch(directUrl);
    if (!directRes.ok) return null;
    return (await directRes.json()) as AppleRssFeedResponse;
  } catch {
    return null;
  }
}

export async function fetchAppleCharts(): Promise<{
  songTracks: ShowcaseTrack[];
  albums: AlbumItem[];
}> {
  const [songsFeedRes, albumsFeedRes] = await Promise.allSettled([
    fetchAppleFeedJson(
      '/api/apple-charts/songs',
      'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/50/songs.json'
    ),
    fetchAppleFeedJson(
      '/api/apple-charts/albums',
      'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/albums.json'
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
    const ids = songEntries
      .map((e) => e.id)
      .filter((id): id is string => Boolean(id));
    try {
      songTracks = await lookupItunesTracksByIds(ids);
    } catch {
      songTracks = [];
    }
  }

  const albums: AlbumItem[] = albumEntries
    .filter(
      (entry) =>
        Boolean(entry.id && entry.name && entry.artistName) &&
        !GENERIC_ARTIST_NAMES.has(entry.artistName!.trim().toLowerCase())
    )
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

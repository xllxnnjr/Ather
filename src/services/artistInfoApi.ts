import { ArtistProfileInfo, RecordingMetadataInfo } from '../types/music';

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

interface MusicBrainzArtistItem {
  id?: string;
  name?: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  'life-span'?: {
    begin?: string;
    end?: string;
    ended?: boolean;
  };
}

interface MusicBrainzArtistSearchResponse {
  artists?: MusicBrainzArtistItem[];
}

interface MusicBrainzRecordingItem {
  id?: string;
  title?: string;
  'first-release-date'?: string;
  'artist-credit'?: {
    name?: string;
    artist?: { id?: string; name?: string };
  }[];
  releases?: {
    id?: string;
    title?: string;
    date?: string;
  }[];
}

interface MusicBrainzRecordingSearchResponse {
  recordings?: MusicBrainzRecordingItem[];
}

const deezerCache = new Map<string, ArtistProfileInfo | null>();
const deezerAlbumCache = new Map<string, string | null>();
const mbArtistCache = new Map<string, MusicBrainzArtistItem | null>();
const mbRecordingCache = new Map<string, RecordingMetadataInfo | null>();

function normalizeArtistMatchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fetchDeezerArtistJsonp(
  artistName: string
): Promise<ArtistProfileInfo | null> {
  const key = normalizeArtistMatchText(artistName);
  if (!key) return Promise.resolve(null);
  if (deezerCache.has(key)) {
    return Promise.resolve(deezerCache.get(key) ?? null);
  }

  return new Promise((resolve) => {
    const callbackName = `__deezerJsonp_${Date.now()}_${Math.floor(
      Math.random() * 100000
    )}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      try {
        delete (window as unknown as Record<string, unknown>)[callbackName];
      } catch {
        (window as unknown as Record<string, unknown>)[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, 5000);

    (window as unknown as Record<string, (data: DeezerArtistSearchResponse) => void>)[
      callbackName
    ] = (payload: DeezerArtistSearchResponse) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();

      const list = Array.isArray(payload?.data) ? payload.data : [];
      const exact =
        list.find(
          (item) => normalizeArtistMatchText(item.name ?? '') === key
        ) ??
        list.find((item) => {
          const norm = normalizeArtistMatchText(item.name ?? '');
          return (
            Boolean(norm) &&
            (norm.includes(key) || key.includes(norm)) &&
            Boolean(item.picture_xl || item.picture_big || item.picture_medium)
          );
        }) ??
        list.find((item) =>
          Boolean(item.picture_xl || item.picture_big || item.picture_medium)
        ) ??
        list[0];

      if (!exact) {
        deezerCache.set(key, null);
        resolve(null);
        return;
      }

      const rawPhotoUrl =
        exact.picture_xl || exact.picture_big || exact.picture_medium || undefined;
      const photoUrl =
        rawPhotoUrl && rawPhotoUrl.startsWith('http')
          ? rawPhotoUrl.replace(/^http:\/\//i, 'https://')
          : undefined;
      const result: ArtistProfileInfo = {
        name: exact.name?.trim() || artistName,
        photoUrl,
        deezerFans:
          typeof exact.nb_fan === 'number' && exact.nb_fan > 0
            ? exact.nb_fan
            : undefined,
      };
      deezerCache.set(key, result);
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

interface DeezerRawAlbum {
  id?: number;
  title?: string;
  cover_xl?: string;
  cover_big?: string;
  cover_medium?: string;
  artist?: { name?: string };
}

export function fetchDeezerAlbumCoverJsonp(
  artistName: string,
  albumTitle: string
): Promise<string | null> {
  const cleanTitle = albumTitle.trim();
  const cleanArtist = artistName.trim();
  if (!cleanTitle) return Promise.resolve(null);
  const cacheKey = `${normalizeArtistMatchText(cleanArtist)}::${normalizeArtistMatchText(
    cleanTitle
  )}`;
  if (deezerAlbumCache.has(cacheKey)) {
    return Promise.resolve(deezerAlbumCache.get(cacheKey) ?? null);
  }

  return new Promise((resolve) => {
    const callbackName = `__deezerAlbum_${Date.now()}_${Math.floor(
      Math.random() * 100000
    )}`;
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
    }, 3500);

    (
      window as unknown as Record<
        string,
        (data: { data?: DeezerRawAlbum[] }) => void
      >
    )[callbackName] = (payload) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();

      const list = Array.isArray(payload?.data) ? payload.data : [];
      const targetTitle = normalizeArtistMatchText(cleanTitle);
      const targetArtist = normalizeArtistMatchText(cleanArtist);

      const best =
        list.find((a) => {
          const t = normalizeArtistMatchText(a.title ?? '');
          const ar = normalizeArtistMatchText(a.artist?.name ?? '');
          return (
            t === targetTitle &&
            (!targetArtist || ar === targetArtist || ar.includes(targetArtist))
          );
        }) ??
        list.find((a) => {
          const t = normalizeArtistMatchText(a.title ?? '');
          return t.includes(targetTitle) || targetTitle.includes(t);
        }) ??
        list[0];

      const rawCover =
        best?.cover_xl || best?.cover_big || best?.cover_medium || null;
      const cover =
        rawCover && rawCover.startsWith('http')
          ? rawCover.replace(/^http:\/\//i, 'https://')
          : null;
      deezerAlbumCache.set(cacheKey, cover);
      resolve(cover);
    };

    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    script.src = `https://api.deezer.com/search/album?q=${encodeURIComponent(
      query
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

async function fetchWikipediaArtistImage(
  artistName: string
): Promise<string | undefined> {
  const clean = artistName.trim();
  if (!clean) return undefined;
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        clean.replace(/\s+/g, '_')
      )}`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      type?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      description?: string;
    };
    if (data.type === 'disambiguation') return undefined;
    const desc = (data.description ?? '').toLowerCase();
    if (
      desc &&
      !/(singer|musician|rapper|band|artist|producer|dj|songwriter|composer|group|duo|vocalist)/.test(
        desc
      )
    ) {
      return undefined;
    }
    const img = data.originalimage?.source || data.thumbnail?.source;
    return img && img.startsWith('http') ? img : undefined;
  } catch {
    return undefined;
  }
}

async function fetchMusicBrainzArtistRaw(
  artistName: string
): Promise<MusicBrainzArtistItem | null> {
  const key = artistName.trim().toLowerCase();
  if (!key) return null;
  if (mbArtistCache.has(key)) {
    return mbArtistCache.get(key) ?? null;
  }

  const parseArtistPayload = (data: MusicBrainzArtistSearchResponse) => {
    const list = Array.isArray(data.artists) ? data.artists : [];
    return (
      list.find((a) => a.name?.trim().toLowerCase() === key) ?? list[0] ?? null
    );
  };

  try {
    const proxyRes = await fetch(
      `/api/musicbrainz/artist?name=${encodeURIComponent(artistName.trim())}`
    );
    const ct = proxyRes.headers.get('content-type') || '';
    if (proxyRes.ok && ct.includes('application/json')) {
      const data = (await proxyRes.json()) as MusicBrainzArtistSearchResponse;
      const match = parseArtistPayload(data);
      mbArtistCache.set(key, match);
      return match;
    }
  } catch {
    // Fall through to direct MusicBrainz HTTPS call (APK / static runtime)
  }

  try {
    const directRes = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(
        `artist:"${artistName.trim()}"`
      )}&fmt=json&limit=5`
    );
    if (!directRes.ok) return null;
    const data = (await directRes.json()) as MusicBrainzArtistSearchResponse;
    const match = parseArtistPayload(data);
    mbArtistCache.set(key, match);
    return match;
  } catch {
    return null;
  }
}

export async function fetchArtistProfileInfo(
  artistName: string
): Promise<ArtistProfileInfo> {
  const [deezerRes, mbRes] = await Promise.allSettled([
    fetchDeezerArtistJsonp(artistName),
    fetchMusicBrainzArtistRaw(artistName),
  ]);

  const deezer = deezerRes.status === 'fulfilled' ? deezerRes.value : null;
  const mb = mbRes.status === 'fulfilled' ? mbRes.value : null;
  let photoUrl = deezer?.photoUrl;

  if (!photoUrl) {
    photoUrl = await fetchWikipediaArtistImage(mb?.name || artistName);
  }

  return {
    name: deezer?.name || mb?.name || artistName,
    photoUrl,
    deezerFans: deezer?.deezerFans,
    type: mb?.type || undefined,
    country: mb?.country || undefined,
    beginYear: mb?.['life-span']?.begin?.slice(0, 4) || undefined,
    endYear: mb?.['life-span']?.ended
      ? mb?.['life-span']?.end?.slice(0, 4) || 'Ended'
      : undefined,
    disambiguation: mb?.disambiguation || undefined,
  };
}

export async function fetchMusicBrainzRecordingInfo(
  title: string,
  artist: string
): Promise<RecordingMetadataInfo | null> {
  const key = `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
  if (mbRecordingCache.has(key)) {
    return mbRecordingCache.get(key) ?? null;
  }

  const fetchRecordingJson =
    async (): Promise<MusicBrainzRecordingSearchResponse | null> => {
      try {
        const proxyRes = await fetch(
          `/api/musicbrainz/recording?title=${encodeURIComponent(
            title.trim()
          )}&artist=${encodeURIComponent(artist.trim())}`
        );
        const ct = proxyRes.headers.get('content-type') || '';
        if (proxyRes.ok && ct.includes('application/json')) {
          return (await proxyRes.json()) as MusicBrainzRecordingSearchResponse;
        }
      } catch {
        // Fallback to direct HTTPS endpoint
      }

      try {
        const query = `recording:"${title.trim()}" AND artist:"${artist.trim()}"`;
        const directRes = await fetch(
          `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(
            query
          )}&fmt=json&limit=3`
        );
        if (!directRes.ok) return null;
        return (await directRes.json()) as MusicBrainzRecordingSearchResponse;
      } catch {
        return null;
      }
    };

  const [recRes, artistRes] = await Promise.allSettled([
    fetchRecordingJson(),
    fetchMusicBrainzArtistRaw(artist),
  ]);

  const recData = recRes.status === 'fulfilled' ? recRes.value : null;
  const mbArtist = artistRes.status === 'fulfilled' ? artistRes.value : null;
  const recording =
    recData && Array.isArray(recData.recordings) ? recData.recordings[0] : null;

  if (!recording && !mbArtist) {
    mbRecordingCache.set(key, null);
    return null;
  }

  const firstRelease = recording?.releases?.[0];
  const begin = mbArtist?.['life-span']?.begin?.slice(0, 4);
  const end = mbArtist?.['life-span']?.ended
    ? mbArtist?.['life-span']?.end?.slice(0, 4) || 'Ended'
    : begin
    ? 'Present'
    : undefined;

  const info: RecordingMetadataInfo = {
    title: recording?.title || title,
    artistName:
      recording?.['artist-credit']?.[0]?.name || mbArtist?.name || artist,
    releaseTitle: firstRelease?.title || undefined,
    releaseDate:
      firstRelease?.date || recording?.['first-release-date'] || undefined,
    artistType: mbArtist?.type || undefined,
    country: mbArtist?.country || undefined,
    activeYears: begin ? `${begin} – ${end ?? 'Present'}` : undefined,
    disambiguation: mbArtist?.disambiguation || undefined,
  };

  mbRecordingCache.set(key, info);
  return info;
}

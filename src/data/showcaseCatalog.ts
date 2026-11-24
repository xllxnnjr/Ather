import {
  AlbumItem,
  ArtworkStyle,
  CategoryPill,
  MoodGenreTile,
  ShowcaseTrack,
} from '../types/music';

export const PLAYLIST_COVER_PRESETS: ArtworkStyle[] = [
  'lime-noir',
  'obsidian-grid',
  'amber-glow',
  'slate-pulse',
  'violet-haze',
  'emerald-dark',
  'carbon-ring',
  'monolith-lime',
];

export const CATEGORIES: CategoryPill[] = [
  'All',
  'Party',
  'Blues',
  'Sad',
  'Hip Hop',
];

export const MOOD_GENRE_TILES: MoodGenreTile[] = [
  {
    id: 'mg-hip-hop',
    title: 'Hip Hop',
    searchQuery: 'hip hop',
    gradientFrom: '#1C1D22',
    gradientTo: '#0B0B0D',
    artwork: 'lime-noir',
  },
  {
    id: 'mg-electronic',
    title: 'Electronic',
    searchQuery: 'electronic',
    gradientFrom: '#181C20',
    gradientTo: '#090A0C',
    artwork: 'obsidian-grid',
  },
  {
    id: 'mg-rnb',
    title: 'R&B',
    searchQuery: 'r&b',
    gradientFrom: '#201B22',
    gradientTo: '#0A090D',
    artwork: 'violet-haze',
  },
  {
    id: 'mg-pop',
    title: 'Pop',
    searchQuery: 'pop',
    gradientFrom: '#1E201A',
    gradientTo: '#0A0B09',
    artwork: 'monolith-lime',
  },
  {
    id: 'mg-blues',
    title: 'Blues',
    searchQuery: 'blues',
    gradientFrom: '#191C22',
    gradientTo: '#0A0B0F',
    artwork: 'slate-pulse',
  },
  {
    id: 'mg-party',
    title: 'Party',
    searchQuery: 'party',
    gradientFrom: '#221E17',
    gradientTo: '#0B0A08',
    artwork: 'amber-glow',
  },
];

export function pickGradientArtwork(seed: string): ArtworkStyle {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PLAYLIST_COVER_PRESETS[hash % PLAYLIST_COVER_PRESETS.length];
}

export function doesArtistNameMatch(candidateArtist: string, targetArtist: string): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const target = clean(targetArtist);
  if (!target) return false;
  if (clean(candidateArtist) === target) return true;

  const credits = candidateArtist
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\band\b|\bx\b/i)
    .map(clean)
    .filter(Boolean);

  return credits.includes(target);
}

export function getTracksByArtist(
  artistName: string,
  tracks: ShowcaseTrack[]
): ShowcaseTrack[] {
  const normalized = artistName.trim().toLowerCase();
  if (!normalized) return [];
  return tracks.filter((t) => doesArtistNameMatch(t.artist, artistName));
}

export function getAlbumsByArtist(
  artistName: string,
  tracks: ShowcaseTrack[],
  knownAlbums: AlbumItem[] = []
): AlbumItem[] {
  const explicit = knownAlbums.filter((a) =>
    doesArtistNameMatch(a.artist, artistName)
  );
  const existingAlbumKeys = new Set(
    explicit.map((a) => `${a.collectionId ?? ''}::${a.title.trim().toLowerCase()}`)
  );

  const artistTracks = getTracksByArtist(artistName, tracks);
  const derivedMap = new Map<string, AlbumItem>();

  for (const track of artistTracks) {
    const albumTitle = track.album.trim();
    if (!albumTitle) continue;
    const dedupeKey = `${track.collectionId ?? ''}::${albumTitle.toLowerCase()}`;
    if (existingAlbumKeys.has(dedupeKey)) continue;

    const existing = derivedMap.get(albumTitle.toLowerCase());
    if (existing) {
      if (!existing.trackIds.includes(track.id)) {
        existing.trackIds.push(track.id);
      }
      if (!existing.coverUrl && track.coverUrl) {
        existing.coverUrl = track.coverUrl;
      }
    } else {
      const parsedYear = track.releaseDate
        ? new Date(track.releaseDate).getFullYear()
        : undefined;
      derivedMap.set(albumTitle.toLowerCase(), {
        id: track.collectionId
          ? `itunes-album-${track.collectionId}`
          : `album-${albumTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        collectionId: track.collectionId,
        title: albumTitle,
        artist: track.artist,
        year: parsedYear && Number.isFinite(parsedYear) ? parsedYear : undefined,
        releaseDate: track.releaseDate,
        genre: track.genre ?? track.category,
        artwork: track.artwork,
        coverUrl: track.coverUrl,
        description: `${track.artist} · ${albumTitle}`,
        trackIds: [track.id],
      });
    }
  }

  return [...explicit, ...Array.from(derivedMap.values())];
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

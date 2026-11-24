export type CategoryPill = 'All' | 'Party' | 'Blues' | 'Sad' | 'Hip Hop';
export type RepeatMode = 'off' | 'all' | 'one';

export type ArtworkStyle =
  | 'lime-noir'
  | 'obsidian-grid'
  | 'amber-glow'
  | 'slate-pulse'
  | 'violet-haze'
  | 'emerald-dark'
  | 'carbon-ring'
  | 'monolith-lime';

export type TrackSource = 'itunes' | 'youtube' | 'audius';
export type StreamResolutionStatus =
  | 'unresolved'
  | 'resolving'
  | 'full'
  | 'preview-only';

export interface LyricLine {
  time: number;
  text: string;
}

export interface SyncedLyricLine {
  timeSec: number;
  text: string;
  isSynced: boolean;
}

export interface LyricsLookupResult {
  syncedLyrics: LyricLine[];
  lines: SyncedLyricLine[];
  plainLyrics: string | null;
  isSynced: boolean;
}

export interface ShowcaseTrack {
  id: string;
  itunesId?: string;
  audiusId?: string;
  youtubeVideoId?: string;
  youtubeCandidates?: string[];
  youtubeChannelTitle?: string;
  isSyncedLyrics?: boolean;
  title: string;
  artist: string;
  album: string;
  collectionId?: string;
  duration: number; // seconds
  durationMs?: number;
  category: Exclude<CategoryPill, 'All'>;
  genre?: string;
  artwork: ArtworkStyle;
  coverUrl?: string;
  previewUrl?: string;
  streamUrl?: string;
  fullDuration?: number;
  releaseDate?: string;
  explicit?: boolean;
  source: TrackSource;
  isAudius?: boolean;
  streamStatus?: StreamResolutionStatus;
  playCount?: number;
  accentColor: string;
  glowColor: string;
  secondaryGlowColor: string;
  lyrics: LyricLine[];
}

export type Track = ShowcaseTrack;

export interface MoodGenreTile {
  id: string;
  title: string;
  searchQuery: string;
  gradientFrom: string;
  gradientTo: string;
  artwork: ArtworkStyle;
  coverUrl?: string;
}

export interface SearchArtistResult {
  id: string;
  name: string;
  genre?: string;
  photoUrl?: string;
  artwork: ArtworkStyle;
}

export interface SearchAllResults {
  tracks: ShowcaseTrack[];
  songs: ShowcaseTrack[];
  artists: SearchArtistResult[];
  albums: AlbumItem[];
}

export interface CollectionItem {
  id: string;
  titleLines: [string, string];
  subtitle: string;
  description: string;
  badge: string;
  theme: 'light-bw' | 'light-offwhite' | 'dark-lime' | 'dark-indigo';
  artwork: ArtworkStyle;
  coverUrl?: string;
  trackIds: string[];
}

export interface HomeShelfCard {
  id: string;
  title: string;
  artist: string;
  subtitle?: string;
  badge?: string;
  artwork: ArtworkStyle;
  coverUrl?: string;
  trackId?: string;
  track?: ShowcaseTrack;
  albumId?: string;
  albumItem?: AlbumItem;
  collectionItem?: CollectionItem;
}

export interface AlbumItem {
  id: string;
  collectionId?: string;
  title: string;
  artist: string;
  year?: number;
  releaseDate?: string;
  genre: string;
  artwork: ArtworkStyle;
  coverUrl?: string;
  description: string;
  trackIds: string[];
}

export interface ArtistProfileInfo {
  name: string;
  photoUrl?: string;
  deezerFans?: number;
  type?: string;
  country?: string;
  beginYear?: string;
  endYear?: string;
  disambiguation?: string;
}

export interface RecordingMetadataInfo {
  title: string;
  artistName: string;
  releaseTitle?: string;
  releaseDate?: string;
  artistType?: string;
  country?: string;
  activeYears?: string;
  disambiguation?: string;
}

export interface FeaturedArtistItem {
  artist: string;
  subtitle: string;
  artwork: ArtworkStyle;
  coverUrl?: string;
}

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  updatedAt: string;
  updatedAtMs?: number;
  coverArtwork?: ArtworkStyle;
  coverImageUrl?: string;
}

export type QualityTier = 'Low' | 'Normal' | 'High';
export type EqualizerPreset =
  | 'Bass Boost'
  | 'Pop'
  | 'Rock'
  | 'Flat'
  | 'Vocal'
  | 'Electronic'
  | 'Late Night'
  | 'Custom';

export interface RecognitionHistoryItem {
  trackId: string;
  identifiedAt: string;
}

export type AiDiscoveryLevel = 'Familiar Hits' | 'Balanced' | 'Deep Cuts';

export interface AiRecommendationEntry {
  trackId: string;
  vibeTag: string;
  reason: string;
}

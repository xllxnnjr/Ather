import React, { useState } from 'react';
import {
  CheckGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  CloseGlyph,
  DiscGlyph,
  DownloadGlyph,
  HeartGlyph,
  MoreHorizontalGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
  QueueGlyph,
  ShuffleGlyph,
} from '../AppIcons';
import { formatDuration } from '../../data/showcaseCatalog';
import { CollectionItem, ShowcaseTrack, UserPlaylist } from '../../types/music';
import { PlaylistCover, ShowcaseArtwork } from '../ShowcaseArtwork';
import { TrackInfoModal } from '../TrackInfoModal';
import { PopupSheet } from '../PopupSheet';

interface CollectionDetailScreenProps {
  collection: CollectionItem;
  currentTrack: ShowcaseTrack | null;
  allTracks?: ShowcaseTrack[];
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  isPlaying: boolean;
  favoriteIds: Set<string>;
  downloadedIds: Set<string>;
  playlists: UserPlaylist[];
  onBack: () => void;
  onSelectTrack: (
    trackOrId: string | ShowcaseTrack,
    openPlayer?: boolean
  ) => void;
  onSelectCollectionTrack?: (
    tracks: ShowcaseTrack[],
    startIndex: number,
    collectionId: string
  ) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onToggleDownload: (track: ShowcaseTrack) => void | Promise<void>;
  onShufflePlay: (trackIds: string[]) => void;
  onOpenArtist: (artistName: string) => void;
  onAddToQueue: (trackId: string) => void;
  onAddTrackToPlaylist: (
    playlistId: string,
    track: ShowcaseTrack
  ) => void | Promise<void>;
}

export const CollectionDetailScreen: React.FC<CollectionDetailScreenProps> = ({
  collection,
  currentTrack,
  allTracks = [],
  resolveTrack,
  isPlaying,
  favoriteIds,
  downloadedIds,
  playlists,
  onBack,
  onSelectTrack,
  onSelectCollectionTrack,
  onTogglePlay,
  onToggleFavorite,
  onToggleDownload,
  onShufflePlay,
  onOpenArtist,
  onAddToQueue,
  onAddTrackToPlaylist,
}) => {
  const tracks = collection.trackIds
    .map(
      (id) =>
        (resolveTrack ? resolveTrack(id) : undefined) ??
        allTracks.find((t) => t.id === id)
    )
    .filter((t): t is ShowcaseTrack => Boolean(t));

  const totalDuration = tracks.reduce((acc, t) => acc + t.duration, 0);
  const isCollectionActive = currentTrack
    ? tracks.some((t) => t.id === currentTrack.id)
    : false;
  const likedTracks = tracks.filter((t) => favoriteIds.has(t.id));

  const [savedCollection, setSavedCollection] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState<ShowcaseTrack | null>(null);
  const [infoTrack, setInfoTrack] = useState<ShowcaseTrack | null>(null);
  const [playlistPickerTrack, setPlaylistPickerTrack] =
    useState<ShowcaseTrack | null>(null);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [resolvingAddId, setResolvingAddId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Immersive Full-Bleed Collection Hero */}
      <section aria-label={collection.titleLines.join(' ')} className="space-y-4">
        <div className="relative ather-hero-bleed h-[320px] sm:h-[450px] overflow-hidden bg-[#0D0D0F]">
          <ShowcaseArtwork
            style={collection.artwork}
            coverUrl={collection.coverUrl}
            alt={collection.titleLines.join(' ')}
            preferGradientFallback={Boolean(collection.coverUrl)}
            className="w-full h-full"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/30 pointer-events-none"
          />

          <div className="absolute ather-hero-topbar z-20 flex items-center justify-start pointer-events-none">
            <button
              type="button"
              aria-label="Back to Home"
              onClick={onBack}
              className="pointer-events-auto w-10 h-10 rounded-full bg-[#111114] border border-white/30 text-white flex items-center justify-center hover:bg-[#1C1C22] hover:border-white/50 active:scale-90 transition-all touch-manipulation"
            >
              <ChevronLeftGlyph className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-4 z-10 space-y-1.5">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
              {collection.badge}
            </span>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[0.98] drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)]">
              {collection.titleLines[0]} {collection.titleLines[1]}
            </h1>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs sm:text-sm font-medium text-white/60 tabular-nums">
            {collection.subtitle} · {tracks.length}{' '}
            {tracks.length === 1 ? 'song' : 'songs'} ·{' '}
            {formatDuration(totalDuration)}
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 relative">
              <button
                type="button"
                onClick={() => setSavedCollection((s) => !s)}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold border transition-all active:scale-95 touch-manipulation ${
                  savedCollection
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-white border-white/45 hover:border-white'
                }`}
              >
                {savedCollection ? 'Following' : 'Follow'}
              </button>

              <button
                type="button"
                aria-label="Collection options"
                onClick={() => setCollectionMenuOpen((o) => !o)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <MoreHorizontalGlyph className="w-5 h-5" />
              </button>

              {collectionMenuOpen && (
                <>
                  <div
                    aria-hidden="true"
                    onClick={() => setCollectionMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div
                    style={{ backgroundColor: '#111114' }}
                    className="absolute left-0 top-11 z-40 w-56 rounded-2xl border border-white/25 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.95)] space-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCollectionMenuOpen(false);
                        onShufflePlay(collection.trackIds);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <ShuffleGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      <span>Shuffle Collection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        tracks.forEach((t) => onAddToQueue(t.id));
                        setCollectionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <QueueGlyph className="w-4 h-4 text-white/80 shrink-0" />
                      <span>Add All to Queue</span>
                    </button>
                    {tracks[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          setCollectionMenuOpen(false);
                          setAddedMsg(null);
                          setPlaylistPickerTrack(tracks[0]);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                      >
                        <PlusGlyph className="w-4 h-4 text-white/80 shrink-0" />
                        <span>Add Lead Song to Playlist</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                aria-label="Shuffle play collection"
                onClick={() => onShufflePlay(collection.trackIds)}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-transform active:scale-90"
              >
                <ShuffleGlyph className="w-5 h-5" />
              </button>

              <button
                type="button"
                aria-label={isCollectionActive && isPlaying ? 'Pause' : 'Play'}
                onClick={() => {
                  if (isCollectionActive) {
                    onTogglePlay();
                  } else if (tracks.length > 0) {
                    if (onSelectCollectionTrack) {
                      onSelectCollectionTrack(tracks, 0, collection.id);
                    } else {
                      onSelectTrack(tracks[0], true);
                    }
                  }
                }}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.28)] hover:scale-105 active:scale-90 transition-transform touch-manipulation"
              >
                {isCollectionActive && isPlaying ? (
                  <PauseGlyph className="w-6 h-6" />
                ) : (
                  <PlayGlyph className="w-6 h-6 translate-x-[1px]" />
                )}
              </button>
            </div>
          </div>
        </div>

        {tracks.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (likedTracks.length > 0) {
                onSelectTrack(likedTracks[0], true);
              } else if (tracks[0]) {
                onToggleFavorite(tracks[0].id);
              }
            }}
            className="w-full flex items-center gap-3.5 py-2 px-1 rounded-2xl hover:bg-white/[0.04] active:bg-white/[0.08] text-left transition-colors"
          >
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/15">
                <ShowcaseArtwork
                  style={collection.artwork}
                  coverUrl={collection.coverUrl}
                  alt={collection.titleLines.join(' ')}
                  preferGradientFallback={Boolean(collection.coverUrl)}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white text-black border-2 border-black flex items-center justify-center">
                <HeartGlyph className="w-2.5 h-2.5" active={true} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">Liked songs</div>
              <div className="text-xs text-white/75 font-bold truncate mt-0.5 tabular-nums">
                {likedTracks.length}{' '}
                {likedTracks.length === 1 ? 'song' : 'songs'} ·{' '}
                {collection.titleLines[0]} {collection.titleLines[1]}
              </div>
            </div>

            <ChevronRightGlyph className="w-4 h-4 text-white/45 shrink-0" />
          </button>
        )}
      </section>

      {/* Collection Tracks */}
      <section aria-label="Popular Tracks" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
          Popular
        </h2>

        {tracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/10 p-6 text-center text-xs text-white/75 font-bold">
            No live tracks available in this collection right now.
          </div>
        ) : (
          <div className="divide-y divide-white/10 rounded-3xl bg-[#111114] border border-white/20 overflow-hidden">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.05] ${
                    isCurrent ? 'bg-white/[0.08]' : ''
                  }`}
                >
                  <span
                    className={`w-5 text-sm font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      aria-label={`Play ${track.title}`}
                      onClick={() => {
                        if (onSelectCollectionTrack) {
                          onSelectCollectionTrack(tracks, idx, collection.id);
                        } else {
                          onSelectTrack(track, true);
                        }
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10"
                    >
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.title}
                        preferGradientFallback={track.isAudius}
                        compact={true}
                        className="w-full h-full"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectCollectionTrack) {
                            onSelectCollectionTrack(tracks, idx, collection.id);
                          } else {
                            onSelectTrack(track, true);
                          }
                        }}
                        className={`block max-w-full text-sm font-bold truncate text-left ${
                          isCurrent ? 'text-white underline underline-offset-4' : 'text-white/95'
                        }`}
                      >
                        {track.title}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-white/75 font-bold truncate mt-0.5 tabular-nums">
                        {track.explicit && (
                          <span className="px-1 py-0.5 rounded-[3px] bg-white/20 text-[9px] font-black leading-none text-white/90 shrink-0">
                            E
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenArtist(track.artist)}
                          className="hover:text-white hover:underline truncate transition-colors text-left"
                        >
                          {track.artist}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">
                          {track.playCount
                            ? `${track.playCount.toLocaleString('en-US')} plays · `
                            : ''}
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`More options for ${track.title}`}
                    onClick={() => setActionTrack(track)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 font-bold hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  >
                    <MoreHorizontalGlyph className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Track Three-Dots Bottom Action Sheet */}
      {actionTrack && (
        <PopupSheet
          onClose={() => setActionTrack(null)}
          ariaLabel={`Options for ${actionTrack.title}`}
          maxWidthClass="max-w-md"
          className="p-5 space-y-4 overflow-y-auto no-scrollbar"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shrink-0">
                <ShowcaseArtwork
                  style={actionTrack.artwork}
                  coverUrl={actionTrack.coverUrl}
                  alt={actionTrack.title}
                  preferGradientFallback={actionTrack.isAudius}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">
                  {actionTrack.title}
                </div>
                <div className="text-xs text-white/75 font-bold truncate mt-0.5 tabular-nums">
                  {actionTrack.artist} · {formatDuration(actionTrack.duration)}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setActionTrack(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-90 transition-all shrink-0"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                onSelectTrack(t, true);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white text-black hover:bg-white/90 text-left text-xs font-extrabold flex items-center gap-3 active:scale-[0.99] transition-all"
            >
              <PlayGlyph className="w-4 h-4 shrink-0" />
              <span>Play Song Now</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setInfoTrack(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DiscGlyph className="w-4 h-4 text-white/80 shrink-0" />
              <span>Song & Artist Info</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const artist = actionTrack.artist;
                setActionTrack(null);
                onOpenArtist(artist);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <ChevronRightGlyph className="w-4 h-4 text-white/80 shrink-0" />
              <span className="truncate">Go to {actionTrack.artist}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleFavorite(actionTrack.id);
                setActionTrack(null);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph
                className="w-4 h-4 shrink-0"
                active={favoriteIds.has(actionTrack.id)}
              />
              <span>
                {favoriteIds.has(actionTrack.id)
                  ? 'Remove from Liked Songs'
                  : 'Like Song'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                void onToggleDownload(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DownloadGlyph
                className="w-4 h-4 shrink-0"
                active={downloadedIds.has(actionTrack.id)}
              />
              <span>
                {downloadedIds.has(actionTrack.id)
                  ? 'Remove Download'
                  : 'Download Full Track'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddToQueue(actionTrack.id);
                setActionTrack(null);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-white/80 shrink-0" />
              <span>Add to Up Next Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setAddedMsg(null);
                setPlaylistPickerTrack(t);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/25 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white/80 shrink-0" />
              <span>Add to Playlist</span>
            </button>
          </div>
        </PopupSheet>
      )}

      {/* Add to Playlist Picker Modal */}
      {playlistPickerTrack && (
        <PopupSheet
          onClose={() => setPlaylistPickerTrack(null)}
          ariaLabel="Add to Playlist"
          maxWidthClass="max-w-md"
          className="p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-white truncate">
                Add to Playlist
              </h2>
              <p className="text-xs text-white/75 font-bold truncate mt-0.5">
                {playlistPickerTrack.title} · {playlistPickerTrack.artist}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPlaylistPickerTrack(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-90 transition-all shrink-0"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          {addedMsg && (
            <div className="rounded-2xl bg-white text-black px-3.5 py-2 text-xs font-bold flex items-center gap-2">
              <CheckGlyph className="w-4 h-4 shrink-0" />
              <span className="truncate">{addedMsg}</span>
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/75 font-bold">
              Create a playlist in Library first to add songs here.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {playlists.map((pl) => {
                const alreadyIn = pl.trackIds.includes(
                  playlistPickerTrack.id
                );
                const firstTrack =
                  (resolveTrack ? resolveTrack(pl.trackIds[0]) : undefined) ??
                  allTracks.find((t) => t.id === pl.trackIds[0]);
                const isAdding = resolvingAddId === pl.id;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    disabled={isAdding}
                    onClick={() => {
                      if (!alreadyIn) {
                        setResolvingAddId(pl.id);
                        Promise.resolve(
                          onAddTrackToPlaylist(pl.id, playlistPickerTrack)
                        ).finally(() => {
                          setResolvingAddId(null);
                          setAddedMsg(
                            `Added “${playlistPickerTrack.title}” to ${pl.name}`
                          );
                        });
                      }
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-white/[0.06] border border-white/12 hover:bg-white/[0.12] hover:border-white/30 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <PlaylistCover
                          coverImageUrl={pl.coverImageUrl}
                          coverArtwork={pl.coverArtwork}
                          fallbackArtwork={firstTrack?.artwork ?? 'lime-noir'}
                          fallbackCoverUrl={firstTrack?.coverUrl}
                          alt={pl.name}
                          compact={true}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {pl.name}
                        </div>
                        <div className="text-xs text-white/75 font-bold">
                          {pl.trackIds.length}{' '}
                          {pl.trackIds.length === 1 ? 'song' : 'songs'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        alreadyIn
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {alreadyIn ? (
                        <CheckGlyph className="w-4 h-4" />
                      ) : (
                        <PlusGlyph className="w-4 h-4" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </PopupSheet>
      )}

      <TrackInfoModal
        track={infoTrack}
        onClose={() => setInfoTrack(null)}
        isFavorite={infoTrack ? favoriteIds.has(infoTrack.id) : false}
        isDownloaded={infoTrack ? downloadedIds.has(infoTrack.id) : false}
        onPlayFullTrack={(t) => onSelectTrack(t, true)}
        onToggleFavorite={onToggleFavorite}
        onToggleDownload={(t) => void onToggleDownload(t)}
        onAddToQueue={onAddToQueue}
        onAddToPlaylist={(t) => {
          setAddedMsg(null);
          setPlaylistPickerTrack(t);
        }}
        onOpenArtist={(artist) => {
          setInfoTrack(null);
          onOpenArtist(artist);
        }}
      />
    </div>
  );
};

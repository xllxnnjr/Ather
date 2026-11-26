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
      <section aria-label={collection.titleLines.join(' ').toLowerCase()} className="space-y-4">
        <div className="relative ather-hero-bleed h-[320px] sm:h-[450px] overflow-hidden bg-black border-b border-[#242429]">
          <ShowcaseArtwork
            style={collection.artwork}
            coverUrl={collection.coverUrl}
            alt={collection.titleLines.join(' ').toLowerCase()}
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
              aria-label="back to home"
              onClick={onBack}
              className="pointer-events-auto ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
            >
              <ChevronLeftGlyph className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-x-4 sm:inset-x-8 bottom-4 z-10 space-y-1.5">
            <span className="inline-block text-[11px] font-extrabold tracking-[0.1em] text-[#E4E4E7]">
              {collection.badge.toLowerCase()}
            </span>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[0.98] drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)]">
              {collection.titleLines[0].toLowerCase()} {collection.titleLines[1].toLowerCase()}
            </h1>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs sm:text-sm font-bold text-[#A1A1AA] tabular-nums">
            {collection.subtitle.toLowerCase()} · {tracks.length}{' '}
            {tracks.length === 1 ? 'song' : 'songs'} ·{' '}
            {formatDuration(totalDuration)}
          </p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 relative">
              <button
                type="button"
                onClick={() => setSavedCollection((s) => !s)}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all active:scale-95 touch-manipulation ${
                  savedCollection
                    ? 'ather-acid-btn'
                    : 'ather-depth-pill text-white'
                }`}
              >
                {savedCollection ? 'following' : 'follow'}
              </button>

              <button
                type="button"
                aria-label="collection options"
                onClick={() => setCollectionMenuOpen((o) => !o)}
                className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
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
                    className="ather-depth-card absolute left-0 top-12 z-40 w-56 rounded-2xl p-1.5 space-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCollectionMenuOpen(false);
                        onShufflePlay(collection.trackIds);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
                    >
                      <ShuffleGlyph className="w-4 h-4 shrink-0" />
                      <span>shuffle collection</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        tracks.forEach((t) => onAddToQueue(t.id));
                        setCollectionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
                    >
                      <QueueGlyph className="w-4 h-4 shrink-0" />
                      <span>add all to queue</span>
                    </button>
                    {tracks[0] && (
                      <button
                        type="button"
                        onClick={() => {
                          setCollectionMenuOpen(false);
                          setAddedMsg(null);
                          setPlaylistPickerTrack(tracks[0]);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-white hover:bg-white hover:text-black flex items-center gap-2.5 transition-colors"
                      >
                        <PlusGlyph className="w-4 h-4 shrink-0" />
                        <span>add lead song to playlist</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                aria-label="shuffle play collection"
                onClick={() => onShufflePlay(collection.trackIds)}
                className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
              >
                <ShuffleGlyph className="w-5 h-5" />
              </button>

              <button
                type="button"
                aria-label={isCollectionActive && isPlaying ? 'pause' : 'play'}
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
                className="ather-acid-btn w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-transform touch-manipulation"
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
            className="ather-depth-row w-full flex items-center gap-3.5 py-2.5 px-3 rounded-2xl text-left transition-colors"
          >
            <div className="relative w-12 h-12 shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-[#242429]">
                <ShowcaseArtwork
                  style={collection.artwork}
                  coverUrl={collection.coverUrl}
                  alt={collection.titleLines.join(' ').toLowerCase()}
                  preferGradientFallback={Boolean(collection.coverUrl)}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <span className="ather-acid-btn absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center">
                <HeartGlyph className="w-2.5 h-2.5" active={true} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-white">liked songs</div>
              <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                {likedTracks.length}{' '}
                {likedTracks.length === 1 ? 'song' : 'songs'} ·{' '}
                {collection.titleLines[0].toLowerCase()} {collection.titleLines[1].toLowerCase()}
              </div>
            </div>

            <ChevronRightGlyph className="w-4 h-4 text-[#A1A1AA] shrink-0" />
          </button>
        )}
      </section>

      {/* Collection Tracks */}
      <section aria-label="popular tracks" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
          popular
        </h2>

        {tracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-6 text-center text-xs text-[#A1A1AA] font-bold">
            no live tracks available in this collection right now.
          </div>
        ) : (
          <div className="ather-depth-card rounded-3xl p-2 space-y-1.5">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={`ather-depth-row rounded-2xl flex items-center gap-3.5 px-3.5 py-2.5 transition-colors ${
                    isCurrent ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span
                    className={`w-5 text-sm font-bold tabular-nums text-center shrink-0 ${
                      isCurrent ? 'text-white' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      aria-label={`play ${track.title.toLowerCase()}`}
                      onClick={() => {
                        if (onSelectCollectionTrack) {
                          onSelectCollectionTrack(tracks, idx, collection.id);
                        } else {
                          onSelectTrack(track, true);
                        }
                      }}
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#242429]"
                    >
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.title.toLowerCase()}
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
                        className={`block max-w-full text-sm font-extrabold truncate text-left ${
                          isCurrent ? 'text-white underline underline-offset-4' : 'text-white'
                        }`}
                      >
                        {track.title.toLowerCase()}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                        {track.explicit && (
                          <span className="px-1 py-0.5 rounded-[3px] bg-[#141418] border border-[#242429] text-[9px] font-black leading-none text-white shrink-0">
                            e
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenArtist(track.artist)}
                          className="hover:text-white hover:underline truncate transition-colors text-left"
                        >
                          {track.artist.toLowerCase()}
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
                    aria-label={`more options for ${track.title.toLowerCase()}`}
                    onClick={() => setActionTrack(track)}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors shrink-0"
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
          ariaLabel={`options for ${actionTrack.title.toLowerCase()}`}
          maxWidthClass="max-w-md"
          className="p-5 space-y-4 overflow-y-auto no-scrollbar"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#242429]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#242429] shrink-0">
                <ShowcaseArtwork
                  style={actionTrack.artwork}
                  coverUrl={actionTrack.coverUrl}
                  alt={actionTrack.title.toLowerCase()}
                  preferGradientFallback={actionTrack.isAudius}
                  compact={true}
                  className="w-full h-full"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate">
                  {actionTrack.title.toLowerCase()}
                </div>
                <div className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5 tabular-nums">
                  {actionTrack.artist.toLowerCase()} · {formatDuration(actionTrack.duration)}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={() => setActionTrack(null)}
              className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shrink-0"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                onSelectTrack(t, true);
              }}
              className="ather-acid-btn w-full px-4 py-3 rounded-2xl text-left text-xs font-extrabold flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              <PlayGlyph className="w-4 h-4 shrink-0" />
              <span>play song now</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setInfoTrack(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DiscGlyph className="w-4 h-4 text-white shrink-0" />
              <span>song &amp; artist info</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const artist = actionTrack.artist;
                setActionTrack(null);
                onOpenArtist(artist);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <ChevronRightGlyph className="w-4 h-4 text-white shrink-0" />
              <span className="truncate">go to {actionTrack.artist.toLowerCase()}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleFavorite(actionTrack.id);
                setActionTrack(null);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph
                className="w-4 h-4 text-white shrink-0"
                active={favoriteIds.has(actionTrack.id)}
              />
              <span>
                {favoriteIds.has(actionTrack.id)
                  ? 'remove from liked songs'
                  : 'like song'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                void onToggleDownload(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <DownloadGlyph
                className="w-4 h-4 text-white shrink-0"
                active={downloadedIds.has(actionTrack.id)}
              />
              <span>
                {downloadedIds.has(actionTrack.id)
                  ? 'remove download'
                  : 'download full track'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddToQueue(actionTrack.id);
                setActionTrack(null);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-white shrink-0" />
              <span>add to up next queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const t = actionTrack;
                setActionTrack(null);
                setAddedMsg(null);
                setPlaylistPickerTrack(t);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white shrink-0" />
              <span>add to playlist</span>
            </button>
          </div>
        </PopupSheet>
      )}

      {/* Add to Playlist Picker Modal */}
      {playlistPickerTrack && (
        <PopupSheet
          onClose={() => setPlaylistPickerTrack(null)}
          ariaLabel="add to playlist"
          maxWidthClass="max-w-md"
          className="p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#242429]">
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-white truncate">
                add to playlist
              </h2>
              <p className="text-xs text-[#A1A1AA] font-bold truncate mt-0.5">
                {playlistPickerTrack.title.toLowerCase()} · {playlistPickerTrack.artist.toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={() => setPlaylistPickerTrack(null)}
              className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shrink-0"
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </div>

          {addedMsg && (
            <div className="rounded-2xl bg-white text-black border border-[#242429] px-3.5 py-2 text-xs font-extrabold flex items-center gap-2">
              <CheckGlyph className="w-4 h-4 shrink-0" />
              <span className="truncate">{addedMsg.toLowerCase()}</span>
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#A1A1AA] font-bold">
              create a playlist in library first to add songs here.
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
                            `added “${playlistPickerTrack.title.toLowerCase()}” to ${pl.name.toLowerCase()}`
                          );
                        });
                      }
                    }}
                    className="ather-depth-row w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[#242429]">
                        <PlaylistCover
                          coverImageUrl={pl.coverImageUrl}
                          coverArtwork={pl.coverArtwork}
                          fallbackArtwork={firstTrack?.artwork ?? 'lime-noir'}
                          fallbackCoverUrl={firstTrack?.coverUrl}
                          alt={pl.name.toLowerCase()}
                          compact={true}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {pl.name.toLowerCase()}
                        </div>
                        <div className="text-xs text-[#A1A1AA] font-bold tabular-nums">
                          {pl.trackIds.length}{' '}
                          {pl.trackIds.length === 1 ? 'song' : 'songs'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[#242429] ${
                        alreadyIn
                          ? 'bg-white text-black'
                          : 'bg-[#141418] text-white'
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

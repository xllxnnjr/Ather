import React from 'react';
import {
  ChevronLeftGlyph,
  MoreDotsGlyph,
  PauseGlyph,
  PlayGlyph,
  ShuffleGlyph,
} from '../AppIcons';
import { formatDuration } from '../../data/showcaseCatalog';
import { AlbumItem, HomeShelfCard, ShowcaseTrack } from '../../types/music';
import { ShowcaseArtwork } from '../ShowcaseArtwork';

export interface HomeShelfDetail {
  id: string;
  title: string;
  cards: HomeShelfCard[];
}

interface ShelfDetailScreenProps {
  shelf: HomeShelfDetail;
  currentTrack: ShowcaseTrack | null;
  isPlaying: boolean;
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  onBack: () => void;
  onPlayAll: (tracks: ShowcaseTrack[], startIndex?: number) => void;
  onShufflePlay: (trackIds: string[]) => void;
  onTogglePlay: () => void;
  onOpenAlbum: (album: AlbumItem) => void;
  onOpenArtist: (artistName: string) => void;
  onOpenTrackInfo?: (track: ShowcaseTrack) => void;
}

export const ShelfDetailScreen: React.FC<ShelfDetailScreenProps> = ({
  shelf,
  currentTrack,
  isPlaying,
  resolveTrack,
  onBack,
  onPlayAll,
  onShufflePlay,
  onTogglePlay,
  onOpenAlbum,
  onOpenArtist,
  onOpenTrackInfo,
}) => {
  const playableTracks = shelf.cards
    .map(
      (c) =>
        c.track ??
        (c.trackId && resolveTrack ? resolveTrack(c.trackId) : undefined)
    )
    .filter((t): t is ShowcaseTrack => Boolean(t));

  const playableIds = playableTracks.map((t) => t.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Back to Home"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#141416] border border-white/12 text-white flex items-center justify-center hover:border-white/35 active:scale-90 transition-all shrink-0"
          >
            <ChevronLeftGlyph className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
              {shelf.title}
            </h1>
            <p className="text-xs text-[#9A9AA6] tabular-nums">
              {shelf.cards.length} {shelf.cards.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {playableTracks.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onShufflePlay(playableIds)}
              aria-label={`Shuffle ${shelf.title}`}
              className="w-10 h-10 rounded-full bg-[#141416] border border-white/12 text-white/85 hover:text-white hover:border-white/35 flex items-center justify-center active:scale-90 transition-all"
            >
              <ShuffleGlyph className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPlayAll(playableTracks, 0)}
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-white/90 active:scale-95 transition-all"
            >
              <PlayGlyph className="w-3.5 h-3.5 translate-x-[0.5px]" />
              <span>Play All</span>
            </button>
          </div>
        )}
      </div>

      {shelf.cards.length === 0 ? (
        <div className="rounded-3xl bg-[#141416] border border-white/10 p-8 text-center text-xs text-[#9A9AA6]">
          No items available in {shelf.title} right now.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {shelf.cards.map((card, idx) => {
            const track =
              card.track ??
              (card.trackId && resolveTrack ? resolveTrack(card.trackId) : undefined);
            const isCurrent = Boolean(
              currentTrack &&
                (card.albumItem
                  ? card.albumItem.trackIds.includes(currentTrack.id)
                  : card.trackId === currentTrack.id || track?.id === currentTrack.id)
            );

            const handleOpenCard = () => {
              if (card.albumItem) {
                onOpenAlbum(card.albumItem);
                return;
              }
              if (track) {
                if (isCurrent) {
                  onTogglePlay();
                } else {
                  const startIdx = Math.max(
                    0,
                    playableTracks.findIndex((t) => t.id === track.id)
                  );
                  onPlayAll(playableTracks.length > 0 ? playableTracks : [track], startIdx >= 0 ? startIdx : idx);
                }
              }
            };

            return (
              <div key={card.id} className="group text-left">
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleOpenCard}
                    className="w-full text-left transition-transform active:scale-[0.98]"
                  >
                    <div
                      className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-all ${
                        isCurrent
                          ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                          : 'border-white/12 group-hover:border-white/30'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={card.artwork}
                        coverUrl={card.coverUrl}
                        alt={card.title}
                        compact={true}
                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div
                        className={`absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                          isCurrent
                            ? 'bg-white text-black opacity-100 scale-100'
                            : 'bg-black/80 text-white border border-white/25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <PauseGlyph className="w-4 h-4" />
                        ) : (
                          <PlayGlyph className="w-4 h-4 translate-x-[0.5px]" />
                        )}
                      </div>
                    </div>
                  </button>

                  {track && onOpenTrackInfo && (
                    <button
                      type="button"
                      aria-label={`Track options for ${card.title}`}
                      onClick={() => onOpenTrackInfo(track)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 border border-white/15 text-white/80 hover:text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <MoreDotsGlyph className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex items-start gap-2">
                  <div
                    className={`w-[2.5px] h-8 rounded-full mt-0.5 shrink-0 ${
                      isCurrent ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={handleOpenCard}
                      className="block max-w-full text-sm font-bold text-white truncate leading-tight text-left"
                    >
                      {card.title}
                    </button>
                    <div className="flex items-center gap-1 text-xs text-white/55 mt-0.5 leading-tight">
                      <button
                        type="button"
                        onClick={() =>
                          card.albumItem
                            ? onOpenAlbum(card.albumItem)
                            : onOpenArtist(card.artist)
                        }
                        className="hover:text-white hover:underline truncate text-left transition-colors"
                      >
                        {card.subtitle || card.artist}
                      </button>
                      {track && track.duration > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0 text-[11px] text-white/45">
                            {formatDuration(track.duration)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

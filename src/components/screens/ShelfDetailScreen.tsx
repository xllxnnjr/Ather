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
            aria-label="back to home"
            onClick={onBack}
            className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform shrink-0"
          >
            <ChevronLeftGlyph className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
              {shelf.title.toLowerCase()}
            </h1>
            <p className="text-xs font-bold text-[#A1A1AA] tabular-nums">
              {shelf.cards.length} {shelf.cards.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {playableTracks.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onShufflePlay(playableIds)}
              aria-label={`shuffle ${shelf.title.toLowerCase()}`}
              className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <ShuffleGlyph className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPlayAll(playableTracks, 0)}
              className="ather-acid-btn px-4 py-2.5 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <PlayGlyph className="w-3.5 h-3.5 translate-x-[0.5px]" />
              <span>play all</span>
            </button>
          </div>
        )}
      </div>

      {shelf.cards.length === 0 ? (
        <div className="ather-depth-card rounded-3xl p-8 text-center text-xs font-bold text-[#A1A1AA]">
          no items available in {shelf.title.toLowerCase()} right now.
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
                      className={`relative w-full aspect-square rounded-2xl overflow-hidden border bg-[#141418] transition-all ${
                        isCurrent ? 'border-white ring-2 ring-white' : 'border-[#242429]'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={card.artwork}
                        coverUrl={card.coverUrl}
                        alt={card.title.toLowerCase()}
                        compact={true}
                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div
                        className={`absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isCurrent
                            ? 'ather-acid-btn opacity-100 scale-100'
                            : 'ather-depth-btn text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100'
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
                      aria-label={`track options for ${card.title.toLowerCase()}`}
                      onClick={() => onOpenTrackInfo(track)}
                      className="ather-depth-btn absolute top-2 right-2 w-8 h-8 rounded-full text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <MoreDotsGlyph className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 flex items-start gap-2">
                  <div
                    className={`w-[2.5px] h-8 rounded-full mt-0.5 shrink-0 ${
                      isCurrent ? 'bg-white' : 'bg-[#242429]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={handleOpenCard}
                      className={`block max-w-full text-sm font-extrabold truncate leading-tight text-left ${
                        isCurrent ? 'text-white underline underline-offset-4' : 'text-white'
                      }`}
                    >
                      {card.title.toLowerCase()}
                    </button>
                    <div className="flex items-center gap-1 text-xs text-[#A1A1AA] font-bold mt-0.5 leading-tight">
                      <button
                        type="button"
                        onClick={() =>
                          card.albumItem
                            ? onOpenAlbum(card.albumItem)
                            : onOpenArtist(card.artist)
                        }
                        className="hover:text-white hover:underline truncate text-left transition-colors"
                      >
                        {(card.subtitle || card.artist).toLowerCase()}
                      </button>
                      {track && track.duration > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums shrink-0 text-[11px] text-[#A1A1AA]">
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

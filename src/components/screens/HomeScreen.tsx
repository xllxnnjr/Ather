import React, { useRef, useState } from 'react';
import {
  AiSparklesGlyph,
  ArrowRightGlyph,
  ChevronDownGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  ChevronUpGlyph,
  RotateGlyph,
} from '../AppIcons';
import { CATEGORIES, formatDuration } from '../../data/showcaseCatalog';
import {
  AiRecommendationEntry,
  AlbumItem,
  CollectionItem,
  FeaturedArtistItem,
  HomeShelfCard,
  ShowcaseTrack,
} from '../../types/music';
import { ShowcaseArtwork } from '../ShowcaseArtwork';

interface HomeScreenProps {
  displayName?: string;
  currentTrack: ShowcaseTrack | null;
  isPlaying: boolean;
  isOffline?: boolean;
  categories?: string[];
  popularTracks: ShowcaseTrack[];
  featuredArtists: FeaturedArtistItem[];
  collections: CollectionItem[];
  forYouCards: HomeShelfCard[];
  albumCards: HomeShelfCard[];
  trendingCards?: HomeShelfCard[];
  newReleaseCards?: HomeShelfCard[];
  exploreCards?: HomeShelfCard[];
  selectedCategory?: string;
  feedLoading?: boolean;
  feedError?: string | null;
  onSelectCategory?: (category: string) => void;
  onRetryFeed?: () => void;
  resolveTrack?: (trackId: string) => ShowcaseTrack | undefined;
  aiRecommendationsEnabled?: boolean;
  aiRecHeadline?: string | null;
  aiRecommendations?: AiRecommendationEntry[];
  aiRecLoading?: boolean;
  aiRecError?: string | null;
  onRefreshAiRecommendations?: () => void;
  onSelectTrack: (trackOrId: string | ShowcaseTrack, openPlayer?: boolean) => void;
  onTogglePlay: () => void;
  onOpenCollection: (collection: CollectionItem) => void;
  onOpenAlbum: (album: AlbumItem) => void;
  onOpenArtist: (artistName: string) => void;
  onOpenTrackInfo?: (track: ShowcaseTrack) => void;
  onOpenShelf?: (shelf: { id: string; title: string; cards: HomeShelfCard[] }) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  displayName = 'listener',
  currentTrack,
  isPlaying,
  isOffline = false,
  categories,
  popularTracks,
  featuredArtists,
  collections,
  forYouCards,
  albumCards,
  trendingCards = [],
  newReleaseCards = [],
  exploreCards = [],
  selectedCategory = 'all',
  feedLoading = false,
  feedError = null,
  onSelectCategory,
  onRetryFeed,
  resolveTrack,
  aiRecommendationsEnabled = true,
  aiRecHeadline = null,
  aiRecommendations = [],
  aiRecLoading = false,
  aiRecError = null,
  onRefreshAiRecommendations,
  onSelectTrack,
  onTogglePlay,
  onOpenCollection,
  onOpenAlbum,
  onOpenArtist,
  onOpenTrackInfo,
  onOpenShelf,
}) => {
  const categoryList = categories && categories.length > 0 ? categories : CATEGORIES;
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [forYouExpanded, setForYouExpanded] = useState(true);
  const collectionRowRef = useRef<HTMLDivElement>(null);

  const scrollCollections = (dir: 'left' | 'right') => {
    const el = collectionRowRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === 'right' ? 340 : -340,
      behavior: 'smooth',
    });
  };

  const handleCardClick = (card: HomeShelfCard) => {
    if (card.collectionItem) {
      onOpenCollection(card.collectionItem);
      return;
    }
    if (card.albumItem) {
      onOpenAlbum(card.albumItem);
      return;
    }
    if (card.track) {
      onSelectTrack(card.track, true);
      return;
    }
    if (card.trackId) {
      const found = resolveTrack ? resolveTrack(card.trackId) : undefined;
      onSelectTrack(found ?? card.trackId, true);
    }
  };

  const renderShelf = (
    shelfId: string,
    title: string,
    cards: HomeShelfCard[],
    actionIcon: 'down' | 'right',
    onHeaderClick?: () => void,
    collapsed = false
  ) => {
    if (feedLoading && cards.length === 0) {
      return (
        <section aria-label={title} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {title}
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[148px] sm:w-[168px] space-y-2.5 animate-pulse"
              >
                <div className="w-full aspect-square rounded-2xl bg-[#141418] border border-[#242429]" />
                <div className="h-3.5 w-4/5 rounded bg-[#141418]" />
                <div className="h-3 w-1/2 rounded bg-[#141418]" />
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (cards.length === 0) return null;

    const handleShelfOpen = () => {
      if (onOpenShelf) {
        onOpenShelf({ id: shelfId, title, cards });
      } else {
        onHeaderClick?.();
      }
    };

    return (
      <section aria-label={title} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={
              actionIcon === 'down'
                ? onHeaderClick ?? handleShelfOpen
                : handleShelfOpen
            }
            className="min-w-0 flex items-center gap-2 text-left group"
          >
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
              {title.toLowerCase()}
            </h2>
            {actionIcon === 'down' && (
              <span className="text-[#A1A1AA] group-hover:text-white transition-colors shrink-0">
                {collapsed ? (
                  <ChevronUpGlyph className="w-4 h-4" />
                ) : (
                  <ChevronDownGlyph className="w-4 h-4" />
                )}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleShelfOpen}
            className="inline-flex items-center gap-0.5 text-xs font-extrabold text-white hover:opacity-80 transition-opacity shrink-0"
          >
            <span>see all</span>
            <ChevronRightGlyph className="w-4 h-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {cards.map((card) => {
              const isCurrent = Boolean(
                currentTrack &&
                  (card.collectionItem
                    ? card.collectionItem.trackIds.includes(currentTrack.id)
                    : card.albumItem
                    ? card.albumItem.trackIds.includes(currentTrack.id)
                    : card.trackId === currentTrack.id)
              );

              return (
                <div
                  key={card.id}
                  className="group text-left shrink-0 w-[148px] sm:w-[168px]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent && !card.albumItem && !card.collectionItem) {
                        onTogglePlay();
                      } else {
                        handleCardClick(card);
                      }
                    }}
                    className="w-full text-left transition-transform active:scale-[0.98]"
                  >
                    <div
                      className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-colors ${
                        isCurrent
                          ? 'border-white'
                          : 'border-[#242429] group-hover:border-white/70'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={card.artwork}
                        coverUrl={card.coverUrl}
                        alt={card.title}
                        compact={true}
                        className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  </button>

                  <div className="mt-2.5 flex items-start gap-2">
                    <div
                      className={`w-[3px] h-8 rounded-full mt-0.5 shrink-0 ${
                        isCurrent ? 'bg-white' : 'bg-[#2A2A32]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleCardClick(card)}
                        className={`block max-w-full text-sm font-extrabold truncate leading-tight text-left ${
                          isCurrent ? 'text-white' : 'text-[#E4E4E7]'
                        }`}
                      >
                        {card.title.toLowerCase()}
                      </button>
                      <div className="flex items-center gap-1 text-xs font-bold text-[#A1A1AA] mt-0.5 leading-tight">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (card.collectionItem) {
                              onOpenCollection(card.collectionItem);
                            } else if (card.albumItem) {
                              onOpenAlbum(card.albumItem);
                            } else {
                              onOpenArtist(card.artist);
                            }
                          }}
                          className="hover:text-white hover:underline truncate text-left transition-colors"
                        >
                          {(card.subtitle || card.artist).toLowerCase()}
                        </button>
                        {card.track && card.track.duration > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums shrink-0 text-[11px] font-bold text-[#A1A1AA]">
                              {formatDuration(card.track.duration)}
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
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Greeting */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
            hello, <span className="font-black text-white">{displayName.toLowerCase()}</span>
          </h1>
        </div>

        {/* Interactive Category Filter Pills */}
        {onSelectCategory && (
          <div
            role="tablist"
            aria-label="music categories"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {categoryList.map((category) => {
              const active =
                selectedCategory.trim().toLowerCase() ===
                category.trim().toLowerCase();
              return (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  disabled={isOffline}
                  onClick={() => onSelectCategory(category)}
                  className={`shrink-0 min-h-[40px] px-4 py-2 rounded-full text-xs font-extrabold transition-colors active:scale-95 disabled:opacity-45 ${
                    active
                      ? 'bg-white text-black border border-white'
                      : 'ather-depth-pill text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {category.toLowerCase()}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Your Top Artists Strip */}
      {(feedLoading && featuredArtists.length === 0) ? (
        <section aria-label="your top artists" className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            your top artists
          </h2>
          <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[96px] sm:w-[108px] flex flex-col items-center space-y-2 animate-pulse"
              >
                <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full bg-[#141418] border border-[#242429]" />
                <div className="h-3 w-16 rounded bg-[#141418]" />
                <div className="h-2.5 w-12 rounded bg-[#141418]" />
              </div>
            ))}
          </div>
        </section>
      ) : featuredArtists.length > 0 ? (
        <section aria-label="your top artists" className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            your top artists
          </h2>
          <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {featuredArtists.map((item) => (
              <button
                key={item.artist}
                type="button"
                onClick={() => onOpenArtist(item.artist)}
                className="group shrink-0 w-[96px] sm:w-[108px] flex flex-col items-center text-center active:scale-95 transition-transform"
              >
                <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full overflow-hidden border border-[#242429] group-hover:border-white group-hover:scale-105 transition-all">
                  <ShowcaseArtwork
                    style={item.artwork}
                    coverUrl={item.coverUrl}
                    alt={item.artist}
                    compact={true}
                    className="w-full h-full"
                  />
                </div>
                <span className="mt-2.5 w-full text-[13px] font-extrabold text-white truncate leading-tight">
                  {item.artist.toLowerCase()}
                </span>
                <span className="mt-0.5 w-full text-[11px] font-bold text-[#A1A1AA] truncate leading-tight tabular-nums">
                  {item.subtitle.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Popular Songs */}
      <section aria-label="popular songs" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
              {selectedCategory.toLowerCase() === 'all'
                ? 'popular songs'
                : `${selectedCategory.toLowerCase()} songs`}
            </h2>
          </div>
          {popularTracks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onOpenShelf) {
                  onOpenShelf({
                    id: 'popular-songs',
                    title:
                      selectedCategory.toLowerCase() === 'all'
                        ? 'popular songs'
                        : `${selectedCategory.toLowerCase()} songs`,
                    cards: popularTracks.map((t) => ({
                      id: `pop-${t.id}`,
                      title: t.title,
                      artist: t.artist,
                      subtitle: t.artist,
                      artwork: t.artwork,
                      coverUrl: t.coverUrl,
                      trackId: t.id,
                      track: t,
                    })),
                  });
                } else {
                  setShowAllSongs((s) => !s);
                }
              }}
              className="inline-flex items-center gap-0.5 text-xs font-extrabold text-white hover:opacity-80 transition-opacity shrink-0"
            >
              <span>{onOpenShelf ? 'see all' : showAllSongs ? 'show carousel' : 'see all'}</span>
              <ChevronRightGlyph className="w-4 h-4" />
            </button>
          )}
        </div>

        {feedLoading && popularTracks.length === 0 ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[148px] sm:w-[168px] space-y-2.5 animate-pulse"
              >
                <div className="w-full aspect-square rounded-2xl bg-[#141418] border border-[#242429]" />
                <div className="h-3.5 w-4/5 rounded bg-[#141418]" />
                <div className="h-3 w-1/2 rounded bg-[#141418]" />
              </div>
            ))}
          </div>
        ) : feedError && popularTracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-extrabold text-white">
                could not load live catalog
              </div>
              <p className="text-xs font-semibold text-[#A1A1AA] leading-relaxed">{feedError.toLowerCase()}</p>
            </div>
            {onRetryFeed && (
              <button
                type="button"
                onClick={onRetryFeed}
                className="ather-acid-btn self-start sm:self-auto px-4 py-2 rounded-full text-xs font-extrabold shrink-0"
              >
                retry
              </button>
            )}
          </div>
        ) : popularTracks.length === 0 ? (
          <div className="ather-depth-card rounded-3xl p-6 text-center space-y-2">
            <p className="text-xs font-extrabold text-white">
              {isOffline
                ? 'you are offline'
                : 'no live tracks matched this filter'}
            </p>
            <p className="text-xs font-semibold text-[#A1A1AA]">
              {isOffline
                ? 'switch to library → downloads to listen to your saved tracks.'
                : 'try another category or retry loading.'}
            </p>
            {!isOffline && onRetryFeed && (
              <button
                type="button"
                onClick={onRetryFeed}
                className="ather-acid-btn mt-2 px-4 py-1.5 rounded-full text-xs font-extrabold"
              >
                retry
              </button>
            )}
          </div>
        ) : (
          <div
            className={
              showAllSongs
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                : 'flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0'
            }
          >
            {popularTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`group text-left shrink-0 ${
                    showAllSongs ? 'w-full' : 'w-[148px] sm:w-[168px]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) onTogglePlay();
                      else onSelectTrack(track, true);
                    }}
                    className="w-full text-left transition-transform active:scale-[0.98]"
                  >
                    <div
                      className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-colors ${
                        isCurrent
                          ? 'border-white'
                          : 'border-[#242429] group-hover:border-white/70'
                      }`}
                    >
                      <ShowcaseArtwork
                        style={track.artwork}
                        coverUrl={track.coverUrl}
                        alt={track.title}
                        compact={true}
                        className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  </button>

                  <div className="mt-2.5 flex items-start gap-2">
                    <div
                      className={`w-[3px] h-8 rounded-full mt-0.5 shrink-0 ${
                        isCurrent ? 'bg-white' : 'bg-[#2A2A32]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTrack(track, true)}
                        className={`block max-w-full text-sm font-extrabold truncate leading-tight text-left ${
                          isCurrent ? 'text-white' : 'text-[#E4E4E7]'
                        }`}
                      >
                        {track.title.toLowerCase()}
                      </button>
                      <div className="flex items-center gap-1 text-xs font-bold text-[#A1A1AA] mt-0.5 leading-tight">
                        <button
                          type="button"
                          onClick={() => onOpenArtist(track.artist)}
                          className="hover:text-white hover:underline truncate text-left transition-colors"
                        >
                          {track.artist.toLowerCase()}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums shrink-0 text-[11px] font-bold text-[#A1A1AA]">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* New Collection — Horizontal Swipeable Carousel */}
      {(feedLoading && collections.length === 0) ? (
        <section aria-label="new collection" className="space-y-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            new collection
          </h2>
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[300px] sm:w-[340px] h-[168px] rounded-3xl bg-[#141418] border border-[#242429] animate-pulse"
              />
            ))}
          </div>
        </section>
      ) : collections.length > 0 ? (
        <section aria-label="new collection" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              new collection
            </h2>

            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                aria-label="scroll collections left"
                onClick={() => scrollCollections('left')}
                className="ather-depth-btn w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <ChevronLeftGlyph className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="scroll collections right"
                onClick={() => scrollCollections('right')}
                className="ather-depth-btn w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <ChevronRightGlyph className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={collectionRowRef}
            className="flex items-center gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-3 px-4 sm:px-6 scroll-px-4 sm:scroll-px-6 rounded-3xl"
          >
            {collections.map((col, idx) => {
              const isPrimaryCard = idx === 0;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onOpenCollection(col)}
                  className={`group relative snap-center shrink-0 w-[86vw] max-w-[340px] sm:w-[340px] md:w-[356px] h-[164px] sm:h-[178px] rounded-3xl p-5 sm:p-6 flex flex-col justify-between overflow-hidden text-left hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] will-change-transform ${
                    isPrimaryCard ? 'ather-acid-btn' : 'ather-depth-card text-white'
                  }`}
                >
                  <div className="relative z-10 max-w-[60%]">
                    <div className="text-base sm:text-xl font-black leading-[1.08] tracking-tight">
                      {col.titleLines[0].toLowerCase()}
                      <br />
                      {col.titleLines[1].toLowerCase()}
                    </div>
                    <div
                      className={`text-xs font-bold mt-1.5 truncate ${
                        isPrimaryCard ? 'text-black/70' : 'text-[#A1A1AA]'
                      }`}
                    >
                      {col.subtitle.toLowerCase()}
                    </div>
                  </div>

                  <div
                    className={`relative z-10 inline-flex items-center gap-2 text-xs font-extrabold ${
                      isPrimaryCard ? 'text-black' : 'text-white'
                    }`}
                  >
                    <ArrowRightGlyph className="w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] group-hover:translate-x-1" />
                    <span>open collection</span>
                  </div>

                  <div className="absolute right-3.5 sm:right-4 bottom-3.5 sm:bottom-4 w-[84px] h-[84px] sm:w-[104px] sm:h-[104px] rounded-2xl overflow-hidden shadow-xl border border-black rotate-6 transition-transform duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] group-hover:rotate-3 group-hover:scale-105 pointer-events-none">
                    <ShowcaseArtwork
                      style={col.artwork}
                      coverUrl={col.coverUrl}
                      alt={col.titleLines.join(' ')}
                      compact={true}
                      className="w-full h-full"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* AI Recommendations Shelf (controlled in Settings -> AI & Smart Playback) */}
      {aiRecommendationsEnabled && (
        <section aria-label="ai recommendations" className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="ather-acid-btn w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                <AiSparklesGlyph className="w-4 h-4" active={true} />
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
                {(aiRecHeadline ?? 'ai recommendations').toLowerCase()}
              </h2>
            </div>

            {onRefreshAiRecommendations && (
              <button
                type="button"
                disabled={isOffline || aiRecLoading}
                onClick={onRefreshAiRecommendations}
                className="ather-depth-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold text-white disabled:opacity-40 transition-colors shrink-0"
              >
                <RotateGlyph className={`w-3.5 h-3.5 text-white ${aiRecLoading ? 'animate-spin' : ''}`} />
                <span>{aiRecLoading ? 'curating' : 'curate'}</span>
              </button>
            )}
          </div>

          {isOffline ? (
            <div className="ather-depth-card rounded-3xl p-5 text-xs font-semibold text-[#A1A1AA]">
              ai recommendations pause automatically while your device is offline.
            </div>
          ) : aiRecLoading && aiRecommendations.length === 0 ? (
            <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="ather-depth-card shrink-0 w-[160px] sm:w-[180px] rounded-2xl p-3 space-y-2.5 animate-pulse"
                >
                  <div className="w-full aspect-square rounded-xl bg-[#141418] border border-[#242429]" />
                  <div className="h-3.5 w-3/4 rounded bg-[#141418]" />
                  <div className="h-3 w-1/2 rounded bg-[#141418]" />
                </div>
              ))}
            </div>
          ) : aiRecError ? (
            <div className="ather-depth-card rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-extrabold text-white">
                  ai recommendations unavailable
                </div>
                <p className="text-xs font-semibold text-[#A1A1AA] leading-relaxed">{aiRecError.toLowerCase()}</p>
              </div>
              {onRefreshAiRecommendations && (
                <button
                  type="button"
                  onClick={onRefreshAiRecommendations}
                  className="ather-acid-btn self-start sm:self-auto px-4 py-2 rounded-full text-xs font-extrabold shrink-0"
                >
                  retry
                </button>
              )}
            </div>
          ) : aiRecommendations.length > 0 ? (
            <div className="flex gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {aiRecommendations.map((rec) => {
                const track = resolveTrack ? resolveTrack(rec.trackId) : undefined;
                if (!track) return null;
                const isCurrent = currentTrack?.id === track.id;

                return (
                  <div
                    key={rec.trackId}
                    className="group shrink-0 w-[158px] sm:w-[178px] text-left"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTrack(track, true)}
                      className="w-full text-left transition-transform active:scale-[0.98]"
                    >
                      <div
                        className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-colors ${
                          isCurrent
                            ? 'border-white'
                            : 'border-[#242429] group-hover:border-white/70'
                        }`}
                      >
                        <ShowcaseArtwork
                          style={track.artwork}
                          coverUrl={track.coverUrl}
                          alt={track.title}
                          compact={true}
                          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="mt-2.5 text-[13px] sm:text-sm font-extrabold text-white leading-snug truncate">
                        {track.title.toLowerCase()}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArtist(track.artist)}
                      className="mt-0.5 block max-w-full text-[11px] font-bold text-[#A1A1AA] hover:text-white hover:underline truncate text-left transition-colors"
                    >
                      {track.artist.toLowerCase()}
                    </button>
                    <p className="mt-1 text-[11px] font-semibold text-[#A1A1AA] line-clamp-2 leading-snug">
                      {rec.vibeTag ? `${rec.vibeTag.toLowerCase()} · ` : ''}
                      {rec.reason.toLowerCase()}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      {/* Uniform Square Shelves */}
      {renderShelf(
        'for-you',
        'for you / quick picks',
        forYouCards,
        'down',
        () => setForYouExpanded((e) => !e),
        !forYouExpanded
      )}

      {renderShelf('albums-for-you', 'albums for you', albumCards, 'right')}

      {renderShelf('trending', 'trending', trendingCards, 'right')}

      {renderShelf('new-releases', 'new releases', newReleaseCards, 'right')}

      {trendingCards.length === 0 &&
        newReleaseCards.length === 0 &&
        renderShelf('explore', 'explore', exploreCards, 'right')}
    </div>
  );
};

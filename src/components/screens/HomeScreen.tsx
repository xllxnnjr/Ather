import React, { useRef, useState } from 'react';
import {
  AiSparklesGlyph,
  ArrowRightGlyph,
  ChevronDownGlyph,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  ChevronUpGlyph,
  MoreDotsGlyph,
  PauseGlyph,
  PlayGlyph,
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
  displayName = 'Listener',
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
  selectedCategory = 'All',
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

  const handleCardPlayClick = (
    e: React.MouseEvent,
    card: HomeShelfCard,
    isCurrent: boolean
  ) => {
    e.stopPropagation();
    if (isCurrent) {
      onTogglePlay();
      return;
    }
    handleCardClick(card);
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
                <div className="w-full aspect-square rounded-2xl bg-[#0E0E10] border border-white/10" />
                <div className="h-3.5 w-4/5 rounded bg-white/[0.1]" />
                <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
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
              {title}
            </h2>
            {actionIcon === 'down' && (
              <span className="text-white/80 group-hover:text-white transition-colors shrink-0">
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
            className="inline-flex items-center gap-0.5 text-xs font-bold text-white/80 hover:text-white transition-colors shrink-0"
          >
            <span>See all</span>
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
                  <div className="relative">
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
                        {card.badge && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#111114] border border-white/25 text-[9px] font-extrabold uppercase tracking-wider text-white max-w-[70%] truncate">
                            {card.badge}
                          </span>
                        )}
                        <div
                          onClick={(e) => handleCardPlayClick(e, card, isCurrent)}
                          className={`absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                            isCurrent
                              ? 'bg-white text-black opacity-100 scale-100'
                              : 'bg-[#111114] text-white border border-white/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100'
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

                    {card.track && onOpenTrackInfo && (
                      <button
                        type="button"
                        aria-label={`Track options for ${card.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTrackInfo(card.track!);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#111114] border border-white/25 text-white hover:border-white/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                        onClick={() => handleCardClick(card)}
                        className="block max-w-full text-sm font-extrabold text-white truncate leading-tight text-left"
                      >
                        {card.title}
                      </button>
                      <div className="flex items-center gap-1 text-xs font-bold text-white/75 mt-0.5 leading-tight">
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
                          {card.subtitle || card.artist}
                        </button>
                        {card.track && card.track.duration > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums shrink-0 text-[11px] font-bold text-white/65">
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
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
          Hello, <span className="font-black text-white">{displayName}</span>
        </h1>

        {/* Interactive Category Filter Pills */}
        {onSelectCategory && (
          <div
            role="tablist"
            aria-label="Music categories"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {categoryList.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  disabled={isOffline}
                  onClick={() => onSelectCategory(category)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-extrabold transition-all active:scale-95 disabled:opacity-45 border ${
                    active
                      ? 'bg-white text-black border-white'
                      : 'bg-[#111114] text-white/85 border-white/20 hover:text-white hover:border-white/40'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Your Top Artists Strip (strictly borderless circular portraits) */}
      {(feedLoading && featuredArtists.length === 0) ? (
        <section aria-label="Your Top Artists" className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Your Top Artists
          </h2>
          <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[96px] sm:w-[108px] flex flex-col items-center space-y-2 animate-pulse"
              >
                <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full bg-[#0E0E10]" />
                <div className="h-3 w-16 rounded bg-white/10" />
                <div className="h-2.5 w-12 rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </section>
      ) : featuredArtists.length > 0 ? (
        <section aria-label="Your Top Artists" className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Your Top Artists
          </h2>
          <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {featuredArtists.map((item) => (
              <button
                key={item.artist}
                type="button"
                onClick={() => onOpenArtist(item.artist)}
                className="group shrink-0 w-[96px] sm:w-[108px] flex flex-col items-center text-center active:scale-95 transition-transform"
              >
                <div className="w-[82px] h-[82px] sm:w-[92px] sm:h-[92px] rounded-full overflow-hidden group-hover:scale-105 transition-transform">
                  <ShowcaseArtwork
                    style={item.artwork}
                    coverUrl={item.coverUrl}
                    alt={item.artist}
                    compact={true}
                    className="w-full h-full"
                  />
                </div>
                <span className="mt-2.5 w-full text-[13px] font-extrabold text-white truncate leading-tight group-hover:underline">
                  {item.artist}
                </span>
                <span className="mt-0.5 w-full text-[11px] font-bold text-white/75 truncate leading-tight tabular-nums">
                  {item.subtitle}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Popular Songs */}
      <section aria-label="Popular Songs" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
              {selectedCategory === 'All'
                ? 'Popular Songs'
                : `${selectedCategory} Songs`}
            </h2>
            {selectedCategory !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-extrabold text-white uppercase tracking-wider shrink-0">
                {selectedCategory}
              </span>
            )}
          </div>
          {popularTracks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onOpenShelf) {
                  onOpenShelf({
                    id: 'popular-songs',
                    title:
                      selectedCategory === 'All'
                        ? 'Popular Songs'
                        : `${selectedCategory} Songs`,
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
              className="inline-flex items-center gap-0.5 text-xs font-bold text-white/80 hover:text-white transition-colors shrink-0"
            >
              <span>{onOpenShelf ? 'See all' : showAllSongs ? 'Show carousel' : 'See all'}</span>
              <ChevronRightGlyph className="w-4 h-4" />
            </button>
          )}
        </div>

        {feedLoading ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[148px] sm:w-[168px] space-y-2.5 animate-pulse"
              >
                <div className="w-full aspect-square rounded-2xl bg-[#0E0E10] border border-white/10" />
                <div className="h-3.5 w-4/5 rounded bg-white/[0.1]" />
                <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ) : feedError && popularTracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/15 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-extrabold text-white">
                Could not load live catalog
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{feedError}</p>
            </div>
            {onRetryFeed && (
              <button
                type="button"
                onClick={onRetryFeed}
                className="self-start sm:self-auto px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        ) : popularTracks.length === 0 ? (
          <div className="rounded-3xl bg-[#0E0E10] border border-white/12 p-6 text-center space-y-2">
            <p className="text-xs font-bold text-white/80">
              {isOffline
                ? 'You are offline'
                : 'No live tracks matched this filter'}
            </p>
            <p className="text-xs text-white/50">
              {isOffline
                ? 'Switch to Library → Downloads to listen to your saved tracks.'
                : 'Try another category or retry loading.'}
            </p>
            {!isOffline && onRetryFeed && (
              <button
                type="button"
                onClick={onRetryFeed}
                className="mt-2 px-4 py-1.5 rounded-full bg-white text-black text-xs font-extrabold"
              >
                Retry
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrent) onTogglePlay();
                        else onSelectTrack(track, true);
                      }}
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
                          style={track.artwork}
                          coverUrl={track.coverUrl}
                          alt={track.title}
                          compact={true}
                          className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                        <div
                          className={`absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                            isCurrent
                              ? 'bg-white text-black opacity-100 scale-100'
                              : 'bg-[#111114] text-white border border-white/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100'
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

                    {onOpenTrackInfo && (
                      <button
                        type="button"
                        aria-label={`Track options for ${track.title}`}
                        onClick={() => onOpenTrackInfo(track)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#111114] border border-white/25 text-white hover:border-white/50 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <MoreDotsGlyph className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-start gap-2">
                    <div
                      className={`w-[2.5px] h-8 rounded-full mt-0.5 shrink-0 ${
                        isCurrent ? 'bg-white' : 'bg-white/40'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectTrack(track, true)}
                        className="block max-w-full text-sm font-extrabold text-white truncate leading-tight text-left"
                      >
                        {track.title}
                      </button>
                      <div className="flex items-center gap-1 text-xs font-bold text-white/75 mt-0.5 leading-tight">
                        <button
                          type="button"
                          onClick={() => onOpenArtist(track.artist)}
                          className="hover:text-white hover:underline truncate text-left transition-colors"
                        >
                          {track.artist}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums shrink-0 text-[11px] font-bold text-white/65">
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
        <section aria-label="New Collection" className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            New Collection
          </h2>
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="shrink-0 w-[300px] sm:w-[340px] h-[168px] rounded-3xl bg-[#0E0E10] border border-white/10 animate-pulse"
              />
            ))}
          </div>
        </section>
      ) : collections.length > 0 ? (
        <section aria-label="New Collection" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              New Collection
            </h2>

            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Scroll collections left"
                onClick={() => scrollCollections('left')}
                className="w-8 h-8 rounded-full bg-[#141416] border border-white/15 flex items-center justify-center text-white/75 hover:text-white hover:border-white/35 active:scale-90 transition-all"
              >
                <ChevronLeftGlyph className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Scroll collections right"
                onClick={() => scrollCollections('right')}
                className="w-8 h-8 rounded-full bg-[#141416] border border-white/15 flex items-center justify-center text-white/75 hover:text-white hover:border-white/35 active:scale-90 transition-all"
              >
                <ChevronRightGlyph className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={collectionRowRef}
            className="flex items-center gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory no-scrollbar py-3 px-4 sm:px-6 scroll-px-4 sm:scroll-px-6 rounded-3xl"
          >
            {collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => onOpenCollection(col)}
                className="group relative snap-center shrink-0 w-[86vw] max-w-[340px] sm:w-[340px] md:w-[356px] h-[164px] sm:h-[178px] rounded-3xl p-5 sm:p-6 flex flex-col justify-between overflow-hidden text-left shadow-[0_12px_28px_rgba(0,0,0,0.45)] bg-white text-black hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.98] transition-all duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] will-change-transform"
              >
                <div className="relative z-10 max-w-[60%]">
                  <div className="text-base sm:text-xl font-black leading-[1.08] tracking-tight uppercase">
                    {col.titleLines[0]}
                    <br />
                    {col.titleLines[1]}
                  </div>
                  <div className="text-xs font-medium mt-1.5 text-black/60 truncate">
                    {col.subtitle}
                  </div>
                </div>

                <div className="relative z-10 inline-flex items-center gap-2 text-xs font-bold text-black">
                  <ArrowRightGlyph className="w-5 h-5 transition-transform duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] group-hover:translate-x-1" />
                  <span>Open Collection</span>
                </div>

                <div className="absolute right-3.5 sm:right-4 bottom-3.5 sm:bottom-4 w-[84px] h-[84px] sm:w-[104px] sm:h-[104px] rounded-2xl overflow-hidden shadow-xl border border-black/10 rotate-6 transition-transform duration-300 ease-[cubic-bezier(0.32,1.28,0.36,1)] group-hover:rotate-3 group-hover:scale-105 pointer-events-none">
                  <ShowcaseArtwork
                    style={col.artwork}
                    coverUrl={col.coverUrl}
                    alt={col.titleLines.join(' ')}
                    compact={true}
                    className="w-full h-full"
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* AI Recommendations Shelf (controlled in Settings -> AI & Smart Playback) */}
      {aiRecommendationsEnabled && (
        <section aria-label="AI Recommendations" className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                <AiSparklesGlyph className="w-4 h-4" active={true} />
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
                {aiRecHeadline ?? 'AI Recommendations'}
              </h2>
            </div>

            {onRefreshAiRecommendations && (
              <button
                type="button"
                disabled={isOffline || aiRecLoading}
                onClick={onRefreshAiRecommendations}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141416] border border-white/15 text-xs font-bold text-white/80 hover:text-white hover:border-white/35 disabled:opacity-40 transition-colors shrink-0"
              >
                <RotateGlyph className={`w-3.5 h-3.5 ${aiRecLoading ? 'animate-spin' : ''}`} />
                <span>{aiRecLoading ? 'Curating' : 'Refresh'}</span>
              </button>
            )}
          </div>

          {isOffline ? (
            <div className="rounded-3xl bg-[#0E0E10] border border-white/12 p-5 text-xs text-white/60">
              AI Recommendations pause automatically while your device is offline.
            </div>
          ) : aiRecLoading && aiRecommendations.length === 0 ? (
            <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="shrink-0 w-[160px] sm:w-[180px] rounded-2xl bg-[#0E0E10] border border-white/10 p-3 space-y-2.5 animate-pulse"
                >
                  <div className="w-full aspect-square rounded-xl bg-white/[0.08]" />
                  <div className="h-3.5 w-3/4 rounded bg-white/[0.1]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : aiRecError ? (
            <div className="rounded-3xl bg-[#0E0E10] border border-white/15 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-extrabold text-white">
                  AI Recommendations Unavailable
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{aiRecError}</p>
              </div>
              {onRefreshAiRecommendations && (
                <button
                  type="button"
                  onClick={onRefreshAiRecommendations}
                  className="self-start sm:self-auto px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold hover:bg-white/90 shrink-0"
                >
                  Retry
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
                        className={`relative w-full aspect-square rounded-2xl overflow-hidden border transition-all ${
                          isCurrent
                            ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                            : 'border-white/12 group-hover:border-white/35'
                        }`}
                      >
                        <ShowcaseArtwork
                          style={track.artwork}
                          coverUrl={track.coverUrl}
                          alt={track.title}
                          compact={true}
                          className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#111114] border border-white/25 text-[10px] font-extrabold text-white max-w-[85%] truncate">
                          {rec.vibeTag}
                        </div>
                        <div
                          className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                            isCurrent
                              ? 'bg-white text-black opacity-100 scale-100'
                              : 'bg-[#111114] text-white border border-white/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 scale-100 sm:scale-90 sm:group-hover:scale-100'
                          }`}
                        >
                          {isCurrent && isPlaying ? (
                            <PauseGlyph className="w-3.5 h-3.5" />
                          ) : (
                            <PlayGlyph className="w-3.5 h-3.5 translate-x-[0.5px]" />
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 text-[13px] sm:text-sm font-extrabold text-white leading-snug truncate">
                        {track.title}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArtist(track.artist)}
                      className="mt-0.5 block max-w-full text-[11px] font-bold text-white/75 hover:text-white hover:underline truncate text-left transition-colors"
                    >
                      {track.artist}
                    </button>
                    <p className="mt-1 text-[11px] font-semibold text-white/65 line-clamp-2 leading-snug">
                      {rec.reason}
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
        'For You / Quick Picks',
        forYouCards,
        'down',
        () => setForYouExpanded((e) => !e),
        !forYouExpanded
      )}

      {renderShelf('albums-for-you', 'Albums For You', albumCards, 'right')}

      {renderShelf('trending', 'Trending', trendingCards, 'right')}

      {renderShelf('new-releases', 'New Releases', newReleaseCards, 'right')}

      {trendingCards.length === 0 &&
        newReleaseCards.length === 0 &&
        renderShelf('explore', 'Explore', exploreCards, 'right')}
    </div>
  );
};

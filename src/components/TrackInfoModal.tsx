import React, { useEffect, useState } from 'react';
import {
  CheckGlyph,
  CloseGlyph,
  DiscGlyph,
  DownloadGlyph,
  HeartGlyph,
  PlayGlyph,
  PlusGlyph,
  QueueGlyph,
} from './AppIcons';
import { formatDuration } from '../data/showcaseCatalog';
import { fetchMusicBrainzRecordingInfo } from '../services/artistInfoApi';
import { RecordingMetadataInfo, ShowcaseTrack } from '../types/music';
import { PopupSheet } from './PopupSheet';
import { ShowcaseArtwork } from './ShowcaseArtwork';

interface TrackInfoModalProps {
  track: ShowcaseTrack | null;
  onClose: () => void;
  isFavorite?: boolean;
  isDownloaded?: boolean;
  onPlayFullTrack: (track: ShowcaseTrack) => void;
  onToggleFavorite?: (trackId: string) => void;
  onToggleDownload?: (track: ShowcaseTrack) => void;
  onAddToQueue?: (trackId: string) => void;
  onAddToPlaylist?: (track: ShowcaseTrack) => void;
  onOpenArtist: (artistName: string) => void;
}

export const TrackInfoModal: React.FC<TrackInfoModalProps> = ({
  track,
  onClose,
  isFavorite = false,
  isDownloaded = false,
  onPlayFullTrack,
  onToggleFavorite,
  onToggleDownload,
  onAddToQueue,
  onAddToPlaylist,
  onOpenArtist,
}) => {
  const [info, setInfo] = useState<RecordingMetadataInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!track) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setInfo(null);

    fetchMusicBrainzRecordingInfo(track.title, track.artist)
      .then((res) => {
        if (!cancelled) setInfo(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track]);

  if (!track) return null;

  const formattedReleaseDate = (() => {
    const raw = info?.releaseDate || track.releaseDate;
    if (!raw) return 'Unavailable';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  })();

  const streamLabel = isDownloaded
    ? 'Offline Ready'
    : track.youtubeVideoId || track.streamStatus === 'full'
    ? 'Full Audio'
    : track.streamStatus === 'preview-only'
    ? '30s Preview'
    : 'Full Audio';

  return (
    <PopupSheet
      onClose={onClose}
      ariaLabel={`Song details for ${track.title}`}
      variant="bottom"
      maxWidthClass="max-w-md"
      maxHeightClass="max-h-[86dvh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shrink-0">
            <ShowcaseArtwork
              style={track.artwork}
              coverUrl={track.coverUrl}
              alt={track.title}
              compact={true}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-white truncate">
              {track.title}
            </h2>
            <button
              type="button"
              onClick={() => {
                const a = track.artist;
                onClose();
                onOpenArtist(a);
              }}
              className="block max-w-full text-xs font-semibold text-white/80 hover:text-white hover:underline truncate text-left mt-0.5"
            >
              {track.artist}
            </button>
            <div className="text-[11px] text-white/50 truncate mt-0.5 tabular-nums">
              {formatDuration(track.duration)} · {streamLabel}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close track info"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors"
        >
          <CloseGlyph className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 space-y-4">
        {/* Credits Grid */}
        <div className="rounded-2xl bg-black/70 border border-white/12 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">
              <DiscGlyph className="w-3.5 h-3.5" />
              <span>Track &amp; Artist Credits</span>
            </div>
            <span className="text-[10px] font-medium text-white/40">
              MusicBrainz
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3.5 w-3/4 rounded bg-white/10" />
              <div className="h-3.5 w-1/2 rounded bg-white/[0.07]" />
              <div className="h-3.5 w-2/3 rounded bg-white/[0.06]" />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Release
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {info?.releaseTitle || track.album || 'Single'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Release Date
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5 tabular-nums">
                  {formattedReleaseDate}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Artist Type
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {info?.artistType || 'Not listed'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Country
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {info?.country || 'Not listed'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Active Years
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {info?.activeYears || 'Not listed'}
                  {info?.disambiguation ? ` · ${info.disambiguation}` : ''}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              onPlayFullTrack(track);
              onClose();
            }}
            className="w-full px-4 py-3 rounded-2xl bg-white text-black text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.99] transition-all"
          >
            <PlayGlyph className="w-4 h-4" />
            <span>Play Song</span>
          </button>

          {onAddToPlaylist && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddToPlaylist(track);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-black/75 border border-white/12 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white/80" />
              <span>Add to Playlist</span>
            </button>
          )}

          {onToggleDownload && (
            <button
              type="button"
              onClick={() => {
                onToggleDownload(track);
                onClose();
              }}
              className="w-full px-4 py-3 rounded-2xl bg-black/75 border border-white/12 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              {isDownloaded ? (
                <CheckGlyph className="w-4 h-4 text-white" />
              ) : (
                <DownloadGlyph className="w-4 h-4 text-white/80" />
              )}
              <span>
                {isDownloaded ? 'Remove Download' : 'Download Full Track'}
              </span>
            </button>
          )}

          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => {
                onToggleFavorite(track.id);
                onClose();
              }}
              className="w-full px-4 py-3 rounded-2xl bg-black/75 border border-white/12 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph className="w-4 h-4" active={isFavorite} />
              <span>
                {isFavorite ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              </span>
            </button>
          )}

          {onAddToQueue && (
            <button
              type="button"
              onClick={() => {
                onAddToQueue(track.id);
                onClose();
              }}
              className="w-full px-4 py-3 rounded-2xl bg-black/75 border border-white/12 hover:border-white/30 text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-white/80" />
              <span>Add to Up Next Queue</span>
            </button>
          )}
        </div>
      </div>
    </PopupSheet>
  );
};

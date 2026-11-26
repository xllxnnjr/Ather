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
    if (!raw) return 'unavailable';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw.toLowerCase();
    return d
      .toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
      .toLowerCase();
  })();

  const streamLabel = isDownloaded
    ? 'offline ready'
    : track.streamStatus === 'full'
    ? 'full audio'
    : track.streamStatus === 'preview-only'
    ? '30s preview'
    : 'full audio';

  return (
    <PopupSheet
      onClose={onClose}
      ariaLabel={`song details for ${track.title.toLowerCase()}`}
      variant="bottom"
      maxWidthClass="max-w-md"
      maxHeightClass="max-h-[86dvh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#242429] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#242429] shrink-0">
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
              {track.title.toLowerCase()}
            </h2>
            <button
              type="button"
              onClick={() => {
                const a = track.artist;
                onClose();
                onOpenArtist(a);
              }}
              className="block max-w-full text-xs font-semibold text-[#A1A1AA] hover:text-white hover:underline truncate text-left mt-0.5"
            >
              {track.artist.toLowerCase()}
            </button>
            <div className="text-[11px] text-[#E4E4E7] truncate mt-0.5 tabular-nums font-bold">
              {formatDuration(track.duration)} · {streamLabel}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="close track info"
          onClick={onClose}
          className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
        >
          <CloseGlyph className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 space-y-4">
        {/* Credits Grid */}
        <div className="ather-depth-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-white">
              <DiscGlyph className="w-3.5 h-3.5 text-white" />
              <span>track &amp; artist credits</span>
            </div>
            <span className="text-[10px] font-bold text-[#A1A1AA]">
              musicbrainz
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3.5 w-3/4 rounded bg-[#141418]" />
              <div className="h-3.5 w-1/2 rounded bg-[#141418]" />
              <div className="h-3.5 w-2/3 rounded bg-[#141418]" />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-[#A1A1AA]">
                  release
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {(info?.releaseTitle || track.album || 'single').toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-[#A1A1AA]">
                  release date
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5 tabular-nums">
                  {formattedReleaseDate}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-[#A1A1AA]">
                  artist type
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {(info?.artistType || 'not listed').toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold tracking-wide text-[#A1A1AA]">
                  country
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {(info?.country || 'not listed').toLowerCase()}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-bold tracking-wide text-[#A1A1AA]">
                  active years
                </dt>
                <dd className="text-white font-semibold truncate mt-0.5">
                  {(info?.activeYears || 'not listed').toLowerCase()}
                  {info?.disambiguation ? ` · ${info.disambiguation.toLowerCase()}` : ''}
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
            className="ather-acid-btn w-full px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
          >
            <PlayGlyph className="w-4 h-4" />
            <span>play song</span>
          </button>

          {onAddToPlaylist && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddToPlaylist(track);
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <PlusGlyph className="w-4 h-4 text-white" />
              <span>add to playlist</span>
            </button>
          )}

          {onToggleDownload && (
            <button
              type="button"
              onClick={() => {
                onToggleDownload(track);
                onClose();
              }}
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              {isDownloaded ? (
                <CheckGlyph className="w-4 h-4 text-white" />
              ) : (
                <DownloadGlyph className="w-4 h-4 text-[#A1A1AA]" />
              )}
              <span>
                {isDownloaded ? 'remove download' : 'download full track'}
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
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <HeartGlyph className="w-4 h-4 text-white" active={isFavorite} />
              <span>
                {isFavorite ? 'remove from liked songs' : 'add to liked songs'}
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
              className="ather-depth-row w-full px-4 py-3 rounded-2xl text-left text-xs font-bold text-white flex items-center gap-3 transition-colors"
            >
              <QueueGlyph className="w-4 h-4 text-[#A1A1AA]" />
              <span>add to up next queue</span>
            </button>
          )}
        </div>
      </div>
    </PopupSheet>
  );
};

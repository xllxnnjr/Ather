import React from 'react';
import { ArtworkStyle } from '../types/music';

interface ShowcaseArtworkProps {
  style?: ArtworkStyle;
  coverUrl?: string;
  alt?: string;
  preferGradientFallback?: boolean;
  className?: string;
  compact?: boolean;
}

const GRADIENT_THEMES: Record<ArtworkStyle, string> = {
  'lime-noir':
    'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.12) 0%, transparent 50%), linear-gradient(145deg, #222226 0%, #121215 58%, #060608 100%)',
  'obsidian-grid':
    'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.1) 0%, transparent 48%), linear-gradient(145deg, #1E1F23 0%, #0E0E11 60%, #050507 100%)',
  'amber-glow':
    'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.11) 0%, transparent 52%), linear-gradient(145deg, #242427 0%, #141416 60%, #070709 100%)',
  'slate-pulse':
    'radial-gradient(circle at 70% 20%, rgba(255,255,255,0.12) 0%, transparent 48%), linear-gradient(145deg, #202227 0%, #111215 60%, #060708 100%)',
  'violet-haze':
    'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 48%), linear-gradient(145deg, #212025 0%, #121115 60%, #070709 100%)',
  'emerald-dark':
    'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.11) 0%, transparent 50%), linear-gradient(145deg, #1D1E20 0%, #101012 60%, #060607 100%)',
  'carbon-ring':
    'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.12) 0%, transparent 52%), linear-gradient(145deg, #242428 0%, #121214 60%, #060607 100%)',
  'monolith-lime':
    'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.13) 0%, transparent 50%), linear-gradient(145deg, #1E1E20 0%, #101012 60%, #050506 100%)',
};

export const ShowcaseArtwork: React.FC<ShowcaseArtworkProps> = ({
  style = 'lime-noir',
  coverUrl,
  alt = '',
  className = '',
  compact = false,
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [coverUrl]);

  if (coverUrl && !imgFailed) {
    return (
      <div
        className={`relative overflow-hidden select-none bg-[#141418] ${className}`}
      >
        <img
          src={coverUrl}
          alt={alt.toLowerCase()}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden select-none flex items-center justify-center ${className}`}
      style={{
        background: GRADIENT_THEMES[style] ?? GRADIENT_THEMES['lime-noir'],
      }}
    >
      <div
        className={`rounded-full border border-[#242429] bg-[#141418] flex items-center justify-center ${
          compact ? 'w-7 h-7' : 'w-16 h-16'
        }`}
      >
        <div
          className={`rounded-full border border-black bg-white ${
            compact ? 'w-2.5 h-2.5' : 'w-5 h-5'
          }`}
        />
      </div>
    </div>
  );
};

interface PlaylistCoverProps {
  coverImageUrl?: string;
  coverArtwork?: ArtworkStyle;
  fallbackArtwork?: ArtworkStyle;
  fallbackCoverUrl?: string;
  alt: string;
  compact?: boolean;
  className?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  coverImageUrl,
  coverArtwork,
  fallbackArtwork = 'lime-noir',
  fallbackCoverUrl,
  alt,
  compact = false,
  className = '',
}) => {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [coverImageUrl]);

  if (coverImageUrl && !failed) {
    return (
      <div className={`relative overflow-hidden bg-[#141418] ${className}`}>
        <img
          src={coverImageUrl}
          alt={alt.toLowerCase()}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-center"
        />
      </div>
    );
  }
  return (
    <ShowcaseArtwork
      style={coverArtwork ?? fallbackArtwork}
      coverUrl={!coverArtwork ? fallbackCoverUrl : undefined}
      alt={alt}
      compact={compact}
      className={className}
    />
  );
};

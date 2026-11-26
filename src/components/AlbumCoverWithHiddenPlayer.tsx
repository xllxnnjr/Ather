import React from 'react';
import { ArtworkStyle } from '../types/music';
import { ShowcaseArtwork } from './ShowcaseArtwork';

interface AlbumCoverWithHiddenPlayerProps {
  style?: ArtworkStyle;
  coverUrl?: string;
  alt?: string;
  compact?: boolean;
  isActive?: boolean;
  className?: string;
}

export const AlbumCoverWithHiddenPlayer: React.FC<
  AlbumCoverWithHiddenPlayerProps
> = ({
  style = 'lime-noir',
  coverUrl,
  alt = '',
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-black select-none ${className}`}
    >
      <div className="relative z-10 w-full h-full pointer-events-none">
        <ShowcaseArtwork
          style={style}
          coverUrl={coverUrl}
          alt={alt}
          compact={compact}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

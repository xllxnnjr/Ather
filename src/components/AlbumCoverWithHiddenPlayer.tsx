import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
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
  isActive = false,
  className = '',
}) => {
  const coverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = coverRef.current;
    if (!isActive || !el) {
      audioEngine.detachCoverContainer(el);
      return;
    }

    audioEngine.attachToCoverContainer(el);

    const onScrollOrResize = () => audioEngine.attachToCoverContainer(el);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    // Re-sync after modal slide-up transform settles (~420ms)
    const settleTimer = window.setTimeout(onScrollOrResize, 420);

    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      audioEngine.detachCoverContainer(el);
    };
  }, [isActive]);

  return (
    <div
      ref={coverRef}
      className={`relative overflow-hidden bg-[#000000] select-none ${className}`}
    >
      {/* z-10 pointer-events-none album artwork rendered directly above aligned z-0 YT host */}
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

import React, { useEffect, useState } from 'react';
import {
  ArtistStreamStat,
  STATS_UPDATED_EVENT,
  getTop10StreamedArtists,
  loadLocalActivityStats,
  syncActivityStatsFromCloud,
} from '../services/listeningStats';

interface TopStreamedArtistsProps {
  uid?: string | null;
  onSelectArtist: (artistName: string) => void;
}

export const TopStreamedArtistsSection: React.FC<TopStreamedArtistsProps> = ({
  uid,
  onSelectArtist,
}) => {
  const [topArtists, setTopArtists] = useState<ArtistStreamStat[]>(() =>
    getTop10StreamedArtists(loadLocalActivityStats())
  );

  useEffect(() => {
    let active = true;

    const refreshLocal = () => {
      if (active) {
        setTopArtists(getTop10StreamedArtists(loadLocalActivityStats()));
      }
    };

    window.addEventListener(STATS_UPDATED_EVENT, refreshLocal);

    if (uid) {
      syncActivityStatsFromCloud(uid)
        .then((merged) => {
          if (active) setTopArtists(getTop10StreamedArtists(merged));
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
      window.removeEventListener(STATS_UPDATED_EVENT, refreshLocal);
    };
  }, [uid]);

  if (topArtists.length === 0) {
    return (
      <section className="ather-depth-card rounded-2xl p-5">
        <h3 className="text-base font-extrabold tracking-tight text-white">
          top 10 artists
        </h3>
        <p className="mt-1.5 text-xs font-bold text-[#A1A1AA]">
          start streaming music to build your live top 10 most streamed artists.
        </p>
      </section>
    );
  }

  return (
    <section className="ather-depth-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-extrabold tracking-tight text-white">
          top 10 artists
        </h3>
        <span className="text-[11px] font-extrabold tracking-wide text-[#E4E4E7]">
          most streamed
        </span>
      </div>

      <div className="flex flex-col space-y-1.5">
        {topArtists.map((artist, index) => (
          <button
            key={artist.artistKey}
            type="button"
            onClick={() => onSelectArtist(artist.name)}
            style={{
              transition:
                'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease',
            }}
            className="ather-depth-row flex items-center gap-3.5 py-2.5 text-left rounded-2xl px-3 active:scale-[0.98]"
          >
            {/* Rank Number */}
            <span
              className={`w-5 text-center text-xs font-extrabold tabular-nums ${
                index < 3 ? 'text-white' : 'text-[#A1A1AA]'
              }`}
            >
              {index + 1}
            </span>

            {/* Artist Portrait */}
            {artist.image ? (
              <img
                src={artist.image}
                alt={artist.name.toLowerCase()}
                referrerPolicy="no-referrer"
                className="h-11 w-11 shrink-0 rounded-full object-cover border border-[#242429]"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#141418] border border-[#242429] text-sm font-extrabold text-white">
                {artist.name.charAt(0).toLowerCase()}
              </div>
            )}

            {/* Artist Name & Stream Tally */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-white">
                {artist.name.toLowerCase()}
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#A1A1AA] tabular-nums">
                {artist.playCount}{' '}
                {artist.playCount === 1 ? 'stream' : 'streams'} •{' '}
                {Math.round(artist.totalMinutes)} min
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

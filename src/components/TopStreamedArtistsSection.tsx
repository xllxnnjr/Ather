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
      <section className="rounded-2xl border border-white/20 bg-[#111114] p-5">
        <h3 className="text-base font-extrabold tracking-tight text-white">
          Top 10 Artists
        </h3>
        <p className="mt-1.5 text-xs font-bold text-white/75">
          Start streaming music to build your live Top 10 most streamed artists.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/20 bg-[#111114] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-extrabold tracking-tight text-white">
          Top 10 Artists
        </h3>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/70">
          Most Streamed
        </span>
      </div>

      <div className="flex flex-col divide-y divide-white/10">
        {topArtists.map((artist, index) => (
          <button
            key={artist.artistKey}
            type="button"
            onClick={() => onSelectArtist(artist.name)}
            style={{
              transition:
                'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease',
            }}
            className="flex items-center gap-3.5 py-2.5 text-left hover:bg-white/[0.05] rounded-xl px-1.5 -mx-1.5 active:scale-[0.98]"
          >
            {/* Spotify-style Rank Number */}
            <span className="w-5 text-center text-xs font-extrabold tabular-nums text-white/75">
              {index + 1}
            </span>

            {/* Strictly Borderless Circular Artist Portrait */}
            {artist.image ? (
              <img
                src={artist.image}
                alt={artist.name}
                referrerPolicy="no-referrer"
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-extrabold text-white">
                {artist.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Artist Name & Stream Tally */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-white">
                {artist.name}
              </p>
              <p className="mt-0.5 text-xs font-bold text-white/75 tabular-nums">
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

import React from 'react';

export interface AppIconProps {
  className?: string;
  active?: boolean;
}

export const PlayGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M7.6 5.25c0-.85.92-1.38 1.65-.95l10.2 6.02c.72.43.72 1.48 0 1.9l-10.2 6.03c-.73.43-1.65-.1-1.65-.95V5.25Z"
      fill="currentColor"
    />
  </svg>
);

export const PauseGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.6" fill="currentColor" />
  </svg>
);

export const NextGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M5.5 6.1c0-.82.9-1.32 1.6-.88l8.1 5.1c.64.4.64 1.35 0 1.76l-8.1 5.1c-.7.44-1.6-.06-1.6-.88V6.1Z"
      fill="currentColor"
    />
    <rect x="17" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
  </svg>
);

export const PrevGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4.8" y="5.5" width="2.2" height="13" rx="1.1" fill="currentColor" />
    <path
      d="M18.5 6.1c0-.82-.9-1.32-1.6-.88l-8.1 5.1c-.64.4-.64 1.35 0 1.76l8.1 5.1c.7.44 1.6-.06 1.6-.88V6.1Z"
      fill="currentColor"
    />
  </svg>
);

export const ShuffleGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M16.5 4.75 19.75 8 16.5 11.25"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.5 12.75 19.75 16 16.5 19.25"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.25 16h3.4c1.3 0 2.5-.65 3.22-1.74l2.76-4.52A3.85 3.85 0 0 1 16.85 8h2.65"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M4.25 8h3.4c1.1 0 2.13.48 2.84 1.31M13.63 14.26A3.85 3.85 0 0 0 16.85 16h2.65"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);

export const RepeatGlyph: React.FC<AppIconProps & { one?: boolean }> = ({
  className = 'w-5 h-5',
  one = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M16.75 4.25 19.75 7.25 16.75 10.25"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.5 11.75V9.5A2.25 2.25 0 0 1 6.75 7.25H19.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M7.25 19.75 4.25 16.75 7.25 13.75"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.5 12.25v2.25a2.25 2.25 0 0 1-2.25 2.25H4.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    {one && (
      <path
        d="M12 9.5v5m0-5-1.35.95"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

export const HeartGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 20.15s-7.45-4.42-8.82-9.22c-.92-3.22 1.25-6.43 4.5-6.66 1.8-.13 3.45.77 4.32 2.13.87-1.36 2.52-2.26 4.32-2.13 3.25.23 5.42 3.44 4.5 6.66-1.37 4.8-8.82 9.22-8.82 9.22Z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
  </svg>
);

export const DevicesGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.75"
      y="4.5"
      width="10.5"
      height="15"
      rx="2.5"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.18 : 0}
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <circle cx="9" cy="13.75" r="2.35" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="8.25" r="1.05" fill="currentColor" />
    <path
      d="M17.2 8.75a4.6 4.6 0 0 1 0 6.5M19.8 6.4a7.8 7.8 0 0 1 0 11.2"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

export const LyricsGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="4"
      y="4.25"
      width="16"
      height="15.5"
      rx="3.75"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.14 : 0}
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path
      d="M8.25 9.5h7.5M8.25 13h5.5M8.25 16.25h3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const QueueGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.5 6.75h11.5M4.5 11.5h15M4.5 16.25h9.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="m16.75 14.3 3.25 1.95-3.25 1.95v-3.9Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const DownloadGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 4.5v10.25m0 0-3.75-3.75M12 14.75l3.75-3.75"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.75 16.25v1.5A2.25 2.25 0 0 0 7 20h10a2.25 2.25 0 0 0 2.25-2.25v-1.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);

export const CheckGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m5.25 12.6 4.4 4.4 9.1-9.6"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MoreDotsGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="5.75" r="1.65" fill="currentColor" />
    <circle cx="12" cy="12" r="1.65" fill="currentColor" />
    <circle cx="12" cy="18.25" r="1.65" fill="currentColor" />
  </svg>
);

export const PlusGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 5.25v13.5M5.25 12h13.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const CloseGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m6.5 6.5 11 11m0-11-11 11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const ChevronLeftGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m14.75 5.75-6.25 6.25 6.25 6.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronRightGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m9.25 5.75 6.25 6.25-6.25 6.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronDownGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m5.75 9.25 6.25 6.25 6.25-6.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronUpGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m5.75 14.75 6.25-6.25 6.25 6.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowRightGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.75 12h14.5m0 0-5.25-5.25M19.25 12 14 17.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowUpGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 19V5m0 0-5 5m5-5 5 5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowDownGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 5v14m0 0-5-5m5 5 5-5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const RotateGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.5 9.25V4.75m0 4.5h4.5M5.2 9.1A7.5 7.5 0 1 1 6.7 17.3"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TrashGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.75 7.25h14.5M9.5 4.25h5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <path
      d="M6.75 7.25v10.5A2.25 2.25 0 0 0 9 20h6a2.25 2.25 0 0 0 2.25-2.25V7.25"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path
      d="M10.25 11v5M13.75 11v5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const EditPenGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m14.8 5.2 4 4L9.2 18.8l-4.7.7.7-4.7L14.8 5.2Z"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path d="m12.8 7.2 4 4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const CameraGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 8.75A2.5 2.5 0 0 1 6.5 6.25h1.65l1.2-1.75h5.3l1.2 1.75h1.65A2.5 2.5 0 0 1 20 8.75v8.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.25v-8.5Z"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12.75" r="3.25" stroke="currentColor" strokeWidth="1.85" />
  </svg>
);

export const ImagePlusGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.75"
      y="4.5"
      width="16.5"
      height="15"
      rx="3.25"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <circle cx="8.75" cy="9.75" r="1.45" fill="currentColor" />
    <path
      d="m5.75 17 4.2-4.2 3.1 3.1 2.2-2.2 3 3.3"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlaylistsGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.5 6.75h11M4.5 11.25h11M4.5 15.75h6.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <circle cx="15.5" cy="16.75" r="2.25" fill="currentColor" />
    <path
      d="M17.75 16.75v-6.5l2.5-.6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ActivityGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.75 12h3.1l2.2-5.5 3.6 11 2.4-6.5 1.85 1h3.35"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ClockGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.85" />
    <path
      d="M12 7.75v4.5l3 1.75"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DiscGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="8.25"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const UserGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="8.25" r="3.5" stroke="currentColor" strokeWidth="1.85" />
    <path
      d="M5.25 19.25c1.1-3.35 3.6-5 6.75-5s5.65 1.65 6.75 5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

export const WifiAudioGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.2 9.3a11.3 11.3 0 0 1 15.6 0M7.4 12.6a6.8 6.8 0 0 1 9.2 0M10.5 15.8a2.3 2.3 0 0 1 3 0"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <circle cx="12" cy="18.25" r="1.25" fill="currentColor" />
  </svg>
);

export const EqSlidersGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.5 4.75v14.5M12 4.75v14.5M17.5 4.75v14.5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <circle cx="6.5" cy="9" r="2.1" fill="currentColor" />
    <circle cx="12" cy="14.5" r="2.1" fill="currentColor" />
    <circle cx="17.5" cy="8.5" r="2.1" fill="currentColor" />
  </svg>
);

export const ReelsFilmGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.75"
      y="3.75"
      width="16.5"
      height="16.5"
      rx="4.75"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path
      d="M4 8.25h16M8.75 3.9l1.75 4.35M14.25 3.9L16 8.25"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
    <path
      d="M10.35 11.7a.55.55 0 0 1 .83-.47l3.7 2.15a.55.55 0 0 1 0 .95l-3.7 2.15a.55.55 0 0 1-.83-.48V11.7Z"
      fill="currentColor"
    />
  </svg>
);

export const HapticsSparkGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    <circle
      cx="12"
      cy="12"
      r="7.75"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeDasharray="3.2 2.8"
      strokeLinecap="round"
    />
  </svg>
);

export const StorageDriveGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.75"
      y="5.5"
      width="16.5"
      height="13"
      rx="3.25"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path d="M4 13.25h16" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="16.25" cy="16" r="1.1" fill="currentColor" />
  </svg>
);

export const GlobeGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.85" />
    <ellipse cx="12" cy="12" rx="3.75" ry="8.25" stroke="currentColor" strokeWidth="1.65" />
    <path d="M4.25 12h15.5" stroke="currentColor" strokeWidth="1.65" />
  </svg>
);

export const ExplicitShieldGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="4.25"
      y="4.25"
      width="15.5"
      height="15.5"
      rx="4"
      fill="currentColor"
      fillOpacity="0.14"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path
      d="M9.5 8.5h5M9.5 12h4.2M9.5 15.5h5M9.5 8.5v7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const BellGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.25 15.75V10.5a5.75 5.75 0 1 1 11.5 0v5.25l1.5 1.75H4.75l1.5-1.75Z"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path
      d="M9.75 19.5a2.35 2.35 0 0 0 4.5 0"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

export const HelpGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.85" />
    <path
      d="M9.75 9.5a2.35 2.35 0 0 1 4.55.75c0 1.5-2.3 2-2.3 3.25"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16.6" r="1.05" fill="currentColor" />
  </svg>
);

export const DocumentGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M6.5 4.25h7.25L18.25 8.75V18A2.25 2.25 0 0 1 16 20.25H6.5A2.25 2.25 0 0 1 4.25 18V6.5A2.25 2.25 0 0 1 6.5 4.25Z"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 12.25h7M8.5 15.75h5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const SpeakerVolumeGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.75 10h3.3l4.7-3.75v11.5L8.05 14h-3.3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
      fill="currentColor"
      fillOpacity="0.16"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path
      d="M16.25 9.25a4.2 4.2 0 0 1 0 5.5M18.75 7a7.5 7.5 0 0 1 0 10"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

export const RadioStreamGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="2.25" fill="currentColor" />
    <path
      d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.75 5.75a9 9 0 0 0 0 12.5M18.25 5.75a9 9 0 0 1 0 12.5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

export const LogoutGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M14.5 5.25H7.25A2.25 2.25 0 0 0 5 7.5v9a2.25 2.25 0 0 0 2.25 2.25h7.25"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M11 12h8.5m0 0-3-3m3 3-3 3"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SearchInputGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle
      cx="10.75"
      cy="10.75"
      r="6.5"
      fill="currentColor"
      fillOpacity="0.1"
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path
      d="m15.65 15.65 4.25 4.25"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const MusicRecognitionGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    {active && (
      <circle
        cx="12"
        cy="12"
        r="10.25"
        fill="currentColor"
        fillOpacity="0.14"
      />
    )}
    {/* Upper interlocking S-link arc (Ather Shazam-style emblem) */}
    <path
      d="M14.35 12.65 16.95 10.05a3.75 3.75 0 0 0-5.3-5.3L8.35 8.05a3.75 3.75 0 0 0 0 5.3"
      stroke="currentColor"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Lower interlocking S-link arc */}
    <path
      d="M9.65 11.35 7.05 13.95a3.75 3.75 0 0 0 5.3 5.3l3.3-3.3a3.75 3.75 0 0 0 0-5.3"
      stroke="currentColor"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WifiOffGlyph: React.FC<AppIconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.75 3.75 20.25 20.25"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
    />
    <path
      d="M8.7 8.7A10.9 10.9 0 0 1 20 10.35M4 10.35a11.3 11.3 0 0 1 2.2-1.6M7.25 13.5a6.8 6.8 0 0 1 2.75-1.42M14.65 12.25c.82.3 1.56.73 2.15 1.25M10.45 16.65a2.35 2.35 0 0 1 3.1 0"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <circle cx="12" cy="19.1" r="1.2" fill="currentColor" />
  </svg>
);

export const WifiOnGlyph: React.FC<AppIconProps> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4.2 10.25a11.1 11.1 0 0 1 15.6 0M7.45 13.4a6.65 6.65 0 0 1 9.1 0M10.55 16.5a2.2 2.2 0 0 1 2.9 0"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
    />
    <circle cx="12" cy="19.1" r="1.2" fill="currentColor" />
  </svg>
);

export const CardSwitcherGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="5"
      y="6.75"
      width="10.5"
      height="13"
      rx="2.6"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.18 : 0}
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <path
      d="M9.5 6.5V5.9A2.15 2.15 0 0 1 11.65 3.75h5.2A2.15 2.15 0 0 1 19 5.9v9.95A2.15 2.15 0 0 1 16.85 18h-1.1"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MoreHorizontalGlyph: React.FC<AppIconProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="5.75" cy="12" r="1.65" fill="currentColor" />
    <circle cx="12" cy="12" r="1.65" fill="currentColor" />
    <circle cx="18.25" cy="12" r="1.65" fill="currentColor" />
  </svg>
);

export const AiSparklesGlyph: React.FC<AppIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M11.25 3.75 13 8.5l4.75 1.75L13 12l-1.75 4.75L9.5 12 4.75 10.25 9.5 8.5l1.75-4.75Z"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.22 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="m18.25 14.5.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75.75-2Z"
      fill="currentColor"
    />
  </svg>
);

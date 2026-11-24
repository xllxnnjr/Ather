import React from 'react';

export interface NavIconProps {
  className?: string;
  active?: boolean;
}

export const HomeNavIcon: React.FC<NavIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {active ? (
      <>
        <path
          d="M11.1 3.1a1.5 1.5 0 0 1 1.8 0l7 5.25A1.5 1.5 0 0 1 20.5 9.55V19a2.5 2.5 0 0 1-2.5 2.5h-3.25a.75.75 0 0 1-.75-.75v-5.25a2 2 0 1 0-4 0v5.25a.75.75 0 0 1-.75.75H6A2.5 2.5 0 0 1 3.5 19V9.55a1.5 1.5 0 0 1 .6-1.2l7-5.25Z"
          fill="currentColor"
        />
      </>
    ) : (
      <>
        <path
          d="M4 9.65a1.5 1.5 0 0 1 .58-1.18l6.5-5.05a1.5 1.5 0 0 1 1.84 0l6.5 5.05A1.5 1.5 0 0 1 20 9.65V18.5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5V9.65Z"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path
          d="M9.75 21v-5.25a2.25 2.25 0 0 1 4.5 0V21"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
      </>
    )}
  </svg>
);

export const SearchNavIcon: React.FC<NavIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="10.75"
      cy="10.75"
      r="6.75"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.14 : 0}
      stroke="currentColor"
      strokeWidth={active ? '2.25' : '1.85'}
    />
    <path
      d="M8.1 8.4a3.9 3.9 0 0 1 3.2-1.45"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      opacity={active ? 0.9 : 0.65}
    />
    <path
      d="m15.8 15.8 4.45 4.45"
      stroke="currentColor"
      strokeWidth={active ? '2.4' : '1.95'}
      strokeLinecap="round"
    />
  </svg>
);

export const ReelsNavIcon: React.FC<NavIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {active ? (
      <>
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="5"
          fill="currentColor"
        />
        <path
          d="M3.8 8.2h16.4M9 3.6l1.8 4.6M14.5 3.6l1.8 4.6"
          stroke="#FFFFFF"
          strokeWidth="1.65"
          strokeLinecap="round"
        />
        <path
          d="M10.4 11.45a.65.65 0 0 1 .98-.56l4.2 2.45a.65.65 0 0 1 0 1.12l-4.2 2.45a.65.65 0 0 1-.98-.56v-4.9Z"
          fill="#FFFFFF"
        />
      </>
    ) : (
      <>
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
      </>
    )}
  </svg>
);

export const LibraryNavIcon: React.FC<NavIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M7 4.25h10"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      opacity={active ? 0.9 : 0.7}
    />
    <path
      d="M5.25 7.25h13.5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      opacity={active ? 0.95 : 0.85}
    />
    {active ? (
      <>
        <rect
          x="3.75"
          y="10.25"
          width="16.5"
          height="10.25"
          rx="3"
          fill="currentColor"
        />
        <path
          d="M10.5 17.5a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7Z"
          fill="#FFFFFF"
        />
        <path
          d="M11.85 16.15v-3.5l3.15-.7v2.95"
          stroke="#FFFFFF"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ) : (
      <>
        <rect
          x="3.75"
          y="10.25"
          width="16.5"
          height="10.25"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.85"
        />
        <circle cx="10.25" cy="16.4" r="1.25" fill="currentColor" />
        <path
          d="M11.5 16.4v-3.4l3-.65v2.7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
  </svg>
);

export const ProfileNavIcon: React.FC<NavIconProps> = ({
  className = 'w-5 h-5',
  active = false,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="8.75"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.85"
    />
    <circle
      cx="12"
      cy="9.4"
      r="2.6"
      fill={active ? '#FFFFFF' : 'currentColor'}
    />
    <path
      d="M7.25 18.2c.8-2.3 2.55-3.45 4.75-3.45s3.95 1.15 4.75 3.45"
      stroke={active ? '#FFFFFF' : 'currentColor'}
      strokeWidth="1.85"
      strokeLinecap="round"
    />
  </svg>
);

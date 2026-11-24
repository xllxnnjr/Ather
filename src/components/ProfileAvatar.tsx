import React from 'react';

export type AvatarPreset =
  | 'silhouette'
  | 'studio'
  | 'initials'
  | 'monolith'
  | 'vinyl'
  | 'wave'
  | 'boombox'
  | 'cassette'
  | 'synth'
  | 'crown'
  | 'bolt'
  | 'helmet'
  | 'panther';

export const AVATAR_PRESETS: { id: AvatarPreset; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'wave', label: 'Wave' },
  { id: 'boombox', label: 'Boombox' },
  { id: 'cassette', label: 'Cassette' },
  { id: 'synth', label: 'Synth' },
  { id: 'crown', label: 'Crown' },
  { id: 'bolt', label: 'Bolt' },
  { id: 'helmet', label: 'Helmet' },
  { id: 'panther', label: 'Panther' },
];

interface ProfileAvatarProps {
  displayName: string;
  imageUrl?: string | null;
  preset?: AvatarPreset;
  className?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  displayName,
  imageUrl,
  preset = 'studio',
  className = 'w-9 h-9',
}) => {
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'AT';

  if (imageUrl) {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#1C1C1F] ${className}`}>
        <img
          src={imageUrl}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (preset === 'initials') {
    return (
      <div
        className={`relative overflow-hidden rounded-full bg-white text-black font-black flex items-center justify-center select-none ${className}`}
      >
        <span className="text-[42%] leading-none tracking-tight">{initials}</span>
      </div>
    );
  }

  if (preset === 'monolith') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141416] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="avatar-mono-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>
          </defs>
          <rect width="36" height="36" fill="url(#avatar-mono-grad)" />
          <polygon points="18,6 28,28 8,28" fill="#F4F4F5" opacity="0.92" />
          <polygon points="18,13 23,28 13,28" fill="#18181B" />
        </svg>
      </div>
    );
  }

  if (preset === 'vinyl') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-black ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#000000" />
          <circle cx="18" cy="18" r="14" fill="#141416" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="1" />
          <circle cx="18" cy="18" r="10" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="0.8" />
          <circle cx="18" cy="18" r="5" fill="#FFFFFF" />
          <circle cx="18" cy="18" r="1.6" fill="#000000" />
        </svg>
      </div>
    );
  }

  if (preset === 'wave') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#18181B] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#000000" />
          <rect x="7" y="14" width="2.8" height="8" rx="1.4" fill="#E4E4E7" />
          <rect x="12" y="10" width="2.8" height="16" rx="1.4" fill="#FFFFFF" />
          <rect x="17" y="7" width="2.8" height="22" rx="1.4" fill="#FFFFFF" />
          <rect x="22" y="11" width="2.8" height="14" rx="1.4" fill="#D4D4D8" />
          <rect x="27" y="15" width="2.8" height="6" rx="1.4" fill="#9A9AA6" />
        </svg>
      </div>
    );
  }

  if (preset === 'boombox') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141416] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#121218" />
          <path d="M12 13V10.5H24V13" stroke="#9A9AA6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <rect x="6" y="13" width="24" height="14" rx="3" fill="#23232D" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1" />
          <circle cx="12" cy="20" r="3.6" fill="#000000" stroke="#FFFFFF" strokeWidth="1.2" />
          <circle cx="24" cy="20" r="3.6" fill="#000000" stroke="#FFFFFF" strokeWidth="1.2" />
          <rect x="16.5" y="16" width="3" height="2" rx="0.5" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  if (preset === 'cassette') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141416] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#101218" />
          <rect x="6.5" y="11" width="23" height="14" rx="2.5" fill="#1F222D" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1" />
          <rect x="9" y="13" width="18" height="4" rx="1" fill="#FFFFFF" />
          <circle cx="13" cy="20" r="2.2" fill="#000000" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="23" cy="20" r="2.2" fill="#000000" stroke="#FFFFFF" strokeWidth="1" />
          <rect x="15.5" y="19" width="5" height="2" rx="0.5" fill="#9A9AA6" />
        </svg>
      </div>
    );
  }

  if (preset === 'synth') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141418] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#12121A" />
          <path d="M5 20 Q 10 10, 15 20 T 25 20 T 33 16" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M5 23 Q 11 16, 17 23 T 31 20" fill="none" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (preset === 'crown') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141416] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#14131A" />
          <path d="M8 25L7 13L13.5 18L18 10L22.5 18L29 13L28 25H8Z" fill="#FFFFFF" />
          <rect x="8.5" y="26.5" width="19" height="2.2" rx="1" fill="#A1A1AA" />
        </svg>
      </div>
    );
  }

  if (preset === 'bolt') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#14141A] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="avatar-bolt-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#27272A" />
              <stop offset="100%" stopColor="#09090B" />
            </linearGradient>
          </defs>
          <rect width="36" height="36" fill="url(#avatar-bolt-bg)" />
          <polygon points="20,6 10,20 17,20 15,30 26,16 19,16" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  if (preset === 'helmet') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#141416] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#131318" />
          <path d="M9 21C9 14.5 13 10 18 10C23 10 27 14.5 27 21V24H23.5V19C23.5 16 21 13.8 18 13.8C15 13.8 12.5 16 12.5 19V24H9V21Z" fill="#FFFFFF" />
          <rect x="7.5" y="18" width="4" height="7" rx="2" fill="#D4D4D8" />
          <rect x="24.5" y="18" width="4" height="7" rx="2" fill="#D4D4D8" />
        </svg>
      </div>
    );
  }

  if (preset === 'panther') {
    return (
      <div className={`relative overflow-hidden rounded-full bg-[#000000] ${className}`}>
        <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
          <rect width="36" height="36" fill="#000000" />
          <polygon points="10,11 14,15 22,15 26,11 27,21 18,28 9,21" fill="#1E1E26" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="1" />
          <polygon points="12.5,18 16,19.5 13,20.5" fill="#FFFFFF" />
          <polygon points="23.5,18 20,19.5 23,20.5" fill="#FFFFFF" />
          <polygon points="16.8,23 19.2,23 18,25" fill="#9A9AA6" />
        </svg>
      </div>
    );
  }

  // Default: 'studio' or legacy 'silhouette'
  return (
    <div className={`relative overflow-hidden rounded-full bg-[#1C1C1F] ${className}`}>
      <svg viewBox="0 0 36 36" className="w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="profile-avatar-bg" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#F4F4F5" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" fill="url(#profile-avatar-bg)" />
        <circle cx="18" cy="13" r="5.2" fill="#000000" />
        <path
          d="M7.5 34.5C8.5 26.2 13 22 18 22C23 22 27.5 26.2 28.5 34.5Z"
          fill="#141416"
        />
      </svg>
    </div>
  );
};

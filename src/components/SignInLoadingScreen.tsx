import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AccountProvider } from '../services/accountStorage';
import { AtherLogoMark } from './AtherLogoMark';
import { AvatarPreset, ProfileAvatar } from './ProfileAvatar';

interface SignInLoadingScreenProps {
  provider: AccountProvider;
  displayName?: string;
  email?: string;
  profileImageUrl?: string | null;
  avatarPreset?: AvatarPreset;
  stage?: 'signing-in' | 'syncing';
}

export const SignInLoadingScreen: React.FC<SignInLoadingScreenProps> = ({
  provider,
  displayName,
  email,
  profileImageUrl = null,
  avatarPreset = 'studio',
  stage = 'signing-in',
}) => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 360);
    return () => window.clearInterval(timer);
  }, []);

  const providerLabel =
    provider === 'google'
      ? 'Google Account'
      : provider === 'apple'
      ? 'Apple Account'
      : provider === 'email'
      ? 'Email Account'
      : 'Guest Session';

  const headline =
    stage === 'syncing'
      ? 'Syncing your ATHER data'
      : 'Signing you in';

  const subtitle =
    stage === 'syncing'
      ? 'Restoring playlists, likes, settings & devices across devices'
      : provider === 'google'
      ? `Connecting ${email || displayName || providerLabel}`
      : `Preparing ${displayName || providerLabel}`;

  const dots = '.'.repeat(dotCount);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${headline}`}
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col items-center justify-between overflow-y-auto no-scrollbar select-none pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      {/* Monochrome Top Horizon Glow */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 h-[45dvh] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% 18%, rgba(255,255,255,0.09) 0%, rgba(0,0,0,0) 75%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Top Brand Wordmark */}
      <div className="relative z-10 flex items-center gap-2.5 pt-2 shrink-0">
        <AtherLogoMark className="w-7 h-7 rounded-lg border border-white/15" />
        <span className="text-sm font-black tracking-[0.22em] text-white/90 uppercase">
          ATHER
        </span>
      </div>

      {/* Center Animated Account + Ring */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto py-8 max-w-sm w-full space-y-6">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          {/* Spinning Crisp Monochrome Ring */}
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-white/12 border-t-white"
          />

          {/* Pulsing Halo */}
          <motion.div
            aria-hidden="true"
            animate={{ scale: [0.94, 1.06, 0.94], opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-2 rounded-full border border-white/20"
          />

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-white/25 bg-[#141416] flex items-center justify-center shadow-[0_14px_40px_rgba(0,0,0,0.85)]">
            {displayName || profileImageUrl ? (
              <ProfileAvatar
                displayName={displayName || 'Listener'}
                imageUrl={profileImageUrl}
                preset={avatarPreset}
                className="w-full h-full"
              />
            ) : (
              <AtherLogoMark className="w-11 h-11 rounded-xl" />
            )}
          </div>
        </div>

        <div className="space-y-2 px-2">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            {headline}
            <span className="inline-block w-5 text-left">{dots}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#9A9AA6] leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Minimal Indeterminate Progress Pill */}
        <div className="w-44 h-1 rounded-full bg-white/12 overflow-hidden">
          <motion.div
            animate={{ x: ['-100%', '180%'] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-1/2 rounded-full bg-white"
          />
        </div>
      </div>

      {/* Bottom Footer Tag */}
      <div className="relative z-10 pb-2 text-center shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
          {provider === 'google'
            ? 'Google Account Sync'
            : 'Isolated Account Space'}
        </span>
      </div>
    </div>
  );
};

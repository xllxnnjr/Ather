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
    }, 320);
    return () => window.clearInterval(timer);
  }, []);

  const providerLabel =
    provider === 'google'
      ? 'google account'
      : provider === 'apple'
      ? 'apple account'
      : provider === 'email'
      ? 'email account'
      : 'guest session';

  const headline =
    stage === 'syncing'
      ? 'syncing your Ather data'
      : 'signing you in';

  const subtitle =
    stage === 'syncing'
      ? 'restoring playlists, likes, settings & devices across devices'
      : provider === 'google'
      ? `connecting ${(email || displayName || providerLabel).toLowerCase()}`
      : `preparing ${(displayName || providerLabel).toLowerCase()}`;

  const dots = '.'.repeat(dotCount);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${headline}`}
      className="fixed inset-0 h-[100dvh] z-50 bg-black text-white flex flex-col items-center justify-between overflow-y-auto no-scrollbar select-none pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      {/* Top Brand Wordmark */}
      <div className="relative z-10 flex items-center gap-2.5 pt-2 shrink-0">
        <AtherLogoMark className="w-8 h-8 rounded-lg border border-[#242429]" />
        <span className="text-sm font-black tracking-[0.1em] text-white">
          Ather
        </span>
      </div>

      {/* Center Animated Account + Monochrome Ring */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto py-8 max-w-sm w-full space-y-6">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-[3px] border-[#141418] border-t-white"
          />

          <div className="ather-depth-card w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden flex items-center justify-center">
            {displayName || profileImageUrl ? (
              <ProfileAvatar
                displayName={displayName || 'listener'}
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
            <span className="inline-block w-5 text-left text-white">{dots}</span>
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#A1A1AA] leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Crisp Monochrome Indeterminate Progress Pill */}
        <div className="w-44 h-2 rounded-full bg-[#141418] border border-[#242429] overflow-hidden">
          <motion.div
            animate={{ x: ['-100%', '180%'] }}
            transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-1/2 rounded-full bg-white"
          />
        </div>
      </div>

      {/* Bottom Footer Tag */}
      <div className="relative z-10 pb-2 text-center shrink-0">
        <span className="text-[11px] font-bold tracking-[0.12em] text-[#A1A1AA]">
          Ather session
        </span>
      </div>
    </div>
  );
};

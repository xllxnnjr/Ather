import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AtherLogoMark } from './AtherLogoMark';
import { AvatarPreset, ProfileAvatar } from './ProfileAvatar';

interface SettingUpAtherScreenProps {
  displayName: string;
  avatarPreset: AvatarPreset;
  profileImageUrl: string | null;
  onFinished: () => void;
}

const STARS = [
  { top: '12%', left: '18%', size: 2, delay: 0 },
  { top: '18%', left: '72%', size: 2.5, delay: 0.4 },
  { top: '27%', left: '34%', size: 1.5, delay: 0.9 },
  { top: '31%', left: '84%', size: 2, delay: 0.2 },
  { top: '42%', left: '14%', size: 2, delay: 1.1 },
  { top: '54%', left: '76%', size: 2.5, delay: 0.6 },
  { top: '63%', left: '24%', size: 2, delay: 1.4 },
  { top: '71%', left: '61%', size: 1.5, delay: 0.3 },
  { top: '79%', left: '39%', size: 2, delay: 0.8 },
];

const STATUS_MESSAGES = [
  'Setting up your ATHER experience',
  'Tuning genres & live charts',
  'Syncing your personal audio profile',
];

export const SettingUpAtherScreen: React.FC<SettingUpAtherScreenProps> = ({
  displayName,
  avatarPreset,
  profileImageUrl,
  onFinished,
}) => {
  const [statusIdx, setStatusIdx] = useState(0);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const statusTimer = window.setInterval(() => {
      setStatusIdx((prev) => Math.min(STATUS_MESSAGES.length - 1, prev + 1));
    }, 800);

    const doneTimer = window.setTimeout(() => {
      onFinishedRef.current();
    }, 2400);

    return () => {
      window.clearInterval(statusTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col items-center justify-between overflow-y-auto no-scrollbar select-none pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Starfield + Monochrome Horizon Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[-12%] h-[56%] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 85% 65% at 50% 100%, rgba(255,255,255,0.22) 0%, rgba(160,160,170,0.08) 40%, rgba(0,0,0,0) 75%)',
          filter: 'blur(26px)',
        }}
      />

      {STARS.map((star, idx) => (
        <motion.span
          key={idx}
          aria-hidden="true"
          animate={{ opacity: [0.25, 0.9, 0.25], scale: [0.85, 1.15, 0.85] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            delay: star.delay,
            ease: 'easeInOut',
          }}
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          className="absolute rounded-full bg-white pointer-events-none"
        />
      ))}

      {/* Top Headline */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 pt-4 sm:pt-8 text-center"
      >
        <p className="text-sm sm:text-base font-medium tracking-tight text-white/90">
          {STATUS_MESSAGES[statusIdx]}
        </p>
      </motion.div>

      {/* Center Animated Crest -> Motion Lines -> Tilted Profile Tile */}
      <div className="relative z-10 flex items-center justify-center gap-3.5 sm:gap-7">
        {/* Morphing ATHER Logo Crest */}
        <motion.div
          animate={{
            scale: [0.94, 1.07, 0.94],
            rotate: [0, 4, 0],
          }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0"
        >
          <AtherLogoMark className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-white/20 shadow-[0_0_28px_rgba(255,255,255,0.22)]" />
        </motion.div>

        {/* Speed Stream Lines */}
        <div className="flex flex-col gap-3 w-10 sm:w-12 shrink-0">
          <motion.div
            animate={{ opacity: [0.25, 0.95, 0.25], x: [-3, 3, -3] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="h-[1.5px] w-full rounded-full bg-gradient-to-r from-white/15 via-white/80 to-white/15"
          />
          <motion.div
            animate={{ opacity: [0.85, 0.3, 0.85], x: [3, -3, 3] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="h-[1.5px] w-full rounded-full bg-gradient-to-r from-white/10 via-white/80 to-white/10"
          />
        </div>

        {/* Tilted Glass Profile Tile with Music Note Badge */}
        <motion.div
          initial={{ scale: 0.9, rotate: -10 }}
          animate={{
            scale: [0.97, 1.03, 0.97],
            rotate: [-6, -2, -6],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl bg-white/[0.1] backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-[0_18px_48px_rgba(0,0,0,0.65)] shrink-0"
        >
          <ProfileAvatar
            displayName={displayName}
            imageUrl={profileImageUrl}
            preset={avatarPreset}
            className="w-11 h-11 ring-1 ring-white/25"
          />
          <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-[#000000] shadow-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
          </span>
        </motion.div>
      </div>

      {/* Bottom Subtle Label */}
      <div className="relative z-10 pb-4 text-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
          ATHER AUDIO ENGINE
        </span>
      </div>
    </div>
  );
};

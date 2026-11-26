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

const STATUS_MESSAGES = [
  'setting up your Ather experience',
  'tuning genres & live charts',
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
    }, 320);

    const doneTimer = window.setTimeout(() => {
      onFinishedRef.current();
    }, 680);

    return () => {
      window.clearInterval(statusTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 h-[100dvh] z-50 bg-black text-white flex flex-col items-center justify-between overflow-y-auto no-scrollbar select-none pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {/* Top Headline */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 pt-4 sm:pt-8 text-center"
      >
        <p className="text-sm sm:text-base font-extrabold tracking-tight text-white">
          {STATUS_MESSAGES[statusIdx]}
        </p>
      </motion.div>

      {/* Center Animated Crest -> Speed Lines -> Elevated Profile Tile */}
      <div className="relative z-10 flex items-center justify-center gap-3.5 sm:gap-7">
        <motion.div
          animate={{ scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0"
        >
          <AtherLogoMark className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-[#242429]" />
        </motion.div>

        <div className="flex flex-col gap-3 w-10 sm:w-12 shrink-0">
          <div className="h-[2px] w-full rounded-full bg-white" />
          <div className="h-[2px] w-full rounded-full bg-[#242429]" />
        </div>

        <motion.div
          initial={{ scale: 0.94, rotate: -6 }}
          animate={{ scale: [0.98, 1.03, 0.98], rotate: [-4, 0, -4] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
          className="ather-depth-card relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0"
        >
          <ProfileAvatar
            displayName={displayName}
            imageUrl={profileImageUrl}
            preset={avatarPreset}
            className="w-11 h-11 border border-[#242429]"
          />
          <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-black border border-[#242429] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
          </span>
        </motion.div>
      </div>

      {/* Bottom Subtle Label */}
      <div className="relative z-10 pb-4 text-center">
        <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#A1A1AA]">
          Ather audio engine
        </span>
      </div>
    </div>
  );
};

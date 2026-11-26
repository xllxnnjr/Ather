import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckGlyph, ChevronLeftGlyph } from './AppIcons';
import { AtherLogoMark } from './AtherLogoMark';
import { AVATAR_PRESETS, AvatarPreset, ProfileAvatar } from './ProfileAvatar';
import {
  compressImageFileToDataUrl,
  getDefaultAppPreferences,
  writeAccountJson,
} from '../services/accountStorage';
import { seedOnboardingTasteProfile } from '../services/tasteProfile';

export const ONBOARDING_STORAGE_KEY = 'ather_onboarding_v1';

export interface OnboardingSetupResult {
  completed: boolean;
  displayName: string;
  avatarPreset: AvatarPreset;
  profileImageUrl: string | null;
  notificationsEnabled: boolean;
  microphoneEnabled: boolean;
  preferredGenres: string[];
  updatedAt: number;
}

const SETUP_GENRES: { id: string; label: string; vibe: string }[] = [
  { id: 'hip hop', label: 'hip hop', vibe: '808s & bars' },
  { id: 'r&b', label: 'r&b / soul', vibe: 'late night cuts' },
  { id: 'pop', label: 'pop', vibe: 'global charts' },
  { id: 'afrobeats', label: 'afrobeats', vibe: 'groove & bounce' },
  { id: 'electronic', label: 'electronic', vibe: 'house & synth' },
  { id: 'alternative', label: 'alternative', vibe: 'indie & alt' },
  { id: 'rock', label: 'rock', vibe: 'guitars & live' },
  { id: 'latin', label: 'latin', vibe: 'reggaetón & urbana' },
  { id: 'blues', label: 'blues & jazz', vibe: 'warm analog' },
  { id: 'k-pop', label: 'k-pop', vibe: 'seoul charts' },
];

export function saveOnboardingSetupRecord(
  data: OnboardingSetupResult,
  accountId?: string | null
): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota errors
    }
  }
  if (accountId) {
    writeAccountJson(
      'preferences',
      {
        ...getDefaultAppPreferences(),
        notificationsEnabled: data.notificationsEnabled,
        microphoneEnabled: data.microphoneEnabled,
      },
      accountId
    );
  }
}

export function readOnboardingSetupRecord(): OnboardingSetupResult | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingSetupResult;
    return parsed?.completed ? parsed : null;
  } catch {
    return null;
  }
}

interface OnboardingSetupProps {
  accountId?: string | null;
  initialDisplayName?: string;
  initialAvatarPreset?: AvatarPreset;
  initialProfileImageUrl?: string | null;
  onComplete: (result: OnboardingSetupResult) => void;
}

export const OnboardingSetup: React.FC<OnboardingSetupProps> = ({
  accountId,
  initialDisplayName = 'Ather listener',
  initialAvatarPreset = 'studio',
  initialProfileImageUrl = null,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(initialAvatarPreset);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    initialProfileImageUrl
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([
    'hip hop',
    'r&b',
    'pop',
  ]);

  const progressPct = Math.round((step / 4) * 100);

  const handlePhotoUpload = (file?: File) => {
    if (!file) return;
    void compressImageFileToDataUrl(file, 256, 0.78)
      .then((compressed) => setProfileImageUrl(compressed))
      .catch(() => undefined);
  };

  const requestNotificationAccess = async () => {
    try {
      if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        const res = await Notification.requestPermission();
        setNotificationsEnabled(res === 'granted');
      }
    } catch {
      setNotificationsEnabled(false);
    }
    setStep(3);
  };

  const requestMicrophoneAccess = async () => {
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicrophoneEnabled(true);
      }
    } catch {
      setMicrophoneEnabled(false);
    }
    setStep(4);
  };

  const toggleGenre = (genreId: string) => {
    setPreferredGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((g) => g !== genreId)
        : [...prev, genreId]
    );
  };

  const finishSetup = () => {
    const cleanName = displayName.trim() || 'Ather listener';
    const record: OnboardingSetupResult = {
      completed: true,
      displayName: cleanName,
      avatarPreset,
      profileImageUrl,
      notificationsEnabled,
      microphoneEnabled,
      preferredGenres: preferredGenres.length > 0 ? preferredGenres : ['hip hop', 'r&b', 'pop'],
      updatedAt: Date.now(),
    };
    seedOnboardingTasteProfile(record.preferredGenres, []);
    saveOnboardingSetupRecord(record, accountId);
    onComplete(record);
  };

  return (
    <div className="fixed inset-0 h-[100dvh] z-50 bg-black text-white flex flex-col overflow-hidden">
      <header className="w-full max-w-lg mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3 shrink-0">
        {step > 1 ? (
          <button
            type="button"
            aria-label="previous step"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform shrink-0"
          >
            <ChevronLeftGlyph className="w-4 h-4" />
          </button>
        ) : (
          <AtherLogoMark className="w-11 h-11 rounded-xl border border-[#242429] shrink-0" />
        )}

        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#A1A1AA]">
            <span>step {step} of 4</span>
            <span className="text-white font-black tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#141418] border border-[#242429] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>

        <div className="w-11 h-11 shrink-0" />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar w-full max-w-lg mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] py-4 flex flex-col justify-between gap-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                your Ather profile
              </h2>
              <p className="text-xs font-bold text-[#A1A1AA] mt-1">
                choose a display name and avatar preset or upload a photo.
              </p>
            </div>

            <div className="ather-depth-card rounded-3xl p-4 flex items-center gap-4">
              <ProfileAvatar
                displayName={displayName || 'listener'}
                imageUrl={profileImageUrl}
                preset={avatarPreset}
                className="w-16 h-16 shrink-0 border border-[#242429]"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-sm font-extrabold text-white truncate">
                  {displayName.trim() ? displayName.trim().toLowerCase() : 'Ather listener'}
                </div>
                <label className="ather-depth-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer">
                  <span>upload photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const selected = !profileImageUrl && avatarPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setProfileImageUrl(null);
                      setAvatarPreset(preset.id);
                    }}
                    className={`rounded-2xl p-2 flex flex-col items-center gap-1 border transition-transform active:scale-95 ${
                      selected
                        ? 'bg-white text-black border-white'
                        : 'ather-depth-row text-white border-[#242429]'
                    }`}
                  >
                    <ProfileAvatar
                      displayName={displayName || 'at'}
                      preset={preset.id}
                      className="w-9 h-9 border border-[#242429]"
                    />
                    <span className="text-[10px] font-extrabold truncate max-w-full">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A1A1AA] mb-1.5">
                display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="your name"
                className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-3 text-base sm:text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="ather-depth-card rounded-3xl p-6 space-y-3">
              <p className="text-[11px] font-extrabold text-[#E4E4E7]">notifications</p>
              <h2 className="text-2xl font-black text-white">stay updated on releases</h2>
              <p className="text-sm font-bold text-[#A1A1AA] leading-relaxed">
                enable alerts when favorite artists release new singles, albums, or sessions.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="ather-depth-card rounded-3xl p-6 space-y-3">
              <p className="text-[11px] font-extrabold text-[#E4E4E7]">audio input</p>
              <h2 className="text-2xl font-black text-white">microphone access</h2>
              <p className="text-sm font-bold text-[#A1A1AA] leading-relaxed">
                optional voice search access inside Ather. you can skip or allow anytime in settings.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  choose your genres
                </h2>
                <p className="text-xs font-bold text-[#A1A1AA] mt-1">
                  guides automatic next-track queueing and home shelves.
                </p>
              </div>
              <span className="text-xs font-extrabold text-white tabular-nums shrink-0">
                {preferredGenres.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {SETUP_GENRES.map((genre) => {
                const active = preferredGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`rounded-2xl p-3.5 text-left transition-all flex items-center justify-between gap-2 ${
                      active ? 'ather-acid-btn' : 'ather-depth-row text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{genre.label}</div>
                      <div
                        className={`text-[11px] font-bold truncate ${
                          active ? 'text-black/75' : 'text-[#A1A1AA]'
                        }`}
                      >
                        {genre.vibe}
                      </div>
                    </div>
                    {active && (
                      <span className="w-6 h-6 rounded-full bg-black text-white border border-black flex items-center justify-center shrink-0">
                        <CheckGlyph className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 space-y-2.5 shrink-0">
          {step === 1 && (
            <button
              type="button"
              disabled={!displayName.trim()}
              onClick={() => setStep(2)}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-transform disabled:opacity-40"
            >
              continue
            </button>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => void requestNotificationAccess()}
                className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-transform"
              >
                allow notifications
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="ather-depth-pill w-full h-11 rounded-full text-white font-extrabold text-xs"
              >
                skip
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => void requestMicrophoneAccess()}
                className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-transform"
              >
                allow microphone
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="ather-depth-pill w-full h-11 rounded-full text-white font-extrabold text-xs"
              >
                skip
              </button>
            </>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={preferredGenres.length < 1}
              onClick={finishSetup}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-transform disabled:opacity-40"
            >
              finish setup
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

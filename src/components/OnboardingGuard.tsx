import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ActiveAccountIdentity,
  StoredAppPreferences,
  compressImageFileToDataUrl,
  getDefaultAppPreferences,
  getDefaultProfile,
  hasCompletedAccountOnboarding,
  readAccountJson,
  setAccountOnboardingCompleted,
  touchSyncSection,
  writeAccountJson,
} from '../services/accountStorage';
import { isValidArtistName, searchRealArtists, searchYouTubeResults } from '../services/musicApi';
import { seedOnboardingTasteProfile } from '../services/tasteProfile';
import { AVATAR_PRESETS, AvatarPreset, ProfileAvatar } from './ProfileAvatar';
import { CheckGlyph, ChevronLeftGlyph } from './AppIcons';
import { AtherLogoMark } from './AtherLogoMark';
import { SearchNavIcon } from './NavIcons';

interface OnboardingGuardProps {
  account: ActiveAccountIdentity;
  onComplete: () => void;
  children: React.ReactNode;
}

const GENRE_CARDS: { id: string; label: string; vibe: string }[] = [
  { id: 'Hip Hop', label: 'Hip Hop', vibe: '808s & Bars' },
  { id: 'R&B', label: 'R&B / Soul', vibe: 'Late Night Cuts' },
  { id: 'Pop', label: 'Pop', vibe: 'Global Charts' },
  { id: 'Afrobeats', label: 'Afrobeats', vibe: 'Groove & Bounce' },
  { id: 'Electronic', label: 'Electronic', vibe: 'House & Synth' },
  { id: 'Alternative', label: 'Alternative', vibe: 'Indie & Alt' },
  { id: 'Rock', label: 'Rock', vibe: 'Guitars & Live' },
  { id: 'Latin', label: 'Latin', vibe: 'Reggaetón & Urbana' },
  { id: 'Blues', label: 'Blues & Jazz', vibe: 'Warm Analog' },
  { id: 'Party', label: 'Party & Club', vibe: 'High Energy' },
  { id: 'Sad', label: 'Melancholy', vibe: 'Acoustic & Deep' },
  { id: 'K-Pop', label: 'K-Pop', vibe: 'Seoul Charts' },
];

const CURATED_ARTISTS: string[] = [
  'The Weeknd',
  'Kendrick Lamar',
  'SZA',
  'Drake',
  'Burna Boy',
  'Billie Eilish',
  'Tyla',
  'Travis Scott',
  'Frank Ocean',
  'Fred again..',
  'Sabrina Carpenter',
  'Rema',
  'Bad Bunny',
  'Playboi Carti',
  'Tame Impala',
  'Ariana Grande',
];

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({
  account,
  onComplete,
  children,
}) => {
  const [completed, setCompleted] = useState<boolean>(() =>
    hasCompletedAccountOnboarding(account.id)
  );
  const [step, setStep] = useState(1);

  const initialProfile = readAccountJson(
    'profile',
    getDefaultProfile(account),
    account.id
  );
  const initialPrefs = readAccountJson<StoredAppPreferences>(
    'preferences',
    getDefaultAppPreferences(),
    account.id
  );

  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [handle, setHandle] = useState(initialProfile.handle);
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset>(
    initialProfile.avatarPreset || 'studio'
  );
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    initialProfile.profileImageUrl
  );

  const [notificationsStatus, setNotificationsStatus] = useState<
    'idle' | 'granted' | 'denied' | 'skipped'
  >(initialPrefs.notificationsEnabled ? 'granted' : 'idle');

  const [selectedGenres, setSelectedGenres] = useState<string[]>([
    'Hip Hop',
    'R&B',
    'Pop',
  ]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([
    'The Weeknd',
    'Kendrick Lamar',
    'SZA',
  ]);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [searchedArtists, setSearchedArtists] = useState<string[]>([]);
  const [artistSearchBusy, setArtistSearchBusy] = useState(false);

  const [autoplay, setAutoplay] = useState(initialPrefs.autoplay);
  const [explicitAllowed, setExplicitAllowed] = useState(
    initialPrefs.explicitAllowed
  );
  const [showLyricsEnabled, setShowLyricsEnabled] = useState(
    initialPrefs.showLyricsEnabled
  );
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setCompleted(hasCompletedAccountOnboarding(account.id));
  }, [account.id]);

  useEffect(() => {
    const q = artistSearchQuery.trim();
    if (q.length < 2) {
      setSearchedArtists([]);
      setArtistSearchBusy(false);
      return;
    }

    let cancelled = false;
    setArtistSearchBusy(true);
    const timer = window.setTimeout(() => {
      void searchRealArtists(q, 8)
        .then(async (list) => {
          if (cancelled) return;
          let names = Array.from(
            new Set(
              list
                .map((item) => item.name.trim())
                .filter((name) => isValidArtistName(name))
            )
          );
          if (names.length === 0) {
            const ytFallback = await searchYouTubeResults(q, 6).catch(() => []);
            names = Array.from(
              new Set(
                ytFallback
                  .map((item) => item.artist.trim())
                  .filter((name) => isValidArtistName(name))
              )
            );
          }
          if (!cancelled) setSearchedArtists(names);
        })
        .catch(() => {
          if (!cancelled) setSearchedArtists([]);
        })
        .finally(() => {
          if (!cancelled) setArtistSearchBusy(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [artistSearchQuery]);

  if (completed) {
    return <>{children}</>;
  }

  const handleImageUpload = (file: File | undefined) => {
    if (!file) return;
    void compressImageFileToDataUrl(file, 256, 0.78)
      .then((compressed) => {
        setProfileImageUrl(compressed);
      })
      .catch(() => undefined);
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined' || !Notification.requestPermission) {
      setNotificationsStatus('skipped');
      setStep(4);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationsStatus(result === 'granted' ? 'granted' : 'denied');
    } catch {
      setNotificationsStatus('denied');
    }
    setStep(4);
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((g) => g !== genreId)
        : [...prev, genreId]
    );
  };

  const toggleArtist = (artistName: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artistName)
        ? prev.filter((a) => a !== artistName)
        : [...prev, artistName]
    );
  };

  const displayedArtists = Array.from(
    new Set([
      ...searchedArtists,
      ...selectedArtists,
      ...CURATED_ARTISTS,
    ])
  );

  const finalizeOnboarding = async () => {
    if (finishing) return;
    setFinishing(true);

    const cleanName = displayName.trim() || 'ATHER Listener';
    const rawHandle = handle.trim() || `@${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const cleanHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;

    writeAccountJson(
      'profile',
      {
        displayName: cleanName,
        handle: cleanHandle,
        email: account.provider === 'guest' ? '' : account.email || '',
        profileImageUrl,
        avatarPreset,
      },
      account.id
    );

    const prefs: StoredAppPreferences = {
      ...getDefaultAppPreferences(),
      autoplay,
      explicitAllowed,
      showLyricsEnabled,
      notificationsEnabled: notificationsStatus === 'granted',
      microphoneEnabled: false,
    };
    writeAccountJson('preferences', prefs, account.id);

    seedOnboardingTasteProfile(selectedGenres, selectedArtists);
    setAccountOnboardingCompleted(true, account.id);
    touchSyncSection('profile', account.id);
    touchSyncSection('preferences', account.id);
    touchSyncSection('taste', account.id);
    touchSyncSection('onboarding', account.id);

    setCompleted(true);
    onComplete();
  };

  const progressPct = Math.round((step / 6) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden">
      {/* Top Progress Header */}
      <header className="w-full max-w-lg mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3 shrink-0">
        {step > 1 ? (
          <button
            type="button"
            aria-label="Previous step"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="w-9 h-9 rounded-full bg-[#111114] border border-white/25 flex items-center justify-center text-white hover:border-white/45 active:scale-95 transition-all shrink-0"
          >
            <ChevronLeftGlyph className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9 shrink-0" />
        )}

        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-white/75">
            <span>Step {step} of 6</span>
            <span className="text-white font-black tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#141416] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
        </div>

        <div className="w-9 h-9 shrink-0" />
      </header>

      {/* Main Step Viewport */}
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar w-full max-w-lg mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] py-4 flex flex-col justify-between gap-6">
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center space-y-6"
          >
            <AtherLogoMark className="w-16 h-16 rounded-2xl border border-white/25 shadow-[0_0_40px_rgba(255,255,255,0.08)]" />

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/65">
                Welcome to ATHER
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.08] text-white">
                Music for your soul, tuned to every frequency.
              </h1>
              <p className="text-sm text-[#9A9AA6] leading-relaxed">
                Let’s set up your personal profile, pick your favorite sounds, and unlock instant lyrics, Spatial Audio, and Reels for your account.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {[
                { label: 'Live Charts', desc: 'Daily releases' },
                { label: 'Synced Lyrics', desc: 'Beat-matched' },
                { label: 'Cross-Device', desc: 'Instant handoff' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl bg-[#141416] border border-white/12 p-3 space-y-1"
                >
                  <div className="text-xs font-extrabold text-white">
                    {card.label}
                  </div>
                  <div className="text-[11px] text-[#9A9AA6]">{card.desc}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                Set up your profile
              </h2>
              <p className="text-xs text-[#9A9AA6] mt-1">
                Customize your avatar, name, and handle for this account.
              </p>
            </div>

            <div className="rounded-3xl bg-[#141416] border border-white/12 p-4 flex items-center gap-4">
              <ProfileAvatar
                displayName={displayName || 'Listener'}
                imageUrl={profileImageUrl}
                preset={avatarPreset}
                className="w-16 h-16 shrink-0 ring-2 ring-white/50"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-sm font-extrabold text-white truncate">
                  {displayName.trim() || 'ATHER Listener'}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer transition-colors">
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#9A9AA6]">
                Or choose an icon avatar
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
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
                      className={`rounded-2xl bg-[#141416] p-1.5 sm:p-2 flex flex-col items-center gap-1 sm:gap-1.5 border transition-all ${
                        selected
                          ? 'border-white ring-1 ring-white/60'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <ProfileAvatar
                        displayName={displayName || 'AT'}
                        preset={preset.id}
                        className="w-9 h-9 sm:w-10 sm:h-10"
                      />
                      <span className="text-[10px] font-bold text-white/80 truncate max-w-full">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9A9AA6] mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-2xl bg-[#141416] border border-white/15 px-4 py-3 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9A9AA6] mb-1">
                  Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@listener"
                  className="w-full rounded-2xl bg-[#141416] border border-white/15 px-4 py-3 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center space-y-5"
          >
            <div className="rounded-3xl bg-[#141416] border border-white/12 p-6 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/65">
                Stay in the Loop
              </p>
              <h2 className="text-2xl font-black text-white">
                Turn on New Release alerts
              </h2>
              <p className="text-sm text-[#9A9AA6] leading-relaxed">
                Get notified when artists you follow drop new albums, singles, and concert sessions.
              </p>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">
                  Pick your sounds
                </h2>
                <p className="text-xs font-bold text-white/75 mt-1">
                  Select at least 3 genres to curate your Home categories &amp; Reels mix.
                </p>
              </div>
              <span className="text-xs font-extrabold text-white tabular-nums shrink-0">
                {selectedGenres.length} of 3 selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {GENRE_CARDS.map((genre) => {
                const active = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`rounded-2xl p-3.5 text-left border transition-all flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'bg-[#111114] text-white border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">
                        {genre.label}
                      </div>
                      <div
                        className={`text-[11px] font-bold truncate ${
                          active ? 'text-black/80' : 'text-white/70'
                        }`}
                      >
                        {genre.vibe}
                      </div>
                    </div>
                    {active && (
                      <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                        <CheckGlyph className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div
            key="step-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                Follow artists &amp; tune playback
              </h2>
              <p className="text-xs font-bold text-white/75 mt-1">
                Artists you pick here appear in Your Top Artists &amp; shape your Home feed.
              </p>
            </div>

            <div className="relative">
              <SearchNavIcon className="w-4 h-4 text-white/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={artistSearchQuery}
                onChange={(e) => setArtistSearchQuery(e.target.value)}
                placeholder="Search any real artist to add..."
                className="w-full rounded-full bg-[#111114] border border-white/25 pl-10 pr-4 py-2.5 text-base sm:text-sm font-bold text-white placeholder:text-white/55 focus:outline-none focus:border-white"
              />
              {artistSearchBusy && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white/75">
                  Searching...
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {displayedArtists.map((artistName) => {
                const active = selectedArtists.includes(artistName);
                return (
                  <button
                    key={artistName}
                    type="button"
                    onClick={() => toggleArtist(artistName)}
                    className={`px-3.5 py-2 rounded-full text-xs font-extrabold border transition-all inline-flex items-center gap-1.5 ${
                      active
                        ? 'bg-white text-black border-white'
                        : 'bg-[#111114] text-white border-white/20 hover:border-white/45'
                    }`}
                  >
                    <span>{artistName}</span>
                    {active && <CheckGlyph className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl bg-[#111114] border border-white/20 divide-y divide-white/15">
              {[
                {
                  label: 'Continuous Autoplay',
                  desc: 'Keep similar tracks queued seamlessly',
                  value: autoplay,
                  toggle: () => setAutoplay((v) => !v),
                },
                {
                  label: 'Allow Explicit Releases',
                  desc: 'Play original unedited album & single masters',
                  value: explicitAllowed,
                  toggle: () => setExplicitAllowed((v) => !v),
                },
                {
                  label: 'Time-Synced Lyrics',
                  desc: 'Show beat-matched lyrics inside the Player',
                  value: showLyricsEnabled,
                  toggle: () => setShowLyricsEnabled((v) => !v),
                },
              ].map((pref) => (
                <button
                  key={pref.label}
                  type="button"
                  onClick={pref.toggle}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white">
                      {pref.label}
                    </div>
                    <div className="text-[11px] font-bold text-white/70">{pref.desc}</div>
                  </div>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                      pref.value ? 'bg-white' : 'bg-white/25'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full transition-transform ${
                        pref.value
                          ? 'translate-x-5 bg-black'
                          : 'translate-x-0 bg-white'
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 6 && (
          <motion.div
            key="step-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center space-y-5"
          >
            <div className="rounded-3xl bg-[#111114] border border-white/30 p-6 space-y-4">
              <div className="flex items-center gap-3.5">
                <ProfileAvatar
                  displayName={displayName || 'Listener'}
                  imageUrl={profileImageUrl}
                  preset={avatarPreset}
                  className="w-14 h-14 ring-2 ring-white"
                />
                <div className="min-w-0">
                  <div className="text-lg font-black text-white truncate">
                    {displayName.trim() || 'ATHER Listener'}
                  </div>
                  <div className="text-xs font-bold text-white/75 truncate">
                    {handle.trim() || '@listener'} · {selectedGenres.length} genres ·{' '}
                    {selectedArtists.length} artists
                  </div>
                </div>
              </div>

              <p className="text-sm font-bold text-white/90 leading-relaxed">
                Everything is tuned for this account. Tap below to launch your personalized ATHER listening space.
              </p>
            </div>
          </motion.div>
        )}

        {/* Footer CTA Action Bar */}
        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 space-y-2.5 shrink-0">
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all"
            >
              Get Started
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={!displayName.trim()}
              onClick={() => setStep(3)}
              className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all disabled:opacity-40"
            >
              Continue
            </button>
          )}

          {step === 3 && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void requestNotifications()}
                className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all"
              >
                Allow Notifications
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotificationsStatus('skipped');
                  setStep(4);
                }}
                className="w-full h-11 rounded-full bg-[#111114] border border-white/20 text-white/80 font-extrabold text-xs hover:text-white transition-colors"
              >
                Maybe Later
              </button>
            </div>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={selectedGenres.length < 3}
              onClick={() => setStep(5)}
              className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all disabled:opacity-40"
            >
              {selectedGenres.length >= 3
                ? 'Continue'
                : `Pick ${3 - selectedGenres.length} more`}
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              disabled={selectedArtists.length < 1}
              onClick={() => setStep(6)}
              className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all disabled:opacity-40"
            >
              {selectedArtists.length >= 1
                ? 'Review Setup'
                : 'Select at least 1 artist'}
            </button>
          )}

          {step === 6 && (
            <button
              type="button"
              disabled={finishing}
              onClick={() => void finalizeOnboarding()}
              className="w-full h-12 rounded-full bg-white text-black font-black text-sm hover:bg-white/90 active:scale-[0.985] transition-all"
            >
              {finishing ? 'Launching...' : 'Start Listening'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

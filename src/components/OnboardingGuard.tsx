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
import { isValidArtistName, searchRealArtists, searchRealSongs } from '../services/musicApi';
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
  { id: 'Hip Hop', label: 'hip hop', vibe: '808s & bars' },
  { id: 'R&B', label: 'r&b / soul', vibe: 'late night cuts' },
  { id: 'Pop', label: 'pop', vibe: 'global charts' },
  { id: 'Afrobeats', label: 'afrobeats', vibe: 'groove & bounce' },
  { id: 'Electronic', label: 'electronic', vibe: 'house & synth' },
  { id: 'Alternative', label: 'alternative', vibe: 'indie & alt' },
  { id: 'Rock', label: 'rock', vibe: 'guitars & live' },
  { id: 'Latin', label: 'latin', vibe: 'reggaetón & urbana' },
  { id: 'Blues', label: 'blues & jazz', vibe: 'warm analog' },
  { id: 'Party', label: 'party & club', vibe: 'high energy' },
  { id: 'Sad', label: 'melancholy', vibe: 'acoustic & deep' },
  { id: 'K-Pop', label: 'k-pop', vibe: 'seoul charts' },
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
            const songFallback = await searchRealSongs(q, 8).catch(() => []);
            names = Array.from(
              new Set(
                songFallback
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

    const cleanName = displayName.trim() || 'Ather listener';
    const rawHandle =
      handle.trim() || `@${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
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

    const normalizedGenres = selectedGenres.map((g) => g.toLowerCase());
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          'ather_onboarding_v1',
          JSON.stringify({
            completed: true,
            displayName: cleanName,
            avatarPreset,
            profileImageUrl,
            notificationsEnabled: notificationsStatus === 'granted',
            microphoneEnabled: false,
            preferredGenres: normalizedGenres,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // ignore quota errors
      }
    }

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
    <div className="fixed inset-0 h-[100dvh] z-50 bg-black text-white flex flex-col overflow-hidden">
      {/* Top Progress Header */}
      <header className="w-full max-w-lg mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3 shrink-0">
        {step > 1 ? (
          <button
            type="button"
            aria-label="previous step"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="ather-depth-btn w-11 h-11 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shrink-0"
          >
            <ChevronLeftGlyph className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-11 h-11 shrink-0" />
        )}

        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#A1A1AA]">
            <span>step {step} of 6</span>
            <span className="text-white font-black tabular-nums">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#141418] border border-[#242429] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
        </div>

        <div className="w-11 h-11 shrink-0" />
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
            <AtherLogoMark className="w-16 h-16 rounded-2xl border border-[#242429]" />

            <div className="space-y-3">
              <p className="text-[11px] font-extrabold tracking-wide text-[#E4E4E7]">
                welcome to Ather
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.08] text-white">
                music for your soul, tuned to every frequency.
              </h1>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                let’s set up your personal profile, pick your favorite sounds, and unlock instant lyrics, full-track audio, and reels for your account.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {[
                { label: 'live charts', desc: 'daily releases' },
                { label: 'synced lyrics', desc: 'beat-matched' },
                { label: 'multi-device', desc: 'active devices sync' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="ather-depth-card rounded-2xl p-3 space-y-1"
                >
                  <div className="text-xs font-extrabold text-white">
                    {card.label}
                  </div>
                  <div className="text-[11px] text-[#A1A1AA]">{card.desc}</div>
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
                set up your profile
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-1">
                customize your avatar, name, and handle for this account.
              </p>
            </div>

            <div className="ather-depth-card rounded-3xl p-4 flex items-center gap-4">
              <ProfileAvatar
                displayName={displayName || 'listener'}
                imageUrl={profileImageUrl}
                preset={avatarPreset}
                className="w-16 h-16 shrink-0 border border-[#242429] ring-2 ring-white"
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
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold tracking-wide text-[#A1A1AA]">
                or choose an icon avatar
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
                      className={`rounded-2xl p-1.5 sm:p-2 flex flex-col items-center gap-1 sm:gap-1.5 transition-all ${
                        selected
                          ? 'ather-acid-btn'
                          : 'ather-depth-row text-white'
                      }`}
                    >
                      <ProfileAvatar
                        displayName={displayName || 'at'}
                        preset={preset.id}
                        className="w-9 h-9 sm:w-10 sm:h-10 border border-[#242429]"
                      />
                      <span
                        className={`text-[10px] font-extrabold truncate max-w-full ${
                          selected ? 'text-black' : 'text-[#A1A1AA]'
                        }`}
                      >
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold tracking-wide text-[#A1A1AA] mb-1">
                  display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="your name"
                  className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-3 text-base sm:text-sm text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-wide text-[#A1A1AA] mb-1">
                  handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@listener"
                  className="w-full rounded-2xl bg-[#141418] border border-[#242429] px-4 py-3 text-base sm:text-sm text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
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
            <div className="ather-depth-card rounded-3xl p-6 space-y-4">
              <p className="text-[11px] font-extrabold tracking-wide text-[#E4E4E7]">
                stay in the loop
              </p>
              <h2 className="text-2xl font-black text-white">
                turn on new release alerts
              </h2>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                get notified when artists you follow drop new albums, singles, and concert sessions.
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
                  pick your sounds
                </h2>
                <p className="text-xs font-bold text-[#A1A1AA] mt-1">
                  select at least 3 genres to curate your home categories &amp; next-track autoplay.
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
                    className={`rounded-2xl p-3.5 text-left transition-all flex items-center justify-between gap-2 ${
                      active
                        ? 'ather-acid-btn'
                        : 'ather-depth-row text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">
                        {genre.label}
                      </div>
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
                follow artists &amp; tune playback
              </h2>
              <p className="text-xs font-bold text-[#A1A1AA] mt-1">
                artists you pick here appear in your top artists &amp; shape your home feed.
              </p>
            </div>

            <div className="relative">
              <SearchNavIcon className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={artistSearchQuery}
                onChange={(e) => setArtistSearchQuery(e.target.value)}
                placeholder="search any real artist to add..."
                className="w-full rounded-full bg-[#141418] border border-[#242429] pl-10 pr-4 py-2.5 text-base sm:text-sm font-bold text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
              />
              {artistSearchBusy && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white">
                  searching...
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
                    className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition-all inline-flex items-center gap-1.5 ${
                      active
                        ? 'ather-acid-btn'
                        : 'ather-depth-pill text-white'
                    }`}
                  >
                    <span>{artistName.toLowerCase()}</span>
                    {active && <CheckGlyph className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {[
                {
                  label: 'continuous autoplay',
                  desc: 'keep genre-matched tracks queued seamlessly',
                  value: autoplay,
                  toggle: () => setAutoplay((v) => !v),
                },
                {
                  label: 'allow explicit releases',
                  desc: 'play original unedited album & single masters',
                  value: explicitAllowed,
                  toggle: () => setExplicitAllowed((v) => !v),
                },
                {
                  label: 'time-synced lyrics',
                  desc: 'show beat-matched lyrics inside the player',
                  value: showLyricsEnabled,
                  toggle: () => setShowLyricsEnabled((v) => !v),
                },
              ].map((pref) => (
                <button
                  key={pref.label}
                  type="button"
                  onClick={pref.toggle}
                  className="ather-depth-row w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white">
                      {pref.label}
                    </div>
                    <div className="text-[11px] font-bold text-[#A1A1AA]">{pref.desc}</div>
                  </div>
                  <span
                    className={`w-11 h-6 rounded-full p-0.5 border border-[#242429] transition-colors shrink-0 ${
                      pref.value ? 'bg-white' : 'bg-[#141418]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full transition-transform ${
                        pref.value
                          ? 'translate-x-5 bg-black'
                          : 'translate-x-0 bg-[#A1A1AA]'
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
            <div className="ather-depth-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3.5">
                <ProfileAvatar
                  displayName={displayName || 'listener'}
                  imageUrl={profileImageUrl}
                  preset={avatarPreset}
                  className="w-14 h-14 border border-[#242429] ring-2 ring-white"
                />
                <div className="min-w-0">
                  <div className="text-lg font-black text-white truncate">
                    {displayName.trim() ? displayName.trim().toLowerCase() : 'Ather listener'}
                  </div>
                  <div className="text-xs font-bold text-[#A1A1AA] truncate">
                    {(handle.trim() || '@listener').toLowerCase()} · {selectedGenres.length} genres ·{' '}
                    {selectedArtists.length} artists
                  </div>
                </div>
              </div>

              <p className="text-sm font-bold text-[#E4E4E7] leading-relaxed">
                everything is tuned for this account. tap below to launch your personalized Ather listening space.
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
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all"
            >
              get started
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={!displayName.trim()}
              onClick={() => setStep(3)}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all disabled:opacity-40"
            >
              continue
            </button>
          )}

          {step === 3 && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void requestNotifications()}
                className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all"
              >
                allow notifications
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotificationsStatus('skipped');
                  setStep(4);
                }}
                className="ather-depth-pill w-full h-11 rounded-full text-white font-extrabold text-xs transition-colors"
              >
                maybe later
              </button>
            </div>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={selectedGenres.length < 3}
              onClick={() => setStep(5)}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all disabled:opacity-40"
            >
              {selectedGenres.length >= 3
                ? 'continue'
                : `pick ${3 - selectedGenres.length} more`}
            </button>
          )}

          {step === 5 && (
            <button
              type="button"
              disabled={selectedArtists.length < 1}
              onClick={() => setStep(6)}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all disabled:opacity-40"
            >
              {selectedArtists.length >= 1
                ? 'review setup'
                : 'select at least 1 artist'}
            </button>
          )}

          {step === 6 && (
            <button
              type="button"
              disabled={finishing}
              onClick={() => void finalizeOnboarding()}
              className="ather-acid-btn w-full h-12 rounded-full font-black text-sm active:scale-[0.985] transition-all"
            >
              {finishing ? 'launching...' : 'start listening'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

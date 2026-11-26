import React, { useState } from 'react';
import { motion } from 'motion/react';
import portraitSinger from '../assets/images/login_portrait_singer_1795680683171.jpg';
import portraitProducer from '../assets/images/login_portrait_producer_1795680684778.jpg';
import portraitGuitarist from '../assets/images/login_portrait_guitarist_1795680684411.jpg';
import portraitListener from '../assets/images/login_portrait_listener_1795680685672.jpg';
import { auth, signInWithGooglePopup, signOutFirebase } from '../firebase';
import {
  ActiveAccountIdentity,
  getKnownAccounts,
  sanitizeAccountId,
  setActiveAccount,
} from '../services/accountStorage';
import { CloseGlyph } from './AppIcons';
import { AtherLogoMark } from './AtherLogoMark';

interface AuthGateScreenProps {
  onAuthenticated: (account: ActiveAccountIdentity) => void;
}

const MARQUEE_COLUMNS: Array<{
  direction: 'up' | 'down';
  offsetClass: string;
  images: string[];
}> = [
  {
    direction: 'up',
    offsetClass: '-mt-6',
    images: [
      portraitSinger,
      portraitProducer,
      portraitGuitarist,
      portraitListener,
      portraitSinger,
      portraitProducer,
      portraitGuitarist,
      portraitListener,
    ],
  },
  {
    direction: 'down',
    offsetClass: '-mt-16',
    images: [
      portraitProducer,
      portraitListener,
      portraitSinger,
      portraitGuitarist,
      portraitProducer,
      portraitListener,
      portraitSinger,
      portraitGuitarist,
    ],
  },
  {
    direction: 'up',
    offsetClass: '-mt-2',
    images: [
      portraitGuitarist,
      portraitSinger,
      portraitListener,
      portraitProducer,
      portraitGuitarist,
      portraitSinger,
      portraitListener,
      portraitProducer,
    ],
  },
  {
    direction: 'down',
    offsetClass: '-mt-12',
    images: [
      portraitListener,
      portraitGuitarist,
      portraitProducer,
      portraitSinger,
      portraitListener,
      portraitGuitarist,
      portraitProducer,
      portraitSinger,
    ],
  },
];

const SpinnerDot: React.FC<{ dark?: boolean }> = ({ dark = true }) => (
  <span
    aria-hidden="true"
    className={`w-4 h-4 rounded-full border-2 animate-spin shrink-0 ${
      dark
        ? 'border-black/25 border-t-black'
        : 'border-white/25 border-t-white'
    }`}
  />
);

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  onAuthenticated,
}) => {
  const [busyProvider, setBusyProvider] = useState<
    'google' | 'apple' | 'email' | 'guest' | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const knownAccounts = getKnownAccounts();

  const clearLingeringFirebaseAuth = async () => {
    if (auth.currentUser) {
      await signOutFirebase().catch(() => undefined);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setBusyProvider('google');
    try {
      const user = await signInWithGooglePopup();
      const identity: ActiveAccountIdentity = {
        id: sanitizeAccountId(`google:${user.uid}`),
        provider: 'google',
        uid: user.uid,
        displayName:
          user.displayName || user.email?.split('@')[0] || 'Ather listener',
        email: user.email || '',
        photoUrl: user.photoURL || undefined,
      };
      setActiveAccount(identity);
      onAuthenticated(identity);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'unable to complete google sign-in.';
      const lower = message.toLowerCase();
      if (!lower.includes('popup-closed-by-user')) {
        if (
          lower.includes('unauthorized-domain') ||
          lower.includes('popup-blocked') ||
          lower.includes('operation-not-supported')
        ) {
          setErrorMsg(
            'google popup sign-in is blocked in this webview or domain. continue with email or authorize this origin in firebase authentication.'
          );
        } else {
          setErrorMsg(lower);
        }
      }
      setBusyProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    setErrorMsg(null);
    setBusyProvider('apple');
    try {
      await clearLingeringFirebaseAuth();
      const existingApple = knownAccounts.find((a) => a.provider === 'apple');
      const identity: ActiveAccountIdentity = existingApple ?? {
        id: 'apple:primary',
        provider: 'apple',
        displayName: 'apple listener',
        handle: '@apple_listener',
      };
      setActiveAccount(identity);
      onAuthenticated(identity);
    } catch {
      setBusyProvider(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('enter a valid email address to continue.');
      return;
    }
    setErrorMsg(null);
    setBusyProvider('email');
    try {
      await clearLingeringFirebaseAuth();
      const cleanName =
        nameInput.trim() ||
        cleanEmail.split('@')[0].replace(/[._-]+/g, ' ') ||
        'Ather listener';
      const identity: ActiveAccountIdentity = {
        id: sanitizeAccountId(`email:${cleanEmail}`),
        provider: 'email',
        email: cleanEmail,
        displayName: cleanName,
      };
      setActiveAccount(identity);
      onAuthenticated(identity);
    } catch {
      setBusyProvider(null);
    }
  };

  const handleSkipGuest = async () => {
    setErrorMsg(null);
    setBusyProvider('guest');
    try {
      await clearLingeringFirebaseAuth();
      const identity: ActiveAccountIdentity = {
        id: 'guest:local',
        provider: 'guest',
        displayName: 'guest listener',
        handle: '@guest',
      };
      setActiveAccount(identity);
      onAuthenticated(identity);
    } catch {
      setBusyProvider(null);
    }
  };

  const handleQuickAccountPick = async (acct: ActiveAccountIdentity) => {
    setErrorMsg(null);
    if (acct.provider === 'google') {
      if (auth.currentUser?.uid === acct.uid && auth.currentUser?.emailVerified) {
        setBusyProvider('google');
        setActiveAccount(acct);
        onAuthenticated(acct);
      } else {
        await handleGoogleSignIn();
      }
      return;
    }

    setBusyProvider(acct.provider);
    try {
      await clearLingeringFirebaseAuth();
      const sanitizedAcct =
        acct.provider === 'guest'
          ? {
              id: acct.id,
              provider: 'guest' as const,
              displayName: acct.displayName || 'guest listener',
              handle: acct.handle || '@guest',
            }
          : acct;
      setActiveAccount(sanitizedAcct);
      onAuthenticated(sanitizedAcct);
    } catch {
      setBusyProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] z-50 bg-black text-white flex flex-col justify-end overflow-hidden select-none">
      {/* Multi-Column Animated Vertical Portrait Collage */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[66dvh] overflow-hidden pointer-events-none"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 px-2.5 h-full">
          {MARQUEE_COLUMNS.map((col, colIdx) => (
            <div
              key={colIdx}
              className={`flex flex-col gap-2.5 ${
                colIdx === 3 ? 'hidden sm:flex' : 'flex'
              } ${col.offsetClass}`}
            >
              <div
                className={`flex flex-col gap-2.5 ${
                  col.direction === 'up' ? 'ather-marquee-up' : 'ather-marquee-down'
                }`}
              >
                {col.images.map((src, imgIdx) => (
                  <div
                    key={`${colIdx}-${imgIdx}`}
                    className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-[#0D0D10] border border-[#242429] shrink-0"
                  >
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover object-top grayscale contrast-115 brightness-90"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Soft monochrome vignette + smooth bottom fade into pure black */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/95 to-transparent" />
      </div>

      {/* Top-Right Skip Control */}
      <div className="fixed top-[max(0.85rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-30">
        <button
          type="button"
          disabled={busyProvider !== null}
          onClick={() => void handleSkipGuest()}
          className="ather-depth-pill min-h-[44px] px-4 py-2 rounded-full text-xs font-extrabold text-white active:scale-95 transition-transform disabled:opacity-60"
        >
          {busyProvider === 'guest' ? 'entering...' : 'skip'}
        </button>
      </div>

      {/* Foreground Content + Auth Actions anchored at lower half */}
      <div className="relative z-20 w-full max-w-md mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 space-y-4 bg-gradient-to-t from-black via-black to-transparent max-h-[82dvh] overflow-y-auto no-scrollbar">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center space-y-2.5"
        >
          {/* 3-Dash Carousel Progress Indicator (- - —) */}
          <div aria-hidden="true" className="flex items-center justify-center gap-1.5 mb-1">
            <span className="w-3 h-1 rounded-full bg-white/30" />
            <span className="w-3 h-1 rounded-full bg-white/30" />
            <span className="w-7 h-1 rounded-full bg-white" />
          </div>

          <AtherLogoMark className="w-11 h-11 rounded-2xl border border-[#242429]" />

          <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.04em] text-white leading-tight">
            Ather
          </h1>
          <p className="text-sm sm:text-base font-extrabold text-white leading-snug max-w-xs">
            stream &amp; connect — your pure sound space
          </p>
          <p className="text-xs font-semibold text-[#A1A1AA] leading-relaxed max-w-xs">
            studio streams, offline downloads, and live audio tailored strictly to your profile.
          </p>
        </motion.div>

        {errorMsg && (
          <div className="ather-depth-card rounded-2xl px-3.5 py-2.5 text-xs font-bold text-white text-center">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void handleAppleSignIn()}
            className="w-full h-12 rounded-full bg-white text-black font-black text-sm flex items-center justify-center gap-2.5 active:scale-[0.985] transition-transform disabled:opacity-70"
          >
            {busyProvider === 'apple' ? (
              <>
                <SpinnerDot dark={true} />
                <span>signing in...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span>continue with apple</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void handleGoogleSignIn()}
            className="w-full h-12 rounded-full bg-white text-black font-black text-sm flex items-center justify-center gap-2.5 active:scale-[0.985] transition-transform disabled:opacity-70"
          >
            {busyProvider === 'google' ? (
              <>
                <SpinnerDot dark={true} />
                <span>signing in with google...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
                <span>continue with google</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => {
              setErrorMsg(null);
              setEmailModalOpen(true);
            }}
            className="ather-depth-btn w-full h-12 rounded-full text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.985] transition-transform disabled:opacity-70"
          >
            {busyProvider === 'email' ? (
              <>
                <SpinnerDot dark={false} />
                <span>signing in...</span>
              </>
            ) : (
              <span>continue with email</span>
            )}
          </button>
        </div>

        {knownAccounts.length > 0 && (
          <div className="pt-0.5 flex items-center justify-center gap-2 flex-wrap">
            {knownAccounts.slice(0, 3).map((acct) => (
              <button
                key={acct.id}
                type="button"
                disabled={busyProvider !== null}
                onClick={() => void handleQuickAccountPick(acct)}
                className="ather-depth-pill min-h-[36px] px-3.5 py-1.5 rounded-full text-[11px] font-bold text-[#A1A1AA] hover:text-white transition-colors truncate max-w-[160px] disabled:opacity-60"
              >
                {(acct.provider === 'guest'
                  ? acct.displayName || 'guest listener'
                  : acct.displayName || acct.email || acct.provider
                ).toLowerCase()}
              </button>
            ))}
          </div>
        )}

        <p className="pt-0.5 text-center text-[11px] font-semibold text-[#A1A1AA] leading-relaxed">
          google accounts sync automatically across your devices. local profiles stay isolated per account.
        </p>
      </div>

      {/* Inline Email Account Sheet */}
      {emailModalOpen && (
        <div className="fixed inset-0 h-[100dvh] z-50 bg-black/85 flex items-end sm:items-center justify-center pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={(e) => void handleEmailSubmit(e)}
            className="ather-depth-card w-full max-w-sm max-h-[min(86dvh,calc(100dvh-2rem))] overflow-y-auto no-scrollbar rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white">
                  sign in with email
                </h2>
                <p className="text-xs text-[#A1A1AA] mt-0.5">
                  creates an isolated profile for this email
                </p>
              </div>
              <button
                type="button"
                aria-label="close email login"
                onClick={() => setEmailModalOpen(false)}
                className="ather-depth-btn w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0"
              >
                <CloseGlyph className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold tracking-wide text-[#A1A1AA] mb-1">
                  email address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="enter your email address"
                  className="w-full rounded-2xl bg-black border border-[#2A2A32] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-wide text-[#A1A1AA] mb-1">
                  display name (optional)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="how you want to appear"
                  className="w-full rounded-2xl bg-black border border-[#2A2A32] px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyProvider !== null}
              className="w-full h-12 rounded-full bg-white text-black font-extrabold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busyProvider === 'email' ? (
                <>
                  <SpinnerDot dark={true} />
                  <span>signing in...</span>
                </>
              ) : (
                <span>continue</span>
              )}
            </button>
          </motion.form>
        </div>
      )}
    </div>
  );
};

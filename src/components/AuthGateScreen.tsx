import React, { useState } from 'react';
import { motion } from 'motion/react';
import authMusicHeroImg from '../assets/images/auth_music_hero_1795507502348.jpg';
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
          user.displayName || user.email?.split('@')[0] || 'ATHER Listener',
        email: user.email || '',
        photoUrl: user.photoURL || undefined,
      };
      setActiveAccount(identity);
      onAuthenticated(identity);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      const lower = message.toLowerCase();
      if (!lower.includes('popup-closed-by-user')) {
        if (
          lower.includes('unauthorized-domain') ||
          lower.includes('popup-blocked') ||
          lower.includes('operation-not-supported')
        ) {
          setErrorMsg(
            'Google popup sign-in is blocked in this WebView or domain. Continue with email or authorize this origin in Firebase Authentication.'
          );
        } else {
          setErrorMsg(message);
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
        displayName: 'Apple Listener',
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
      setErrorMsg('Enter a valid email address to continue.');
      return;
    }
    setErrorMsg(null);
    setBusyProvider('email');
    try {
      await clearLingeringFirebaseAuth();
      const cleanName =
        nameInput.trim() ||
        cleanEmail.split('@')[0].replace(/[._-]+/g, ' ') ||
        'ATHER Listener';
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
        displayName: 'Guest Listener',
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
              displayName: acct.displayName || 'Guest Listener',
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
    <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top Hero Atmospheric Artwork */}
      <div className="relative flex-1 min-h-[128px] overflow-hidden">
        <img
          src={authMusicHeroImg}
          alt="ATHER Studio Sound"
          className="w-full h-full object-cover object-center scale-[1.03]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-[#000000]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 sm:h-44 bg-gradient-to-t from-[#000000] via-[#000000]/90 to-transparent"
        />

        {/* Top-Right Skip Control */}
        <div className="absolute top-[max(0.85rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-20">
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => void handleSkipGuest()}
            className="min-h-[36px] px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90 hover:bg-black/75 active:scale-95 transition-all disabled:opacity-60"
          >
            {busyProvider === 'guest' ? 'Entering...' : 'Skip'}
          </button>
        </div>

        {/* Center-Lower Brand Crest + Wordmark overlapping bottom horizon */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 bottom-3 sm:bottom-4 z-10 flex flex-col items-center text-center pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]"
        >
          <AtherLogoMark className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.65)] mb-2.5 sm:mb-3" />

          <h1 className="text-2xl sm:text-4xl font-black tracking-[-0.04em] text-white uppercase">
            ATHER
          </h1>
          <p className="mt-1 text-[11px] sm:text-xs font-medium text-[#9A9AA6]">
            Sound tailored strictly to your profile
          </p>
        </motion.div>
      </div>

      {/* Lower Auth Stack — scrollable on short landscape Android viewports */}
      <div className="relative z-20 w-full max-w-md mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 space-y-2.5 sm:space-y-3 bg-[#000000] max-h-[70dvh] overflow-y-auto no-scrollbar shrink-0">
        {errorMsg && (
          <div className="rounded-2xl bg-[#141416] border border-white/25 px-3.5 py-2.5 text-xs text-white/90 text-center">
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          disabled={busyProvider !== null}
          onClick={() => void handleAppleSignIn()}
          className="w-full h-11 sm:h-12 rounded-full bg-white text-black font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-white/92 active:scale-[0.985] transition-all shadow-sm disabled:opacity-70"
        >
          {busyProvider === 'apple' ? (
            <>
              <SpinnerDot dark={true} />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <span>Continue with Apple</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={busyProvider !== null}
          onClick={() => void handleGoogleSignIn()}
          className="w-full h-11 sm:h-12 rounded-full bg-white text-black font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-white/92 active:scale-[0.985] transition-all shadow-sm disabled:opacity-70"
        >
          {busyProvider === 'google' ? (
            <>
              <SpinnerDot dark={true} />
              <span>Signing in with Google...</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              <span>Continue with Google</span>
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
          className="w-full h-11 sm:h-12 rounded-full bg-[#1C1C20] border border-white/12 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#25252A] active:scale-[0.985] transition-all disabled:opacity-70"
        >
          {busyProvider === 'email' ? (
            <>
              <SpinnerDot dark={false} />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Continue with Email</span>
          )}
        </button>

        {knownAccounts.length > 0 && (
          <div className="pt-0.5 flex items-center justify-center gap-2 flex-wrap">
            {knownAccounts.slice(0, 3).map((acct) => (
              <button
                key={acct.id}
                type="button"
                disabled={busyProvider !== null}
                onClick={() => void handleQuickAccountPick(acct)}
                className="px-3 py-1.5 rounded-full bg-[#141416] border border-white/12 text-[11px] font-semibold text-white/75 hover:text-white hover:border-white/50 transition-colors truncate max-w-[160px] disabled:opacity-60"
              >
                {acct.provider === 'guest'
                  ? acct.displayName || 'Guest Listener'
                  : acct.displayName || acct.email || acct.provider}
              </button>
            ))}
          </div>
        )}

        <p className="pt-1 text-center text-[11px] text-white/55 leading-relaxed">
          Google accounts sync automatically across your devices. Local profiles stay isolated per account.
        </p>
      </div>

      {/* Inline Email Account Sheet */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={(e) => void handleEmailSubmit(e)}
            className="w-full max-w-sm max-h-[min(86dvh,calc(100dvh-2rem))] overflow-y-auto no-scrollbar rounded-3xl bg-[#141416] border border-white/12 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white">
                  Sign in with Email
                </h2>
                <p className="text-xs text-[#9A9AA6] mt-0.5">
                  Creates an isolated profile for this email
                </p>
              </div>
              <button
                type="button"
                aria-label="Close email login"
                onClick={() => setEmailModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0"
              >
                <CloseGlyph className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  Email Address
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
                  placeholder="Enter your email address"
                  className="w-full rounded-2xl bg-black border border-white/15 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/60 mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="How you want to appear"
                  className="w-full rounded-2xl bg-black border border-white/15 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyProvider !== null}
              className="w-full h-11 rounded-full bg-white text-black font-extrabold text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busyProvider === 'email' ? (
                <>
                  <SpinnerDot dark={true} />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Continue</span>
              )}
            </button>
          </motion.form>
        </div>
      )}
    </div>
  );
};

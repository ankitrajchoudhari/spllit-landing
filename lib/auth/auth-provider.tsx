'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateCurrentUser,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import { ApiError, setAuthTokenGetter } from '@/lib/api/client';
import { usersService } from '@/lib/services/users';
import { captureReferral, clearReferral, readReferral } from '@/lib/auth/referral';
import type { User } from '@/types';

type AuthStatus =
  /** Firebase has not yet reported a session either way. */
  | 'loading'
  /** No Firebase session. */
  | 'signed-out'
  /** Firebase session exists but the backend profile is incomplete. */
  | 'onboarding'
  /** Fully signed in with a completed profile. */
  | 'authenticated';

/**
 * How a Google sign-in ended. `redirect` means the browser is navigating away
 * to Google and nothing after the call will run — the caller must stop rather
 * than fire follow-up requests against a page that is being torn down.
 */
export type SignInOutcome = 'popup' | 'redirect';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  signInWithGoogle: () => Promise<SignInOutcome>;
  signOut: () => Promise<void>;
  /** Re-pulls the backend profile, e.g. after onboarding completes. */
  refreshProfile: () => Promise<User | null>;
  setProfile: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Firebase's IndexedDB persistence refuses to touch the database while the
 * document is hidden, throwing a bare `Error('Database is closing/hidden')`
 * with no error code attached.
 *
 * lib/firebase.ts now prefers localStorage precisely so this does not happen,
 * but the chain still falls through to IndexedDB when localStorage is
 * unavailable — Safari with cookies blocked, some enterprise profiles — so the
 * failure is reachable and has to be survivable here.
 */
function isPersistenceHiddenError(error: unknown): boolean {
  return error instanceof Error && /database is closing\/hidden/i.test(error.message);
}

/** Resolves once the tab is actually in front of the user again. */
function documentVisible(timeoutMs = 5000): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onChange);
      resolve();
    };
    const onChange = () => {
      if (document.visibilityState === 'visible') done();
    };
    // Resolve on the timeout too. Returning late is recoverable; never
    // returning would strand the sign-in exactly as the bug already does.
    const timer = setTimeout(done, timeoutMs);
    document.addEventListener('visibilitychange', onChange);
  });
}

/**
 * Re-runs the persistence write that was refused while the tab was hidden.
 *
 * This is worth attempting because the sign-in genuinely succeeded: Firebase
 * assigns `auth.currentUser` *before* it writes, so at the point the write
 * throws the credential is already in memory and only the save is missing.
 * Waiting for the tab to come forward clears the SDK's `isHiding` flag, and
 * updateCurrentUser then persists the session and notifies the listeners that
 * the failed attempt skipped.
 *
 * Returns whether the session was recovered; the caller reports the original
 * error if not.
 */
async function retryHiddenPersistence(auth: Auth): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  await documentVisible();

  try {
    await updateCurrentUser(auth, user);
    return true;
  } catch (error) {
    console.error('[auth] could not persist session after hidden-tab failure:', error);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<User | null>(null);
  // Derived at init rather than corrected by an effect: if Firebase is not
  // configured there is nothing to wait for, so starting in 'loading' would
  // only cause an immediate second render.
  const [status, setStatus] = useState<AuthStatus>(() =>
    isFirebaseConfigured() ? 'loading' : 'signed-out',
  );

  // Held in a ref so setAuthTokenGetter registers exactly once and always reads
  // the current user rather than closing over a stale one. Synced in an effect,
  // not during render — a render can be discarded and replayed under concurrent
  // rendering, and this effect is declared first so later ones see it current.
  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    firebaseUserRef.current = firebaseUser;
  }, [firebaseUser]);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      /**
       * `auth.currentUser` is authoritative and Firebase sets it *before*
       * signInWithPopup resolves, whereas the ref is only written from the
       * onAuthStateChanged callback — which is scheduled, not synchronous.
       * Reading the ref alone sent the very first request after a popup
       * sign-in with no Authorization header at all, and the bootstrap call
       * that establishes the account came back 401.
       */
      const current = getFirebaseAuth()?.currentUser ?? firebaseUserRef.current;
      if (!current) return null;
      // getIdToken refreshes automatically when the token is within 5 min of
      // expiry, so this is safe to call on every request.
      return current.getIdToken();
    });
    return () => setAuthTokenGetter(null);
  }, []);

  /**
   * Resolves the Firebase identity to a backend profile.
   *
   * Must use /users/me/profile, not /users/me: the latter belongs to the
   * legacy router, which authenticates backend-issued JWTs only and rejects
   * every Firebase ID token. That rejection was swallowed as "no profile", so
   * a fully onboarded user was permanently reported as still onboarding and
   * bounced back to /auth on every visit.
   *
   * Throws when the backend could not be reached. Callers must not read that
   * as "no profile" — a dropped request would otherwise sign a valid user out.
   */
  const fetchProfile = useCallback(async (): Promise<User | null> => {
    try {
      return await usersService.me();
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isNotFound) throw error;
    }

    // 404: verified identity, no local record. Create it here rather than only
    // in the sign-in handler — a persisted session is restored on whatever
    // page the user opens, which is usually not the one that ran sign-in.
    const created = await usersService.bootstrap(readReferral());
    // The account now exists, so the handle has been spent. Leaving it would
    // attribute a second, unrelated signup on this device to the same referrer.
    clearReferral();
    return created;
  }, []);

  /**
   * Park any `?ref=` before sign-in navigates away. Runs on every route because
   * an invite link can point anywhere, not only at the landing page.
   */
  useEffect(() => {
    captureReferral();
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();

    // No Firebase in this environment. Status already initialised to
    // signed-out above, so the public surfaces render and only sign-in itself
    // is unavailable — nothing to do here.
    if (!auth) return;

    /**
     * Watchdog. `loading` is the only status that renders nothing actionable,
     * so it must never be terminal. If Firebase has not reported within this
     * window we fall through to signed-out, which renders the sign-in buttons;
     * a real session still arrives later and corrects the status.
     *
     * Better to briefly offer sign-in to someone already signed in than to
     * trap everyone else on a spinner.
     */
    const watchdog = setTimeout(() => {
      /**
       * Never demote somebody who is demonstrably signed in.
       *
       * `auth.currentUser` is populated as soon as Firebase has restored the
       * persisted session, which can happen before onAuthStateChanged has
       * fired. Without this check a slow restore past the timeout showed the
       * sign-in screen to a returning user — they would sign in again, having
       * been signed in the whole time. Keep waiting instead; the listener
       * below still resolves it.
       */
      if (auth.currentUser) return;
      setStatus((current) => (current === 'loading' ? 'signed-out' : current));
    }, 8000);

    /**
     * Completes a redirect-based sign-in. onAuthStateChanged reports the
     * resulting session on its own, so the result itself is unused — this is
     * here to surface errors that would otherwise be swallowed and leave the
     * user staring at the sign-in screen they just came back from.
     */
    void getRedirectResult(auth).catch(async (error) => {
      // Same hidden-tab persistence refusal as the popup path. Coming back
      // from Google can land while the document is still reported hidden, and
      // without this the completed redirect is thrown away in a console line.
      if (isPersistenceHiddenError(error) && (await retryHiddenPersistence(auth))) return;
      console.error('[auth] Google redirect sign-in failed:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(watchdog);
      setFirebaseUser(user);
      firebaseUserRef.current = user;

      if (!user) {
        setProfileState(null);
        setStatus('signed-out');
        return;
      }

      try {
        const next = await fetchProfile();
        setProfileState(next);
        setStatus(next?.onboarded ? 'authenticated' : 'onboarding');
      } catch (error) {
        // Backend unreachable. Whether this user has a profile is unknown, so
        // hold whatever was already established instead of demoting a signed-in
        // session to 'onboarding' and throwing them out of the app.
        console.error('[auth] could not load profile:', error);
        setStatus((current) => (current === 'loading' ? 'onboarding' : current));
      }
    });

    return () => {
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [fetchProfile]);

  /**
   * Rejects when the user comes back from the Google popup without signing in.
   *
   * `signInWithPopup` normally rejects with auth/popup-closed-by-user, but it
   * detects closure by polling the popup's window handle — and when that
   * detection fails (a COOP boundary, an in-app browser, or a chooser dismissed
   * before the handle is live) the promise simply never settles. Nothing
   * throws, so no catch runs, and the caller's `busy` flag stays true forever:
   * the button spins and the page looks frozen, which is exactly what closing
   * the account chooser produced.
   *
   * The signal is the user returning to *our* tab. If the document is visible
   * again and Firebase still has no user after a grace period, the attempt is
   * over. The grace matters: a successful popup also ends with our tab visible,
   * and currentUser is set slightly before onAuthStateChanged fires, so
   * rejecting immediately would cancel real sign-ins.
   */
  const abandonedPopup = (auth: ReturnType<typeof getFirebaseAuth>) =>
    new Promise<never>((_resolve, reject) => {
      if (typeof document === 'undefined') return;

      const GRACE_MS = 2500;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      };

      function onVisible() {
        if (document.visibilityState !== 'visible') return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (auth?.currentUser) return; // real sign-in landed; leave it alone
          cleanup();
          reject(
            Object.assign(new Error('Sign-in was cancelled.'), {
              code: 'auth/popup-closed-by-user',
            }),
          );
        }, GRACE_MS);
      }

      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    });

  const signInWithGoogle = useCallback(async (): Promise<SignInOutcome> => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Sign-in is not configured for this environment.');

    try {
      await Promise.race([signInWithPopup(auth, googleProvider), abandonedPopup(auth)]);
      // onAuthStateChanged drives the rest; nothing to do here.
      return 'popup';
    } catch (error) {
      /**
       * The credential arrived while our tab was still behind the Google
       * popup, so persistence refused the write. The user is signed in but
       * unsaved — retry the write now rather than reporting a failure for a
       * sign-in that actually worked.
       */
      if (isPersistenceHiddenError(error) && (await retryHiddenPersistence(auth))) {
        return 'popup';
      }

      const code = (error as { code?: string }).code ?? '';
      /**
       * Popups are unavailable in more places than they are available: iOS
       * Safari with the default blocker, every in-app browser (Instagram,
       * LinkedIn, Gmail), and locked-down enterprise profiles. Falling back to
       * a full-page redirect is the only way those users can sign in at all.
       *
       * A user-cancelled popup is deliberately not on this list — reopening
       * the flow they just dismissed, as a redirect, would be hostile.
       */
      const popupUnavailable =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/internal-error';

      if (!popupUnavailable) throw error;

      await signInWithRedirect(auth, googleProvider);
      return 'redirect';
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    setProfileState(null);
    setStatus('signed-out');
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const next = await fetchProfile();
      setProfileState(next);
      setStatus(next?.onboarded ? 'authenticated' : 'onboarding');
      return next;
    } catch (error) {
      // Same rule as the auth listener: a failed re-read is not evidence that
      // the profile went away, so leave the current state alone.
      console.error('[auth] could not refresh profile:', error);
      return null;
    }
  }, [fetchProfile]);

  const setProfile = useCallback((user: User) => {
    setProfileState(user);
    setStatus(user.onboarded ? 'authenticated' : 'onboarding');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      firebaseUser,
      profile,
      signInWithGoogle,
      signOut,
      refreshProfile,
      setProfile,
    }),
    [status, firebaseUser, profile, signInWithGoogle, signOut, refreshProfile, setProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience for components that only render when a profile exists. */
export function useProfile(): User | null {
  return useAuth().profile;
}

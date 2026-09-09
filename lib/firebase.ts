'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import { config } from '@/lib/config';

/**
 * Firebase is the identity provider only — Google Sign-In and Phone OTP.
 * All application data lives in the Mongo/Express backend. Do not add
 * Firestore, RTDB or Storage imports here.
 *
 * `databaseURL` and `measurementId` are carried in the config because the
 * console hands them over as one block, but neither is used:
 *   - RTDB: live positions/presence/typing go over Socket.IO instead.
 *   - Analytics: getAnalytics() is deliberately not called. It drops a cookie
 *     and pulls in ~40 kB, so it should be wired up behind a consent gate
 *     rather than fired on every page load.
 */

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
/** Latches after a failed init so we don't retry on every render. */
let initFailed = false;

/**
 * True only when the web config is actually present. Firebase throws
 * `auth/invalid-api-key` from getAuth() when it isn't — and because the auth
 * provider mounts at the root, that would take down the public landing page
 * too. Everything below degrades instead of throwing.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(config.firebase.apiKey && config.firebase.appId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  if (!isFirebaseConfigured() || initFailed) return null;
  try {
    app = getApps().length ? getApp() : initializeApp(config.firebase);
    return app;
  } catch (error) {
    initFailed = true;
    console.error('[firebase] initialisation failed:', error);
    return null;
  }
}

/**
 * Returns null when Firebase is unavailable. Callers must handle that —
 * sign-in surfaces a message, and everything that does not need identity
 * carries on working.
 */
export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  try {
    /**
     * Persistence is declared up front as an ordered fallback rather than set
     * afterwards with setPersistence().
     *
     * This matters: Firebase gates its first onAuthStateChanged emission on
     * persistence being ready. A fire-and-forget setPersistence() that never
     * settles — which is what happens when IndexedDB is unavailable, as in
     * private browsing, storage-blocked or locked-down enterprise browsers —
     * leaves the app on a loading spinner forever with no way to sign in.
     *
     * Declaring the chain lets Firebase degrade localStorage → IndexedDB →
     * in-memory on its own and still emit. In-memory means the session ends
     * with the tab, which is the correct trade against not signing in at all.
     *
     * localStorage is deliberately ahead of IndexedDB, which is the opposite
     * of Firebase's own default.
     *
     * IndexedDBLocalPersistence listens for `pagehide` and `visibilitychange`
     * and, the moment the document is hidden, sets an internal `isHiding` flag
     * and closes the connection. Every read or write while that flag is up
     * throws a bare `Error('Database is closing/hidden')` — see
     * `_openDb()` in @firebase/auth. A Google sign-in hides the document by
     * definition: the popup takes focus, and on mobile it is a whole separate
     * tab. Google posts the credential back while our document is still
     * hidden, so Firebase sets `currentUser` in memory, then throws on the
     * persistence write that follows. signInWithPopup rejects, the auth
     * listener is never notified, and the user is shown the SDK's raw internal
     * string while being — briefly, unpersistedly — signed in. That is the
     * "Database is closing/hidden" sign-in failure.
     *
     * localStorage has no such lifecycle: it is synchronous and readable while
     * hidden, so the write simply lands. The stored blob is one small JSON
     * object, so the synchronous cost is not worth optimising against.
     *
     * Existing sessions are not lost by this reorder. PersistenceUserManager
     * searches *every* persistence in the hierarchy for a stored user, then
     * migrates it to the first available one and clears the rest, so anybody
     * currently held in IndexedDB is moved into localStorage on their next
     * load rather than being signed out.
     */
    authInstance = initializeAuth(firebaseApp, {
      persistence: [
        browserLocalPersistence,
        indexedDBLocalPersistence,
        inMemoryPersistence,
      ],
      /**
       * Required, and easy to lose by switching from getAuth() to
       * initializeAuth().
       *
       * getAuth() installs this resolver for you. initializeAuth() gives you
       * only what you pass, and every popup/redirect operation asserts on it
       * — see the `_assert(this._popupRedirectResolver, …, 'argument-error')`
       * in @firebase/auth. Without it signInWithPopup, signInWithRedirect and
       * getRedirectResult all throw auth/argument-error before a window is
       * ever opened, which is exactly how "Continue with Google" failed.
       */
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // initializeAuth throws if auth was already initialised for this app
    // (React strict mode double-invoke, or a hot reload). Reuse it.
    try {
      authInstance = getAuth(firebaseApp);
    } catch (error) {
      initFailed = true;
      console.error('[firebase] auth unavailable:', error);
      return null;
    }
  }

  return authInstance;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * A second, isolated Firebase Auth instance used only to prove ownership of an
 * institute Google account.
 *
 * It has to be separate from the primary one: Firebase permits a single linked
 * account per provider, so a user who signed in with a personal Gmail cannot
 * also link their campus Google account. Signing into this throwaway instance
 * yields an ID token Google itself vouches for, which the server verifies and
 * then discards — the primary session is never touched.
 */
let verifierAuth: Auth | null = null;

export function getInstituteVerifierAuth(): Auth | null {
  if (verifierAuth) return verifierAuth;
  if (!isFirebaseConfigured()) return null;

  try {
    const existing = getApps().find((a) => a.name === 'institute-verifier');
    const app = existing ?? initializeApp(config.firebase, 'institute-verifier');
    // Same resolver requirement as the primary instance — this one exists
    // purely to run a popup, so without it it cannot do its only job.
    verifierAuth = initializeAuth(app, {
      persistence: [inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    return verifierAuth;
  } catch {
    try {
      verifierAuth = getAuth(getApp('institute-verifier'));
      return verifierAuth;
    } catch (error) {
      console.error('[firebase] institute verifier unavailable:', error);
      return null;
    }
  }
}

/**
 * Google provider scoped to one institute domain.
 *
 * `hd` is only a UI hint — Google does not guarantee it, and a determined user
 * can still complete the flow with another account. The domain is therefore
 * re-checked on the server against the verified token; this just makes the
 * account chooser show the right thing.
 */
export function instituteGoogleProvider(domain: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: domain, prompt: 'select_account' });
  return provider;
}

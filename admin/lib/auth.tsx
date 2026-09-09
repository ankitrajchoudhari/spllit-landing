'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';

import { api, ApiError, setTokenGetter } from '@/lib/api';
import { currentIdToken, getFirebaseAuth, signOutOfConsole } from '@/lib/firebase';
import type { AdminSession, Permission } from '@/lib/permissions';

/**
 * Console session state.
 *
 * Two separate questions, deliberately kept apart:
 *
 *   1. Is someone signed in?          — answered by Firebase
 *   2. Are they allowed in here?      — answered by the backend
 *
 * Collapsing them is the classic frontend-only admin check. A signed-in
 * Spllit user with no console role reaches step 1 perfectly happily; only the
 * call to /me tells us they may not be here, and that call is authorised
 * server-side against a role read fresh from the database.
 */

type Status =
  | 'loading' // Firebase is still restoring a persisted session
  | 'signed-out' // Nobody is signed in
  | 'checking' // Signed in; asking the backend whether they are an admin
  | 'denied' // Signed in, but not an admin
  | 'ready' // Signed in and authorised
  | 'error'; // The check itself failed — network or server fault

interface AuthState {
  status: Status;
  session: AdminSession | null;
  firebaseUser: FirebaseUser | null;
  /** Set when status is 'error', so the UI can say what actually went wrong. */
  error: string | null;
  signOut: () => Promise<void>;
  retry: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Wire the API layer to Firebase once, here, so lib/api.ts stays free of any
  // Firebase import and remains usable from tests.
  useEffect(() => {
    setTokenGetter(currentIdToken);
    return () => setTokenGetter(null);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      setFirebaseUser(user);
      if (!user) {
        setSession(null);
        setError(null);
        setStatus('signed-out');
      } else {
        setStatus('checking');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status !== 'checking') return;

    let cancelled = false;

    void (async () => {
      try {
        const me = await api<AdminSession>('/me');
        if (cancelled) return;
        setSession(me);
        setError(null);
        setStatus('ready');
      } catch (caught) {
        if (cancelled) return;

        if (caught instanceof ApiError && caught.isForbidden) {
          // Signed in as a real Spllit user who has no console role. Not an
          // error state — a legitimate answer to "may I come in".
          setSession(null);
          setStatus('denied');
          return;
        }

        setSession(null);
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Could not verify your access. Please try again.',
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, attempt]);

  const signOut = useCallback(async () => {
    await signOutOfConsole();
    setSession(null);
    setStatus('signed-out');
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setStatus('checking');
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      firebaseUser,
      error,
      signOut,
      retry,
      can: (permission: Permission) => Boolean(session?.permissions.includes(permission)),
    }),
    [status, session, firebaseUser, error, signOut, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

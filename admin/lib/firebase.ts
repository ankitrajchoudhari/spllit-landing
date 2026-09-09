'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';

import { config } from '@/lib/config';

/**
 * Firebase, identity only — exactly as the main app uses it.
 *
 * The console signs in against the same Firebase project as spllit.app, which
 * is what makes "one identity across the platform" true: an admin is a Spllit
 * user whose row carries a console role. There is no second password store to
 * keep in sync, and revoking someone in the console revokes them everywhere.
 *
 * Signing in successfully proves who you are and nothing more. Whether you may
 * see anything is decided by the backend on every request.
 */

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(config.firebase);
  return app;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  // Survives a refresh, which matters when an admin is moving between the
  // console and the dashboards they are comparing it against.
  void setPersistence(auth, browserLocalPersistence);
  return auth;
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Always show the chooser: an admin often has a personal and a work Google
  // account in the same browser, and silently reusing the last one signs them
  // in as the wrong person.
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(getFirebaseAuth(), provider);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim().toLowerCase(), password);
}

export async function signOutOfConsole(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/** Fresh ID token for the API layer. Firebase refreshes it when near expiry. */
export async function currentIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

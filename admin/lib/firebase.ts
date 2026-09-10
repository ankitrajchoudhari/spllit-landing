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
  OAuthProvider,
  type Auth,
} from 'firebase/auth';

import { config, zohoEnabled } from '@/lib/config';

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

/**
 * Zoho sign-in, through Firebase's generic OIDC support.
 *
 * Zoho is not a built-in Firebase provider the way Google is. This works only
 * once Zoho has been registered as an OIDC provider in Firebase — which needs
 * Identity Platform — and `NEXT_PUBLIC_ZOHO_PROVIDER_ID` set to that provider's
 * id (Firebase requires the `oidc.` prefix, e.g. `oidc.zoho`).
 *
 * Until then `zohoEnabled` is false and the sign-in screen does not offer it,
 * so this is never reachable in a state where it would fail.
 */
export async function signInWithZoho(): Promise<void> {
  if (!zohoEnabled) {
    throw new Error('Zoho sign-in is not configured for this deployment.');
  }

  const provider = new OAuthProvider(config.zohoProviderId);
  // Zoho's OIDC scopes. `email` is the one that matters: the backend resolves
  // an admin by matching the token's email against the User collection, so a
  // token without one cannot be tied to an account.
  provider.addScope('email');
  provider.addScope('profile');

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

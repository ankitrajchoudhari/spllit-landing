/**
 * Environment, read in one place.
 *
 * Same rule as the main app: nothing else in this project touches
 * `process.env` directly, and no key or URL is hardcoded in a component.
 *
 * Every value here is NEXT_PUBLIC_ and therefore compiled into the browser
 * bundle. That is the whole reason the console holds no secrets: the Mongo
 * URL, the Firebase Admin credentials, the Mapbox server token and the
 * Razorpay keys stay on the backend, and the console reaches them only through
 * an authenticated API call.
 */

function required(value: string | undefined, name: string): string {
  // Empty rather than throwing at import time: a missing variable should
  // surface as one clear message in the UI, not a white screen from a module
  // that failed to evaluate before React mounted.
  if (!value) {
    if (typeof window !== 'undefined') {
      console.error(`[config] ${name} is not set. The console cannot reach the API.`);
    }
    return '';
  }
  return value;
}

export const config = {
  env: process.env.NEXT_PUBLIC_ENV ?? 'development',

  api: {
    baseUrl: required(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL'),
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? '',
  },

  firebase: {
    apiKey: required(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: required(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    ),
    projectId: required(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    ),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: required(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, 'NEXT_PUBLIC_FIREBASE_APP_ID'),
  },
} as const;

export const isConfigured = Boolean(config.api.baseUrl && config.firebase.apiKey);

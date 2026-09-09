/**
 * Firebase Auth error codes → messages a user can act on.
 *
 * The previous catch-all ("Could not send the code") hid the actual cause, and
 * most phone-auth failures are configuration problems that look identical to
 * a mistyped number. Several of these need a change in the Firebase Console,
 * not a retry — saying so saves a long debugging session.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number':
    'That phone number is not valid. Include the country code and no spaces.',
  'auth/missing-phone-number': 'Enter a phone number first.',
  'auth/quota-exceeded':
    'The SMS quota for this project is used up. Try again later or use Google sign-in.',
  'auth/too-many-requests':
    'Too many attempts from this device. Wait a few minutes and try again.',
  'auth/operation-not-allowed':
    'Phone sign-in is turned off for this project. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/billing-not-enabled':
    'Phone sign-in needs a Firebase Blaze (pay-as-you-go) plan. Upgrade the project, then try again.',
  'auth/invalid-app-credential':
    'reCAPTCHA could not be verified. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/captcha-check-failed':
    'reCAPTCHA check failed. Reload the page and try again.',
  'auth/unauthorized-domain':
    'This domain is not authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/invalid-verification-code': 'That code did not match. Check it and try again.',
  'auth/code-expired': 'That code has expired. Request a new one.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and retry.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/invalid-api-key':
    'Firebase is misconfigured for this environment (invalid API key).',
};

/**
 * Bare `Error`s thrown from inside the SDK, matched on message because they
 * carry no code.
 *
 * The fallback below deliberately surfaces `error.message`, which is right for
 * the errors this app throws itself — they are written for the person reading
 * them. Firebase's internals are not: "Database is closing/hidden" is a note
 * to a Firebase maintainer, and users were being shown it verbatim when a
 * sign-in raced a hidden tab. Anything matched here is replaced.
 *
 * The condition is handled properly in lib/auth/auth-provider.tsx, which
 * retries the write; this only governs what is said when that retry also fails.
 */
const INTERNAL_MESSAGES: { pattern: RegExp; message: string }[] = [
  {
    pattern: /database is closing\/hidden/i,
    message:
      'Sign-in could not finish because the tab lost focus. Keep this tab in front and try again.',
  },
];

interface MaybeFirebaseError {
  code?: unknown;
  message?: unknown;
}

export function firebaseErrorMessage(error: unknown, fallback: string): string {
  const code = (error as MaybeFirebaseError)?.code;
  if (typeof code === 'string') {
    const known = MESSAGES[code];
    // Show the raw code alongside anything unmapped — an unknown code is far
    // more useful to act on than a generic apology.
    return known ?? `${fallback} (${code})`;
  }
  if (error instanceof Error && error.message) {
    const internal = INTERNAL_MESSAGES.find((entry) => entry.pattern.test(error.message));
    return internal ? internal.message : error.message;
  }
  return fallback;
}

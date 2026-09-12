import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
/**
 * Normalise the service-account private key.
 *
 * The key is almost always copied out of the service-account JSON, where the
 * line reads `"private_key": "-----BEGIN...-----\n",` — and the quotes and the
 * trailing comma come along with it. dotenv leaves them in place when the comma
 * sits outside the closing quote, so the value reaching this module can be
 * `"-----BEGIN…-----\n",` rather than the key itself.
 *
 * OpenSSL then fails with `DECODER routines::unsupported`, firebase-admin never
 * initialises, and *every* authenticated request fails token verification. The
 * cause is invisible from the symptom: it looks like sign-in is broken, not
 * like a stray comma in an env file.
 *
 * One env file with that shape is already in this repo's working tree, so this
 * is not hypothetical — it is a deploy away from taking production auth down.
 * Accepting the mis-pasted form costs three lines and removes the whole class
 * of failure.
 */
function normalisePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  // Trailing comma from the JSON line it was copied out of.
  if (key.endsWith(',')) key = key.slice(0, -1).trim();
  // Wrapping quotes, single or double, that dotenv did not strip.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Escaped newlines, whether they survived the quoting or not.
  return key.replace(/\\n/g, '\n');
}

const privateKey = normalisePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

let initialized = false;

export const isFirebaseAdminConfigured = () => {
  return Boolean(projectId && clientEmail && privateKey);
};

const ensureFirebaseAdmin = () => {
  if (initialized) return;
  if (!isFirebaseAdminConfigured()) return;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  initialized = true;
};

export const verifyFirebaseIdToken = async (idToken: string) => {
  ensureFirebaseAdmin();

  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }

  return getAuth().verifyIdToken(idToken);
};

/**
 * Stops this account minting new ID tokens from its refresh token.
 *
 * Half of ending a session. It does nothing about an ID token already in a
 * browser — those stay valid for up to an hour and `verifyIdToken` is
 * deliberately called without `checkRevoked`, which would cost a network round
 * trip on every authenticated request in the app. `User.sessionsRevokedAt`,
 * checked in middleware/identity.ts against the token's `auth_time`, is the
 * other half and is what makes the cut-off immediate.
 *
 * Both are needed: without this call the client silently refreshes and returns;
 * without the column the person keeps working for the rest of the hour.
 */
export const revokeFirebaseSessions = async (firebaseUid: string): Promise<void> => {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured');
  }
  await getAuth().revokeRefreshTokens(firebaseUid);
};

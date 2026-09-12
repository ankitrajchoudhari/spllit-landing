import { Response, NextFunction } from 'express';

import prisma from '../utils/prisma.js';
import { verifyAccessToken } from '../utils/helpers.js';
import { verifyFirebaseIdToken, isFirebaseAdminConfigured } from '../utils/firebaseAdmin.js';
import { AuthRequest } from '../types/express.js';
import { markActive } from '../services/activeUsers.js';

/**
 * Dual-scheme authentication.
 *
 * The web client sends a Firebase ID token (Google Sign-In / Phone OTP);
 * existing clients send the backend-issued JWT. Both resolve to the same
 * `req.user`, so downstream handlers never care which one arrived. This is what
 * keeps "one identity" true across web and mobile without forcing a migration
 * on either side.
 *
 * Order matters: the backend JWT is checked first because it is the cheaper
 * verification (local signature) and is what most existing traffic carries.
 */
export async function identify(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const token = header.substring(7);

  try {
    req.user = verifyAccessToken(token);
    // Fire-and-forget, deduplicated in memory to one write per user per
    // day. See services/activeUsers.ts — this is the hottest path in the app.
    markActive(req.user.userId);
    next();
    return;
  } catch {
    // Not a backend JWT — fall through to Firebase.
  }

  if (!isFirebaseAdminConfigured()) {
    // Distinct from a bad token: the server has no credentials to verify with.
    // Logged because the silent version of this was indistinguishable in the
    // logs from a user simply presenting a bad token.
    console.error('[identify] Firebase Admin is not configured — check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  /**
   * Verification and lookup are caught separately, and this is not tidiness.
   *
   * They shared one `try`, so anything thrown below — including the database
   * being unreachable — was reported as `401 Invalid token`. That is a lie in
   * the most expensive direction: it blames the caller's credentials for a
   * server-side outage. A rotated database password cost four rounds of
   * debugging Firebase keys, service-account IAM and Secret Manager, because a
   * perfectly valid token kept coming back "Invalid".
   *
   * A token we cannot verify is 401. A database we cannot reach is 503, which
   * is both true and the thing a client should retry.
   */
  let decoded: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  try {
    decoded = await verifyFirebaseIdToken(token);
  } catch (error) {
    console.error('[identify] Firebase verification failed:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  try {
    // Resolve the Firebase identity to a local user. Matching on firebaseUid
    // first, then email, lets accounts created before firebaseUid existed
    // adopt their uid on the next sign-in instead of forking into a duplicate.
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid: decoded.uid },
          ...(decoded.email ? [{ email: decoded.email }] : []),
        ],
      },
    });

    if (user && !user.firebaseUid) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: decoded.uid },
      });
    }

    if (!user) {
      // A verified Firebase identity with no local profile is the onboarding
      // case. /auth/firebase-login creates the record; everything else 404s so
      // the client knows to run onboarding rather than retrying blindly.
      res.status(404).json({ success: false, message: 'Profile not found', code: 'no-profile' });
      return;
    }

    /**
     * Sessions cut off by an admin.
     *
     * `auth_time` is when the person actually signed in, and it survives token
     * refresh — `iat` does not, so a client quietly refreshing would walk
     * straight back in if this compared that instead.
     *
     * Done here rather than by passing `checkRevoked` to `verifyIdToken`,
     * which would ask Firebase to fetch the user record on *every* authenticated
     * request in the app. This is a comparison against a row already loaded on
     * the line above, and it costs nothing. Firebase's own
     * `revokeRefreshTokens` is still called alongside it, so the client cannot
     * mint a replacement; this is what stops the token already in their hand.
     */
    if (user.sessionsRevokedAt && typeof decoded.auth_time === 'number') {
      if (decoded.auth_time * 1000 < user.sessionsRevokedAt.getTime()) {
        res.status(401).json({
          success: false,
          message: 'Your session was ended. Sign in again.',
          code: 'session-revoked',
        });
        return;
      }
    }

    req.user = { userId: user.id, email: user.email };
    // Fire-and-forget, deduplicated in memory to one write per user per
    // day. See services/activeUsers.ts — this is the hottest path in the app.
    markActive(req.user.userId);
    next();
  } catch (error) {
    // The token was already verified above, so reaching here means our own
    // storage failed, not the caller. 503 says so, and says it is worth
    // retrying — which 401 actively discourages.
    console.error('[identify] could not resolve the signed-in user:', error);
    res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
  }
}

/** Same resolution, but never rejects — for endpoints with a public fallback. */
export async function identifyOptional(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.substring(7);

  try {
    req.user = verifyAccessToken(token);
    // Fire-and-forget, deduplicated in memory to one write per user per
    // day. See services/activeUsers.ts — this is the hottest path in the app.
    markActive(req.user.userId);
    next();
    return;
  } catch {
    // fall through
  }

  if (!isFirebaseAdminConfigured()) {
    next();
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid: decoded.uid },
          ...(decoded.email ? [{ email: decoded.email }] : []),
        ],
      },
    });
    if (user) {
      req.user = { userId: user.id, email: user.email };
      markActive(user.id);
    }
  } catch {
    // Anonymous is a valid outcome here.
  }

  next();
}

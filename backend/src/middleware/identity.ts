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
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);

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

    req.user = { userId: user.id, email: user.email };
    // Fire-and-forget, deduplicated in memory to one write per user per
    // day. See services/activeUsers.ts — this is the hottest path in the app.
    markActive(req.user.userId);
    next();
  } catch (error) {
    console.error('[identify] Firebase verification failed:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
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

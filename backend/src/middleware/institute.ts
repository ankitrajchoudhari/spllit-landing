import { Response, NextFunction } from 'express';

import prisma from '../utils/prisma.js';
import { fail } from '../utils/respond.js';
import { instituteDomainList } from '../data/institutes.js';
import { AuthRequest } from '../types/express.js';
import { getBoolean } from '../services/platformSettings.js';

/**
 * Campus verification gate.
 *
 * Spllit's safety model is that everyone you travel with is a verified member
 * of a named institute. That claim is only true if it is enforced on the way
 * in, so any endpoint that puts a user in a vehicle or a group with strangers
 * sits behind this.
 *
 * Verification means the user proved ownership of an address on their
 * institute's domain by signing in to that Google account — a token Google
 * vouches for, checked server-side in POST /users/me/institute-email. A typed
 * address is never enough.
 *
 * Deliberately *not* applied to browsing. Seeing that rides exist is what
 * motivates someone to verify; hiding the map until they do leaves a new
 * account staring at nothing with no reason to continue.
 */
export async function requireVerifiedInstitute(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { instituteVerified: true, instituteId: true, college: true },
  });

  if (!user) {
    fail(res, 404, 'Profile not found', 'no-profile');
    return;
  }

  if (user.instituteVerified) {
    next();
    return;
  }

  if (!user.instituteId) {
    fail(
      res,
      403,
      'Choose your institute and verify your campus email first.',
      'institute-required',
    );
    return;
  }

  // Every accepted address, not just the canonical one — naming a single
  // domain tells a student on one of the others that theirs will not work.
  const domains = instituteDomainList(user.instituteId);
  fail(
    res,
    403,
    domains
      ? `Verify your ${domains} email to do this.`
      : `${user.college} has no verifiable email domain yet.`,
    'institute-unverified',
  );
}

/**
 * The same campus gate for the deprecated /api/rides and /api/matches writes.
 *
 * Those routers predate verification and never checked it, so anyone could
 * offer or join a ride through them regardless of the rule above. Answers in
 * the legacy `{ error }` shape their clients read.
 *
 * Controlled by the `security.legacy_require_institute` platform setting
 * (default on) so it can be relaxed from the console, without a deploy, if an
 * older client turns out to have no way to verify.
 */
export async function requireVerifiedInstituteLegacy(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!(await getBoolean('security.legacy_require_institute', true))) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { instituteVerified: true },
    });

    if (!user?.instituteVerified) {
      res.status(403).json({
        error: 'Verify your campus email in the Spllit app to offer or join rides.',
        code: 'institute-unverified',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[institute/legacy]', error);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
}

import type { User } from '@prisma/client';

import prisma from '../utils/prisma.js';

/** The claims this module reads from a verified Firebase ID token. */
export interface FirebaseClaims {
  uid: string;
  email?: string;
  email_verified?: boolean;
  auth_time?: number;
}

/**
 * The address a token may be matched on, or null when it may not be.
 *
 * Only an address Firebase has verified. Email/password sign-up is enabled on
 * the project, so an unverified claim is just a string anyone can type — it
 * proves nothing about who owns the mailbox.
 */
export function linkableEmail(claims: FirebaseClaims): string | null {
  if (claims.email_verified !== true || !claims.email) return null;
  return claims.email.trim().toLowerCase();
}

/**
 * Whether adopting this row must also drop its password.
 *
 * A row nobody has linked to Firebase, whose email was never verified, with a
 * password: someone chose that password without proving they own the address.
 * POST /api/auth/register creates exactly this for any email, so it may be a
 * squat waiting for the real owner to sign in. The owner has just proven the
 * mailbox; the password is the one credential that has not been proven, so it
 * goes. They sign in with Firebase from here on.
 */
export function mustDropPassword(
  row: Pick<User, 'firebaseUid' | 'emailVerified' | 'password'>,
): boolean {
  return !row.firebaseUid && !row.emailVerified && row.password != null;
}

/**
 * The local user a verified Firebase identity resolves to, or null.
 *
 * One resolver for every entry point — identify, identifyOptional, the socket,
 * /users/me/bootstrap and /auth/firebase. They each carried their own copy of
 * "uid, else email", none checked email_verified, and so a Firebase account
 * made with somebody else's address resolved to that person's profile.
 *
 * Matching on uid first, then verified email, still lets accounts made before
 * firebaseUid existed adopt their uid instead of forking into a duplicate.
 */
export async function resolveFirebaseUser(claims: FirebaseClaims): Promise<User | null> {
  const byUid = await prisma.user.findFirst({ where: { firebaseUid: claims.uid } });
  if (byUid) return byUid;

  const email = linkableEmail(claims);
  if (!email) return null;

  // Stored addresses are lowercased on every write path today; the exact claim
  // is kept as well for rows older than that.
  const candidates = [...new Set([email, claims.email!])];
  const byEmail = await prisma.user.findFirst({ where: { email: { in: candidates } } });
  if (!byEmail) return null;

  // Already linked to another uid on the same verified mailbox — the same
  // person with a recreated Firebase account. Unchanged from before.
  if (byEmail.firebaseUid) return byEmail;

  const drop = mustDropPassword(byEmail);
  if (drop) {
    console.warn(`[identity] ${byEmail.id}: unverified password dropped on first verified sign-in`);
  }

  return prisma.user.update({
    where: { id: byEmail.id },
    data: {
      firebaseUid: claims.uid,
      emailVerified: true,
      ...(drop
        ? {
            password: null,
            // Ends any legacy JWT session the squatter still holds, via the
            // check in /auth/refresh. Pinned to this sign-in, not "now", so the
            // session that just proved the mailbox is not the one cut off.
            ...(typeof claims.auth_time === 'number'
              ? { sessionsRevokedAt: new Date(claims.auth_time * 1000) }
              : {}),
          }
        : {}),
    },
  });
}

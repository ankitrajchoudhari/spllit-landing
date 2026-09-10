import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import prisma from '../utils/prisma.js';

/**
 * Single-use links that identify one pending join request.
 *
 * A leader gets an email saying somebody asked to join. The link in it opens
 * that request directly instead of making them find the squad. What it does
 * *not* do is authorise anything.
 *
 * ## The token identifies; the session authorises
 *
 * This split is the whole design, and it is what makes the feature safe:
 *
 *   - the token says **which request** is being answered;
 *   - the session says **who is answering it**.
 *
 * Neither alone is enough. A valid token with no session gets nothing; a
 * session with no token can still act, through the ordinary in-app route. So a
 * forwarded email hands the recipient a pointer to a request they still cannot
 * act on, which is the property that matters for a squad sharing live location.
 *
 * ## Email links are fetched by machines
 *
 * Outlook Safe Links, Gmail's proxy, corporate scanners and antivirus all
 * request URLs found in mail before a human sees them. Any GET that decided a
 * request would therefore be decided by a scanner, minutes after sending and
 * without the leader reading a word. Nothing here mutates on GET: resolving a
 * token is a read, and the decision is a POST the person makes deliberately.
 *
 * ## Why hashed rows rather than signed tokens
 *
 * A signed token (a JWT, an HMAC) carries its own validity and cannot be taken
 * back — which is exactly wrong here, because a request answered in the app
 * must immediately kill the link that was emailed about it. A row can be
 * revoked. Storing only the hash means a dump of this collection yields nothing
 * anyone can use.
 */

/** 32 bytes. Long enough that guessing is not a threat model. */
const TOKEN_BYTES = 32;

/**
 * Roughly how long a join request stays worth answering.
 *
 * Long enough to survive a weekend, short enough that a link found in an old
 * mailbox is dead. Expiry is not the main defence — single use and the session
 * check are — it just stops tokens accumulating indefinitely.
 */
export const TOKEN_TTL_HOURS = 72;

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ResolvedToken {
  id: string;
  squadId: string;
  memberId: string;
  leaderId: string;
}

/** Why a token cannot be used. Deliberately collapsed for the caller. */
export type TokenFailure = 'not-found' | 'expired' | 'used' | 'answered';

/**
 * Mints a token for one pending request and returns the raw value.
 *
 * The raw token is returned once and never stored, so it exists only in the
 * email. Any existing tokens for the same request are revoked first: two live
 * links to one decision means the second reader can act after the first
 * already has.
 */
export async function createJoinRequestToken(params: {
  squadId: string;
  memberId: string;
  leaderId: string;
}): Promise<string> {
  await prisma.joinRequestToken.deleteMany({ where: { memberId: params.memberId } });

  const raw = randomBytes(TOKEN_BYTES).toString('base64url');

  await prisma.joinRequestToken.create({
    data: {
      tokenHash: hash(raw),
      squadId: params.squadId,
      memberId: params.memberId,
      leaderId: params.leaderId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000),
    },
  });

  return raw;
}

/**
 * Looks a token up without consuming it.
 *
 * Read-only on purpose: this is what the page calls to render "X wants to join
 * Y", and rendering a page must never be the thing that spends a single-use
 * token — a mail scanner fetching the link would otherwise burn it before the
 * leader arrived.
 *
 * The failure reasons are for logging. The endpoint collapses them into one
 * neutral message so the page cannot be used to probe which squads or requests
 * exist.
 */
export async function resolveJoinRequestToken(
  raw: string,
  now: Date = new Date(),
): Promise<{ token: ResolvedToken | null; reason: TokenFailure | null }> {
  const trimmed = raw.trim();
  if (!trimmed) return { token: null, reason: 'not-found' };

  const row = await prisma.joinRequestToken.findUnique({
    where: { tokenHash: hash(trimmed) },
  });

  if (!row) return { token: null, reason: 'not-found' };
  if (row.usedAt) return { token: null, reason: 'used' };
  if (row.expiresAt <= now) return { token: null, reason: 'expired' };

  /**
   * The request itself is the authority on whether it is still open.
   *
   * A leader who accepted in the app leaves the token row untouched, so
   * checking only the token would let the emailed link answer a request that
   * has already been decided. Reading the membership makes "answered elsewhere"
   * close the link without anything having to remember to revoke it.
   */
  const request = await prisma.squadMember.findFirst({
    where: { id: row.memberId, squadId: row.squadId, status: 'pending' },
    select: { id: true },
  });
  if (!request) return { token: null, reason: 'answered' };

  return {
    reason: null,
    token: {
      id: row.id,
      squadId: row.squadId,
      memberId: row.memberId,
      leaderId: row.leaderId,
    },
  };
}

/**
 * Marks a token spent, and refuses to do so twice.
 *
 * Guarded on `usedAt: null` in the update itself rather than checked first:
 * two requests arriving together would both pass a read-then-write check, and
 * this is the point at which a decision is taken. `count === 1` is the caller's
 * proof that it won.
 */
export async function consumeJoinRequestToken(tokenId: string): Promise<boolean> {
  const { count } = await prisma.joinRequestToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

/**
 * Revokes every token for a request, however it was answered.
 *
 * Called from the ordinary in-app decision path so accepting in the app kills
 * the emailed link. `resolveJoinRequestToken` would refuse it anyway once the
 * membership stops being pending — this removes the row rather than leaving it
 * to be re-checked, and cleans up after a withdrawal, where no decision was
 * ever taken.
 */
export async function revokeTokensForRequest(memberId: string): Promise<void> {
  try {
    await prisma.joinRequestToken.deleteMany({ where: { memberId } });
  } catch (error) {
    // Never fail a decision because cleanup failed; the resolve path already
    // refuses a token whose request is no longer pending.
    console.error('[join-tokens] could not revoke', error);
  }
}

/** Deletes expired and spent rows. Called from the maintenance sweep. */
export async function sweepJoinRequestTokens(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.joinRequestToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });
  return count;
}

/**
 * Constant-time equality for the two user ids the endpoint compares.
 *
 * Not because a timing attack on a cuid is realistic, but because this is the
 * authorisation comparison in a security-sensitive path and a `===` here is the
 * kind of thing that gets copied somewhere it does matter.
 */
export function sameUser(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

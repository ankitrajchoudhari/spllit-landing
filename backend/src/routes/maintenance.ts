import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, Request, Response } from 'express';

import { ok, fail } from '../utils/respond.js';
import { sweepErasedChats } from '../services/squadChatRetention.js';
import { sweepAllRead } from '../services/notificationRetention.js';
import { isEmailConfigured, sendTestEmail } from '../services/email.js';
import { sweepJoinRequestTokens } from '../services/joinRequestTokens.js';
import { sweepEmailSendLog } from '../services/emailPolicy.js';

/**
 * Scheduled maintenance, called by Cloud Scheduler rather than by a person.
 *
 * These jobs exist because Cloud Run offers no timer of its own: it scales to
 * zero, so `setInterval` armed inside the process dies with the instance, and
 * it runs several instances, so anything that did fire would fire N times. The
 * rest of the codebase works around that by deriving state on read and
 * sweeping opportunistically — see services/squadLifecycle.ts.
 *
 * Opportunistic is the right default for anything whose only cost is storage.
 * It is *not* enough for a deletion we have promised: "we erase squad chats
 * after four days" must not quietly mean "unless nobody opens the app". This
 * router is what turns that into a guarantee, by giving an external scheduler
 * something to call on a fixed cadence.
 *
 * ## Why a shared secret and not IAM
 *
 * The usual Cloud Run answer — require an OIDC token and let Cloud Run IAM
 * refuse everyone else — is unavailable here, because this service is public
 * by necessity: it serves the app. IAM is all-or-nothing per service, not per
 * route. So the route carries its own key.
 *
 * Fail-closed: with MAINTENANCE_KEY unset the endpoint does not exist. A
 * maintenance route that is open because a secret was forgotten is worse than
 * one that is broken, because nothing tells you about it.
 */

const router = Router();

/**
 * 404 rather than 401 for both "no key configured" and "wrong key".
 *
 * Same reasoning as the admin console's middleware: an unauthenticated caller
 * should not be able to confirm from the response that a privileged endpoint
 * exists at this path. A 401 says "you found something real, keep guessing".
 */
/**
 * A short, non-reversible fingerprint, so two values can be compared in logs
 * without either appearing in them.
 *
 * Eight hex characters of SHA-256 over a 32-byte random secret is of no use to
 * an attacker and is exactly enough to answer the only question worth asking
 * from the outside: are these the same string or not.
 */
function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function authorised(req: Request): boolean {
  /**
   * Trimmed on both sides, and this is the fix rather than a nicety.
   *
   * A secret written with `echo` instead of `printf` carries a trailing
   * newline, and Secret Manager stores exactly the bytes it is given. The
   * value then arrives here as "abc123\n" while the caller sends "abc123",
   * the lengths differ by one, and the request is refused — with a 404 that,
   * by design, explains nothing. Since no legitimate key has leading or
   * trailing whitespace, removing it costs nothing and removes the single most
   * common way of getting this wrong.
   */
  const expected = (process.env.MAINTENANCE_KEY ?? '').trim();
  if (!expected) return false;

  /**
   * `req.get` is case-insensitive: Node lowercases every incoming header name
   * and Express lowercases the lookup, so `X-Maintenance-Key` and
   * `x-maintenance-key` are the same header here. Casing is not a failure mode.
   */
  const provided = (req.get('x-maintenance-key') ?? '').trim();

  /**
   * Length is compared first because timingSafeEqual throws on a mismatch.
   * That leaks length, which for a machine-generated secret compared against
   * an attacker-supplied string is not the property worth protecting —
   * constant-time comparison of equal-length values is.
   */
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    /**
     * Logged only on refusal, and only in terms that cannot reconstruct
     * either value. This exists because the 404 is deliberately silent to the
     * caller, which makes a misconfigured key indistinguishable from a
     * missing route from the outside — and that is a genuinely painful thing
     * to debug blind.
     */
    console.warn(
      '[maintenance] refused: ' +
        `expected ${b.length} bytes (${fingerprint(expected)}), ` +
        `received ${a.length} bytes (${provided ? fingerprint(provided) : 'none'})`,
    );
    return false;
  }

  return true;
}

/**
 * POST /api/maintenance/sweep-chats
 *
 * Erases the messages of squads that ended longer ago than the retention
 * window allows. Idempotent: a second call finds nothing left and reports zero.
 *
 * Loops in bounded passes rather than deleting everything in one statement, so
 * a backlog is cleared without a single unbounded delete against the largest
 * collection in the database. `maxPasses` caps the work one invocation may do —
 * anything still outstanding is picked up by the next run, which for a daily
 * schedule is soon enough.
 */
router.post('/sweep-chats', async (req: Request, res: Response) => {
  if (!authorised(req)) return fail(res, 404, 'Not found');

  const maxPasses = Math.min(Math.max(Number(req.body?.maxPasses) || 20, 1), 100);

  let squads = 0;
  let messages = 0;
  let passes = 0;

  try {
    for (; passes < maxPasses; passes += 1) {
      const result = await sweepErasedChats();
      squads += result.squads;
      messages += result.messages;
      // Nothing due. Stop rather than spending the remaining passes proving it.
      if (result.squads === 0) break;
    }

    // Logged as well as returned: Cloud Scheduler keeps the response, but the
    // service's own logs are where anyone auditing deletion will look.
    console.log(
      `[maintenance] chat sweep: ${messages} messages from ${squads} squads over ${passes} passes`,
    );

    return ok(res, { squads, messages, passes, complete: passes < maxPasses });
  } catch (error) {
    console.error('[maintenance] chat sweep failed', error);
    return fail(res, 500, 'Sweep failed');
  }
});

/**
 * POST /api/maintenance/sweep-notifications
 *
 * Deletes read notifications past their retention window, across every user.
 *
 * The app already sweeps a user's own expired rows whenever they open their
 * inbox. That covers everybody who keeps using Spllit and nobody who stops —
 * and the ones who stop are exactly the accounts whose notifications would
 * otherwise sit forever. This is the pass that reaches them.
 */
router.post('/sweep-notifications', async (req: Request, res: Response) => {
  if (!authorised(req)) return fail(res, 404, 'Not found');

  const limit = Math.min(Math.max(Number(req.body?.limit) || 5000, 1), 20_000);

  try {
    const { deleted } = await sweepAllRead(new Date(), limit);
    console.log(`[maintenance] notification sweep: ${deleted} read notifications removed`);
    // `complete` false means the cap was hit and more are due; a daily job
    // will clear the rest, but a backlog is worth knowing about.
    return ok(res, { deleted, complete: deleted < limit });
  } catch (error) {
    console.error('[maintenance] notification sweep failed', error);
    return fail(res, 500, 'Sweep failed');
  }
});

/**
 * POST /api/maintenance/sweep
 *
 * Everything above, in one call.
 *
 * Exists so the schedule is one job rather than one per retention rule. Adding
 * a rule should not mean remembering to add a Cloud Scheduler job, and a job
 * that silently never got created is not a failure anyone notices — the data
 * simply stays. The individual routes remain for running one in isolation.
 *
 * Never fails as a whole because one part failed: each sweep reports its own
 * outcome, so a broken chat sweep does not also stop notifications being
 * cleaned up.
 */
router.post('/sweep', async (req: Request, res: Response) => {
  if (!authorised(req)) return fail(res, 404, 'Not found');

  const results: Record<string, unknown> = {};

  try {
    const chat = await sweepErasedChats();
    results.chat = chat;
  } catch (error) {
    console.error('[maintenance] chat sweep failed', error);
    results.chat = { error: 'failed' };
  }

  try {
    const notifications = await sweepAllRead();
    results.notifications = notifications;
  } catch (error) {
    console.error('[maintenance] notification sweep failed', error);
    results.notifications = { error: 'failed' };
  }

  try {
    // Spent and expired decision links. They authorise nothing once used, so
    // this is housekeeping rather than a security boundary.
    results.joinTokens = { deleted: await sweepJoinRequestTokens() };
  } catch (error) {
    console.error('[maintenance] join token sweep failed', error);
    results.joinTokens = { error: 'failed' };
  }

  try {
    // Send-log rows older than the longest window that reads them.
    results.emailLog = { deleted: await sweepEmailSendLog() };
  } catch (error) {
    console.error('[maintenance] email log sweep failed', error);
    results.emailLog = { error: 'failed' };
  }

  console.log(`[maintenance] sweep: ${JSON.stringify(results)}`);
  return ok(res, results);
});

/**
 * POST /api/maintenance/email-test  { "to": "you@example.com" }
 *
 * Confirms the sending domain works end to end, without having to provoke a
 * real join request against a real person to find out.
 *
 * The recipient must already be a verified Spllit user — see sendTestEmail for
 * why an endpoint that mails arbitrary addresses would be a liability on the
 * very domain this is meant to protect.
 */
router.post('/email-test', async (req: Request, res: Response) => {
  if (!authorised(req)) return fail(res, 404, 'Not found');

  const to = String(req.body?.to ?? '').trim();
  if (!to) return fail(res, 400, 'Pass { "to": "address" }');

  const result = await sendTestEmail(to);
  return ok(res, { configured: isEmailConfigured(), ...result });
});

export default router;

import { timingSafeEqual } from 'node:crypto';
import { Router, Request, Response } from 'express';

import { ok, fail } from '../utils/respond.js';
import { sweepErasedChats } from '../services/squadChatRetention.js';

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
function authorised(req: Request): boolean {
  const expected = process.env.MAINTENANCE_KEY;
  if (!expected) return false;

  const provided = req.get('x-maintenance-key') ?? '';

  /**
   * Length is compared first because timingSafeEqual throws on a mismatch, and
   * the comparison itself must not leak length through timing either — hence
   * hashing both to a fixed width would be the paranoid option. Here the key is
   * a machine-generated secret compared against an attacker-supplied string, so
   * equal-length constant-time comparison is the meaningful protection.
   */
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

export default router;

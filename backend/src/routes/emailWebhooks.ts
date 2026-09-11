import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, Request, Response } from 'express';

import { suppressAddress } from '../services/emailPolicy.js';

/**
 * Resend delivery webhooks.
 *
 * This is the half of email that decides whether the domain keeps working.
 * Sending is easy; *stopping* is what protects a sender. A hard bounce means
 * the mailbox does not exist, and a complaint means somebody pressed "this is
 * spam" — continuing to send to either is the fastest route to being blocked
 * by Gmail and Outlook, and neither is a decision we get to disagree with.
 *
 * Mounted outside /api because it is not part of the app's API surface: it is
 * an integration endpoint called by one known third party.
 */

const router = Router();

/**
 * Verifies Resend's signature, which is Svix's scheme.
 *
 * Three headers: an id, a timestamp and one or more space-separated signatures
 * of the form `v1,<base64>`. The signed payload is `id.timestamp.body`, HMAC'd
 * with the secret after its `whsec_` prefix is stripped and the rest
 * base64-decoded.
 *
 * The raw body is required, byte for byte. `JSON.parse` followed by
 * `JSON.stringify` does not round-trip — key order and number formatting can
 * both change — so this route is mounted with a raw body parser and parses the
 * JSON itself afterwards.
 *
 * Implemented here rather than by adding the `svix` package: it is thirty lines
 * of standard-library crypto against a documented format, in a service that
 * rebuilds from source on every push.
 */
function verifySignature(req: Request, raw: Buffer): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  // Fail closed. An unverified webhook is an open endpoint that lets anyone
  // suppress any address — which is a denial-of-service on your own email.
  if (!secret) return false;

  const id = req.get('svix-id');
  const timestamp = req.get('svix-timestamp');
  const signatures = req.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;

  /**
   * Reject anything older than five minutes.
   *
   * A signature stays valid forever unless time is part of the check, so a
   * captured request could be replayed indefinitely — and every replay of a
   * bounce is another address suppressed.
   */
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${raw.toString('utf8')}`)
    .digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Several signatures may be present during a secret rotation; any one
  // matching is enough.
  return signatures.split(' ').some((entry) => {
    const value = entry.startsWith('v1,') ? entry.slice(3) : entry;
    const candidate = Buffer.from(value);
    return candidate.length === expectedBuf.length && timingSafeEqual(candidate, expectedBuf);
  });
}

/**
 * POST /webhooks/resend
 *
 * Always answers 200 once the signature is good, whatever happens next. A
 * webhook that returns an error is retried, and a retry of an event we have
 * already handled is pure noise — the work here is idempotent, so there is
 * nothing a retry could fix.
 */
router.post('/resend', async (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

  if (!verifySignature(req, raw)) {
    console.warn('[email webhook] rejected an unsigned or stale request');
    return res.status(401).json({ ok: false });
  }

  let event: { type?: string; data?: { to?: string[] | string; bounce?: { type?: string } } };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    // Signed but unparseable. Not worth a retry.
    return res.status(200).json({ ok: true });
  }

  const recipients = Array.isArray(event.data?.to)
    ? event.data.to
    : event.data?.to
      ? [event.data.to]
      : [];

  try {
    for (const address of recipients) {
      if (event.type === 'email.bounced') {
        /**
         * Soft bounces are not suppressed. A full mailbox or a server having a
         * bad afternoon is temporary, and permanently silencing somebody over
         * it is a worse outcome than one retried message. Only a hard bounce —
         * the address does not exist — is a permanent fact.
         */
        const hard = (event.data?.bounce?.type ?? '').toLowerCase().includes('hard');
        if (hard) await suppressAddress(address, 'bounce', event.data?.bounce?.type);
      } else if (event.type === 'email.complained') {
        // No soft version of this. Somebody said it was spam.
        await suppressAddress(address, 'complaint');
      }
    }
  } catch (error) {
    console.error('[email webhook] could not record', error);
  }

  return res.status(200).json({ ok: true });
});

export default router;

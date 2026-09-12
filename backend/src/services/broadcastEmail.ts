import prisma from '../utils/prisma.js';
import { EMAIL_CATEGORIES, mayEmail } from './emailPolicy.js';
import { sendCampaignMessage } from './email.js';

/**
 * Emailing the people a console broadcast was aimed at.
 *
 * The broadcast composer writes in-app notifications. This is the same message
 * through a channel that cannot be recalled and that spends sending reputation,
 * so it is opt-in per send and carries more rules.
 *
 * ## Every recipient is checked individually
 *
 * An admin-initiated send is exactly where skipping the policy "just this once"
 * is tempting, and exactly where the consequences are worst: one unverified
 * address is a hard bounce, and hard bounces are what get a sending domain
 * blocked. So each person goes through `mayEmail` — verified address, not
 * suppressed, not opted out of announcements — and anyone refused is counted
 * rather than sent to.
 *
 * ## It is a campaign, for reputation purposes
 *
 * Sent through `sendCampaignMessage`, which uses CAMPAIGN_EMAIL_FROM. An
 * announcement is the likeliest message to draw a spam complaint, and that must
 * never be able to stop "your request was accepted" reaching somebody. The
 * caller refuses the send outright when that domain is unconfigured rather than
 * falling back to the transactional sender.
 *
 * The CAMPAIGN category also bypasses the per-person hourly cap inside
 * `mayEmail` — one announcement to everybody must not be silenced for somebody
 * who happened to have a busy squad that hour — while still honouring
 * suppression and opt-out, which are the rules that protect the domain.
 */

/** Chunked so one send does not open thousands of concurrent requests. */
const BATCH = 50;

export interface BroadcastEmailResult {
  /** Accepted by the provider. Delivery is a separate question. */
  sent: number;
  /** Refused by policy: unverified, suppressed, or opted out. */
  skipped: number;
  /** Accepted by policy, refused by the provider. */
  failed: number;
}

export async function broadcastEmail(params: {
  userIds: string[];
  subject: string;
  body: string;
}): Promise<BroadcastEmailResult> {
  const result: BroadcastEmailResult = { sent: 0, skipped: 0, failed: 0 };
  if (params.userIds.length === 0) return result;

  /**
   * A stable id for the whole send, so the provider's idempotency and the
   * unsubscribe footer both treat it as one announcement rather than as N
   * unrelated messages.
   */
  const broadcastId = `broadcast-${Date.now()}`;

  for (let i = 0; i < params.userIds.length; i += BATCH) {
    const slice = params.userIds.slice(i, i + BATCH);

    const verdicts = await Promise.all(
      slice.map(async (userId) => {
        try {
          const verdict = await mayEmail({ userId, category: EMAIL_CATEGORIES.CAMPAIGN });
          if (!verdict.allowed) return null;
          return { email: verdict.email!, name: verdict.name! };
        } catch {
          // A policy check that throws must not be read as permission.
          return null;
        }
      }),
    );

    const recipients = verdicts.filter((v): v is { email: string; name: string } => v !== null);
    result.skipped += slice.length - recipients.length;
    if (recipients.length === 0) continue;

    const ok = await sendCampaignMessage({
      campaignId: broadcastId,
      subject: params.subject,
      body: params.body,
      recipients,
    });

    if (ok) result.sent += recipients.length;
    else result.failed += recipients.length;
  }

  /**
   * Deliberately not written to EmailSendLog.
   *
   * That log exists for the rate limiter, and the CAMPAIGN category is exempt
   * from the hourly cap by design. Logging here would spend an allowance
   * nothing reads, and would then suppress the transactional mail — a join
   * request, an acceptance — that the cap actually protects.
   */
  return result;
}

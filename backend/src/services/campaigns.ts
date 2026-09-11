import prisma from '../utils/prisma.js';
import { EMAIL_CATEGORIES, mayEmail } from './emailPolicy.js';
import { sendCampaignMessage, campaignSenderConfigured } from './email.js';

/**
 * Announcements written in the console and sent to everybody at once.
 *
 * ## This must not send from the transactional domain
 *
 * The whole reason `mail.spllit.app` is a subdomain is that sending reputation
 * is per-domain: a campaign that draws complaints must not be able to stop
 * "your request was accepted" arriving. A broadcast is by far the likeliest
 * message to be reported as spam — it is unsolicited by definition, however
 * welcome it is — so it sends from its own domain or it does not send.
 *
 * `CAMPAIGN_EMAIL_FROM` is therefore required, and campaigns are refused
 * without it. That is deliberate friction: the failure mode of defaulting to
 * the transactional sender is invisible for weeks and then permanent.
 *
 * ## Everything else still applies
 *
 * Suppression, verification, the `campaign` preference and quiet hours are all
 * enforced per recipient through `mayEmail`, exactly as for a transactional
 * message. The per-recipient hourly cap does not, because one announcement
 * should not be dropped for somebody whose squad was busy that afternoon.
 */

/** Provider limit for one batch request. */
const BATCH_SIZE = 100;

/** Small pause between batches, so a burst does not look like a compromised account. */
const BATCH_PAUSE_MS = 1000;

export interface AudienceCount {
  /** Verified, unsuppressed, opted-in addresses. */
  reachable: number;
  /** Everyone with an account, for context. */
  total: number;
}

/**
 * Who would actually receive a campaign right now.
 *
 * Deliberately shown before sending: "send to all users" means something much
 * smaller than the user count, and an admin who expects 229 and sees 180 should
 * find that out before pressing send rather than after.
 */
export async function audienceCount(): Promise<AudienceCount> {
  const total = await prisma.user.count();

  const candidates = await prisma.user.findMany({
    where: { emailVerified: true, isActive: true },
    select: { email: true },
  });

  const addresses = candidates
    .map((u) => u.email?.toLowerCase())
    .filter((e): e is string => Boolean(e) && !e!.endsWith('.local'));

  const [suppressed, optedOut] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: { email: { in: addresses } },
      select: { email: true },
    }),
    prisma.notificationPref.findMany({
      where: { emailOff: { has: EMAIL_CATEGORIES.CAMPAIGN } },
      select: { userId: true },
    }),
  ]);

  const blocked = new Set(suppressed.map((s) => s.email));
  const reachable = addresses.filter((a) => !blocked.has(a)).length - optedOut.length;

  return { reachable: Math.max(reachable, 0), total };
}

/**
 * Sends a campaign, updating its row as it goes.
 *
 * Runs to completion in the request rather than as a background job, because
 * Cloud Run gives no durable queue and a "background" task on an instance that
 * scales to zero is a task that may simply stop. The caller is an admin who
 * pressed send and is watching; the row records the outcome either way.
 *
 * Every recipient is checked individually. A campaign is exactly the kind of
 * send where skipping the policy "just this once" is tempting and where the
 * consequences are worst.
 */
export async function sendCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  // Claim it, so two admins pressing send cannot both broadcast.
  const claim = await prisma.campaign.updateMany({
    where: { id: campaignId, status: 'draft' },
    data: { status: 'sending', startedAt: new Date() },
  });
  if (claim.count !== 1) return;

  const recipients = await prisma.user.findMany({
    where: { emailVerified: true, isActive: true },
    select: { id: true, name: true, email: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const allowed: { email: string; name: string }[] = [];
      for (const person of batch) {
        const verdict = await mayEmail({
          userId: person.id,
          category: EMAIL_CATEGORIES.CAMPAIGN,
        });
        if (verdict.allowed && verdict.email) {
          allowed.push({ email: verdict.email, name: verdict.name ?? person.name });
        } else {
          skipped += 1;
        }
      }

      if (allowed.length > 0) {
        const ok = await sendCampaignMessage({
          campaignId,
          subject: campaign.subject,
          body: campaign.body,
          recipients: allowed,
        });
        if (ok) sent += allowed.length;
        else failed += allowed.length;
      }

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sent, skipped, failed },
      });

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: failed > 0 && sent === 0 ? 'failed' : 'sent',
        audience: recipients.length,
        sent,
        skipped,
        failed,
        finishedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[campaign] send failed', error);
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'failed', sent, skipped, failed, finishedAt: new Date() },
    });
  }
}

export function campaignsAvailable(): boolean {
  return campaignSenderConfigured();
}

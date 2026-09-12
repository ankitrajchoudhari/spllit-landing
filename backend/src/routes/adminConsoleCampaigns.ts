import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { AdminRequest, requireConsoleAdmin, requirePermission } from '../middleware/adminConsole.js';
import { ok, fail } from '../utils/respond.js';
import * as audit from '../services/auditLog.js';
import { audienceCount, campaignsAvailable, sendCampaign } from '../services/campaigns.js';
import {
  MAX_NAMED_RECIPIENTS,
  describeAudience,
  isAudience,
  type Audience,
} from '../services/audience.js';

/**
 * Announcements, from the console.
 *
 * Gated on `notifications.send`, which already exists for the broadcast surface
 * — this is the same authority applied to a different channel, so it does not
 * invent a permission that nobody has been granted.
 *
 * Every send writes an audit row. A broadcast is the one message that cannot be
 * taken back, so "who sent this, when, to how many" needs an answer six months
 * later when somebody asks why they received it.
 */

const router = Router();

router.use(identify, requireConsoleAdmin);

/** Draft length caps. Generous, but a subject line is not an essay. */
const MAX_SUBJECT = 120;
const MAX_BODY = 5000;

/**
 * GET /api/admin-console/campaigns
 *
 * The history, plus whether sending is possible at all and how many people
 * would actually receive one.
 */
router.get('/campaigns', requirePermission('notifications.send'), async (req: AdminRequest, res: Response) => {
  try {
    /**
     * The audience is a query parameter so the composer can re-size as the
     * operator changes their mind, without writing a draft first. Anything
     * unrecognised falls back to `all` rather than erroring — a malformed
     * query should show a number, not an empty page.
     */
    const kind: Audience = isAudience(req.query.audience) ? req.query.audience : 'all';
    const college = String(req.query.college ?? '');
    const userIds = String(req.query.userIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_NAMED_RECIPIENTS);

    const [campaigns, audience] = await Promise.all([
      prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      audienceCount(kind, college, userIds),
    ]);

    return ok(res, {
      campaigns,
      audience,
      /**
       * False when CAMPAIGN_EMAIL_FROM is unset. Surfaced rather than hidden so
       * the console can explain *why* sending is unavailable — a disabled
       * button with no reason is the kind of thing that gets debugged for an
       * hour. See services/campaigns.ts for why it is required.
       */
      available: campaignsAvailable(),
    });
  } catch (error) {
    console.error('[admin-console/campaigns GET]', error);
    return fail(res, 500, 'Failed to load campaigns');
  }
});

/**
 * POST /api/admin-console/campaigns
 *
 * Writes a draft and sends it. Draft-then-send is one call because there is no
 * editing step yet: the confirmation happens in the console before this is
 * reached, and a draft nobody can edit is just an unsent row.
 */
router.post('/campaigns', requirePermission('notifications.send'), async (req: AdminRequest, res: Response) => {
  try {
    if (!campaignsAvailable()) {
      return fail(
        res,
        503,
        'Campaign sending is not configured. CAMPAIGN_EMAIL_FROM must point at a sending domain separate from transactional mail.',
        'campaigns-unconfigured',
      );
    }

    const subject = String(req.body?.subject ?? '').trim();
    const body = String(req.body?.body ?? '').trim();

    if (!subject) return fail(res, 400, 'A subject is required');
    if (subject.length > MAX_SUBJECT) return fail(res, 400, `Subject must be under ${MAX_SUBJECT} characters`);
    if (!body) return fail(res, 400, 'A message is required');
    if (body.length > MAX_BODY) return fail(res, 400, `Message must be under ${MAX_BODY} characters`);

    /**
     * Typed confirmation, checked server-side.
     *
     * The console asks for it too, but a client-side confirm on an
     * unrecallable action is decoration. This is the check that counts.
     */
    if (String(req.body?.confirm ?? '') !== 'SEND') {
      return fail(res, 400, 'Confirmation required', 'confirm-required');
    }

    const kind: Audience = isAudience(req.body?.audience) ? req.body.audience : 'all';
    const college = String(req.body?.college ?? '').trim();
    const userIds: string[] = Array.isArray(req.body?.userIds)
      ? req.body.userIds.map((id: unknown) => String(id)).slice(0, MAX_NAMED_RECIPIENTS)
      : [];

    if (kind === 'college' && !college) {
      return fail(res, 400, 'Choose a college for that audience');
    }
    if (kind === 'users' && userIds.length === 0) {
      return fail(res, 400, 'Name at least one person for that audience');
    }

    const audience = await audienceCount(kind, college, userIds);
    if (audience.reachable === 0) {
      // Refused rather than recorded as a zero-recipient send. A campaign row
      // saying "sent to 0" is how a broken filter hides in the history.
      return fail(res, 400, 'Nobody in that audience can be emailed right now', 'audience-empty');
    }

    const campaign = await prisma.campaign.create({
      data: {
        subject,
        body,
        createdBy: req.admin!.userId,
        createdName: req.admin!.name ?? null,
        status: 'draft',
        audience: audience.reachable,
        audienceKind: kind,
        audienceCollege: college || null,
        audienceUserIds: userIds,
      },
    });

    // Recorded before sending, not after: if the send crashes halfway, the row
    // saying it was attempted is the thing you want to exist.
    await audit.record(
      req.admin!,
      {
        action: 'campaign.send',
        targetType: 'campaign',
        targetId: campaign.id,
        targetLabel: subject,
        after: {
          subject,
          audience: audience.reachable,
          aimedAt: describeAudience(kind, college, userIds.length),
        },
      },
      req,
    );

    await sendCampaign(campaign.id);

    const finished = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    return ok(res, finished, 201);
  } catch (error) {
    console.error('[admin-console/campaigns POST]', error);
    return fail(res, 500, 'Failed to send the campaign');
  }
});

export default router;

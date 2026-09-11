import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail } from '../utils/respond.js';
import { sweepRead, unexpiredWhere } from '../services/notificationRetention.js';
import { OPTIONAL_CATEGORIES } from '../services/emailPolicy.js';

const router = Router();

router.get('/', identify, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 60);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    // Read notifications expire two hours after being seen. Removing them here
    // rather than on a timer is deliberate — see services/notificationRetention.
    // The filter below repeats the rule so the list is right even if this
    // delete failed or has not caught up.
    await sweepRead(req.user!.userId);

    const items = await prisma.notification.findMany({
      where: {
        userId: req.user!.userId,
        ...unexpiredWhere(),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Cursor is the timestamp of the last row — stable under concurrent writes
    // in a way an offset never is.
    const nextCursor =
      items.length === limit ? (items[items.length - 1]?.createdAt.toISOString() ?? null) : null;

    return ok(res, { items, nextCursor });
  } catch (error) {
    console.error('[notifications GET]', error);
    return fail(res, 500, 'Failed to load notifications');
  }
});

router.get('/unread-count', identify, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, readAt: null },
    });
    return ok(res, { count });
  } catch (error) {
    console.error('[notifications/unread-count]', error);
    return fail(res, 500, 'Failed to load unread count');
  }
});

router.post('/:id/read', identify, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification || notification.userId !== req.user!.userId) {
      return fail(res, 404, 'Notification not found');
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    return res.status(204).end();
  } catch (error) {
    console.error('[notifications/read]', error);
    return fail(res, 500, 'Failed to mark as read');
  }
});

router.post('/read-all', identify, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return res.status(204).end();
  } catch (error) {
    console.error('[notifications/read-all]', error);
    return fail(res, 500, 'Failed to mark all as read');
  }
});

/**
 * GET /api/notifications/preferences
 *
 * Absent row means everything is on, so this synthesises the defaults rather
 * than making the client know that. A row is written only when somebody
 * changes something.
 */
router.get('/preferences', identify, async (req: AuthRequest, res: Response) => {
  try {
    const prefs = await prisma.notificationPref.findUnique({
      where: { userId: req.user!.userId },
      select: { emailOff: true, quietHours: true, timezone: true },
    });

    return ok(res, {
      emailOff: prefs?.emailOff ?? [],
      quietHours: prefs?.quietHours ?? true,
      timezone: prefs?.timezone ?? null,
      // Sent so the client renders the switches it can actually honour, rather
      // than a hardcoded list that drifts from the server's.
      optional: OPTIONAL_CATEGORIES,
    });
  } catch (error) {
    console.error('[notifications/preferences GET]', error);
    return fail(res, 500, 'Failed to load preferences');
  }
});

/**
 * PATCH /api/notifications/preferences
 *
 * Only categories the server considers optional may be switched off. A client
 * sending `request-accepted` is ignored rather than refused: that message is
 * the answer to something the person asked for, and an app that let you mute
 * it would simply leave you wondering.
 */
router.patch('/preferences', identify, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};

    const emailOff: string[] | undefined = Array.isArray(body.emailOff)
      ? [...new Set((body.emailOff as unknown[]).map((key) => String(key)))].filter((key) =>
          OPTIONAL_CATEGORIES.includes(key),
        )
      : undefined;

    const quietHours = typeof body.quietHours === 'boolean' ? body.quietHours : undefined;

    /**
     * The timezone is validated by trying to use it. An unknown zone would
     * otherwise be stored and then silently ignored at send time, which reads
     * as quiet hours not working.
     */
    let timezone: string | null | undefined;
    if (body.timezone === null) {
      timezone = null;
    } else if (typeof body.timezone === 'string' && body.timezone.trim()) {
      const candidate = body.timezone.trim();
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: candidate });
        timezone = candidate;
      } catch {
        return fail(res, 400, 'That is not a recognised timezone', 'bad-timezone');
      }
    }

    const data = {
      ...(emailOff !== undefined ? { emailOff } : {}),
      ...(quietHours !== undefined ? { quietHours } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
    };

    if (Object.keys(data).length === 0) return fail(res, 400, 'Nothing to change');

    const saved = await prisma.notificationPref.upsert({
      where: { userId: req.user!.userId },
      update: data,
      create: { userId: req.user!.userId, emailOff: [], quietHours: true, ...data },
      select: { emailOff: true, quietHours: true, timezone: true },
    });

    return ok(res, saved);
  } catch (error) {
    console.error('[notifications/preferences PATCH]', error);
    return fail(res, 500, 'Failed to save preferences');
  }
});

export default router;

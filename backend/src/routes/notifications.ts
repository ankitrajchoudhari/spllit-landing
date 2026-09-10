import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail } from '../utils/respond.js';
import { sweepRead, unexpiredWhere } from '../services/notificationRetention.js';

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

export default router;

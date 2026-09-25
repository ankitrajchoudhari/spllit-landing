import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { invalidateSuspensions, suspensionPatch } from '../services/suspension.js';
import { getIO } from '../services/live.js';
import { identify } from '../middleware/identity.js';
import { requireAdmin, requireMasterAdmin } from '../middleware/requireAdmin.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail } from '../utils/respond.js';
import { notify } from '../services/notifications.js';
import { formatPlate } from '../data/vehicles.js';
import { syncHostStatus } from './host.js';

const router = Router();

// Every route below is admin-gated. Mounted once here so a new handler cannot
// accidentally ship without the check.
router.use(identify, requireAdmin);

const USER_ROW = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  college: true,
  profilePhoto: true,
  role: true,
  isActive: true,
  onboarded: true,
  rating: true,
  totalRides: true,
  createdAt: true,
  lastSeen: true,
} as const;

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/admin/overview
 * Everything the dashboard's top section needs, in one round trip.
 */
router.get('/overview', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers24h,
      newUsers7d,
      activeRides,
      ridesToday,
      completedRides,
      totalSquads,
      activeSquads,
      upcomingEvents,
      communities,
      waitlist,
      openEmergencies,
      messages24h,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.ride.count({
        where: { status: { in: ['requested', 'pending', 'accepted', 'matched', 'arriving', 'in_progress'] } },
      }),
      prisma.ride.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.ride.count({ where: { status: 'completed' } }),
      prisma.squad.count(),
      prisma.squad.count({ where: { isActive: true } }),
      prisma.event.count({ where: { status: 'published', startsAt: { gte: now } } }),
      prisma.community.count(),
      prisma.waitlist.count(),
      prisma.emergency.count({ where: { status: 'active' } }),
      prisma.threadMessage.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);

    // Signup trend for the last 14 days, bucketed server-side so the client
    // renders a chart without shipping every user row to do it.
    const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      buckets.set(day.toISOString().slice(0, 10), 0);
    }
    for (const user of recentUsers) {
      const key = user.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return ok(res, {
      users: { total: totalUsers, new24h: newUsers24h, new7d: newUsers7d },
      rides: { active: activeRides, today: ridesToday, completed: completedRides },
      squads: { total: totalSquads, active: activeSquads },
      events: { upcoming: upcomingEvents },
      communities: { total: communities },
      waitlist: { total: waitlist },
      emergencies: { open: openEmergencies },
      messages: { last24h: messages24h },
      signupTrend: [...buckets.entries()].map(([date, count]) => ({ date, count })),
    });
  } catch (error) {
    console.error('[admin/overview]', error);
    return fail(res, 500, 'Failed to load overview');
  }
});

/** GET /api/admin/users?q=&page= */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q ?? '').trim();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const perPage = 25;

    const where = q
      ? {
          OR: [
            { name: { contains: escapeRegex(q), mode: 'insensitive' as const } },
            { email: { contains: escapeRegex(q), mode: 'insensitive' as const } },
            { username: { contains: escapeRegex(q), mode: 'insensitive' as const } },
            { college: { contains: escapeRegex(q), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_ROW,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.user.count({ where }),
    ]);

    return ok(res, { items, total, page, perPage });
  } catch (error) {
    console.error('[admin/users]', error);
    return fail(res, 500, 'Failed to load users');
  }
});

/**
 * PATCH /api/admin/users/:id
 * Suspend/restore an account. Role changes are master-admin only and handled
 * by the route below.
 */
router.patch('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.params.id === req.user!.userId) {
      return fail(res, 400, 'You cannot change your own account here');
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(typeof req.body.isActive === 'boolean' ? suspensionPatch(req.body.isActive) : {}),
      },
      select: USER_ROW,
    });
    invalidateSuspensions();
    if (req.body.isActive === false) getIO()?.in(`user:${req.params.id}`).disconnectSockets(true);

    return ok(res, user);
  } catch (error) {
    console.error('[admin/users PATCH]', error);
    return fail(res, 500, 'Failed to update user');
  }
});

/** PATCH /api/admin/users/:id/role — master admin only. */
router.patch('/users/:id/role', requireMasterAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const role = String(req.body.role ?? '');
    if (!['user', 'subadmin', 'admin'].includes(role)) {
      return fail(res, 400, 'Unknown role');
    }
    if (req.params.id === req.user!.userId) {
      return fail(res, 400, 'You cannot change your own role');
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role, isAdmin: role !== 'user' },
      select: USER_ROW,
    });

    return ok(res, user);
  } catch (error) {
    console.error('[admin/users/role]', error);
    return fail(res, 500, 'Failed to update role');
  }
});

/** GET /api/admin/content?type=rides|squads|events|communities|waitlist */
router.get('/content', async (req: AuthRequest, res: Response) => {
  try {
    const type = String(req.query.type ?? 'rides');
    const take = 50;

    if (type === 'rides') {
      const rides = await prisma.ride.findMany({ orderBy: { createdAt: 'desc' }, take });
      const hosts = await prisma.user.findMany({
        where: { id: { in: [...new Set(rides.map((r) => r.userId))] } },
        select: { id: true, name: true, email: true },
      });
      const byId = new Map(hosts.map((h) => [h.id, h]));
      return ok(res, rides.map((r) => ({ ...r, host: byId.get(r.userId) ?? null })));
    }

    if (type === 'squads') {
      const squads = await prisma.squad.findMany({ orderBy: { createdAt: 'desc' }, take });
      const leaders = await prisma.user.findMany({
        where: { id: { in: [...new Set(squads.map((s) => s.leaderId))] } },
        select: { id: true, name: true, email: true },
      });
      const byId = new Map(leaders.map((l) => [l.id, l]));
      return ok(res, squads.map((s) => ({ ...s, leader: byId.get(s.leaderId) ?? null })));
    }

    if (type === 'events') {
      const events = await prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take });
      const hosts = await prisma.user.findMany({
        where: { id: { in: [...new Set(events.map((e) => e.hostId))] } },
        select: { id: true, name: true, email: true },
      });
      const byId = new Map(hosts.map((h) => [h.id, h]));
      return ok(res, events.map((e) => ({ ...e, host: byId.get(e.hostId) ?? null })));
    }

    if (type === 'communities') {
      return ok(
        res,
        await prisma.community.findMany({ orderBy: { memberCount: 'desc' }, take }),
      );
    }

    if (type === 'waitlist') {
      return ok(res, await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' }, take }));
    }

    if (type === 'emergencies') {
      const emergencies = await prisma.emergency.findMany({
        orderBy: { createdAt: 'desc' },
        take,
      });
      const users = await prisma.user.findMany({
        where: { id: { in: [...new Set(emergencies.map((e) => e.userId))] } },
        select: { id: true, name: true, phone: true, college: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      return ok(res, emergencies.map((e) => ({ ...e, user: byId.get(e.userId) ?? null })));
    }

    return fail(res, 400, 'Unknown content type');
  } catch (error) {
    console.error('[admin/content]', error);
    return fail(res, 500, 'Failed to load content');
  }
});

/** DELETE /api/admin/content/:type/:id — moderation removal. */
router.delete('/content/:type/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;

    // Soft-deactivate rather than hard-delete wherever a row is referenced by
    // matches, members or messages — a hard delete would orphan them.
    if (type === 'squads') {
      await prisma.squad.update({ where: { id }, data: { isActive: false } });
    } else if (type === 'events') {
      await prisma.event.update({ where: { id }, data: { status: 'cancelled' } });
    } else if (type === 'rides') {
      await prisma.ride.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Removed by admin' },
      });
    } else if (type === 'waitlist') {
      await prisma.waitlist.delete({ where: { id } });
    } else {
      return fail(res, 400, 'Unknown content type');
    }

    return res.status(204).end();
  } catch (error) {
    console.error('[admin/content DELETE]', error);
    return fail(res, 500, 'Failed to remove content');
  }
});

/** PATCH /api/admin/emergencies/:id — acknowledge or resolve an SOS. */
router.patch('/emergencies/:id', async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.body.status ?? '');
    if (!['active', 'acknowledged', 'resolved', 'false-alarm'].includes(status)) {
      return fail(res, 400, 'Unknown status');
    }

    const emergency = await prisma.emergency.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'resolved' || status === 'false-alarm'
          ? { resolvedAt: new Date() }
          : {}),
      },
    });

    return ok(res, emergency);
  } catch (error) {
    console.error('[admin/emergencies]', error);
    return fail(res, 500, 'Failed to update emergency');
  }
});

/**
 * POST /api/admin/broadcast
 * Sends a notification to every active user, or to one college. Capped and
 * chunked so a broadcast cannot stall the event loop or hammer FCM.
 */
router.post('/broadcast', async (req: AuthRequest, res: Response) => {
  try {
    const title = String(req.body.title ?? '').trim();
    const body = String(req.body.body ?? '').trim();
    const college = req.body.college ? String(req.body.college) : null;
    const href = req.body.href ? String(req.body.href) : undefined;

    if (title.length < 3 || body.length < 3) {
      return fail(res, 400, 'A title and message are required');
    }

    const recipients = await prisma.user.findMany({
      where: { isActive: true, onboarded: true, ...(college ? { college } : {}) },
      select: { id: true },
      take: 5000,
    });

    // Chunked so a large broadcast doesn't open thousands of concurrent writes.
    const CHUNK = 100;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      await Promise.all(
        recipients.slice(i, i + CHUNK).map((user) =>
          notify({
            userId: user.id,
            type: 'event.created',
            title,
            body,
            ...(href ? { href } : {}),
          }),
        ),
      );
    }

    return ok(res, { sent: recipients.length });
  } catch (error) {
    console.error('[admin/broadcast]', error);
    return fail(res, 500, 'Failed to send broadcast');
  }
});

/**
 * GET /api/admin-panel/vehicles — the host verification queue.
 *
 * Vehicles are created `pending` and nothing else moves them. Without a
 * reviewer here the whole host gate is theatre: a plate nobody checked would
 * be shown to a passenger as verified.
 */
router.get('/vehicles', async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status ?? 'pending');
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return fail(res, 400, 'Unknown status filter');
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const profiles = await prisma.hostProfile.findMany({
      where: { id: { in: [...new Set(vehicles.map((v) => v.hostProfileId))] } },
      select: { id: true, userId: true, phone: true, status: true },
    });
    const byProfile = new Map(profiles.map((p) => [p.id, p]));

    const users = await prisma.user.findMany({
      where: { id: { in: profiles.map((p) => p.userId) } },
      select: { id: true, name: true, username: true, email: true, college: true, profilePhoto: true },
    });
    const byUser = new Map(users.map((u) => [u.id, u]));

    return ok(
      res,
      vehicles.map((vehicle) => {
        const profile = byProfile.get(vehicle.hostProfileId);
        return {
          ...vehicle,
          plateFormatted: formatPlate(vehicle.plate),
          hostPhone: profile?.phone ?? null,
          hostStatus: profile?.status ?? null,
          user: profile ? (byUser.get(profile.userId) ?? null) : null,
        };
      }),
    );
  } catch (error) {
    console.error('[admin/vehicles]', error);
    return fail(res, 500, 'Failed to load the verification queue');
  }
});

/** PATCH /api/admin-panel/vehicles/:id — approve or reject one vehicle. */
router.patch('/vehicles/:id', async (req: AuthRequest, res: Response) => {
  try {
    const decision = String(req.body.status ?? '');
    if (!['verified', 'rejected'].includes(decision)) {
      return fail(res, 400, 'Decision must be verified or rejected');
    }

    const note =
      typeof req.body.rejectionNote === 'string' ? req.body.rejectionNote.trim().slice(0, 300) : '';

    // A rejection with no reason gives the host nothing to act on, so it is
    // refused rather than silently accepted.
    if (decision === 'rejected' && !note) {
      return fail(res, 400, 'Give the host a reason for the rejection', 'reason-required');
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      select: { id: true, hostProfileId: true },
    });
    if (!vehicle) return fail(res, 404, 'Vehicle not found');

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        status: decision,
        rejectionNote: decision === 'rejected' ? note : null,
        verifiedAt: decision === 'verified' ? new Date() : null,
        // A rejected vehicle cannot remain somebody's default.
        ...(decision === 'rejected' ? { isPrimary: false } : {}),
      },
    });

    // Approving the first vehicle is what activates the host, so re-derive
    // rather than assuming either way.
    const hostStatus = await syncHostStatus(vehicle.hostProfileId);

    const profile = await prisma.hostProfile.findUnique({
      where: { id: vehicle.hostProfileId },
      select: { userId: true },
    });

    if (profile) {
      await notify({
        userId: profile.userId,
        type: decision === 'verified' ? 'host.vehicle_verified' : 'host.vehicle_rejected',
        title: decision === 'verified' ? 'Vehicle approved' : 'Vehicle not approved',
        body: decision === 'verified' ? 'You can now offer seats on Spllit.' : note,
        href: '/host/vehicles',
        data: { vehicleId: vehicle.id },
      });
    }

    return ok(res, { id: vehicle.id, status: decision, hostStatus });
  } catch (error) {
    console.error('[admin/vehicles PATCH]', error);
    return fail(res, 500, 'Failed to record the decision');
  }
});

export default router;

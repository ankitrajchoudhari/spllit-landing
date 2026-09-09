import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import {
  AdminRequest,
  requireConsoleAdmin,
  requirePermission,
} from '../middleware/adminConsole.js';
import { ok, fail } from '../utils/respond.js';
import { escapeRegex, paged, pagination, resolveUsers, sorting, str } from '../utils/adminQuery.js';
import * as audit from '../services/auditLog.js';

/**
 * Admin console — operational surfaces.
 *
 * Split out of adminConsole.ts, which was already carrying session, users,
 * admins, audit, flags and system. Both routers mount on /api/admin-console;
 * their path prefixes do not overlap, so ordering between them is not load
 * bearing.
 *
 * Everything here reads models that already exist. Nothing invents a surface:
 * where the brief asked for something Spllit does not have — posts, comments,
 * reactions, reports — there is no endpoint, and the console renders the reason
 * instead of an empty table.
 */

const router = Router();

router.use(identify, requireConsoleAdmin);

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------

/** Mirrors the state machine documented on the Ride model. */
const RIDE_ACTIVE = ['requested', 'pending', 'accepted', 'matched', 'arriving', 'in_progress'];

/** GET /rides?status=&q=&sort=&dir=&page= */
router.get('/rides', requirePermission('content.view'), async (req: AdminRequest, res: Response) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const status = str(req.query.status);
    const q = str(req.query.q);

    const where: Record<string, unknown> = {};

    if (status === 'active') where.status = { in: RIDE_ACTIVE };
    else if (status) where.status = status;

    if (q) {
      const term = escapeRegex(q);
      where.OR = [
        { origin: { contains: term, mode: 'insensitive' } },
        { destination: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        orderBy: sorting(req.query, ['createdAt', 'departureTime', 'status'], 'createdAt'),
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          origin: true,
          destination: true,
          departureTime: true,
          vehicleType: true,
          seats: true,
          fare: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.ride.count({ where }),
    ]);

    const creators = await resolveUsers(prisma, rows.map((row) => row.userId));

    return ok(
      res,
      paged(
        rows.map((row) => ({ ...row, creator: creators.get(row.userId) ?? null })),
        total,
        page,
        limit,
      ),
    );
  } catch (error) {
    console.error('[admin-console/rides]', error);
    return fail(res, 500, 'Failed to load rides');
  }
});

/** GET /rides/:id — the full lifecycle of one ride. */
router.get(
  '/rides/:id',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const id = str(req.params.id);

      const ride = await prisma.ride.findUnique({ where: { id } });
      if (!ride) return fail(res, 404, 'Ride not found');

      const matches = await prisma.match.findMany({
        where: { rideId: id },
        orderBy: { matchedAt: 'desc' },
        select: {
          id: true,
          user1Id: true,
          user2Id: true,
          status: true,
          initiatedBy: true,
          matchedAt: true,
          acceptedAt: true,
          declinedAt: true,
          completedAt: true,
        },
      });

      const people = await resolveUsers(prisma, [
        ride.userId,
        ...matches.flatMap((match) => [match.user1Id, match.user2Id]),
      ]);

      return ok(res, {
        ride,
        host: people.get(ride.userId) ?? null,
        matches: matches.map((match) => ({
          ...match,
          host: people.get(match.user1Id) ?? null,
          guest: people.get(match.user2Id) ?? null,
        })),
        unavailable: [{ key: 'reports', reason: 'No reporting feature exists in Spllit yet.' }],
      });
    } catch (error) {
      console.error('[admin-console/rides/:id]', error);
      return fail(res, 500, 'Failed to load ride');
    }
  },
);

// ---------------------------------------------------------------------------
// Squads
// ---------------------------------------------------------------------------

/** GET /squads?status=&q=&page= */
router.get(
  '/squads',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const status = str(req.query.status);
      const q = str(req.query.q);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (q) {
        const term = escapeRegex(q);
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { college: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.squad.findMany({
          where,
          orderBy: sorting(req.query, ['createdAt', 'meetingAt', 'memberCount'], 'createdAt'),
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            leaderId: true,
            college: true,
            type: true,
            visibility: true,
            status: true,
            memberCount: true,
            memberLimit: true,
            meetingAt: true,
            createdAt: true,
          },
        }),
        prisma.squad.count({ where }),
      ]);

      const leaders = await resolveUsers(prisma, rows.map((row) => row.leaderId));

      return ok(
        res,
        paged(
          rows.map((row) => ({ ...row, leader: leaders.get(row.leaderId) ?? null })),
          total,
          page,
          limit,
        ),
      );
    } catch (error) {
      console.error('[admin-console/squads]', error);
      return fail(res, 500, 'Failed to load squads');
    }
  },
);

/** GET /squads/:id */
router.get(
  '/squads/:id',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const id = str(req.params.id);

      const squad = await prisma.squad.findUnique({ where: { id } });
      if (!squad) return fail(res, 404, 'Squad not found');

      const members = await prisma.squadMember.findMany({
        where: { squadId: id },
        orderBy: { joinedAt: 'asc' },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          feePaid: true,
          joinedAt: true,
          arrivedAt: true,
        },
      });

      const people = await resolveUsers(prisma, [
        squad.leaderId,
        ...members.map((member) => member.userId),
      ]);

      /**
       * Message *count* only, never content.
       *
       * A squad's chat is a private group conversation. Knowing how much
       * traffic it carries is a legitimate operational signal; reading it
       * without a report or a support ticket naming the thread is not, and the
       * console deliberately offers no way to.
       */
      const thread = await prisma.chatThread.findFirst({
        where: { contextType: 'squad', contextId: id },
        select: { id: true, lastMessageAt: true },
      });

      const messageCount = thread
        ? await prisma.threadMessage.count({ where: { threadId: thread.id } })
        : 0;

      return ok(res, {
        squad,
        leader: people.get(squad.leaderId) ?? null,
        members: members.map((member) => ({ ...member, user: people.get(member.userId) ?? null })),
        chat: { exists: Boolean(thread), messageCount, lastMessageAt: thread?.lastMessageAt ?? null },
      });
    } catch (error) {
      console.error('[admin-console/squads/:id]', error);
      return fail(res, 500, 'Failed to load squad');
    }
  },
);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** GET /events?status=&when=&q=&page= */
router.get(
  '/events',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const status = str(req.query.status);
      const when = str(req.query.when);
      const q = str(req.query.q);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (when === 'upcoming') where.startsAt = { gte: new Date() };
      if (when === 'past') where.startsAt = { lt: new Date() };
      if (q) {
        const term = escapeRegex(q);
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { college: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: sorting(req.query, ['startsAt', 'createdAt', 'attendeeCount'], 'startsAt'),
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            hostId: true,
            college: true,
            category: true,
            startsAt: true,
            endsAt: true,
            ticketType: true,
            price: true,
            capacity: true,
            attendeeCount: true,
            status: true,
            createdAt: true,
          },
        }),
        prisma.event.count({ where }),
      ]);

      const hosts = await resolveUsers(prisma, rows.map((row) => row.hostId));

      return ok(
        res,
        paged(
          rows.map((row) => ({ ...row, host: hosts.get(row.hostId) ?? null })),
          total,
          page,
          limit,
        ),
      );
    } catch (error) {
      console.error('[admin-console/events]', error);
      return fail(res, 500, 'Failed to load events');
    }
  },
);

/** GET /events/:id */
router.get(
  '/events/:id',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const id = str(req.params.id);

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) return fail(res, 404, 'Event not found');

      const attendees = await prisma.eventAttendee.findMany({
        where: { eventId: id },
        orderBy: { joinedAt: 'desc' },
        take: 100,
        select: { id: true, userId: true, status: true, joinedAt: true },
      });

      const people = await resolveUsers(prisma, [
        event.hostId,
        ...attendees.map((attendee) => attendee.userId),
      ]);

      return ok(res, {
        event,
        host: people.get(event.hostId) ?? null,
        attendees: attendees.map((attendee) => ({
          ...attendee,
          user: people.get(attendee.userId) ?? null,
        })),
        // The list is capped, so say so rather than letting a 100-row table
        // read as the complete guest list for a 400-person event.
        attendeesTruncated: attendees.length === 100,
      });
    } catch (error) {
      console.error('[admin-console/events/:id]', error);
      return fail(res, 500, 'Failed to load event');
    }
  },
);

/**
 * PATCH /events/:id/status — { status, reason }
 *
 * Cancelling an event is visible to every attendee immediately, so it carries
 * the same reason-and-audit requirement as suspending a user.
 */
router.patch(
  '/events/:id/status',
  requirePermission('content.delete'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = str(req.params.id);
      const status = str(req.body?.status);
      const reason = str(req.body?.reason);

      if (!['published', 'cancelled', 'draft'].includes(status)) {
        return fail(res, 400, 'Status must be published, cancelled or draft.');
      }
      if (reason.length < 4) {
        return fail(res, 400, 'A reason is required, so the audit log explains itself later.');
      }

      const event = await prisma.event.findUnique({
        where: { id },
        select: { id: true, title: true, status: true },
      });
      if (!event) return fail(res, 404, 'Event not found');

      const updated = await audit.recorded(
        admin,
        {
          action: `event.${status}`,
          targetType: 'event',
          targetId: id,
          targetLabel: event.title,
          ...audit.diff({ status: event.status }, { status }),
          reason,
        },
        req,
        () => prisma.event.update({ where: { id }, data: { status } }),
      );

      return ok(res, updated);
    } catch (error) {
      console.error('[admin-console/events/status]', error);
      return fail(res, 500, 'Failed to update event');
    }
  },
);

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

/** GET /communities?q=&visibility=&page= */
router.get(
  '/communities',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const visibility = str(req.query.visibility);
      const q = str(req.query.q);

      const where: Record<string, unknown> = {};
      if (visibility) where.visibility = visibility;
      if (q) {
        const term = escapeRegex(q);
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { college: { contains: term, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        prisma.community.findMany({
          where,
          orderBy: sorting(req.query, ['createdAt', 'memberCount', 'name'], 'createdAt'),
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            college: true,
            visibility: true,
            memberCount: true,
            createdAt: true,
          },
        }),
        prisma.community.count({ where }),
      ]);

      const owners = await resolveUsers(prisma, rows.map((row) => row.ownerId));

      return ok(
        res,
        paged(
          rows.map((row) => ({ ...row, owner: owners.get(row.ownerId) ?? null })),
          total,
          page,
          limit,
        ),
      );
    } catch (error) {
      console.error('[admin-console/communities]', error);
      return fail(res, 500, 'Failed to load communities');
    }
  },
);

/** GET /communities/:id */
router.get(
  '/communities/:id',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const id = str(req.params.id);

      const community = await prisma.community.findUnique({ where: { id } });
      if (!community) return fail(res, 404, 'Community not found');

      const [channels, members, staff] = await Promise.all([
        prisma.channel.findMany({
          where: { communityId: id },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, slug: true, isReadOnly: true, createdAt: true },
        }),
        prisma.communityMember.count({ where: { communityId: id } }),
        // Owners and moderators only — the full member list belongs behind its
        // own paginated call, not inlined into a detail page.
        prisma.communityMember.findMany({
          where: { communityId: id, role: { in: ['owner', 'moderator'] } },
          select: { id: true, userId: true, role: true, joinedAt: true },
        }),
      ]);

      const people = await resolveUsers(prisma, [
        community.ownerId,
        ...staff.map((member) => member.userId),
      ]);

      return ok(res, {
        community,
        owner: people.get(community.ownerId) ?? null,
        channels,
        memberCount: members,
        staff: staff.map((member) => ({ ...member, user: people.get(member.userId) ?? null })),
      });
    } catch (error) {
      console.error('[admin-console/communities/:id]', error);
      return fail(res, 500, 'Failed to load community');
    }
  },
);

// ---------------------------------------------------------------------------
// Emergencies (SOS)
// ---------------------------------------------------------------------------

/** GET /emergencies?status=&page= */
router.get(
  '/emergencies',
  requirePermission('moderation.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const status = str(req.query.status);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const [rows, total] = await Promise.all([
        prisma.emergency.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.emergency.count({ where }),
      ]);

      const people = await resolveUsers(prisma, rows.map((row) => row.userId));

      return ok(
        res,
        paged(
          rows.map((row) => ({ ...row, user: people.get(row.userId) ?? null })),
          total,
          page,
          limit,
        ),
      );
    } catch (error) {
      console.error('[admin-console/emergencies]', error);
      return fail(res, 500, 'Failed to load emergencies');
    }
  },
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * GET /notifications — what has actually been sent.
 *
 * `readAt` is the only delivery signal Spllit records. There is no per-device
 * push receipt, so the console reports opens and nothing more rather than
 * implying a delivery pipeline that does not exist.
 */
router.get(
  '/notifications',
  requirePermission('content.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const type = str(req.query.type);

      const where: Record<string, unknown> = {};
      if (type) where.type = type;

      const [rows, total, opened] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            userId: true,
            type: true,
            title: true,
            body: true,
            href: true,
            readAt: true,
            createdAt: true,
          },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { ...where, readAt: { not: null } } }),
      ]);

      const people = await resolveUsers(prisma, rows.map((row) => row.userId));

      return ok(res, {
        ...paged(
          rows.map((row) => ({ ...row, user: people.get(row.userId) ?? null })),
          total,
          page,
          limit,
        ),
        openedCount: opened,
        unavailable: [
          {
            key: 'delivery',
            reason:
              'Spllit records in-app notifications and their read time. There is no per-device push delivery receipt, so delivery and failure rates cannot be reported.',
          },
        ],
      });
    } catch (error) {
      console.error('[admin-console/notifications]', error);
      return fail(res, 500, 'Failed to load notifications');
    }
  },
);

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/**
 * GET /moderation/status
 *
 * Answers "is there a moderation queue" honestly rather than serving an empty
 * one. An empty queue and a non-existent feature look identical in a table,
 * and only one of them means nobody needs to do anything.
 */
router.get(
  '/moderation/status',
  requirePermission('moderation.view'),
  async (_req: AdminRequest, res: Response) => {
    const openEmergencies = await prisma.emergency.count({ where: { status: 'active' } });
    const blocks = await prisma.block.count();

    return ok(res, {
      reporting: {
        available: false,
        reason:
          'Spllit has no Report model and no way for a user to report a person or a piece of content. A moderation queue cannot exist until reporting is built in the main app.',
      },
      // What genuinely does exist and is adjacent to moderation.
      available: {
        emergencies: { open: openEmergencies, label: 'SOS alerts' },
        blocks: { total: blocks, label: 'User blocks' },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

/**
 * GET /search?q= — the command palette's backing query.
 *
 * Runs across the entities Spllit actually has, capped at five hits each. The
 * cap is the point: this is a jump-to-record affordance, not an export, and it
 * must stay cheap enough to run on every keystroke a debounce lets through.
 */
router.get('/search', requirePermission('users.view'), async (req: AdminRequest, res: Response) => {
  try {
    const q = str(req.query.q);
    if (q.length < 2) return ok(res, { query: q, groups: [] });

    const term = escapeRegex(q);
    const contains = { contains: term, mode: 'insensitive' as const };
    const TAKE = 5;

    const canSeeContent = req.admin!.permissions.includes('content.view');
    const canSeeAudit = req.admin!.permissions.includes('audit.view');

    const [users, rides, squads, events, communities, auditRows] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ name: contains }, { email: contains }, { username: contains }] },
        take: TAKE,
        select: { id: true, name: true, email: true, username: true },
      }),
      canSeeContent
        ? prisma.ride.findMany({
            where: { OR: [{ origin: contains }, { destination: contains }] },
            take: TAKE,
            orderBy: { createdAt: 'desc' },
            select: { id: true, origin: true, destination: true, status: true },
          })
        : Promise.resolve([]),
      canSeeContent
        ? prisma.squad.findMany({
            where: { name: contains },
            take: TAKE,
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, status: true, memberCount: true },
          })
        : Promise.resolve([]),
      canSeeContent
        ? prisma.event.findMany({
            where: { title: contains },
            take: TAKE,
            orderBy: { startsAt: 'desc' },
            select: { id: true, title: true, status: true, startsAt: true },
          })
        : Promise.resolve([]),
      canSeeContent
        ? prisma.community.findMany({
            where: { OR: [{ name: contains }, { slug: contains }] },
            take: TAKE,
            select: { id: true, name: true, slug: true, memberCount: true },
          })
        : Promise.resolve([]),
      canSeeAudit
        ? prisma.auditLog.findMany({
            where: { OR: [{ actorEmail: contains }, { action: contains }, { targetLabel: contains }] },
            take: TAKE,
            orderBy: { createdAt: 'desc' },
            select: { id: true, action: true, actorEmail: true, targetLabel: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const groups = [
      {
        key: 'users',
        label: 'Users',
        items: users.map((user) => ({
          id: user.id,
          title: user.name,
          subtitle: user.email,
          href: `/users/${user.id}`,
        })),
      },
      {
        key: 'rides',
        label: 'Rides',
        items: rides.map((ride) => ({
          id: ride.id,
          title: `${ride.origin} → ${ride.destination}`,
          subtitle: ride.status,
          href: `/rides/${ride.id}`,
        })),
      },
      {
        key: 'squads',
        label: 'Squads',
        items: squads.map((squad) => ({
          id: squad.id,
          title: squad.name,
          subtitle: `${squad.status} · ${squad.memberCount} members`,
          href: `/squads/${squad.id}`,
        })),
      },
      {
        key: 'events',
        label: 'Events',
        items: events.map((event) => ({
          id: event.id,
          title: event.title,
          subtitle: event.status,
          href: `/events/${event.id}`,
        })),
      },
      {
        key: 'communities',
        label: 'Communities',
        items: communities.map((community) => ({
          id: community.id,
          title: community.name,
          subtitle: `${community.memberCount} members`,
          href: `/communities/${community.id}`,
        })),
      },
      {
        key: 'audit',
        label: 'Audit log',
        items: auditRows.map((row) => ({
          id: row.id,
          title: row.action,
          subtitle: `${row.actorEmail}${row.targetLabel ? ` → ${row.targetLabel}` : ''}`,
          href: '/audit',
        })),
      },
    ].filter((group) => group.items.length > 0);

    return ok(res, { query: q, groups });
  } catch (error) {
    console.error('[admin-console/search]', error);
    return fail(res, 500, 'Search failed');
  }
});

export default router;

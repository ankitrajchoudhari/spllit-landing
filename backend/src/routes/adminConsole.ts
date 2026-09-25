import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { invalidateSuspensions, suspensionPatch } from '../services/suspension.js';
import { getIO } from '../services/live.js';
import { identify } from '../middleware/identity.js';
import {
  AdminRequest,
  requireConsoleAdmin,
  requirePermission,
} from '../middleware/adminConsole.js';
import {
  ADMIN_ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  canManageRole,
  effectivePermissions,
  isAdminRole,
  isPermission,
  permissionsFor,
  resolveAdminRole,
  type Permission,
} from '../config/adminRoles.js';
import { revokeFirebaseSessions } from '../utils/firebaseAdmin.js';
import { ok, fail } from '../utils/respond.js';
import * as audit from '../services/auditLog.js';
import { readCounters, readSeries } from '../services/adminEvents.js';
import { connectedAdminCount } from '../services/adminSocket.js';
import {
  generateReport,
  isReportWindow,
  isReportingConfigured,
} from '../services/aiReports.js';
import { invalidateFlagCache } from '../services/featureFlags.js';
import {
  activationFunnel,
  activeUsers as activeUserMetrics,
  featureAdoption,
  retention,
} from '../services/analytics.js';

/**
 * The admin console API — admin.spllit.app.
 *
 * Mounted at /api/admin-console. Deliberately a new namespace rather than an
 * extension of /api/admin-panel: that router is what the shipped in-app admin
 * page calls, and changing its shapes would break a surface that is live.
 *
 * Two things hold for every handler below:
 *   - authorisation is enforced here, in middleware, never in the client;
 *   - every mutation writes an audit row, including the ones that fail.
 */

const router = Router();

// Applied once at the router level so a new handler cannot ship ungated by
// someone forgetting to repeat it.
router.use(identify, requireConsoleAdmin);

const USER_ROW = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  college: true,
  profilePhoto: true,
  role: true,
  adminRole: true,
  isAdmin: true,
  adminStatus: true,
  isActive: true,
  adminGrants: true,
  adminRevokes: true,
  sessionsRevokedAt: true,
  onboarded: true,
  emailVerified: true,
  phoneVerified: true,
  instituteVerified: true,
  rating: true,
  totalRides: true,
  createdAt: true,
  lastSeen: true,
} as const;

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Page size, clamped so a caller cannot ask for the whole collection. */
function pagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * GET /api/admin-console/me
 *
 * What the console calls on load to decide whether to render at all, and which
 * navigation the signed-in admin should see. The permission list is sent so the
 * client can hide what it cannot do — hiding is a courtesy, the gate is server
 * side either way.
 */
router.get('/me', async (req: AdminRequest, res: Response) => {
  const admin = req.admin!;
  return ok(res, {
    userId: admin.userId,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    roleLabel: ROLE_LABELS[admin.role],
    permissions: admin.permissions,
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * GET /api/admin-console/overview
 *
 * Counts for the founder dashboard, in one round trip.
 *
 * Phase 3 changed what this costs. The volatile figures — the ones the live
 * feed increments — now come from `MetricCounter`, which is a single keyed read
 * of every counter at once rather than a `count()` per metric. What remains as
 * a live count is the set of figures that are *states* rather than events:
 * how many rides are currently active, how many accounts are suspended. Those
 * cannot be derived by incrementing, because a row changing status is not a
 * write anybody counts.
 *
 * `counters` is sent alongside so the client can tell a metric that is
 * genuinely zero from one that has not started being recorded yet — the
 * counters only begin filling from the first write after Phase 3 shipped, so a
 * database with existing history reports lifetime totals lower than the
 * collections actually hold until it is backfilled.
 */
router.get(
  '/overview',
  requirePermission('dashboard.view'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      /**
       * Past this, nothing scheduled can still be under way.
       *
       * Mirrors LIFECYCLE.HARD_MAX_HOURS in services/squadLifecycle.ts, which
       * is the rule the app itself applies when it does evaluate a squad.
       */
      const staleBefore = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      const [
        totalUsers,
        newToday,
        newWeek,
        newMonth,
        activeUsers,
        suspendedUsers,
        onboardedUsers,
        totalRides,
        activeRides,
        staleRides,
        completedRides,
        cancelledRides,
        totalSquads,
        activeSquads,
        staleSquads,
        upcomingEvents,
        totalEvents,
        communities,
        messages24h,
        threads,
        openEmergencies,
        waitlist,
        notifications24h,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        /**
         * Distinct users active today, from ActiveUserDay.
         *
         * This used to count `lastSeen >= 24h`, which was an approximation and
         * labelled as one: lastSeen is written at login and nowhere else, so it
         * measured recent *sign-ins* rather than activity. Now that Phase 4
         * records activity properly, showing the old estimate here beside a
         * real DAU on the analytics page would just be two different numbers
         * for the same question.
         *
         * One row per user per day means the count is already distinct, and it
         * is bounded by DAU rather than by the size of the User collection.
         */
        prisma.activeUserDay.count({ where: { day: new Date().toISOString().slice(0, 10) } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.user.count({ where: { onboarded: true } }),
        prisma.ride.count(),
        /**
         * Rides that are actually happening, not rows that were never closed.
         *
         * Status alone was counting 21 as "active" while every one of their
         * departure times sat in the past — the oldest by five months. Nothing
         * moves a `requested` ride to `cancelled` when its departure passes:
         * the state machine is driven by people, and people who lose interest
         * do not press cancel.
         *
         * So the clock is part of the question. `arriving` and `in_progress`
         * are live by definition whatever the schedule says; the rest have to
         * still be ahead of us, within the same four-hour ceiling the squad
         * lifecycle uses for "this cannot still be running".
         */
        prisma.ride.count({
          where: {
            OR: [
              { status: { in: ['arriving', 'in_progress'] } },
              {
                status: { in: ['requested', 'pending', 'accepted', 'matched'] },
                departureTime: { gte: staleBefore },
              },
            ],
          },
        }),
        // Open rides whose departure is long past. Not noise — 21 of these is
        // the actual finding, and hiding them behind a corrected count would
        // fix the number while leaving the problem invisible.
        prisma.ride.count({
          where: {
            status: { in: ['requested', 'pending', 'accepted', 'matched'] },
            departureTime: { lt: staleBefore },
          },
        }),
        prisma.ride.count({ where: { status: 'completed' } }),
        prisma.ride.count({ where: { status: 'cancelled' } }),
        prisma.squad.count(),
        /**
         * Same correction for squads.
         *
         * `isActive` is derived from `status`, and `status` is derived on read
         * — see services/squadLifecycle.ts. A squad nobody has opened since its
         * meeting keeps whatever it was last written with, so the dashboard was
         * showing two squads as active whose meetings were three days and one
         * month ago.
         *
         * Evaluating the real lifecycle needs each squad's members, which is a
         * query per squad and not something a dashboard tile can afford. The
         * hard ceiling costs nothing and is the same rule: past it, the
         * lifecycle would have ended the squad anyway.
         */
        prisma.squad.count({
          where: {
            isActive: true,
            OR: [{ meetingAt: null }, { meetingAt: { gte: staleBefore } }],
          },
        }),
        prisma.squad.count({
          where: { isActive: true, meetingAt: { lt: staleBefore } },
        }),
        prisma.event.count({ where: { status: 'published', startsAt: { gte: now } } }),
        prisma.event.count(),
        prisma.community.count(),
        prisma.threadMessage.count({ where: { createdAt: { gte: dayAgo } } }),
        prisma.chatThread.count(),
        prisma.emergency.count({ where: { status: 'active' } }),
        prisma.waitlist.count(),
        prisma.notification.count({ where: { createdAt: { gte: dayAgo } } }),
      ]);

      /**
       * Lifetime counters and today's rollups, in two queries rather than
       * twenty. Read after the block above so a slow counter read cannot delay
       * the figures the page cannot render without.
       */
      const counters = await readCounters();

      return ok(res, {
        generatedAt: now.toISOString(),
        /**
         * Raw counters, so the client can distinguish a real zero from a
         * metric that is not yet being recorded. Empty until the first write
         * after Phase 3 — existing history is not backfilled.
         */
        counters,
        users: {
          total: totalUsers,
          newToday,
          newWeek,
          newMonth,
          activeToday: activeUsers,
          suspended: suspendedUsers,
          onboarded: onboardedUsers,
        },
        rides: {
          total: totalRides,
          active: activeRides,
          stale: staleRides,
          completed: completedRides,
          cancelled: cancelledRides,
        },
        squads: { total: totalSquads, active: activeSquads, stale: staleSquads },
        events: { total: totalEvents, upcoming: upcomingEvents },
        communities: { total: communities },
        chat: { messages24h, threads },
        emergencies: { open: openEmergencies },
        waitlist: { total: waitlist },
        notifications: { sent24h: notifications24h },

        /**
         * Surfaces the brief asks for that Spllit has no data model behind.
         * Sent explicitly so the console can render "not available" instead of
         * a zero, which would read as a real measurement of nothing happening.
         */
        unavailable: [
          { key: 'reports', reason: 'No reporting feature exists in Spllit yet.' },
          { key: 'posts', reason: 'Spllit has no posts or comments.' },
          { key: 'analytics', reason: 'Event tracking is not implemented yet.' },
        ],
      });
    } catch (error) {
      console.error('[admin-console/overview]', error);
      return fail(res, 500, 'Failed to load overview');
    }
  },
);

/**
 * GET /api/admin-console/signups?days=30
 * Signup counts bucketed by day, aggregated server-side.
 */
router.get(
  '/signups',
  requirePermission('dashboard.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
      const now = new Date();
      const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Only the timestamp is selected: bucketing needs nothing else, and
      // pulling whole user rows to count them is how this gets slow.
      const rows = await prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      });

      const buckets = new Map<string, number>();
      for (let i = days - 1; i >= 0; i -= 1) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        buckets.set(day.toISOString().slice(0, 10), 0);
      }
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      return ok(res, {
        days,
        series: [...buckets.entries()].map(([date, count]) => ({ date, count })),
      });
    } catch (error) {
      console.error('[admin-console/signups]', error);
      return fail(res, 500, 'Failed to load signup trend');
    }
  },
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** GET /api/admin-console/users?q=&status=&page=&limit= */
router.get(
  '/users',
  requirePermission('users.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const q = String(req.query.q ?? '').trim();
      const status = String(req.query.status ?? '').trim();
      const { page, limit, skip } = pagination(req.query);

      const where: Record<string, unknown> = {};

      if (q) {
        const term = escapeRegex(q);
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { college: { contains: term, mode: 'insensitive' } },
        ];
      }

      if (status === 'active') where.isActive = true;
      if (status === 'suspended') where.isActive = false;
      if (status === 'onboarded') where.onboarded = true;
      if (status === 'admins') {
        where.OR = [{ role: { in: ['admin', 'subadmin'] } }, { isAdmin: true }];
      }

      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: USER_ROW,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return ok(res, {
        rows: rows.map((u) => ({ ...u, consoleRole: resolveAdminRole(u) })),
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('[admin-console/users]', error);
      return fail(res, 500, 'Failed to load users');
    }
  },
);

/**
 * GET /api/admin-console/users/:id
 *
 * The 360° view the brief asks for, assembled from what Spllit actually has.
 * Counts rather than full lists for the heavy relations: this is a summary
 * page, and the tabs fetch their own pages when opened.
 */
router.get(
  '/users/:id',
  requirePermission('users.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const id = String(req.params.id);

      const user = await prisma.user.findUnique({ where: { id }, select: USER_ROW });
      if (!user) return fail(res, 404, 'User not found');

      const [
        rides,
        squadMemberships,
        events,
        emergencies,
        notifications,
        blocks,
        communities,
        recentRides,
        squadRows,
        eventRows,
        communityRows,
      ] = await Promise.all([
        prisma.ride.count({ where: { userId: id } }),
        prisma.squadMember.count({ where: { userId: id } }),
        prisma.eventAttendee.count({ where: { userId: id } }),
        prisma.emergency.count({ where: { userId: id } }),
        prisma.notification.count({ where: { userId: id } }),
        prisma.block.count({ where: { blockedId: id } }),
        prisma.communityMember.count({ where: { userId: id } }),
        prisma.ride.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
            origin: true,
            destination: true,
            departureTime: true,
          },
        }),
        prisma.squadMember.findMany({
          where: { userId: id },
          orderBy: { joinedAt: 'desc' },
          take: 10,
          select: { id: true, squadId: true, role: true, status: true, joinedAt: true },
        }),
        prisma.eventAttendee.findMany({
          where: { userId: id },
          orderBy: { joinedAt: 'desc' },
          take: 10,
          select: { id: true, eventId: true, status: true, joinedAt: true },
        }),
        prisma.communityMember.findMany({
          where: { userId: id },
          orderBy: { joinedAt: 'desc' },
          take: 10,
          select: { id: true, communityId: true, role: true, joinedAt: true },
        }),
      ]);

      // Names for the ids above, batched. Three lookups rather than thirty.
      const [squadNames, eventNames, communityNames] = await Promise.all([
        prisma.squad.findMany({
          where: { id: { in: squadRows.map((row) => row.squadId) } },
          select: { id: true, name: true, status: true },
        }),
        prisma.event.findMany({
          where: { id: { in: eventRows.map((row) => row.eventId) } },
          select: { id: true, title: true, startsAt: true, status: true },
        }),
        prisma.community.findMany({
          where: { id: { in: communityRows.map((row) => row.communityId) } },
          select: { id: true, name: true, slug: true },
        }),
      ]);

      const squadById = new Map(squadNames.map((squad) => [squad.id, squad]));
      const eventById = new Map(eventNames.map((event) => [event.id, event]));
      const communityById = new Map(communityNames.map((community) => [community.id, community]));

      /**
       * Two distinct trails, deliberately separated.
       *
       * `auditTrail` is what admins did *to* this account. `actedTrail` is what
       * this account did as an admin. Merging them into one list reads as if a
       * suspended user suspended somebody, which is the opposite of what
       * happened.
       */
      const [auditTrail, actedTrail] = await Promise.all([
        prisma.auditLog.findMany({
          where: { targetType: 'user', targetId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.auditLog.findMany({
          where: { actorId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

      return ok(res, {
        user: { ...user, consoleRole: resolveAdminRole(user) },
        counts: {
          rides,
          squads: squadMemberships,
          events,
          communities,
          emergencies,
          notifications,
          blockedBy: blocks,
        },
        recentRides,
        squads: squadRows.map((row) => ({ ...row, squad: squadById.get(row.squadId) ?? null })),
        events: eventRows.map((row) => ({ ...row, event: eventById.get(row.eventId) ?? null })),
        communities: communityRows.map((row) => ({
          ...row,
          community: communityById.get(row.communityId) ?? null,
        })),
        auditTrail,
        actedTrail,
        unavailable: [
          { key: 'posts', reason: 'Spllit has no posts or comments.' },
          { key: 'reports', reason: 'No reporting feature exists in Spllit yet.' },
        ],
      });
    } catch (error) {
      console.error('[admin-console/users/:id]', error);
      return fail(res, 500, 'Failed to load user');
    }
  },
);

/**
 * PATCH /api/admin-console/users/:id/status
 * Suspend or restore an account. Body: { isActive, reason }
 */
router.patch(
  '/users/:id/status',
  requirePermission('users.suspend'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = String(req.params.id);
      const isActive = Boolean(req.body?.isActive);
      const reason = String(req.body?.reason ?? '').trim();

      if (!reason || reason.length < 4) {
        return fail(res, 400, 'A reason is required, so the audit log explains itself later.');
      }

      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, isActive: true, role: true, adminRole: true },
      });
      if (!target) return fail(res, 404, 'User not found');

      // An admin suspending themselves locks the console behind an account
      // that can no longer sign in to undo it.
      if (target.id === admin.userId) {
        return fail(res, 400, 'You cannot change your own account status.');
      }

      // Rank check: a moderator must not be able to suspend a super admin.
      const targetRole = resolveAdminRole({
        adminRole: target.adminRole,
        role: target.role,
        isAdmin: false,
        adminStatus: 'active',
        isActive: true,
      });
      if (targetRole && !canManageRole(admin.role, targetRole)) {
        return fail(res, 403, 'You cannot act on an account of equal or higher privilege.');
      }

      const updated = await audit.recorded(
        admin,
        {
          action: isActive ? 'user.restore' : 'user.suspend',
          targetType: 'user',
          targetId: id,
          targetLabel: target.email,
          ...audit.diff({ isActive: target.isActive }, { isActive }),
          reason,
        },
        req,
        () =>
          prisma.user.update({
            where: { id },
            data: suspensionPatch(isActive),
            select: USER_ROW,
          }),
      );
      invalidateSuspensions();
      // Sockets authenticate once, at connect; one already open would keep
      // working until it dropped on its own.
      if (!isActive) getIO()?.in(`user:${id}`).disconnectSockets(true);

      return ok(res, updated);
    } catch (error) {
      console.error('[admin-console/users/status]', error);
      return fail(res, 500, 'Failed to update account status');
    }
  },
);

/**
 * PATCH /api/admin-console/users/:id/role
 * Assign a console role. Body: { adminRole: AdminRole | null, reason }
 */
router.patch(
  '/users/:id/role',
  requirePermission('admins.manage'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = String(req.params.id);
      const next = req.body?.adminRole ?? null;
      const reason = String(req.body?.reason ?? '').trim();

      if (next !== null && !isAdminRole(next)) {
        return fail(res, 400, `Role must be null or one of: ${ADMIN_ROLES.join(', ')}`);
      }
      if (!reason || reason.length < 4) {
        return fail(res, 400, 'A reason is required for a role change.');
      }

      // Self-edit is what turns any admin account into a super admin in one
      // request, so it is refused outright rather than rank-checked.
      if (id === admin.userId) {
        return fail(res, 400, 'You cannot change your own role.');
      }

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          adminRole: true,
          role: true,
          isAdmin: true,
          adminStatus: true,
          isActive: true,
        },
      });
      if (!target) return fail(res, 404, 'User not found');

      const currentRole = resolveAdminRole(target);

      // Both directions are checked: you must outrank what they are now, and
      // you must outrank what you are trying to make them. Without the second
      // check an admin could mint a super admin and be promoted back by them.
      if (currentRole && !canManageRole(admin.role, currentRole)) {
        return fail(res, 403, 'You cannot change the role of an equal or higher admin.');
      }
      if (next && !canManageRole(admin.role, next)) {
        return fail(res, 403, 'You cannot grant a role equal to or above your own.');
      }

      const updated = await audit.recorded(
        admin,
        {
          action: next ? 'admin.role_grant' : 'admin.role_revoke',
          targetType: 'admin',
          targetId: id,
          targetLabel: target.email,
          ...audit.diff({ adminRole: target.adminRole }, { adminRole: next }),
          reason,
        },
        req,
        () =>
          prisma.user.update({
            where: { id },
            data: { adminRole: next },
            select: USER_ROW,
          }),
      );

      return ok(res, { ...updated, consoleRole: resolveAdminRole(updated) });
    } catch (error) {
      console.error('[admin-console/users/role]', error);
      return fail(res, 500, 'Failed to update role');
    }
  },
);

// ---------------------------------------------------------------------------
// Per-admin permissions and sessions
// ---------------------------------------------------------------------------

/**
 * Everything below answers one question the role matrix cannot: "this person
 * needs one more thing than their role gives, or one thing less."
 *
 * The alternative is a new role per exception, and a matrix grown that way
 * stops being readable at about eight rows — at which point nobody can say what
 * any of them actually mean, which is the failure mode a permission system
 * exists to prevent.
 *
 * Stored as overrides, not as an absolute list. See the columns in
 * prisma/schema.prisma and `effectivePermissions` for why.
 */

/** Both lists, cleaned: known permissions only, deduplicated, order fixed. */
function cleanPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<Permission>();
  for (const entry of value) {
    if (isPermission(entry)) set.add(entry);
  }
  return PERMISSIONS.filter((permission) => set.has(permission));
}

/**
 * PATCH /api/admin-console/users/:id/permissions
 * Body: { grants: Permission[], revokes: Permission[], reason }
 */
router.patch(
  '/users/:id/permissions',
  requirePermission('admins.manage'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = String(req.params.id);
      const reason = String(req.body?.reason ?? '').trim();

      if (reason.length < 4) {
        return fail(res, 400, 'A reason is required for a permission change.');
      }

      /**
       * Self-edit is refused outright rather than rank-checked — the same rule
       * as role changes, for the same reason. An admin who can widen their own
       * permissions is an admin with every permission, one request away.
       */
      if (id === admin.userId) {
        return fail(res, 400, 'You cannot change your own permissions.');
      }

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          adminRole: true,
          role: true,
          isAdmin: true,
          adminStatus: true,
          isActive: true,
          adminGrants: true,
          adminRevokes: true,
        },
      });
      if (!target) return fail(res, 404, 'User not found');

      const targetRole = resolveAdminRole(target);
      if (!targetRole) {
        return fail(res, 400, 'That account has no console role to adjust.', 'not-an-admin');
      }

      // Same ladder that guards role assignment: you may only reach below you.
      if (!canManageRole(admin.role, targetRole)) {
        return fail(res, 403, 'That admin outranks you.', 'outranked');
      }

      const grants = cleanPermissions(req.body?.grants);
      const revokes = cleanPermissions(req.body?.revokes);

      /**
       * You cannot grant what you do not hold.
       *
       * Without this a moderator with `admins.manage` could hand out
       * `users.delete` — a permission nobody in that chain was ever given —
       * and the rank ladder would not notice, because the *role* never moved.
       */
      const beyond = grants.filter((permission) => !admin.permissions.includes(permission));
      if (beyond.length > 0) {
        return fail(
          res,
          403,
          `You cannot grant what you do not hold yourself: ${beyond.join(', ')}`,
          'grant-exceeds-authority',
        );
      }

      const updated = await audit.recorded(
        admin,
        {
          action: 'admin.permissions',
          targetType: 'user',
          targetId: id,
          targetLabel: target.email,
          ...audit.diff(
            { grants: target.adminGrants, revokes: target.adminRevokes },
            { grants, revokes },
          ),
          reason,
        },
        req,
        () =>
          prisma.user.update({
            where: { id },
            data: { adminGrants: grants, adminRevokes: revokes },
            select: USER_ROW,
          }),
      );

      return ok(res, {
        ...updated,
        consoleRole: targetRole,
        grants,
        revokes,
        effective: effectivePermissions(targetRole, grants, revokes),
      });
    } catch (error) {
      console.error('[admin-console/users/permissions]', error);
      return fail(res, 500, 'Failed to update permissions');
    }
  },
);

/**
 * POST /api/admin-console/users/:id/sessions/revoke
 * Ends every signed-in session. Body: { reason }
 *
 * Two writes, because either alone leaves a hole: the column refuses the token
 * already in their browser, and Firebase stops the client refreshing a new one.
 * The column is written *first* — if the Firebase call fails, the cut-off has
 * still happened, whereas the other order would report success having done
 * nothing enforceable.
 */
router.post(
  '/users/:id/sessions/revoke',
  requirePermission('admins.manage'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = String(req.params.id);
      const reason = String(req.body?.reason ?? '').trim();

      if (reason.length < 4) return fail(res, 400, 'A reason is required.');

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firebaseUid: true,
          adminRole: true,
          role: true,
          isAdmin: true,
          adminStatus: true,
          isActive: true,
        },
      });
      if (!target) return fail(res, 404, 'User not found');

      /**
       * Outranking is checked only for admins. Ending an ordinary user's
       * session is a support action, not an escalation — but ending a peer's
       * is exactly the lateral move the ladder exists to stop.
       */
      const targetRole = resolveAdminRole(target);
      if (targetRole && !canManageRole(admin.role, targetRole)) {
        return fail(res, 403, 'That admin outranks you.', 'outranked');
      }
      if (id === admin.userId) {
        return fail(res, 400, 'Sign out normally rather than revoking yourself.');
      }

      const at = new Date();
      await audit.record(
        admin,
        {
          action: 'admin.sessions.revoke',
          targetType: 'user',
          targetId: id,
          targetLabel: target.email,
          after: { sessionsRevokedAt: at.toISOString() },
          reason,
        },
        req,
      );

      await prisma.user.update({ where: { id }, data: { sessionsRevokedAt: at } });

      /**
       * Best-effort, and deliberately after the write. A Firebase outage must
       * not leave the caller believing nothing happened when the enforceable
       * half already has — they would simply press it again.
       */
      let firebase = false;
      if (target.firebaseUid) {
        try {
          await revokeFirebaseSessions(target.firebaseUid);
          firebase = true;
        } catch (error) {
          console.error('[admin-console/sessions/revoke] firebase refused', error);
        }
      }

      return ok(res, { revokedAt: at.toISOString(), firebase });
    } catch (error) {
      console.error('[admin-console/users/sessions/revoke]', error);
      return fail(res, 500, 'Failed to end the sessions');
    }
  },
);

/**
 * DELETE /api/admin-console/users/:id/sessions/revoke
 * Lets them sign in again. Body: { reason }
 *
 * Clearing the column is all that is needed — it only ever refuses credentials
 * older than itself, so removing it stops that comparison happening. Firebase's
 * revocation is not undone and does not need to be: it invalidated the refresh
 * tokens that existed at that moment, and signing in again issues new ones.
 *
 * So this does not restore the old session. Nothing can. It restores the
 * ability to start a new one, which is what "renew" means here — worth being
 * precise about, because an operator expecting the person's open tab to spring
 * back to life would otherwise report this as broken.
 */
router.delete(
  '/users/:id/sessions/revoke',
  requirePermission('admins.manage'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const id = String(req.params.id);
      const reason = String(req.body?.reason ?? '').trim();

      if (reason.length < 4) return fail(res, 400, 'A reason is required.');

      const target = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          adminRole: true,
          role: true,
          isAdmin: true,
          adminStatus: true,
          isActive: true,
        },
      });
      if (!target) return fail(res, 404, 'User not found');

      const targetRole = resolveAdminRole(target);
      if (targetRole && !canManageRole(admin.role, targetRole)) {
        return fail(res, 403, 'That admin outranks you.', 'outranked');
      }

      await audit.record(
        admin,
        {
          action: 'admin.sessions.restore',
          targetType: 'user',
          targetId: id,
          targetLabel: target.email,
          after: { sessionsRevokedAt: null },
          reason,
        },
        req,
      );

      await prisma.user.update({ where: { id }, data: { sessionsRevokedAt: null } });
      return ok(res, { revokedAt: null });
    } catch (error) {
      console.error('[admin-console/users/sessions/restore]', error);
      return fail(res, 500, 'Failed to restore access');
    }
  },
);

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

/** GET /api/admin-console/admins — everyone who can reach the console. */
router.get(
  '/admins',
  requirePermission('admins.manage'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const rows = await prisma.user.findMany({
        where: {
          OR: [
            { adminRole: { not: null } },
            { role: { in: ['admin', 'subadmin'] } },
            { isAdmin: true },
          ],
        },
        select: USER_ROW,
        orderBy: { createdAt: 'asc' },
      });

      return ok(res, {
        rows: rows
          .map((u) => {
            const consoleRole = resolveAdminRole(u);
            return {
              ...u,
              consoleRole,
              /**
               * The resolved set, sent alongside the overrides rather than
               * left for the client to recompute. Two implementations of
               * "what may this person do" is one too many, and the one that
               * matters is the server's.
               */
              effective: consoleRole
                ? effectivePermissions(consoleRole, u.adminGrants, u.adminRevokes)
                : [],
            };
          })
          // Rows whose legacy fields no longer resolve to a role are dropped:
          // listing a deactivated admin as an admin is how one gets forgotten
          // about and quietly reactivated later.
          .filter((u) => u.consoleRole !== null),
        roles: ADMIN_ROLES.map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
          permissions: permissionsFor(role),
        })),
        /** Every toggle the console may offer, in a stable order. */
        permissions: PERMISSIONS,
        /**
         * What the *caller* holds. The console greys out anything they cannot
         * grant, because the server refuses those and a toggle that always
         * errors is worse than one that is visibly unavailable.
         */
        actorPermissions: _req.admin!.permissions,
        actorRole: _req.admin!.role,
      });
    } catch (error) {
      console.error('[admin-console/admins]', error);
      return fail(res, 500, 'Failed to load admins');
    }
  },
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/** GET /api/admin-console/audit?actor=&action=&targetType=&page= */
router.get(
  '/audit',
  requirePermission('audit.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const where: Record<string, unknown> = {};

      const actor = String(req.query.actor ?? '').trim();
      const action = String(req.query.action ?? '').trim();
      const targetType = String(req.query.targetType ?? '').trim();

      if (actor) where.actorEmail = { contains: escapeRegex(actor), mode: 'insensitive' };
      if (action) where.action = action;
      if (targetType) where.targetType = targetType;

      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return ok(res, { rows, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error('[admin-console/audit]', error);
      return fail(res, 500, 'Failed to load audit log');
    }
  },
);

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

/** GET /api/admin-console/flags */
router.get(
  '/flags',
  requirePermission('settings.view'),
  async (_req: AdminRequest, res: Response) => {
    try {
      const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
      return ok(res, { rows });
    } catch (error) {
      console.error('[admin-console/flags]', error);
      return fail(res, 500, 'Failed to load feature flags');
    }
  },
);

/** PATCH /api/admin-console/flags/:key — { enabled?, rolloutPercentage?, reason } */
router.patch(
  '/flags/:key',
  requirePermission('flags.edit'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const key = String(req.params.key);
      const reason = String(req.body?.reason ?? '').trim();

      const existing = await prisma.featureFlag.findUnique({ where: { key } });
      if (!existing) return fail(res, 404, 'Feature flag not found');

      const data: Record<string, unknown> = { updatedBy: admin.userId };

      if (typeof req.body?.enabled === 'boolean') data.enabled = req.body.enabled;
      if (req.body?.rolloutPercentage !== undefined) {
        const pct = Number(req.body.rolloutPercentage);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          return fail(res, 400, 'Rollout percentage must be between 0 and 100.');
        }
        data.rolloutPercentage = Math.round(pct);
      }

      const updated = await audit.recorded(
        admin,
        {
          action: 'flag.update',
          targetType: 'flag',
          targetId: existing.id,
          targetLabel: key,
          ...audit.diff(
            { enabled: existing.enabled, rolloutPercentage: existing.rolloutPercentage },
            {
              enabled: data.enabled ?? existing.enabled,
              rolloutPercentage: data.rolloutPercentage ?? existing.rolloutPercentage,
            },
          ),
          reason: reason || null,
        },
        req,
        () => prisma.featureFlag.update({ where: { key }, data }),
      );

      // Same reasoning as settings: the admin who just flipped a flag is the
      // one most likely to check whether it took.
      invalidateFlagCache();

      return ok(res, updated);
    } catch (error) {
      console.error('[admin-console/flags/:key]', error);
      return fail(res, 500, 'Failed to update feature flag');
    }
  },
);

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------

/**
 * GET /api/admin-console/system
 *
 * Only what can actually be measured from inside the process. Latency is a
 * real round trip to Mongo, not an estimate; anything the runtime cannot see
 * is reported as unavailable rather than invented.
 */
router.get(
  '/system',
  requirePermission('system.view'),
  async (_req: AdminRequest, res: Response) => {
    const startedAt = Date.now();
    let databaseOk = false;
    let databaseLatencyMs: number | null = null;

    try {
      await prisma.user.count({ where: { id: '__healthcheck__' } });
      databaseOk = true;
      databaseLatencyMs = Date.now() - startedAt;
    } catch (error) {
      console.error('[admin-console/system] database check failed', error);
    }

    return ok(res, {
      checkedAt: new Date().toISOString(),
      api: { ok: true, uptimeSeconds: Math.round(process.uptime()) },
      // Real connections to the /admin namespace, not an estimate.
      realtime: { connectedAdmins: connectedAdminCount() },
      database: { ok: databaseOk, latencyMs: databaseLatencyMs },
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      node: process.version,
      unavailable: [
        { key: 'errorRate', reason: 'No error aggregation service is wired up.' },
        { key: 'queues', reason: 'Spllit has no background job queue.' },
      ],
    });
  },
);

// ---------------------------------------------------------------------------
// Realtime (Phase 3)
// ---------------------------------------------------------------------------

/**
 * GET /api/admin-console/activity?limit=
 *
 * The activity feed's backlog. The console loads this once, then receives
 * everything after it over the socket — so this is the only query the feed
 * makes, no matter how long the tab stays open.
 */
router.get(
  '/activity',
  requirePermission('dashboard.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);

      const rows = await prisma.activityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return ok(res, { rows, connectedAdmins: connectedAdminCount() });
    } catch (error) {
      console.error('[admin-console/activity]', error);
      return fail(res, 500, 'Failed to load activity');
    }
  },
);

/**
 * GET /api/admin-console/series?metric=&days=
 *
 * A metric's daily history, straight from the rollups.
 *
 * Unlike /signups — which scans the User collection and is kept because it can
 * report on history recorded before Phase 3 — this reads pre-aggregated
 * buckets and its cost does not grow with the size of the collection.
 */
router.get(
  '/series',
  requirePermission('dashboard.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const metric = String(req.query.metric ?? '').trim();
      if (!metric) return fail(res, 400, 'A metric is required.');

      const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
      return ok(res, { metric, days, series: await readSeries(metric, days) });
    } catch (error) {
      console.error('[admin-console/series]', error);
      return fail(res, 500, 'Failed to load series');
    }
  },
);

// ---------------------------------------------------------------------------
// Analytics (Phase 4)
// ---------------------------------------------------------------------------

/**
 * GET /api/admin-console/analytics
 *
 * Active users, retention, the activation funnel and feature adoption, in one
 * round trip — the analytics page needs all four to render anything useful,
 * and four requests would just be four waterfalls.
 *
 * Gated on `analytics.view`, which is the one permission an Analyst has. That
 * is deliberate: this endpoint returns aggregates only and never names an
 * individual, so it is the one surface a read-only role can safely reach.
 */
/**
 * Cached analytics responses, keyed by window.
 *
 * These are the most expensive reads in the console — several aggregations
 * across whole collections — and they answer a question whose shape does not
 * change minute to minute. Without this, three admins with the page open turn
 * one workload into three, and a refresh key turns it into as many as somebody
 * feels like.
 *
 * Sixty seconds is chosen against what the page is for: nobody makes a decision
 * from a retention curve that depends on the last minute of data.
 */
const analyticsCache = new Map<number, { at: number; payload: unknown }>();
const ANALYTICS_CACHE_MS = 60_000;

router.get(
  '/analytics',
  requirePermission('analytics.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);

      const cached = analyticsCache.get(days);
      if (cached && Date.now() - cached.at < ANALYTICS_CACHE_MS) {
        return ok(res, cached.payload);
      }

      const [active, retentionRows, funnel, adoption] = await Promise.all([
        activeUserMetrics(days),
        retention(14),
        activationFunnel(),
        featureAdoption(),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        days,
        active,
        retention: retentionRows,
        funnel,
        adoption,
        /**
         * Said in the payload rather than left for the reader to infer.
         * ActiveUserDay only starts filling from the first request after
         * Phase 4 shipped, so every figure derived from it describes the
         * period since then and not the platform's whole history.
         */
        notes: [
          {
            key: 'backfill',
            text: 'Active-user history starts when this shipped. Days before that read as zero because nothing was recorded, not because nobody was there.',
          },
        ],
      };

      // Bounded by the number of distinct windows the UI offers (7/30/90), so
      // this cannot grow — no sweep needed.
      analyticsCache.set(days, { at: Date.now(), payload });

      return ok(res, payload);
    } catch (error) {
      console.error('[admin-console/analytics]', error);
      return fail(res, 500, 'Failed to load analytics');
    }
  },
);

// ---------------------------------------------------------------------------
// AI reports
// ---------------------------------------------------------------------------

/** GET /api/admin-console/reports?window=&page= */
router.get(
  '/reports',
  requirePermission('analytics.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const where: Record<string, unknown> = {};

      const window = String(req.query.window ?? '').trim();
      if (isReportWindow(window)) where.window = window;

      const [rows, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          // `inputs` is deliberately omitted from the list: it is the full
          // aggregate snapshot, and shipping one per row would make a page of
          // twenty reports many times larger than the prose anybody reads.
          select: {
            id: true,
            window: true,
            headline: true,
            body: true,
            model: true,
            trigger: true,
            actorEmail: true,
            error: true,
            createdAt: true,
          },
        }),
        prisma.report.count({ where }),
      ]);

      return ok(res, {
        rows,
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1),
        configured: isReportingConfigured(),
      });
    } catch (error) {
      console.error('[admin-console/reports]', error);
      return fail(res, 500, 'Failed to load reports');
    }
  },
);

/** GET /api/admin-console/reports/:id — one report, with what it was given. */
router.get(
  '/reports/:id',
  requirePermission('analytics.view'),
  async (req: AdminRequest, res: Response) => {
    try {
      const report = await prisma.report.findUnique({ where: { id: String(req.params.id) } });
      if (!report) return fail(res, 404, 'Report not found');
      return ok(res, report);
    } catch (error) {
      console.error('[admin-console/reports/:id]', error);
      return fail(res, 500, 'Failed to load report');
    }
  },
);

/**
 * POST /api/admin-console/reports/generate — { window }
 *
 * Gated on `exports.run` rather than `analytics.view`. Reading a report costs
 * nothing; writing one spends money at OpenAI, so it sits with the other
 * permission that authorises expensive work.
 */
router.post(
  '/reports/generate',
  requirePermission('exports.run'),
  async (req: AdminRequest, res: Response) => {
    try {
      const admin = req.admin!;
      const window = String(req.body?.window ?? '24h');

      if (!isReportWindow(window)) {
        return fail(res, 400, 'Window must be 1h, 24h or 7d.');
      }
      if (!isReportingConfigured()) {
        return fail(res, 503, 'Reports are not configured — GEMINI_API_KEY is not set.');
      }

      const report = await audit.recorded(
        admin,
        {
          action: 'report.generate',
          targetType: 'export',
          targetLabel: window,
          after: { window },
        },
        req,
        () => generateReport({ window, trigger: 'manual', actorEmail: admin.email }),
      );

      return ok(res, {
        id: report.id,
        headline: report.headline,
        body: report.body,
        failed: report.error !== null,
        error: report.error,
      });
    } catch (error) {
      console.error('[admin-console/reports/generate]', error);
      return fail(res, 500, 'Report generation failed');
    }
  },
);

export default router;

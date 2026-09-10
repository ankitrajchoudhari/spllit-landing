import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { requireVerifiedInstitute } from '../middleware/institute.js';
import { currentCommitment } from '../services/squads.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail } from '../utils/respond.js';
import { notify } from '../services/notifications.js';
import { emailRequestAccepted } from '../services/email.js';
import { getIO } from '../services/live.js';
import {
  ACTIVE_MEMBER_STATUSES,
  membershipOf,
  progressToMeetingPoint,
  recordPosition,
  SQUAD_ROLES,
  LIVE_SQUAD_STATUSES,
  type SquadRole,
} from '../services/squads.js';
import { markSquadActivity } from '../services/squadLifecycle.js';

const router = Router();

/**
 * Squad membership, roles, live position and arrival.
 *
 * Split from squads.ts, which owns discovery and the squad record itself.
 * Everything here is authorised through `membershipOf` — capability is decided
 * in one place so a new handler cannot quietly disagree with the others about
 * what a guest may do.
 *
 * Mounted on /api/squads *after* the main router, so its specific paths are
 * matched before that router's `/:id` catch-all.
 */

const USER_SUMMARY = {
  id: true,
  name: true,
  username: true,
  profilePhoto: true,
  college: true,
  rating: true,
} as const;

/** POST /api/squads/join-by-code — the code someone read out to you. */
router.post('/join-by-code', identify, requireVerifiedInstitute, async (req: AuthRequest, res: Response) => {
  try {
    /**
     * One squad at a time — the same rule the direct join enforces. A code is a
     * shortcut past discovery, not past the rules.
     */
    const commitment = await currentCommitment(req.user!.userId);
    if (commitment) {
      const where =
        commitment.squad.destination?.label?.split(',')[0] ?? commitment.squad.name;
      return fail(
        res,
        409,
        commitment.role === 'leader'
          ? `You lead a squad to ${where}. Cancel it before joining another.`
          : `You are already in a squad to ${where}. Leave it before joining another.`,
        'already-in-squad',
      );
    }

    // Uppercased and stripped: people type codes with spaces and in lower case.
    const code = String(req.body.code ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return fail(res, 400, 'Join codes are six characters', 'bad-code');

    const squad = await prisma.squad.findFirst({
      // Someone running late can still use the code after the meeting time.
      where: { joinCode: code, status: { in: [...LIVE_SQUAD_STATUSES] } },
    });
    if (!squad) return fail(res, 404, 'No squad with that code', 'bad-code');

    const existing = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: squad.id, userId: req.user!.userId } },
      select: { id: true, status: true },
    });

    if (existing && ACTIVE_MEMBER_STATUSES.includes(existing.status as 'active')) {
      return ok(res, { squadId: squad.id, status: existing.status });
    }
    if (existing?.status === 'pending') {
      return ok(res, { squadId: squad.id, status: 'pending' });
    }

    if (squad.memberLimit !== null && squad.memberCount >= squad.memberLimit) {
      return fail(res, 409, 'That squad is full', 'squad-full');
    }

    /**
     * A code proves you were told it, which is enough for a public squad but
     * not for a private one — there, the code gets you into the queue and the
     * leader still decides.
     */
    const status = squad.visibility === 'public' ? 'active' : 'pending';

    if (existing) {
      await prisma.squadMember.update({
        where: { id: existing.id },
        data: { status, role: 'member' },
      });
    } else {
      await prisma.squadMember.create({
        data: { squadId: squad.id, userId: req.user!.userId, role: 'member', status },
      });
    }

    if (status === 'active') {
      await prisma.squad.update({
        where: { id: squad.id },
        data: { memberCount: { increment: 1 } },
      });
    }

    const joiner = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    await notify({
      userId: squad.leaderId,
      type: 'squad.joined',
      title:
        status === 'active'
          ? `${joiner?.name ?? 'Someone'} joined ${squad.name}`
          : `${joiner?.name ?? 'Someone'} asked to join ${squad.name}`,
      body: status === 'active' ? 'They used the join code.' : 'Approve or reject the request.',
      href: `/squads/${squad.id}`,
      data: { squadId: squad.id },
    });

    getIO()?.to(`squad:${squad.id}`).emit('squad:members-changed', { squadId: squad.id });

    return ok(res, { squadId: squad.id, status }, 201);
  } catch (error) {
    console.error('[squads/join-by-code]', error);
    return fail(res, 500, 'Failed to join the squad');
  }
});

/** GET /api/squads/:id/requests — pending join requests, for admitters. */
router.get('/:id/requests', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership?.can.admitMembers) {
      return fail(res, 403, 'You cannot review join requests for this squad', 'forbidden');
    }

    const pending = await prisma.squadMember.findMany({
      where: { squadId: req.params.id, status: 'pending' },
      orderBy: { joinedAt: 'asc' },
      take: 100,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: pending.map((m) => m.userId) } },
      select: USER_SUMMARY,
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return ok(
      res,
      pending
        .map((member) => {
          const user = byId.get(member.userId);
          return user ? { id: member.id, user, requestedAt: member.joinedAt } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    );
  } catch (error) {
    console.error('[squads/requests]', error);
    return fail(res, 500, 'Failed to load join requests');
  }
});

/** POST /api/squads/:id/requests/:memberId — { decision: approve | reject } */
router.post('/:id/requests/:memberId', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership?.can.admitMembers) {
      return fail(res, 403, 'You cannot review join requests for this squad', 'forbidden');
    }

    const decision = String(req.body.decision ?? '');
    if (!['approve', 'reject'].includes(decision)) {
      return fail(res, 400, 'Decision must be approve or reject');
    }

    const request = await prisma.squadMember.findFirst({
      where: { id: req.params.memberId, squadId: req.params.id, status: 'pending' },
      select: { id: true, userId: true },
    });
    if (!request) return fail(res, 404, 'That request is no longer open');

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, memberCount: true, memberLimit: true },
    });
    if (!squad) return fail(res, 404, 'Squad not found');

    // Re-checked at approval, not at request time: the squad may have filled
    // while the request sat in the queue.
    if (
      decision === 'approve' &&
      squad.memberLimit !== null &&
      squad.memberCount >= squad.memberLimit
    ) {
      return fail(res, 409, 'The squad is full', 'squad-full');
    }

    await prisma.squadMember.update({
      where: { id: request.id },
      data: { status: decision === 'approve' ? 'active' : 'left' },
    });

    if (decision === 'approve') {
      await prisma.squad.update({
        where: { id: squad.id },
        data: { memberCount: { increment: 1 } },
      });
    }

    await notify({
      userId: request.userId,
      type: 'squad.joined',
      title: decision === 'approve' ? `You're in ${squad.name}` : `Not admitted to ${squad.name}`,
      body:
        decision === 'approve'
          ? 'You can see the map and chat now.'
          : 'The leader turned down your request.',
      href: decision === 'approve' ? `/squads/${squad.id}` : '/squads',
      data: { squadId: squad.id },
    });

    /**
     * Email only on approval.
     *
     * A rejection is told in-app and left there: mailing somebody to say they
     * were turned down adds nothing they can act on, and is exactly the kind of
     * message that earns a spam complaint. Not awaited — the decision is
     * already recorded and must not fail because mail did.
     */
    if (decision === 'approve') {
      void emailRequestAccepted({
        userId: request.userId,
        squadId: squad.id,
        squadName: squad.name,
      });
    }

    /**
     * The squad room, and the decided-upon user's own room.
     *
     * Until they are approved they are not in the squad room — `authorisedRooms`
     * only admits active members — so the one person whose status just changed
     * was the one person the broadcast could not reach. They saw nothing until
     * they reloaded the page, which is exactly the "I had to refresh to see I
     * was accepted" report. Their user room always exists, so it is sent there
     * too and the client invalidates from the same handler.
     */
    getIO()?.to(`squad:${squad.id}`).emit('squad:members-changed', { squadId: squad.id });
    getIO()?.to(`user:${request.userId}`).emit('squad:members-changed', { squadId: squad.id });

    return ok(res, { id: request.id, decision });
  } catch (error) {
    console.error('[squads/requests decision]', error);
    return fail(res, 500, 'Failed to record the decision');
  }
});

/** PATCH /api/squads/:id/members/:userId — change a member's role. */
router.patch('/:id/members/:userId', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership?.can.assignRoles) {
      return fail(res, 403, 'Only the squad leader can change roles', 'forbidden');
    }

    const role = String(req.body.role ?? '') as SquadRole;
    if (!SQUAD_ROLES.includes(role)) return fail(res, 400, 'Unknown role');

    const target = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: req.params.id, userId: req.params.userId } },
      select: { id: true, userId: true, status: true },
    });
    if (!target || !ACTIVE_MEMBER_STATUSES.includes(target.status as 'active')) {
      return fail(res, 404, 'That member is not in this squad');
    }

    /**
     * Handing over leadership is a swap, not a promotion: the squad must have
     * exactly one leader at every instant, so both rows and the squad's own
     * leaderId move together or not at all.
     */
    if (role === 'leader') {
      if (target.userId === req.user!.userId) return fail(res, 400, 'You already lead this squad');
      await prisma.$transaction([
        prisma.squadMember.update({ where: { id: target.id }, data: { role: 'leader' } }),
        prisma.squadMember.update({ where: { id: membership.memberId }, data: { role: 'co-leader' } }),
        prisma.squad.update({ where: { id: req.params.id }, data: { leaderId: target.userId } }),
      ]);
    } else {
      if (target.userId === req.user!.userId) {
        return fail(res, 400, 'Hand leadership to someone else first', 'transfer-first');
      }
      await prisma.squadMember.update({ where: { id: target.id }, data: { role } });
    }

    getIO()?.to(`squad:${req.params.id}`).emit('squad:members-changed', {
      squadId: req.params.id,
    });

    return ok(res, { userId: target.userId, role });
  } catch (error) {
    console.error('[squads/members PATCH]', error);
    return fail(res, 500, 'Failed to change the role');
  }
});

/** DELETE /api/squads/:id/members/:userId — remove someone. */
router.delete('/:id/members/:userId', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership?.can.manageMembers) {
      return fail(res, 403, 'You cannot remove members from this squad', 'forbidden');
    }

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, leaderId: true },
    });
    if (!squad) return fail(res, 404, 'Squad not found');
    if (squad.leaderId === req.params.userId) {
      return fail(res, 400, 'The leader cannot be removed', 'leader-immune');
    }

    const target = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: req.params.id, userId: req.params.userId } },
      select: { id: true, status: true },
    });
    if (!target || !ACTIVE_MEMBER_STATUSES.includes(target.status as 'active')) {
      return fail(res, 404, 'That member is not in this squad');
    }

    await prisma.squadMember.update({
      where: { id: target.id },
      // Position is cleared on removal. Someone who is no longer in the squad
      // must not leave their last known location behind in it.
      data: { status: 'left', lat: null, lng: null, locationAt: null },
    });
    await prisma.squad.update({
      where: { id: squad.id },
      data: { memberCount: { decrement: 1 } },
    });

    await notify({
      userId: req.params.userId,
      type: 'squad.joined',
      title: `Removed from ${squad.name}`,
      body: 'A squad leader removed you.',
      href: '/squads',
      data: { squadId: squad.id },
    });

    getIO()?.to(`squad:${squad.id}`).emit('squad:members-changed', { squadId: squad.id });

    return res.status(204).end();
  } catch (error) {
    console.error('[squads/members DELETE]', error);
    return fail(res, 500, 'Failed to remove the member');
  }
});

/**
 * POST /api/squads/:id/position — report where you are.
 *
 * Only ever your own position: the path carries no user id, so there is no
 * shape of this request that writes somebody else's location.
 */
router.post('/:id/position', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership?.can.shareLocation) {
      return fail(res, 403, 'You are not sharing location in this squad', 'forbidden');
    }

    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail(res, 400, 'A valid latitude and longitude are required');
    }

    const rawBattery = Number(req.body.battery);
    const result = await recordPosition({
      squadId: req.params.id,
      userId: req.user!.userId,
      lat,
      lng,
      battery: Number.isFinite(rawBattery)
        ? Math.min(Math.max(Math.round(rawBattery), 0), 100)
        : null,
      network: typeof req.body.network === 'string' ? req.body.network.slice(0, 20) : null,
    });

    return ok(res, result);
  } catch (error) {
    console.error('[squads/position]', error);
    return fail(res, 500, 'Failed to record your position');
  }
});

/**
 * GET /api/squads/:id/progress — every member's distance, ETA and state.
 *
 * The leader's answer to "do I wait or do we go". Positions are only returned
 * to people already in the squad, which is what stops a squad id being a
 * location lookup for anyone who has one.
 */
router.get('/:id/progress', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await membershipOf(req.params.id, req.user!.userId);
    if (!membership) return fail(res, 403, 'You are not in this squad', 'forbidden');

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { id: true, meetingPoint: true, meetingAt: true, leaderId: true },
    });
    if (!squad) return fail(res, 404, 'Squad not found');

    const members = await prisma.squadMember.findMany({
      where: { squadId: req.params.id, status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      orderBy: { joinedAt: 'asc' },
      take: 200,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: USER_SUMMARY,
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    const meeting = squad.meetingPoint as { lat?: number; lng?: number } | null;
    const hasMeeting = Number.isFinite(meeting?.lat) && Number.isFinite(meeting?.lng);

    const items = await Promise.all(
      members.map(async (member) => {
        const user = byId.get(member.userId);
        if (!user) return null;

        const progress = hasMeeting
          ? await progressToMeetingPoint(member, {
              lat: meeting!.lat as number,
              lng: meeting!.lng as number,
            })
          : { distanceMetres: null, etaSeconds: null, arrived: false };

        return {
          user,
          role: member.role,
          status: member.status,
          lat: member.lat,
          lng: member.lng,
          locationAt: member.locationAt,
          battery: member.battery,
          network: member.network,
          arrivedAt: member.arrivedAt,
          distanceMetres: progress.distanceMetres,
          etaSeconds: progress.etaSeconds,
        };
      }),
    );

    return ok(res, {
      meetingAt: squad.meetingAt,
      items: items.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    });
  } catch (error) {
    console.error('[squads/progress]', error);
    return fail(res, 500, 'Failed to load squad progress');
  }
});

export default router;

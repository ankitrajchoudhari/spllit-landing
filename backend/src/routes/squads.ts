import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { requireVerifiedInstitute } from '../middleware/institute.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail, boundingBox, parseCoords } from '../utils/respond.js';
import { parseBody, geoPoint, text, isoDate } from '../utils/validate.js';
import { mergeMeetingPoint, toStoredGeoPoint } from '../services/geoPoint.js';
import { z } from 'zod';
import { calculateDistance } from '../utils/helpers.js';
import { notify } from '../services/notifications.js';
import { emailJoinRequested, emailTripCreated } from '../services/email.js';
import { createJoinRequestToken, revokeTokensForRequest } from '../services/joinRequestTokens.js';
import { getIO } from '../services/live.js';
import {
  ACTIVE_MEMBER_STATUSES,
  allocateJoinCode,
  membershipOf,
  progressToMeetingPoint,
  recordPosition,
  transferLeadership,
  currentCommitment,
  SQUAD_ROLES,
  LIVE_SQUAD_STATUSES,
  type SquadRole,
} from '../services/squads.js';

import {
  acceptsJoins,
  isLiveStatus,
  markSquadActivity,
  syncSquadLifecycle,
} from '../services/squadLifecycle.js';

import { rankSquad } from '../services/squadRanking.js';
import {
  OPEN_SQUAD_WHERE,
  nearDestination,
  withFreeSlots,
} from '../services/squadVisibility.js';

const router = Router();

/**
 * Squad creation contract.
 *
 * `study` and `hostel` are accepted but not offered by the create flow — they
 * predate the destination-first redesign and still exist on stored rows, so
 * rejecting them would break an edit of an old squad.
 */
const createSquadSchema = z.object({
  name: text(2, 80),
  description: text(0, 500).optional(),
  /**
   * Accepted and ignored. The squad's college is read from the creator's own
   * row — see the create handler — because a client-supplied one both
   * mis-files squads and lets anyone post into another institute's feed.
   *
   * Kept in the schema rather than removed so an older client still sending it
   * is not rejected; zod simply drops the value.
   */
  college: text(0, 120).optional(),
  type: z
    .enum([
      'exam', 'college', 'office', 'shopping', 'travel',
      'event', 'concert', 'sports', 'general', 'study', 'hostel',
    ])
    .default('general'),
  visibility: z.enum(['public', 'private', 'invite']).default('public'),
  // Clamped, not rejected: a client sending 500 means "no real limit".
  memberLimit: z.coerce.number().int().min(2).max(200).nullish(),
  destination: geoPoint.optional(),
  meetingPoint: geoPoint.optional(),
  meetingAt: isoDate.optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/**
 * The whole meeting point, plus when to be there.
 *
 * `geoPoint` itself rather than a hand-picked subset, so this endpoint accepts
 * exactly what the create route does. A client that knows about `featureType`
 * or `accuracyMetres` can send them; one that does not sends `lat` and `lng` as
 * it always has, and `mergeMeetingPoint` decides what that means.
 */
const meetingPointSchema = geoPoint.extend({ meetingAt: isoDate.optional() });

const USER_SUMMARY = {
  id: true,
  name: true,
  username: true,
  profilePhoto: true,
  college: true,
  rating: true,
} as const;

async function attachLeaders(squads: { leaderId: string }[]) {
  const ids = [...new Set(squads.map((s) => s.leaderId))];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: USER_SUMMARY,
  });
  return new Map(users.map((u) => [u.id, u]));
}

/**
 * GET /api/squads/nearby
 * Public squads within a radius, nearest first.
 */
router.get('/nearby', identify, async (req: AuthRequest, res: Response) => {
  try {
    const coords = parseCoords(req.query);
    // Default widened from 10km: a campus network spans a city, and a 10km
    // circle around a hostel excludes the airport run people most want.
    const radiusKm = Math.min(Number(req.query.radiusKm) || 25, 50);
    const limit = Math.min(Number(req.query.limit) || 20, 60);

    const box = coords ? boundingBox(coords.lat, coords.lng, radiusKm) : null;

    /**
     * Squads the caller is already part of, so discovery can exclude them.
     *
     * "Squads near you" is a list of things to *join*. Showing your own squad
     * back to you is noise at best, and at worst reads as a duplicate of the
     * one already pinned at the top of the page. Your squads live under
     * /squads/mine.
     */
    const own = await prisma.squadMember.findMany({
      where: {
        userId: req.user!.userId,
        status: { in: [...ACTIVE_MEMBER_STATUSES, 'pending'] },
      },
      select: { squadId: true },
    });
    const ownIds = own.map((membership) => membership.squadId);

    /**
     * Optional destination filter — "who else is going where I am going".
     *
     * Without this, picking a destination changed the heading and nothing else:
     * the list underneath still showed every squad near the user regardless of
     * where it was heading, so a search for Velachery answered with squads
     * going to the airport.
     */
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    const hasDestination = Number.isFinite(destLat) && Number.isFinite(destLng);
    const destRadiusKm = Math.min(Number(req.query.destRadiusKm) || 5, 25);

    const candidates = await prisma.squad.findMany({
      where: {
        ...OPEN_SQUAD_WHERE,
        // Excludes squads you lead as well — the leader is always a member.
        ...(ownIds.length ? { id: { notIn: ownIds } } : {}),
        ...(req.query.college ? { college: String(req.query.college) } : {}),
        ...(req.query.type ? { type: String(req.query.type) } : {}),
        ...(box
          ? {
              lat: { gte: box.minLat, lte: box.maxLat },
              lng: { gte: box.minLng, lte: box.maxLng },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      /**
       * Over-fetch: the destination and capacity filters below run after the
       * database has applied `take`, so asking for exactly `limit` would return
       * short pages whenever nearby squads happen to be full or heading
       * elsewhere.
       */
      take: hasDestination ? Math.min(limit * 6, 300) : Math.min(limit * 3, 180),
    });

    const open = withFreeSlots(candidates);
    const matching = hasDestination
      ? nearDestination(open, { lat: destLat, lng: destLng }, destRadiusKm)
      : open;
    const squads = matching.slice(0, limit);

    const leaders = await attachLeaders(squads);

    /**
     * Ranked, not merely sorted by distance from the searcher.
     *
     * Distance alone put a squad forming next door above one going the same
     * way at the same time, because it only ever measured one of the six
     * things that make a squad worth joining. Scoring happens in
     * services/squadRanking.ts so the number on the card and the order of the
     * cards come from the same arithmetic.
     *
     * Falls back to distance when there is nothing to rank against — with no
     * destination and no time, "nearest" is genuinely the best answer available.
     */
    const departAtParam = req.query.departAt ? new Date(String(req.query.departAt)) : null;
    const rankInput = coords
      ? {
          origin: { lat: coords.lat, lng: coords.lng },
          destination: hasDestination ? { lat: destLat, lng: destLng } : null,
          departAt: departAtParam && !Number.isNaN(departAtParam.getTime()) ? departAtParam : null,
          purpose: req.query.type ? String(req.query.type) : null,
        }
      : null;

    const items = squads
      .map((squad) => {
        const ranked = rankInput ? rankSquad(squad, rankInput) : null;
        return {
          ...squad,
          leader: leaders.get(squad.leaderId) ?? null,
          /** 0-100, comparable only within this response. */
          matchScore: ranked?.score ?? null,
          /** Short, user-facing, and only for factors actually measured. */
          matchReasons: ranked?.reasons ?? [],
          _distance:
            coords && squad.lat !== null && squad.lng !== null
              ? calculateDistance(coords.lat, coords.lng, squad.lat, squad.lng)
              : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) =>
        a.matchScore !== null && b.matchScore !== null
          ? b.matchScore - a.matchScore
          : a._distance - b._distance,
      )
      .map(({ _distance, ...squad }) => squad);

    return ok(res, { items, nextCursor: null });
  } catch (error) {
    console.error('[squads/nearby]', error);
    return fail(res, 500, 'Failed to load squads');
  }
});

/**
 * GET /api/squads/availability — how many joinable squads exist, per purpose.
 *
 * This is what the Exam / College / Office / Travel / Event rows show before a
 * destination is chosen. They previously counted a capped page of *nearby*
 * squads on the client, which is why every row read 0: the page was already
 * filtered and the count was really a page size.
 *
 * Two questions, one endpoint, distinguished by whether a destination is given:
 *   - no destination → "how many squads are forming for this purpose near me",
 *     the overall picture someone opening the app wants;
 *   - destination → "how many are heading where I am heading", which is what
 *     the row counts must mean once a search has been run, or the numbers
 *     contradict the list below them.
 */
router.get('/availability', identify, async (req: AuthRequest, res: Response) => {
  try {
    const coords = parseCoords(req.query);
    const radiusKm = Math.min(Number(req.query.radiusKm) || 25, 50);
    const box = coords ? boundingBox(coords.lat, coords.lng, radiusKm) : null;

    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    const hasDestination = Number.isFinite(destLat) && Number.isFinite(destLng);
    const destRadiusKm = Math.min(Number(req.query.destRadiusKm) || 5, 25);

    // Same exclusion as /nearby: your own squads are not things to join, and
    // counting them would make a row read 1 with an empty list under it.
    const own = await prisma.squadMember.findMany({
      where: {
        userId: req.user!.userId,
        status: { in: [...ACTIVE_MEMBER_STATUSES, 'pending'] },
      },
      select: { squadId: true },
    });
    const ownIds = own.map((membership) => membership.squadId);

    const candidates = await prisma.squad.findMany({
      where: {
        ...OPEN_SQUAD_WHERE,
        ...(ownIds.length ? { id: { notIn: ownIds } } : {}),
        ...(box
          ? {
              lat: { gte: box.minLat, lte: box.maxLat },
              lng: { gte: box.minLng, lte: box.maxLng },
            }
          : {}),
      },
      // No `take`: this is a count, and a cap is what made the old number wrong.
      select: {
        id: true,
        type: true,
        memberCount: true,
        memberLimit: true,
        destination: true,
      },
    });

    const open = withFreeSlots(candidates);
    const matching = hasDestination
      ? nearDestination(open, { lat: destLat, lng: destLng }, destRadiusKm)
      : open;

    const counts: Record<string, number> = {};
    for (const squad of matching) {
      counts[squad.type] = (counts[squad.type] ?? 0) + 1;
    }

    return ok(res, {
      counts,
      total: matching.length,
      /** Tells the client whether these mean "going there" or just "near you". */
      directional: hasDestination,
    });
  } catch (error) {
    console.error('[squads/availability]', error);
    return fail(res, 500, 'Failed to count squads');
  }
});

/** GET /api/squads/mine — squads the caller is an active member of. */
router.get('/mine', identify, async (req: AuthRequest, res: Response) => {
  try {
    /**
     * Every active status, not the literal 'active'. A leader who starts
     * walking flips to `travelling` and used to vanish from their own squad
     * list — which also made the "one squad at a time" guard fail open, since
     * the client could no longer see the squad it was meant to block on.
     */
    /**
     * `pending` is included, and leaving it out was a dead end for the user.
     *
     * Discovery excludes any squad you are already attached to — and it counts
     * `pending` as attached, deliberately, so a squad you have asked to join
     * stops being offered to you again. But this list only counted *active*
     * memberships. Between the two, asking to join made the squad vanish
     * completely: gone from "Squads near you" because you had asked, and absent
     * from "your squads" because nobody had said yes yet.
     *
     * The result was a request that could not be seen, chased or withdrawn, and
     * a squad that looked like it had been deleted. The two queries have to
     * agree on what "attached" means, and the honest answer is that a pending
     * request is a thing you are waiting on, so it belongs on your own list —
     * marked as pending, which `viewerStatus` below now carries.
     */
    const memberships = await prisma.squadMember.findMany({
      where: {
        userId: req.user!.userId,
        status: { in: [...ACTIVE_MEMBER_STATUSES, 'pending'] },
      },
      select: { squadId: true, role: true, status: true },
    });

    const squads = await prisma.squad.findMany({
      // Finished and cancelled squads are history, not "your squads". One that
      // has merely started is very much still yours.
      where: {
        id: { in: memberships.map((m) => m.squadId) },
        status: { in: [...LIVE_SQUAD_STATUSES] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const leaders = await attachLeaders(squads);
    const roleBySquad = new Map(memberships.map((m) => [m.squadId, m.role]));
    const statusBySquad = new Map(memberships.map((m) => [m.squadId, m.status]));

    return ok(
      res,
      squads.map((squad) => ({
        ...squad,
        leader: leaders.get(squad.leaderId) ?? null,
        viewerRole: roleBySquad.get(squad.id) ?? null,
        // So the client can show a requested squad as awaiting approval rather
        // than as one you are already in — the two are not the same thing, and
        // showing them identically would be its own kind of lie.
        viewerStatus: statusBySquad.get(squad.id) ?? null,
      })),
    );
  } catch (error) {
    console.error('[squads/mine]', error);
    return fail(res, 500, 'Failed to load your squads');
  }
});

/** GET /api/squads/:id — private squads are members-only. */
router.get('/:id', identify, async (req: AuthRequest, res: Response) => {
  try {
    const stored = await prisma.squad.findUnique({ where: { id: req.params.id } });
    if (!stored) return fail(res, 404, 'Squad not found');

    /**
     * The lifecycle is evaluated here, on the read, rather than by a scheduled
     * job — see services/squadLifecycle.ts for why a timer is unsound on Cloud
     * Run. This is the read that matters most: opening a squad is how anyone
     * finds out it has started or finished.
     */
    const squad = await syncSquadLifecycle(stored);

    const membership = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: squad.id, userId: req.user!.userId } },
    });

    // Authorisation is enforced here, not by hiding UI.
    if (squad.visibility === 'private' && !membership) {
      return fail(res, 403, 'This squad is invite only');
    }

    const members = await prisma.squadMember.findMany({
      where: { squadId: squad.id, status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      orderBy: { joinedAt: 'asc' },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: USER_SUMMARY,
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const viewer = await membershipOf(squad.id, req.user!.userId);

    return ok(res, {
      ...squad,
      // The join code is a credential. Returning it on a public squad page
      // would make it worthless, so only members ever see it.
      joinCode: viewer ? squad.joinCode : null,
      leader: byId.get(squad.leaderId) ?? null,
      viewerRole: viewer?.role ?? null,
      /**
       * Raw membership status, which `viewerRole` cannot express: a pending
       * request resolves to no role at all, so without this the client cannot
       * tell "never asked" from "waiting on the leader" and would offer the
       * join button to someone already in the queue.
       */
      viewerStatus: membership?.status ?? null,
      /// Sent so the client renders the same permission model the server
      /// enforces, rather than re-deriving it and drifting.
      can: viewer?.can ?? null,
      members: members
        .filter((m) => byId.has(m.userId))
        .map((m) => ({ ...m, user: byId.get(m.userId)! })),
    });
  } catch (error) {
    console.error('[squads/:id]', error);
    return fail(res, 500, 'Failed to load squad');
  }
});

/**
 * PATCH /api/squads/:id/status — end a squad.
 *
 * Leader-only, and the only way out of the one-squad-at-a-time rule: without
 * it a leader is committed forever and can neither start another nor join one.
 *
 * Terminal on purpose. Reopening a cancelled squad would resurrect a group
 * whose members have already been told it is over and have gone elsewhere;
 * starting a fresh one is both clearer and cheap.
 */
/**
 * PATCH /api/squads/:id/visibility — publish a squad, or hide it again.
 *
 * Visibility was decided once at creation and then frozen, which made an
 * invite-only squad a one-way door: it is excluded from /nearby by design, so
 * nobody can find it, and the leader had no way to change that without
 * cancelling and starting over. Two accounts testing the app hit exactly this
 * — one created an invite-only squad and the other could not see it, which
 * looks identical to discovery being broken.
 *
 * Leader-only, and deliberately not part of a general "update squad" route:
 * this flips who can see the squad, which is worth its own authorisation check
 * rather than riding along in a patch of arbitrary fields.
 */
router.patch('/:id/visibility', identify, async (req: AuthRequest, res: Response) => {
  try {
    const next = String(req.body?.visibility ?? '');
    if (!['public', 'invite'].includes(next)) {
      return fail(res, 400, 'Visibility must be public or invite');
    }

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { id: true, leaderId: true, visibility: true, status: true },
    });
    if (!squad) return fail(res, 404, 'Squad not found');

    const viewer = await membershipOf(squad.id, req.user!.userId);
    if (!viewer?.can.destroy) {
      return fail(res, 403, 'Only the leader can change who can find this squad', 'forbidden');
    }

    // A finished squad must not be republishable into discovery.
    if (squad.status !== 'active') {
      return fail(res, 409, 'This squad is no longer active', 'not-active');
    }

    if (squad.visibility === next) {
      // Idempotent: a double-tap is not an error.
      return ok(res, { id: squad.id, visibility: squad.visibility });
    }

    const updated = await prisma.squad.update({
      where: { id: squad.id },
      data: { visibility: next },
      select: { id: true, visibility: true },
    });

    // Publishing a squad adds it to everyone's nearby list, and hiding removes
    // it. Same broadcast as ending one, for the same reason — the audience is
    // people who are not in the squad.
    getIO()?.emit('squad:status', { squadId: squad.id, status: squad.status });

    return ok(res, updated);
  } catch (error) {
    console.error('[squads/visibility]', error);
    return fail(res, 500, 'Failed to update visibility');
  }
});

router.patch('/:id/status', identify, async (req: AuthRequest, res: Response) => {
  try {
    const next = String(req.body?.status ?? '');
    if (!['completed', 'cancelled'].includes(next)) {
      return fail(res, 400, 'Status must be completed or cancelled');
    }

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, leaderId: true, status: true },
    });
    if (!squad) return fail(res, 404, 'Squad not found');

    // Authorisation, not presentation — the button is also hidden, but that is
    // not what stops anyone.
    const viewer = await membershipOf(squad.id, req.user!.userId);
    if (!viewer?.can.destroy) {
      return fail(res, 403, 'Only the leader can end this squad', 'forbidden');
    }

    if (!isLiveStatus(squad.status)) {
      // Idempotent: a double-tap should not read as an error. Ending a squad
      // that has already started is not a double-tap, though — the leader must
      // be able to call it off after the meeting time as well as before.
      return ok(res, { id: squad.id, status: squad.status });
    }

    const updated = await prisma.squad.update({
      where: { id: squad.id },
      // endedAt anchors both chat retention windows — the lock and the erase.
      // Set here as well as in syncSquadLifecycle so a squad ended by hand and
      // one that expired on its own leave the same state behind, which is the
      // same rule releaseSquad already follows.
      data: { status: next, isActive: false, endedAt: new Date() },
    });

    /**
     * Members are released, not deleted. Their rows become `left`, which frees
     * them under the one-squad rule and clears the last position we held —
     * a squad that is over must not keep broadcasting where anyone was.
     */
    const members = await prisma.squadMember.findMany({
      where: { squadId: squad.id, status: { in: [...ACTIVE_MEMBER_STATUSES, 'pending'] } },
      select: { userId: true },
    });

    await prisma.squadMember.updateMany({
      where: { squadId: squad.id },
      data: { status: 'left', lat: null, lng: null, locationAt: null },
    });

    await Promise.all(
      members
        .filter((member) => member.userId !== req.user!.userId)
        .map((member) =>
          notify({
            userId: member.userId,
            type: 'squad.joined',
            title:
              next === 'cancelled'
                ? `${squad.name} was cancelled`
                : `${squad.name} has finished`,
            body:
              next === 'cancelled'
                ? 'The leader called it off. You can join another squad now.'
                : 'Thanks for travelling together.',
            href: '/squads',
            data: { squadId: squad.id },
          }),
        ),
    );

    getIO()?.to(`squad:${squad.id}`).emit('squad:members-changed', { squadId: squad.id });

    /**
     * Broadcast, not scoped to `squad:${id}`.
     *
     * The people who need to hear that a squad ended are the ones *browsing*
     * for a squad to join — and they are, by definition, not members, so they
     * are not in that room. A room-scoped emit reaches exactly the users who
     * already know. The server excludes cancelled squads from every discovery
     * query, so this only decides *when* everyone else finds out; without it
     * a cancelled squad sat in other people's lists until their cache expired.
     *
     * Safe to send to everyone: the payload is a squad id and a status, and
     * squad ids are already public in discovery. Volume is a non-issue — this
     * fires when a leader ends a squad, not on activity.
     */
    getIO()?.emit('squad:status', { squadId: squad.id, status: updated.status });

    return ok(res, { id: updated.id, status: updated.status });
  } catch (error) {
    console.error('[squads/:id/status]', error);
    return fail(res, 500, 'Failed to update the squad');
  }
});

/** POST /api/squads — creator becomes the leader. */
router.post('/', identify, requireVerifiedInstitute, async (req: AuthRequest, res: Response) => {
  try {
    /**
     * Validated rather than coerced.
     *
     * This block previously read the body by hand — String(), Number(), a
     * length check on the name and nothing else. A 5MB description or a
     * latitude of 900 was accepted and stored; every downstream reader then had
     * to cope. The schema states the contract once, at the boundary.
     */
    const body = parseBody(createSquadSchema, req.body, res);
    if (!body) return;

    const {
      name,
      description,
      meetingAt,
      type,
      visibility: chosenVisibility,
      memberLimit,
    } = body;

    /**
     * The squad's college is the creator's, read from their own row — never
     * whatever the client sent.
     *
     * It used to be `college: college || null` straight off the request body,
     * which was wrong twice over.
     *
     * The visible half: `college` scopes discovery, and the web form fills it
     * from the creator's profile while the *name* is free text. So a squad
     * called "Chennai Institute of Technology College Squad" was filed under
     * IIT Madras, because that is where its creator studies. It then surfaced
     * to the wrong students and stayed invisible to the ones it was named for.
     *
     * The half that matters more: the field was trusted from the client at all.
     * Anyone posting directly to this endpoint could file a squad under any
     * institute they liked and appear in that college's feed — a soft trust
     * boundary that `requireVerifiedInstitute` exists to defend, undone by
     * taking the answer from the caller.
     *
     * Reading it here makes the tag mean "created by a member of this college",
     * which is the only claim the server can actually stand behind.
     */
    const creator = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { college: true },
    });
    const college = creator?.college?.trim() || null;

    const resolvedDestination = body.destination ?? null;
    const meetingPoint = body.meetingPoint ?? null;

    /**
     * A squad exists so that people meet, so it must never be stored without a
     * meeting point — "somewhere at the destination" is not a place anyone can
     * walk to. When the leader skips the picker we fall back to the destination
     * itself, which is always somewhere real, rather than leaving null.
     *
     * Only defaulted when a destination exists: clients that predate the
     * destination-first flow still post neither, and rejecting them would break
     * squad creation for anything not on this web build.
     */
    /**
     * Normalised to the shape Prisma's embedded GeoPoint expects: it takes
     * `string | null`, while the schema leaves optional fields `undefined`.
     *
     * Shared with the meeting-point update so both write paths agree on what a
     * stored point is — see `services/geoPoint`.
     */
    /**
     * `Number(...)` on the coordinates because this backend runs with
     * `strict: false`, so zod infers every validated field as optional however
     * required the schema makes it. The values are guaranteed present by the
     * time this runs; the cast is for the compiler, not for safety.
     */
    const toStored = (point: z.infer<typeof geoPoint>) =>
      toStoredGeoPoint({ ...point, lat: Number(point.lat), lng: Number(point.lng) });

    const storedDestination = resolvedDestination ? toStored(resolvedDestination) : null;

    const resolvedMeetingPoint = meetingPoint
      ? toStored(meetingPoint)
      : storedDestination
        ? {
            ...storedDestination,
            label: storedDestination.label ? `At ${storedDestination.label}` : null,
          }
        : null;

    /**
     * One live squad per leader.
     *
     * This replaces a "five per hour" counter, which allowed exactly the mess
     * it was meant to stop: five near-identical squads to the same place, each
     * splitting the people who might otherwise have travelled together. A
     * network like this fails by fragmenting, not by volume.
     *
     * Scoped to squads still running. Completing or cancelling frees the slot
     * immediately, so this is a concurrency limit rather than a quota.
     */
    const live = await prisma.squad.findFirst({
      where: {
        leaderId: req.user!.userId,
        status: { in: [...LIVE_SQUAD_STATUSES] },
        isActive: true,
      },
      select: { id: true, name: true, destination: true },
    });

    if (live) {
      return fail(
        res,
        409,
        `You already lead "${live.name}". Finish or cancel it before starting another.`,
        'squad-already-active',
      );
    }

    const squad = await prisma.squad.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        leaderId: req.user!.userId,
        type,
        visibility: chosenVisibility,
        // Every squad gets a code, including public ones — it is the fastest
        // way to pull somebody in who is standing next to you.
        joinCode: await allocateJoinCode(),
        status: 'active',
        memberLimit: memberLimit ?? null,
        themeColor: body.themeColor ?? null,
        // Derived above from the creator's row, not from the request body.
        college,
        memberCount: 1,
        ...(storedDestination ? { destination: storedDestination } : {}),
        ...(resolvedMeetingPoint ? { meetingPoint: resolvedMeetingPoint } : {}),
        /**
         * Map position for clustering and /nearby is *always* the meeting
         * point. People travel to where the squad gathers, not to the middle of
         * the destination — a marker on Phoenix Mall when everyone is meeting at
         * Gate 2 sends them to the wrong place.
         */
        ...(resolvedMeetingPoint
          ? { lat: resolvedMeetingPoint.lat, lng: resolvedMeetingPoint.lng }
          : {}),
        ...(meetingAt ? { meetingAt: new Date(meetingAt) } : {}),
      },
    });

    await prisma.squadMember.create({
      data: { squadId: squad.id, userId: req.user!.userId, role: 'leader', status: 'active' },
    });

    /**
     * Not awaited, and that is the rule this module already follows elsewhere:
     * the squad is created and the response is owed now. A slow or broken mail
     * provider must not hold the request open or turn a successful creation
     * into a 500. `emailTripCreated` swallows its own errors; the `catch` is
     * belt and braces against an unhandled rejection taking the process down.
     */
    void emailTripCreated({
      userId: req.user!.userId,
      kind: 'squad',
      id: squad.id,
      title: squad.name,
      joinCode: squad.joinCode,
      whenAt: squad.meetingAt,
    }).catch(() => undefined);

    return ok(res, squad, 201);
  } catch (error) {
    console.error('[squads POST]', error);
    return fail(res, 500, 'Failed to create squad');
  }
});

/** POST /api/squads/:id/join */
router.post('/:id/join', identify, requireVerifiedInstitute, async (req: AuthRequest, res: Response) => {
  try {
    const squad = await prisma.squad.findUnique({ where: { id: req.params.id } });
    if (!squad) return fail(res, 404, 'Squad not found');
    if (squad.visibility === 'private') {
      return fail(res, 403, 'This squad is invite only');
    }

    /**
     * Running late is fine; turning up after it ended is not.
     *
     * `in_progress` still accepts joins — that is the whole point of it being a
     * distinct state rather than an ending. A completed or cancelled squad does
     * not, and until now nothing said so: a request could be queued against a
     * squad that was already over, and it would sit in the leader's list for a
     * squad they had finished with.
     */
    if (!acceptsJoins(squad.status)) {
      return fail(res, 409, 'This squad has already ended', 'squad-ended');
    }

    /**
     * One squad at a time. Checked before anything is written so a second
     * pending request cannot be queued behind the first.
     */
    const commitment = await currentCommitment(req.user!.userId);
    if (commitment && commitment.squad.id !== squad.id) {
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

    const existing = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: squad.id, userId: req.user!.userId } },
    });

    if (existing?.status === 'active') {
      return ok(res, { ...squad, viewerRole: existing.role, viewerStatus: 'active' });
    }

    // Idempotent: tapping Join twice must not queue two requests or renotify.
    if (existing?.status === 'pending') {
      return ok(res, { ...squad, viewerRole: null, viewerStatus: 'pending' });
    }

    /**
     * Capacity is checked here *and* again at approval. Here so nobody queues
     * behind a squad that is already full; again at approval because the squad
     * can fill while a request sits waiting.
     */
    if (squad.memberLimit !== null && squad.memberCount >= squad.memberLimit) {
      return fail(res, 409, 'This squad is full', 'squad-full');
    }

    /**
     * Joining is a *request*, not an admission — the leader decides. The
     * pending row is what /requests lists and what the approve handler flips to
     * active; memberCount is deliberately not incremented until then, so a
     * queue of hopefuls cannot make a squad look full.
     */
    if (existing) {
      await prisma.squadMember.update({
        where: { id: existing.id },
        data: { status: 'pending', role: 'member' },
      });
    } else {
      await prisma.squadMember.create({
        data: { squadId: squad.id, userId: req.user!.userId, status: 'pending' },
      });
    }

    const joiner = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    await notify({
      userId: squad.leaderId,
      type: 'squad.join_requested',
      title: `${joiner?.name ?? 'Someone'} wants to join ${squad.name}`,
      body: 'Review the request to let them in.',
      href: `/squads/${squad.id}`,
      data: { squadId: squad.id },
    });

    /**
     * Email as well, for a leader who is not in the app.
     *
     * Not awaited into the response path's success: the request has already
     * been recorded and the in-app notification already sent, so a mail
     * failure must not turn a successful join request into an error. The
     * module swallows its own errors; this `void` is the second guard.
     */
    void (async () => {
      /**
       * Minting is inside the same best-effort block as the send. A token is
       * only useful if the email carrying it goes out, and neither is allowed
       * to fail the join request that has already been recorded.
       */
      let token: string | undefined;
      try {
        const pending = await prisma.squadMember.findFirst({
          where: { squadId: squad.id, userId: req.user!.userId, status: 'pending' },
          select: { id: true },
        });
        if (pending) {
          token = await createJoinRequestToken({
            squadId: squad.id,
            memberId: pending.id,
            leaderId: squad.leaderId,
          });
        }
      } catch (error) {
        // The email still sends, pointing at the squad page instead.
        console.error('[squads/join] could not mint a decision token', error);
      }

      await emailJoinRequested({
        leaderId: squad.leaderId,
        squadId: squad.id,
        squadName: squad.name,
        requesterName: joiner?.name ?? 'Someone',
        token,
      });
    })();

    // Someone asking to join is the squad being used, and keeps it alive.
    await markSquadActivity(squad.id);

    getIO()?.to(`squad:${squad.id}`).emit('squad:members-changed', { squadId: squad.id });

    return ok(res, { ...squad, viewerRole: null, viewerStatus: 'pending' });
  } catch (error) {
    console.error('[squads/join]', error);
    return fail(res, 500, 'Failed to join squad');
  }
});

/** POST /api/squads/:id/leave */
/**
 * POST /api/squads/:id/withdraw — take back a join request.
 *
 * Separate from `leave`, because they are different acts. Leaving is exiting a
 * squad you are in; withdrawing is retracting a request nobody has answered
 * yet. `leave` refuses a pending member outright — it requires an active
 * status — so before this existed a request could be made and then never
 * unmade: you waited, or you did not, and either way the row stayed.
 *
 * Only a `pending` row may be withdrawn. Once the leader has admitted you, the
 * way out is `leave`, which is the one that adjusts the member count and hands
 * on leadership if it has to. Withdrawing touches none of that, because a
 * pending request was never counted in the first place.
 */
router.post('/:id/withdraw', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: req.params.id, userId: req.user!.userId } },
    });

    if (!membership) return fail(res, 404, 'You have no request on this squad');

    if (membership.status !== 'pending') {
      /**
       * Deliberately specific. "You are already in this squad, use Leave" is
       * actionable; a bare 404 would read as the request having vanished,
       * which is the confusion this endpoint exists to end.
       */
      return fail(
        res,
        409,
        ACTIVE_MEMBER_STATUSES.includes(membership.status as 'active')
          ? 'Your request was already accepted. Leave the squad instead.'
          : 'That request is no longer pending.',
        'not-pending',
      );
    }

    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { name: true, leaderId: true },
    });

    // Deleted, not marked 'left'. A withdrawn request should leave nothing
    // behind — the same person may well ask again, and a stale row would make
    // the second request look like a duplicate. `left` is for people who were
    // actually in the squad and whose history is worth keeping.
    // The emailed link points at this request; withdrawing it must not leave a
    // live link to a decision that no longer exists.
    await revokeTokensForRequest(membership.id);
    await prisma.squadMember.delete({ where: { id: membership.id } });

    const withdrawer = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });

    /**
     * The leader is told, because they may have been looking at the request
     * and deciding. Nobody else is: a request that was never accepted was
     * never visible to the rest of the squad, so announcing its withdrawal
     * would be telling people about something they never knew existed.
     */
    if (squad?.leaderId && squad.leaderId !== req.user!.userId) {
      await notify({
        userId: squad.leaderId,
        type: 'squad.join_requested',
        title: 'Join request withdrawn',
        body: `${withdrawer?.name ?? 'Someone'} withdrew their request to join ${squad.name}.`,
        data: { squadId: req.params.id },
        href: `/squads/${req.params.id}`,
      });
    }

    // Refreshes the leader's pending list if they have the squad open.
    getIO()?.to(`squad:${req.params.id}`).emit('squad:members-changed', {
      squadId: req.params.id,
    });

    return res.status(204).end();
  } catch (error) {
    console.error('[squads/withdraw]', error);
    return fail(res, 500, 'Failed to withdraw the request');
  }
});

router.post('/:id/leave', identify, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: req.params.id, userId: req.user!.userId } },
    });
    if (!membership || !ACTIVE_MEMBER_STATUSES.includes(membership.status as 'active')) {
      return fail(res, 404, 'You are not in this squad');
    }

    await prisma.squadMember.update({
      where: { id: membership.id },
      // Position goes with them. Someone who has left the squad must not leave
      // their last known location inside it.
      data: { status: 'left', lat: null, lng: null, locationAt: null },
    });
    await prisma.squad.update({
      where: { id: req.params.id },
      data: { memberCount: { decrement: 1 } },
    });

    // A squad whose leaderId points at someone who walked away has nobody who
    // can move the meeting point or admit anyone, which is a dead squad.
    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      select: { leaderId: true },
    });
    if (squad?.leaderId === req.user!.userId) {
      await transferLeadership(req.params.id, req.user!.userId);
    }

    getIO()?.to(`squad:${req.params.id}`).emit('squad:members-changed', {
      squadId: req.params.id,
    });

    return res.status(204).end();
  } catch (error) {
    console.error('[squads/leave]', error);
    return fail(res, 500, 'Failed to leave squad');
  }
});

/**
 * PATCH /api/squads/:id/meeting-point — LEADER ONLY.
 * This is the authorisation boundary the spec calls out explicitly: the client
 * also hides the control, but this check is what actually enforces it.
 */
router.patch('/:id/meeting-point', identify, async (req: AuthRequest, res: Response) => {
  try {
    const squad = await prisma.squad.findUnique({ where: { id: req.params.id } });
    if (!squad) return fail(res, 404, 'Squad not found');
    if (squad.leaderId !== req.user!.userId) {
      return fail(res, 403, 'Only the squad leader can move the meeting point');
    }

    /**
     * Validated with the same `geoPoint` schema the create route uses, rather
     * than read field by field off `req.body`.
     *
     * The hand-rolled version took `lat`, `lng` and `label` and assigned the
     * result straight to the composite — which, on MongoDB, *replaces* it. So
     * every move of a meeting point silently erased the address that had been
     * resolved for it, and would have erased the four new fields too. Validating
     * the whole point means the whole point can be written.
     */
    const body = parseBody(meetingPointSchema, req.body, res);
    if (!body) return;

    const { meetingAt, ...incoming } = body;
    const stored = mergeMeetingPoint(squad.meetingPoint, {
      ...incoming,
      lat: Number(incoming.lat),
      lng: Number(incoming.lng),
    });
    const { lat, lng } = stored;

    const updated = await prisma.squad.update({
      where: { id: squad.id },
      data: {
        meetingPoint: stored,
        lat,
        lng,
        ...(meetingAt ? { meetingAt: new Date(meetingAt) } : {}),
      },
    });

    // Push to everyone with the squad open so their map updates without a poll.
    getIO()?.to(`squad:${squad.id}`).emit('squad:meeting-point', {
      squadId: squad.id,
      lat,
      lng,
      label: stored.label,
    });

    const members = await prisma.squadMember.findMany({
      where: { squadId: squad.id, status: 'active' },
      select: { userId: true },
    });

    await Promise.all(
      members
        .filter((m) => m.userId !== req.user!.userId)
        .map((m) =>
          notify({
            userId: m.userId,
            type: 'squad.meeting_point_updated',
            title: `${squad.name}: new meeting point`,
            body: req.body.label ?? 'The leader moved the meeting point.',
            href: `/squads/${squad.id}`,
            data: { squadId: squad.id },
          }),
        ),
    );

    return ok(res, updated);
  } catch (error) {
    console.error('[squads/meeting-point]', error);
    return fail(res, 500, 'Failed to update meeting point');
  }
});

export default router;

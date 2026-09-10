import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { requireVerifiedInstitute as requireInstituteMw } from '../middleware/institute.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail, boundingBox, parseCoords } from '../utils/respond.js';
import { calculateDistance, calculateDistanceMetres } from '../utils/helpers.js';
import { notify } from '../services/notifications.js';
import { getIO, getLivePosition } from '../services/live.js';
import { getRoute } from '../services/directions.js';
import {
  DEFAULT_CORRIDOR,
  fitToCorridor,
  scoreFit,
  type LatLng,
} from '../services/corridor.js';
import {
  DEPARTED_GRACE_MINUTES,
  hasSeatFree,
  joinableRideWhere,
  seatsRemaining,
  withFreeSeats,
} from '../services/rideVisibility.js';
import { instituteDomainList } from '../data/institutes.js';

const router = Router();

const USER_SUMMARY = {
  id: true,
  name: true,
  username: true,
  profilePhoto: true,
  college: true,
  rating: true,
} as const;

/**
 * The ride state machine. The client never writes `status` directly — it POSTs
 * an intent to /transition and the server decides whether the move is legal.
 *
 *   requested → accepted → arriving → in_progress → completed
 *             ↘──────────┴──────────┘
 *                    cancelled
 */
const TRANSITIONS: Record<string, string[]> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['arriving', 'cancelled'],
  arriving: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

/** Legacy rows use pending/matched; normalise before checking the machine. */
function normaliseStatus(status: string): string {
  if (status === 'pending') return 'requested';
  if (status === 'matched') return 'accepted';
  return status;
}

/** Transitions only the host may perform. */
const HOST_ONLY = new Set(['accepted', 'arriving', 'in_progress', 'completed']);

/**
 * Rides are the one surface where strangers get into a vehicle together, so
 * they require a verified institute email. Browsing stays open; creating and
 * joining do not.
 *
 * Returns null when allowed, or a failure reason.
 */
async function requireVerifiedInstitute(
  userId: string,
): Promise<{ status: number; message: string; code: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { instituteVerified: true, instituteId: true, college: true },
  });

  if (!user) return { status: 404, message: 'Profile not found', code: 'no-profile' };
  if (user.instituteVerified) return null;

  if (!user.instituteId) {
    return {
      status: 403,
      message: 'Choose your institute and verify your campus email to use rides.',
      code: 'institute-required',
    };
  }

  // Every accepted address, not just the canonical one — see instituteDomainList.
  const domains = instituteDomainList(user.instituteId);
  return {
    status: 403,
    message: domains
      ? `Verify your ${domains} email to create or join rides.`
      : `${user.college} has no verifiable email domain yet, so rides are unavailable.`,
    code: 'institute-unverified',
  };
}

async function hydrate(rideIds: string[]) {
  const [hosts, matches] = await Promise.all([
    prisma.ride.findMany({
      where: { id: { in: rideIds } },
      select: { id: true, userId: true },
    }),
    prisma.match.findMany({
      where: { rideId: { in: rideIds }, status: { in: ['pending', 'accepted'] } },
      select: { rideId: true, user2Id: true, status: true },
    }),
  ]);

  const userIds = [
    ...new Set([...hosts.map((h) => h.userId), ...matches.map((m) => m.user2Id)]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: USER_SUMMARY,
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const passengersByRide = new Map<string, typeof users>();
  for (const match of matches) {
    if (match.status !== 'accepted') continue;
    const user = byId.get(match.user2Id);
    if (!user) continue;
    const list = passengersByRide.get(match.rideId) ?? [];
    list.push(user);
    passengersByRide.set(match.rideId, list);
  }

  return { byId, passengersByRide };
}

function shape(
  ride: Awaited<ReturnType<typeof prisma.ride.findFirst>>,
  byId: Map<string, unknown>,
  passengersByRide: Map<string, unknown[]>,
) {
  if (!ride) return null;
  const passengers = passengersByRide.get(ride.id) ?? [];
  return {
    ...ride,
    status: normaliseStatus(ride.status),
    host: byId.get(ride.userId) ?? null,
    passengers,
    seatsTaken: passengers.length,
  };
}

/**
 * POST /api/rides — create a ride.
 *
 * Defined here rather than in the legacy router so it sits behind the
 * institute gate. This router is mounted first, so it wins the route.
 */
router.post('/', identify, async (req: AuthRequest, res: Response) => {
  try {
    const blocked = await requireVerifiedInstitute(req.user!.userId);
    if (blocked) return fail(res, blocked.status, blocked.message, blocked.code);

    const {
      origin,
      originLat,
      originLng,
      destination,
      destLat,
      destLng,
      departureTime,
      vehicleType,
      seats,
      fare,
      genderPref,
      stops,
    } = req.body;

    if (typeof origin !== 'string' || !origin.trim()) {
      return fail(res, 400, 'A pickup location is required');
    }
    if (typeof destination !== 'string' || !destination.trim()) {
      return fail(res, 400, 'A destination is required');
    }
    /**
     * Both ends are required, and the pickup is the one that used to be
     * optional.
     *
     * A ride with no origin coordinates is accepted, stored, and then invisible
     * for the rest of its life: /nearby filters on an originLat range, which a
     * null never satisfies, and the corridor filter drops null-origin rides
     * outright. Nothing ever un-hides it — unlike a stale departure time, which
     * only hides a ride once it is genuinely past. The host sees their ride on
     * their own screen and no one else ever does, which reads as the app being
     * broken rather than as a missing field.
     *
     * The destination has always been checked. The asymmetry was the bug: the
     * two are equally load-bearing for matching.
     */
    if (!Number.isFinite(Number(originLat)) || !Number.isFinite(Number(originLng))) {
      return fail(res, 400, 'Pick the pickup point from the suggestions', 'origin-not-resolved');
    }
    if (!Number.isFinite(Number(destLat)) || !Number.isFinite(Number(destLng))) {
      return fail(res, 400, 'Pick the destination from the suggestions', 'destination-not-resolved');
    }
    const departsAt = new Date(departureTime);
    if (Number.isNaN(departsAt.getTime())) {
      return fail(res, 400, 'A valid departure time is required');
    }

    // Rate limit: a burst of rides from one account is almost always abuse.
    const recent = await prisma.ride.count({
      where: {
        userId: req.user!.userId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recent >= 10) {
      return fail(res, 429, 'You have posted too many rides in the last hour');
    }

    const ride = await prisma.ride.create({
      data: {
        userId: req.user!.userId,
        origin: origin.trim(),
        // Unconditional: the guard above has already refused anything that
        // would have landed here as null.
        originLat: Number(originLat),
        originLng: Number(originLng),
        destination: destination.trim(),
        destLat: Number(destLat),
        destLng: Number(destLng),
        departureTime: departsAt,
        vehicleType: ['cab', 'bike', 'auto'].includes(vehicleType) ? vehicleType : 'cab',
        seats: Math.min(Math.max(Number(seats) || 1, 1), 8),
        fare: Number.isFinite(Number(fare)) ? Number(fare) : null,
        genderPref: ['male', 'female', 'any'].includes(genderPref) ? genderPref : 'any',
        status: 'requested',
        ...(Array.isArray(stops)
          ? {
              stops: stops
                .filter((s: unknown): s is { lat: number; lng: number; label?: string } =>
                  Boolean(s && Number.isFinite(Number((s as { lat: unknown }).lat))),
                )
                .map((s) => ({
                  lat: Number(s.lat),
                  lng: Number(s.lng),
                  label: s.label ?? null,
                })),
            }
          : {}),
      },
    });

    const { byId, passengersByRide } = await hydrate([ride.id]);
    return ok(res, shape(ride, byId, passengersByRide), 201);
  } catch (error) {
    console.error('[rides POST]', error);
    return fail(res, 500, 'Failed to create the ride');
  }
});

/**
 * GET /api/rides/nearby — replaces the legacy /search for the web client.
 *
 * Given a destination, only rides heading the same way — the same corridor test
 * /availability already applied to its counts.
 *
 * Without it this endpoint filtered on the ride's *origin* box alone, so it
 * answered "who is setting off near you" when the screen above it was asking
 * "who is going where you are going". In a city those are barely related
 * questions: a search from Agraharam St to Coir Lane returned a host driving
 * Velachery → Golden Fortune Cross Lane, which starts nearby and then leaves in
 * an entirely different direction. Every row was plausible and most were
 * useless, which is worse than an empty list — it costs the user a tap to find
 * out, every time.
 *
 * /availability already fixed exactly this for its counts, and its comment says
 * the count and the list must not disagree. They did: the count was
 * direction-aware and the list under it was not.
 *
 * The destination stays optional. Callers that want a plain proximity browse —
 * the home feed, the map — pass no destLat/destLng and are unaffected.
 */
router.get('/nearby', identify, async (req: AuthRequest, res: Response) => {
  try {
    const coords = parseCoords(req.query);
    const radiusKm = Math.min(Number(req.query.radiusKm) || 15, 60);
    const limit = Math.min(Number(req.query.limit) || 20, 60);
    const box = coords ? boundingBox(coords.lat, coords.lng, radiusKm) : null;

    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    // A corridor needs both ends. Without a pickup there is nothing to measure
    // the host's route against, so a lone destination cannot narrow anything.
    const dropoff: LatLng | null =
      coords && Number.isFinite(destLat) && Number.isFinite(destLng)
        ? { lat: destLat, lng: destLng }
        : null;

    const candidates = await prisma.ride.findMany({
      where: {
        // Shared with /search and /availability so the three cannot disagree
        // about what a joinable ride is. This is also what excludes the
        // viewer's own rides, which /nearby previously did not.
        ...joinableRideWhere(req.user?.userId),
        ...(req.query.vehicleType ? { vehicleType: String(req.query.vehicleType) } : {}),
        ...(box
          ? {
              originLat: { gte: box.minLat, lte: box.maxLat },
              originLng: { gte: box.minLng, lte: box.maxLng },
            }
          : {}),
      },
      orderBy: { departureTime: 'asc' },
      // Over-fetch: capacity and corridor both remove rows after the database
      // has already applied `take`, so asking for exactly `limit` here would
      // return short pages whenever nearby rides happen to be full or headed
      // the other way. Direction throws away far more than capacity does, so it
      // buys a deeper pool.
      take: dropoff ? Math.min(limit * 8, 400) : Math.min(limit * 3, 180),
    });

    const { byId, passengersByRide } = await hydrate(candidates.map((r) => r.id));

    const seated = withFreeSeats(candidates, passengersByRide);

    const bufferMetres = Math.min(
      Math.max(Number(req.query.corridorMetres) || DEFAULT_CORRIDOR.bufferMetres, 200),
      5_000,
    );

    const heading = dropoff
      ? seated.filter((ride) => {
          if (ride.originLat === null || ride.originLng === null) return false;
          // Pass one of /search, at the same doubled buffer: measured against
          // the straight origin→destination chord, which cuts corners the road
          // takes wide. Deliberately no Directions call — this list is browsed,
          // and /search does the exact routing once the guest commits.
          const fit = fitToCorridor(
            [
              { lat: ride.originLat, lng: ride.originLng },
              { lat: ride.destLat, lng: ride.destLng },
            ],
            { lat: coords!.lat, lng: coords!.lng },
            dropoff,
          );
          if (!fit) return false;
          return scoreFit(fit, { bufferMetres: bufferMetres * 2, minSharedMetres: 0 }).matches;
        })
      : seated;

    // Truncate after filtering, never before — slicing first would let a full
    // or wrong-way ride consume one of the twenty slots the caller asked for.
    const rides = heading.slice(0, limit);

    const items = rides
      .map((ride) => ({
        shaped: shape(ride, byId, passengersByRide),
        distance:
          coords && ride.originLat !== null && ride.originLng !== null
            ? calculateDistance(coords.lat, coords.lng, ride.originLat, ride.originLng)
            : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.shaped);

    // Lets the client say "no one is going your way" rather than the ambiguous
    // "nothing nearby", and stops it claiming a filter it did not get.
    return ok(res, { items, nextCursor: null, directional: Boolean(dropoff) });
  } catch (error) {
    console.error('[rides/nearby]', error);
    return fail(res, 500, 'Failed to load rides');
  }
});

/**
 * GET /api/rides/availability — how many joinable rides exist, by vehicle type.
 *
 * The counts beside Cab / Auto / Bike used to be computed on the client from
 * whatever page of rides it happened to be holding. That was wrong three ways:
 * the page was capped at 20 so the number was a page size rather than a count;
 * selecting a vehicle re-fetched *filtered* to that vehicle, so every other row
 * immediately dropped to 0; and it counted rides near the guest's pickup
 * regardless of where they were going, so "3 nearby" could be three cabs
 * driving in the opposite direction.
 *
 * This counts on the server, over the whole matching set, and — when a
 * destination is given — only rides heading the same way, using the same
 * corridor geometry as /search so the count and the list cannot disagree.
 *
 * Deliberately cheap: straight-line corridor only, no Directions calls. This
 * runs on every keystroke-ish interaction, and /search does the exact routing
 * once the guest commits.
 */
router.get('/availability', identify, async (req: AuthRequest, res: Response) => {
  try {
    const coords = parseCoords(req.query);
    if (!coords) return fail(res, 400, 'A pickup location is required', 'no-origin');

    const radiusKm = Math.min(Number(req.query.radiusKm) || 20, 60);
    const box = boundingBox(coords.lat, coords.lng, radiusKm);

    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    const hasDestination = Number.isFinite(destLat) && Number.isFinite(destLng);

    const windowMins = Math.min(Number(req.query.windowMins) || 120, 24 * 60);
    const departAt = req.query.departAt ? new Date(String(req.query.departAt)) : new Date();
    if (Number.isNaN(departAt.getTime())) return fail(res, 400, 'Invalid departure time');
    const windowMs = windowMins * 60 * 1000;

    const candidates = await prisma.ride.findMany({
      where: {
        ...joinableRideWhere(req.user?.userId),
        departureTime: {
          gte: new Date(
            Math.max(
              departAt.getTime() - windowMs,
              Date.now() - DEPARTED_GRACE_MINUTES * 60 * 1000,
            ),
          ),
          lte: new Date(departAt.getTime() + windowMs),
        },
        originLat: { gte: box.minLat, lte: box.maxLat },
        originLng: { gte: box.minLng, lte: box.maxLng },
      },
      // No `take`: this is a count, and a cap is exactly what made the old
      // number wrong. Bounded instead by the box, the time window and status.
      select: {
        id: true,
        seats: true,
        vehicleType: true,
        originLat: true,
        originLng: true,
        destLat: true,
        destLng: true,
      },
    });

    const accepted = await prisma.match.groupBy({
      by: ['rideId'],
      where: { rideId: { in: candidates.map((r) => r.id) }, status: 'accepted' },
      _count: { rideId: true },
    });
    const takenByRide = new Map(accepted.map((row) => [row.rideId, row._count.rideId]));

    const bufferMetres = Math.min(
      Math.max(Number(req.query.corridorMetres) || DEFAULT_CORRIDOR.bufferMetres, 200),
      5_000,
    );
    const pickup = { lat: coords.lat, lng: coords.lng };
    const dropoff = hasDestination ? { lat: destLat, lng: destLng } : null;

    const counts: Record<string, number> = { cab: 0, auto: 0, bike: 0 };
    let total = 0;

    for (const ride of candidates) {
      if (!hasSeatFree(ride.seats, takenByRide.get(ride.id) ?? 0)) continue;

      if (dropoff && ride.originLat !== null && ride.originLng !== null) {
        // Same corridor test as /search pass one, at the same doubled buffer:
        // a straight chord cuts corners the road takes wide.
        const fit = fitToCorridor(
          [
            { lat: ride.originLat, lng: ride.originLng },
            { lat: ride.destLat, lng: ride.destLng },
          ],
          pickup,
          dropoff,
        );
        if (!fit) continue;
        if (!scoreFit(fit, { bufferMetres: bufferMetres * 2, minSharedMetres: 0 }).matches) {
          continue;
        }
      }

      const key = ride.vehicleType in counts ? ride.vehicleType : null;
      if (key) counts[key] += 1;
      total += 1;
    }

    return ok(res, {
      counts,
      total,
      /** Tells the client whether these are direction-aware or just "nearby". */
      directional: Boolean(dropoff),
    });
  } catch (error) {
    console.error('[rides/availability]', error);
    return fail(res, 500, 'Failed to count rides');
  }
});

/**
 * GET /api/rides/search — the corridor search behind "Find a ride".
 *
 * Given where the guest is starting and ending, returns hosts already driving
 * past both points, in that order. This is the difference between "rides that
 * start near me" (which /nearby does, and which misses every host who would
 * pass the guest's door mid-trip) and "rides I can actually get on".
 *
 * Two passes, deliberately:
 *   1. every candidate is measured against its straight origin→destination
 *      line with a widened buffer — free, and throws away the bulk;
 *   2. the survivors are re-measured against their real Directions polyline,
 *      which is what knows the road bends away from the guest.
 *
 * Without the prefilter this would be one Directions request per ride in the
 * city, per search. The refinement pass is capped for the same reason, and
 * degrades to pass-one geometry when Directions is not configured.
 */
const REFINE_LIMIT = 12;

router.get('/search', identify, requireInstituteMw, async (req: AuthRequest, res: Response) => {
  try {
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      return fail(res, 400, 'A pickup and a destination are both required', 'no-route');
    }

    const pickup = { lat: originLat, lng: originLng };
    const dropoff = { lat: destLat, lng: destLng };

    const bufferMetres = Math.min(
      Math.max(Number(req.query.corridorMetres) || DEFAULT_CORRIDOR.bufferMetres, 200),
      5_000,
    );
    const windowMins = Math.min(Number(req.query.windowMins) || 120, 24 * 60);
    const departAt = req.query.departAt ? new Date(String(req.query.departAt)) : new Date();
    if (Number.isNaN(departAt.getTime())) return fail(res, 400, 'Invalid departure time');

    const windowMs = windowMins * 60 * 1000;

    /**
     * Coarse database filter before any geometry. A host whose whole trip is
     * outside a box around the guest's own trip cannot possibly pass within
     * the buffer, and this keeps the candidate set to one indexed range query.
     */
    const spanLat = Math.abs(destLat - originLat);
    const spanLng = Math.abs(destLng - originLng);
    const padLat = bufferMetres / 111_320 + spanLat;
    const padLng =
      bufferMetres / (111_320 * Math.max(Math.cos((originLat * Math.PI) / 180), 0.01)) + spanLng;
    const midLat = (originLat + destLat) / 2;
    const midLng = (originLng + destLng) / 2;

    const candidates = await prisma.ride.findMany({
      where: {
        ...joinableRideWhere(req.user!.userId),
        departureTime: {
          /**
           * Both the search window and the departed-grace floor apply. A guest
           * searching a window that reaches into the past must still not be
           * shown rides that already left — `joinableRideWhere` sets that
           * floor, and spreading it after would silently drop it.
           */
          gte: new Date(
            Math.max(
              departAt.getTime() - windowMs,
              Date.now() - DEPARTED_GRACE_MINUTES * 60 * 1000,
            ),
          ),
          lte: new Date(departAt.getTime() + windowMs),
        },
        originLat: { gte: midLat - padLat, lte: midLat + padLat },
        originLng: { gte: midLng - padLng, lte: midLng + padLng },
      },
      orderBy: { departureTime: 'asc' },
      take: 120,
    });

    /** Straight line through the host's own stops — pass one. */
    const straightPath = (ride: (typeof candidates)[number]): LatLng[] => {
      const stops = Array.isArray(ride.stops)
        ? (ride.stops as { lat?: unknown; lng?: unknown }[])
            .filter((s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)))
            .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }))
        : [];
      return [
        { lat: ride.originLat as number, lng: ride.originLng as number },
        ...stops,
        { lat: ride.destLat, lng: ride.destLng },
      ];
    };

    // Pass one runs at double the buffer: a straight line cuts corners the real
    // road takes wide, so a ride that genuinely passes the guest can sit
    // further from the chord than from the route. Narrowing back to the true
    // buffer is pass two's job.
    const coarseRule = { bufferMetres: bufferMetres * 2, minSharedMetres: 0 };

    const shortlist = candidates
      .filter((ride) => ride.originLat !== null && ride.originLng !== null)
      .map((ride) => {
        const fit = fitToCorridor(straightPath(ride), pickup, dropoff);
        return fit ? { ride, ...scoreFit(fit, coarseRule) } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.matches)
      .sort((a, b) => a.detourMetres - b.detourMetres)
      .slice(0, REFINE_LIMIT);

    const rule = { bufferMetres, minSharedMetres: DEFAULT_CORRIDOR.minSharedMetres };

    const refined = await Promise.all(
      shortlist.map(async ({ ride }) => {
        const route = await getRoute(
          [ride.originLng as number, ride.originLat as number],
          [ride.destLng, ride.destLat],
        );

        // Falls back to the straight path when Directions is unconfigured or
        // the request failed — a coarser match beats no match.
        const path: LatLng[] = route
          ? route.coordinates.map(([lng, lat]) => ({ lat, lng }))
          : straightPath(ride);

        const fit = fitToCorridor(path, pickup, dropoff);
        if (!fit) return null;

        const score = scoreFit(fit, rule);
        if (!score.matches) return null;

        return {
          ride,
          score,
          fit,
          routed: Boolean(route),
          coordinates: route?.coordinates ?? null,
        };
      }),
    );

    const hits = refined
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.score.detourMetres - b.score.detourMetres);

    const { byId, passengersByRide } = await hydrate(hits.map((hit) => hit.ride.id));

    const items = hits
      .map((hit) => {
        const shaped = shape(hit.ride, byId, passengersByRide);
        if (!shaped) return null;
        return {
          ride: shaped,
          /** How far the guest walks to meet the route at each end. */
          pickupWalkMetres: Math.round(hit.fit.pickupDetourMetres),
          dropoffWalkMetres: Math.round(hit.fit.dropoffDetourMetres),
          sharedMetres: Math.round(hit.score.sharedMetres),
          /** True when the geometry came from real roads, not a chord. */
          routed: hit.routed,
          route: hit.coordinates,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => ({
        ...item,
        seatsLeft: seatsRemaining(item.ride.seats, item.ride.seatsTaken),
      }))
      /**
       * Full rides are now removed rather than returned greyed out.
       *
       * The greyed row was meant to show the corridor was active, but a result
       * you cannot act on is indistinguishable from one you can until you tap
       * it — and with a "0 nearby" count next to a visible ride, the screen
       * contradicted itself. A guest sees only rides they could actually join;
       * the host still sees their own full ride in /mine.
       */
      .filter((item) => item.seatsLeft > 0);

    return ok(res, { items, corridorMetres: bufferMetres });
  } catch (error) {
    console.error('[rides/search]', error);
    return fail(res, 500, 'Failed to search for rides');
  }
});

/**
 * GET /api/rides/companions
 *
 * The squad search: who else is heading to this destination, around this time.
 *
 * Three kinds of person come back, and the client colours them differently on
 * the map because they need different actions:
 *   - `host`      already created a ride there — join it
 *   - `passenger` already on one — you would be riding together
 *   - `online`    same campus, sharing a live position nearby, no ride yet —
 *                 someone to invite rather than join
 *
 * Matching is on *destination* proximity, not origin: two people leaving from
 * opposite ends of campus for the same airport are the entire point. Origins
 * are returned so the client can suggest somewhere in the middle to meet.
 */
router.get('/companions', identify, requireInstituteMw, async (req: AuthRequest, res: Response) => {
  try {
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
      return fail(res, 400, 'A destination is required', 'no-destination');
    }

    // Generous by default: "the airport" is a big polygon, and a 2 km circle
    // around one terminal would miss someone who pinned another.
    const destRadiusKm = Math.min(Number(req.query.destRadiusKm) || 5, 25);
    const windowMins = Math.min(Number(req.query.windowMins) || 90, 24 * 60);
    const departAt = req.query.departAt ? new Date(String(req.query.departAt)) : new Date();
    if (Number.isNaN(departAt.getTime())) {
      return fail(res, 400, 'Invalid departure time');
    }

    const origin = parseCoords(req.query);
    const destBox = boundingBox(destLat, destLng, destRadiusKm);
    const windowMs = windowMins * 60 * 1000;

    const me = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { college: true },
    });

    const rides = await prisma.ride.findMany({
      where: {
        userId: { not: req.user!.userId },
        status: { in: ['requested', 'pending', 'accepted', 'matched', 'arriving'] },
        destLat: { gte: destBox.minLat, lte: destBox.maxLat },
        destLng: { gte: destBox.minLng, lte: destBox.maxLng },
        departureTime: {
          gte: new Date(departAt.getTime() - windowMs),
          lte: new Date(departAt.getTime() + windowMs),
        },
      },
      orderBy: { departureTime: 'asc' },
      take: 40,
    });

    const { byId, passengersByRide } = await hydrate(rides.map((ride) => ride.id));

    /** One entry per person, so somebody hosting two rides is not listed twice. */
    const companions = new Map<string, Record<string, unknown>>();
    const origins: { lat: number; lng: number }[] = [];

    const add = (
      userId: string,
      kind: 'host' | 'passenger' | 'online',
      ride: (typeof rides)[number] | null,
    ) => {
      if (userId === req.user!.userId || companions.has(userId)) return;
      const user = byId.get(userId);
      if (!user) return;

      // A live position is where they actually are; the ride origin is where
      // they said they would be. Prefer the truth, fall back to the plan.
      const live = getLivePosition(userId);
      const lat = live?.lat ?? ride?.originLat ?? null;
      const lng = live?.lng ?? ride?.originLng ?? null;
      if (lat === null || lng === null) return;

      if (ride?.originLat != null && ride.originLng != null) {
        origins.push({ lat: ride.originLat, lng: ride.originLng });
      }

      const seatsTaken = ride ? (passengersByRide.get(ride.id)?.length ?? 0) : 0;

      companions.set(userId, {
        user,
        kind,
        live: Boolean(live),
        lat,
        lng,
        rideId: ride?.id ?? null,
        origin: ride?.origin ?? null,
        destination: ride?.destination ?? null,
        departureTime: ride?.departureTime ?? null,
        vehicleType: ride?.vehicleType ?? null,
        seatsLeft: ride ? Math.max(ride.seats - seatsTaken, 0) : null,
        fare: ride?.fare ?? null,
        distanceMetres:
          origin !== null
            ? Math.round(calculateDistanceMetres(origin.lat, origin.lng, lat, lng))
            : null,
      });
    };

    for (const ride of rides) add(ride.userId, 'host', ride);
    for (const ride of rides) {
      for (const passenger of passengersByRide.get(ride.id) ?? []) {
        add((passenger as { id: string }).id, 'passenger', ride);
      }
    }

    /**
     * Campus-mates who are online near the pickup point but have no ride yet.
     * Scoped to the caller's college and to people actively broadcasting a
     * position — this must never become a way to look up where someone is.
     */
    if (origin && me?.college) {
      const originBox = boundingBox(origin.lat, origin.lng, 10);
      const candidates = await prisma.user.findMany({
        where: {
          id: { not: req.user!.userId },
          college: me.college,
          isActive: true,
          onboarded: true,
        },
        select: USER_SUMMARY,
        take: 200,
      });

      const blocked = await prisma.block.findMany({
        where: {
          OR: [{ blockerId: req.user!.userId }, { blockedId: req.user!.userId }],
        },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = new Set(
        blocked
          .flatMap((entry) => [entry.blockerId, entry.blockedId])
          .filter((id) => id !== req.user!.userId),
      );

      for (const candidate of candidates) {
        if (companions.has(candidate.id) || blockedIds.has(candidate.id)) continue;
        const live = getLivePosition(candidate.id);
        if (!live) continue;
        if (
          live.lat < originBox.minLat ||
          live.lat > originBox.maxLat ||
          live.lng < originBox.minLng ||
          live.lng > originBox.maxLng
        ) {
          continue;
        }
        byId.set(candidate.id, candidate);
        add(candidate.id, 'online', null);
      }
    }

    /**
     * A starting point for the meeting-point picker, not a decision. The
     * centroid of everyone's origins is rarely the final answer — the client
     * lets the group drag or retype it — but it beats opening on nothing.
     */
    const meetingSuggestion = origins.length
      ? {
          lat: origins.reduce((sum, p) => sum + p.lat, 0) / origins.length,
          lng: origins.reduce((sum, p) => sum + p.lng, 0) / origins.length,
        }
      : null;

    const items = [...companions.values()].sort((a, b) => {
      const left = (a.distanceMetres as number | null) ?? Number.MAX_SAFE_INTEGER;
      const right = (b.distanceMetres as number | null) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });

    return ok(res, { items, meetingSuggestion });
  } catch (error) {
    console.error('[rides/companions]', error);
    return fail(res, 500, 'Failed to find people going your way');
  }
});

/**
 * GET /api/rides/:id/candidates — riders whose published trip fits this ride.
 *
 * The mirror image of /rides/search: same corridor rule, same buffer, same
 * pickup-before-drop-off ordering — only run from the driver's side, over
 * TripRequest rows instead of Ride rows. Sharing `fitToCorridor` is what keeps
 * the two directions from disagreeing about who counts as a match.
 */
router.get('/:id/candidates', identify, requireInstituteMw, async (req: AuthRequest, res: Response) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');
    if (ride.userId !== req.user!.userId) {
      return fail(res, 403, 'Only the host can see who fits this trip', 'not-host');
    }
    if (ride.originLat === null || ride.originLng === null) {
      return fail(res, 400, 'This ride has no pickup point to match against', 'no-origin');
    }

    const bufferMetres = Math.min(
      Math.max(Number(req.query.corridorMetres) || DEFAULT_CORRIDOR.bufferMetres, 200),
      5_000,
    );
    const windowMs = Math.min(Number(req.query.windowMins) || 120, 24 * 60) * 60 * 1000;

    // A stale request must never be offered a seat.
    await prisma.tripRequest.updateMany({
      where: { status: 'open', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });

    const requests = await prisma.tripRequest.findMany({
      where: {
        status: 'open',
        userId: { not: req.user!.userId },
        departAt: {
          gte: new Date(ride.departureTime.getTime() - windowMs),
          lte: new Date(ride.departureTime.getTime() + windowMs),
        },
      },
      orderBy: { departAt: 'asc' },
      take: 120,
    });

    if (requests.length === 0) {
      return ok(res, { items: [], corridorMetres: bufferMetres, routed: false });
    }

    // One Directions call for this ride, reused for every candidate — the
    // corridor is a property of the host's route, not of who stands beside it.
    const route = await getRoute(
      [ride.originLng, ride.originLat],
      [ride.destLng, ride.destLat],
    );

    const stops = Array.isArray(ride.stops)
      ? (ride.stops as { lat?: unknown; lng?: unknown }[])
          .filter((s) => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng)))
          .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }))
      : [];

    const path: LatLng[] = route
      ? route.coordinates.map(([lng, lat]) => ({ lat, lng }))
      : [
          { lat: ride.originLat, lng: ride.originLng },
          ...stops,
          { lat: ride.destLat, lng: ride.destLng },
        ];

    const rule = { bufferMetres, minSharedMetres: DEFAULT_CORRIDOR.minSharedMetres };

    const fits = requests
      .map((request) => {
        const fit = fitToCorridor(
          path,
          { lat: request.originLat, lng: request.originLng },
          { lat: request.destLat, lng: request.destLng },
        );
        if (!fit) return null;
        const score = scoreFit(fit, rule);
        return score.matches ? { request, fit, score } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.score.detourMetres - b.score.detourMetres)
      .slice(0, 40);

    const [users, existing] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: fits.map((f) => f.request.userId) } },
        select: USER_SUMMARY,
      }),
      // Already invited or already aboard — still listed, but not invitable twice.
      prisma.match.findMany({
        where: {
          rideId: ride.id,
          user2Id: { in: fits.map((f) => f.request.userId) },
          status: { in: ['pending', 'accepted'] },
        },
        select: { user2Id: true, status: true },
      }),
    ]);

    const userById = new Map(users.map((user) => [user.id, user]));
    const stateByUser = new Map(existing.map((match) => [match.user2Id, match.status]));

    const items = fits
      .map(({ request, fit, score }) => {
        const user = userById.get(request.userId);
        if (!user) return null;
        return {
          request: {
            id: request.id,
            originLabel: request.originLabel,
            destLabel: request.destLabel,
            departAt: request.departAt,
            seats: request.seats,
          },
          user,
          detourMetres: Math.round(fit.pickupDetourMetres),
          dropoffDetourMetres: Math.round(fit.dropoffDetourMetres),
          sharedMetres: Math.round(score.sharedMetres),
          inviteStatus: stateByUser.get(request.userId) ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return ok(res, { items, corridorMetres: bufferMetres, routed: Boolean(route) });
  } catch (error) {
    console.error('[rides/candidates]', error);
    return fail(res, 500, 'Failed to find riders going your way');
  }
});

/** POST /api/rides/:id/invite — host asks one rider to join. */
router.post('/:id/invite', identify, requireInstituteMw, async (req: AuthRequest, res: Response) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');
    if (ride.userId !== req.user!.userId) {
      return fail(res, 403, 'Only the host can invite riders', 'not-host');
    }
    if (['cancelled', 'completed'].includes(ride.status)) {
      return fail(res, 409, 'That trip is no longer running', 'ride-closed');
    }

    const request = await prisma.tripRequest.findUnique({
      where: { id: String(req.body.requestId ?? '') },
    });
    if (!request || request.status !== 'open') {
      return fail(res, 404, 'That rider is no longer looking', 'request-closed');
    }
    if (request.userId === req.user!.userId) {
      return fail(res, 400, 'You cannot invite yourself');
    }

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user!.userId, blockedId: request.userId },
          { blockerId: request.userId, blockedId: req.user!.userId },
        ],
      },
      select: { id: true },
    });
    if (blocked) return fail(res, 403, 'You cannot invite this rider');

    /**
     * More invites than seats is allowed — people decline — but only within a
     * small margin, so the car cannot be double-sold on acceptance. The hard
     * stop is re-checked when a rider actually accepts.
     */
    const [taken, outstanding] = await Promise.all([
      prisma.match.count({ where: { rideId: ride.id, status: 'accepted' } }),
      prisma.match.count({ where: { rideId: ride.id, status: 'pending' } }),
    ]);
    if (taken >= ride.seats) return fail(res, 409, 'Your trip is full', 'ride-full');
    if (taken + outstanding >= ride.seats + 2) {
      return fail(res, 429, 'You have enough invites out for the seats you have left');
    }

    const already = await prisma.match.findFirst({
      where: { rideId: ride.id, user2Id: request.userId, status: { in: ['pending', 'accepted'] } },
      select: { id: true },
    });
    if (already) return fail(res, 409, 'You already invited this rider', 'already-invited');

    const match = await prisma.match.create({
      data: {
        rideId: ride.id,
        user1Id: ride.userId,
        user2Id: request.userId,
        // Unique per row; the thread itself is not created until acceptance.
        chatRoomId: `ride:${ride.id}:${request.userId}`,
        status: 'pending',
        initiatedBy: 'host',
        requestId: request.id,
      },
    });

    await notify({
      userId: request.userId,
      type: 'ride.accepted',
      title: 'A host invited you',
      body: `Someone is driving to ${ride.destination} and has room for you.`,
      href: '/rides/invites',
      data: { rideId: ride.id, matchId: match.id },
    });

    return ok(res, { id: match.id, status: match.status }, 201);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return fail(res, 409, 'You already invited this rider', 'already-invited');
    }
    console.error('[rides/invite]', error);
    return fail(res, 500, 'Failed to send the invite');
  }
});

/** GET /api/rides/mine — rides the caller hosts or has been accepted onto. */
router.get('/mine', identify, async (req: AuthRequest, res: Response) => {
  try {
    const joined = await prisma.match.findMany({
      where: { user2Id: req.user!.userId, status: { in: ['pending', 'accepted'] } },
      select: { rideId: true },
    });

    const rides = await prisma.ride.findMany({
      where: {
        OR: [{ userId: req.user!.userId }, { id: { in: joined.map((m) => m.rideId) } }],
      },
      orderBy: { departureTime: 'desc' },
      take: 50,
    });

    const { byId, passengersByRide } = await hydrate(rides.map((r) => r.id));
    return ok(
      res,
      rides.map((ride) => shape(ride, byId, passengersByRide)),
    );
  } catch (error) {
    console.error('[rides/mine]', error);
    return fail(res, 500, 'Failed to load your rides');
  }
});

/** GET /api/rides/:id/detail */
router.get('/:id/detail', identify, async (req: AuthRequest, res: Response) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');

    const { byId, passengersByRide } = await hydrate([ride.id]);
    return ok(res, shape(ride, byId, passengersByRide));
  } catch (error) {
    console.error('[rides/:id/detail]', error);
    return fail(res, 500, 'Failed to load ride');
  }
});

/**
 * GET /api/rides/:id/tracking
 * Server-computed ETA from the host's live position to the pickup point.
 * Only ride participants may read it.
 */
router.get('/:id/tracking', identify, async (req: AuthRequest, res: Response) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');

    const isHost = ride.userId === req.user!.userId;
    const isPassenger = await prisma.match.findFirst({
      where: { rideId: ride.id, user2Id: req.user!.userId, status: 'accepted' },
      select: { id: true },
    });
    if (!isHost && !isPassenger) {
      return fail(res, 403, 'Only people on this ride can see live tracking');
    }

    const position = getLivePosition(ride.userId);
    if (!position) return ok(res, null);

    const target: [number, number] =
      normaliseStatus(ride.status) === 'in_progress'
        ? [ride.destLng, ride.destLat]
        : [ride.originLng ?? ride.destLng, ride.originLat ?? ride.destLat];

    const route = await getRoute([position.lng, position.lat], target);

    const payload = {
      rideId: ride.id,
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      etaSeconds: route?.durationSeconds ?? null,
      distanceMetres: route?.distanceMetres ?? null,
      updatedAt: position.updatedAt,
      route: route?.coordinates ?? null,
    };

    // Also push to anyone with the ride open so their marker moves without a
    // poll; the HTTP response covers the initial load.
    getIO()?.to(`ride:${ride.id}`).emit('ride:tracking', payload);

    return ok(res, payload);
  } catch (error) {
    console.error('[rides/tracking]', error);
    return fail(res, 500, 'Failed to compute tracking');
  }
});

/**
 * POST /api/rides/:id/transition
 * The single entry point for status changes. Validates the move against the
 * state machine and the caller's role before writing anything.
 */
router.post('/:id/transition', identify, async (req: AuthRequest, res: Response) => {
  try {
    const to = String(req.body.to ?? '');
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');

    const from = normaliseStatus(ride.status);
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      return fail(res, 409, `A ride that is ${from.replace('_', ' ')} cannot become ${to}`);
    }

    const isHost = ride.userId === req.user!.userId;
    const passenger = await prisma.match.findFirst({
      where: { rideId: ride.id, user2Id: req.user!.userId },
      select: { id: true },
    });

    if (HOST_ONLY.has(to) && !isHost) {
      return fail(res, 403, 'Only the host can do that');
    }
    if (to === 'cancelled' && !isHost && !passenger) {
      return fail(res, 403, 'You are not on this ride');
    }

    const now = new Date();
    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: to,
        ...(to === 'accepted' ? { acceptedAt: now } : {}),
        ...(to === 'in_progress' ? { startedAt: now } : {}),
        ...(to === 'completed' ? { finishedAt: now } : {}),
        ...(to === 'cancelled'
          ? {
              cancelledAt: now,
              cancelledBy: req.user!.userId,
              cancelReason: req.body.reason ? String(req.body.reason).slice(0, 300) : null,
            }
          : {}),
      },
    });

    getIO()?.to(`ride:${ride.id}`).emit('ride:status', { rideId: ride.id, status: to });

    /**
     * And to everyone else, for discovery.
     *
     * The room emit above reaches the host and passengers — the people already
     * on the ride. A cancelled ride has to disappear from the lists of people
     * who were *considering* it, and none of them are in that room. Same
     * reasoning as squad:status; the payload is an id and a state, nothing
     * that is not already visible in a public listing.
     */
    if (to === 'cancelled' || to === 'completed' || to === 'in_progress') {
      getIO()?.emit('ride:status', { rideId: ride.id, status: to });
    }

    // Tell everyone on the ride except the person who triggered the change.
    const participants = await prisma.match.findMany({
      where: { rideId: ride.id, status: 'accepted' },
      select: { user2Id: true },
    });
    const audience = [ride.userId, ...participants.map((p) => p.user2Id)].filter(
      (id) => id !== req.user!.userId,
    );

    const COPY: Record<string, { type: Parameters<typeof notify>[0]['type']; title: string }> = {
      accepted: { type: 'ride.accepted', title: 'Your ride was accepted' },
      arriving: { type: 'ride.arriving', title: 'Your host is on the way' },
      in_progress: { type: 'ride.started', title: 'Your ride has started' },
      completed: { type: 'ride.completed', title: 'Ride completed' },
      cancelled: { type: 'ride.cancelled', title: 'A ride was cancelled' },
    };
    const copy = COPY[to];

    if (copy) {
      await Promise.all(
        audience.map((userId) =>
          notify({
            userId,
            type: copy.type,
            title: copy.title,
            body: `${ride.origin} → ${ride.destination}`,
            href: `/rides/${ride.id}`,
            data: { rideId: ride.id },
          }),
        ),
      );
    }

    const { byId, passengersByRide } = await hydrate([ride.id]);
    return ok(res, shape(updated, byId, passengersByRide));
  } catch (error) {
    console.error('[rides/transition]', error);
    return fail(res, 500, 'Failed to update the ride');
  }
});

/** POST /api/rides/:id/join — creates a pending match for the host to accept. */
router.post('/:id/join', identify, async (req: AuthRequest, res: Response) => {
  try {
    const blocked = await requireVerifiedInstitute(req.user!.userId);
    if (blocked) return fail(res, blocked.status, blocked.message, blocked.code);

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) return fail(res, 404, 'Ride not found');
    if (ride.userId === req.user!.userId) {
      return fail(res, 400, 'You are already hosting this ride');
    }
    if (!['requested', 'pending'].includes(ride.status)) {
      return fail(res, 409, 'This ride is no longer taking passengers');
    }

    const taken = await prisma.match.count({
      where: { rideId: ride.id, status: 'accepted' },
    });
    if (taken >= ride.seats) return fail(res, 409, 'This ride is full');

    const existing = await prisma.match.findFirst({
      where: { rideId: ride.id, user2Id: req.user!.userId },
    });

    if (!existing) {
      await prisma.match.create({
        data: {
          rideId: ride.id,
          user1Id: ride.userId,
          user2Id: req.user!.userId,
          chatRoomId: `ride-${ride.id}-${req.user!.userId}`,
          status: 'pending',
        },
      });

      const requester = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { name: true },
      });

      await notify({
        userId: ride.userId,
        type: 'ride.accepted',
        title: `${requester?.name ?? 'Someone'} wants a seat`,
        body: `${ride.origin} → ${ride.destination}`,
        href: `/rides/${ride.id}`,
        data: { rideId: ride.id },
      });
    }

    const { byId, passengersByRide } = await hydrate([ride.id]);
    return ok(res, shape(ride, byId, passengersByRide));
  } catch (error) {
    console.error('[rides/join]', error);
    return fail(res, 500, 'Failed to join the ride');
  }
});

/** POST /api/rides/:id/leave */
router.post('/:id/leave', identify, async (req: AuthRequest, res: Response) => {
  try {
    const match = await prisma.match.findFirst({
      where: { rideId: req.params.id, user2Id: req.user!.userId },
    });
    if (!match) return fail(res, 404, 'You are not on this ride');

    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'cancelled' },
    });

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    const { byId, passengersByRide } = await hydrate([req.params.id]);
    return ok(res, shape(ride, byId, passengersByRide));
  } catch (error) {
    console.error('[rides/leave]', error);
    return fail(res, 500, 'Failed to leave the ride');
  }
});

export default router;

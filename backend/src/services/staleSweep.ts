import prisma from '../utils/prisma.js';
import {
  LIFECYCLE,
  evaluateLifecycle,
  isLiveStatus,
  syncSquadLifecycle,
} from './squadLifecycle.js';
import { getIO } from './live.js';
import { statusesAllowing } from './rideLifecycle.js';

/**
 * Closing rides and squads that nobody ever closed.
 *
 * Both state machines are driven by people, and people who lose interest do not
 * press cancel. So a ride sits in `requested` forever: at the time of writing,
 * twenty-one of the thirty-nine rides in the database were open, and every one
 * of them had departed — the oldest a hundred and sixty-six days earlier.
 *
 * Teaching the dashboard not to *count* those was the first half and shipped
 * already. This is the second, and it is the one that matters more: the rows
 * themselves still claim to be live, so every future query, export and report
 * has to know to work around them. A ceiling in the dashboard fixes one reader.
 * Settling the row fixes all of them.
 *
 * ## Why a sweep, when squadLifecycle argues against exactly this
 *
 * Spllit's usual answer is to derive state when somebody looks, and
 * services/squadLifecycle.ts explains at length why a scheduled job was the
 * wrong shape for it. That reasoning holds and is not reversed here. It assumes
 * a reader: opening a squad evaluates it, so the state settles the moment it
 * matters. Nobody opens an abandoned ride — that is what makes it abandoned —
 * so the derivation never runs and the row never settles.
 *
 * So this is the backstop for rows no request will ever touch, not a
 * replacement for lazy evaluation. Note what it does *not* do: it never decides
 * a squad's fate itself. It finds candidates and hands each one to
 * `syncSquadLifecycle`, which is the same function a page load calls.
 */

/**
 * How long past departure a ride is taken as abandoned.
 *
 * A day, deliberately not the four hours the dashboard uses to decide what to
 * show. Those answer different questions. "Is this happening right now" can be
 * wrong for an hour and self-corrects on the next render; writing a terminal
 * status onto somebody's ride is a one-way door, so it waits until there is no
 * argument left. A ride running late is still a ride.
 *
 * The live data does not distinguish the two thresholds — all twenty-one stale
 * rides are months old, and identical counts come back at 4h, 24h and 72h. The
 * gap is there for the ride that is merely late, which is the case this has to
 * get right and which the current data happens not to contain.
 */
const RIDE_ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * The statuses this may cancel: asked of the state machine, not written down.
 *
 * The sweep must not be able to make a transition a user could not, and a
 * hand-copied list would agree with the machine right until somebody edited
 * one of them. Today this resolves to `requested`, `accepted`, `arriving` and
 * the legacy aliases `pending` and `matched`.
 *
 * `in_progress` is absent, and that falls out of the machine rather than being
 * a special case here: it leads only to `completed`. Which is the right
 * answer — auto-completing would assert that a trip took place, a claim about
 * the world rather than a cleanup, and nothing here knows whether it is true.
 * Such a ride stays open and visibly wrong, which is correct for a row that
 * needs a human to look at it.
 */
const CANCELLABLE_RIDE_STATUSES = statusesAllowing('cancelled');

/**
 * Bound on a single pass.
 *
 * A sweep that tried to close a hundred thousand rows in one request would
 * exceed the request timeout and close none of them, then do the same an hour
 * later. What one pass misses, the next takes.
 */
const RIDE_BATCH = 500;
const SQUAD_BATCH = 200;

export interface SweepResult {
  /** Rows that would change. Equal to `changed` unless this was a dry run. */
  found: number;
  changed: number;
  dryRun: boolean;
  /** A handful of examples, so the operator can see what was touched. */
  samples: string[];
}

/**
 * Cancels rides whose departure passed without anyone starting or ending them.
 *
 * `cancelled` is the only terminal state an unfinished ride can reach — the
 * machine has no `expired` — so the difference between "the host cancelled" and
 * "the time simply passed" has to live somewhere else, and it lives in
 * `cancelledBy` and `cancelReason`. Both are written on every row this touches,
 * so nothing downstream has to infer intent from a bare status.
 *
 * ## Two deliberate departures from the manual cancel path
 *
 * POST /rides/:id/transition also notifies the other participants, and leaves
 * matches untouched. This inverts the first and keeps the second.
 *
 * No notifications, because that notification means "a person changed their
 * mind about a ride you are on", which is worth a push. Here nobody decided
 * anything and the ride left in April. Sending them would put twenty-one
 * pushes about long-dead rides onto real phones — a worse outcome than the
 * stale rows this is meant to fix.
 *
 * Matches are left alone, exactly as the manual path leaves them. Twelve
 * accepted matches point at these rides, and they record that two people once
 * agreed to travel together. That happened. The ride's status is what was
 * untrue, not the match.
 */
export async function sweepDepartedRides(options: { dryRun?: boolean } = {}): Promise<SweepResult> {
  const dryRun = options.dryRun ?? false;
  const cutoff = new Date(Date.now() - RIDE_ABANDONED_AFTER_MS);

  const stale = await prisma.ride.findMany({
    where: {
      status: { in: CANCELLABLE_RIDE_STATUSES },
      departureTime: { lt: cutoff },
    },
    select: { id: true, origin: true, destination: true, departureTime: true },
    orderBy: { departureTime: 'asc' },
    take: RIDE_BATCH,
  });

  const samples = stale.slice(0, 5).map((r) => {
    const departed = r.departureTime.toISOString().slice(0, 10);
    return `${r.origin} → ${r.destination} (departed ${departed})`;
  });

  if (dryRun || stale.length === 0) {
    return { found: stale.length, changed: 0, dryRun, samples };
  }

  const now = new Date();
  const result = await prisma.ride.updateMany({
    /**
     * The status guard is repeated here rather than matching on id alone.
     * Between the read above and this write a host may have cancelled or
     * started one of these themselves, and without the guard the sweep would
     * overwrite a real decision with a machine one.
     */
    where: {
      id: { in: stale.map((r) => r.id) },
      status: { in: CANCELLABLE_RIDE_STATUSES },
    },
    data: {
      status: 'cancelled',
      cancelledAt: now,
      /**
       * A sentinel, never a user id. Anything reading this row — a support
       * conversation, an export, a report — must be able to tell at a glance
       * that no person made this call.
       */
      cancelledBy: 'system',
      cancelReason: 'Departure time passed without the ride being started or cancelled.',
    },
  });

  /**
   * Broadcast, because a cancelled ride has to leave the lists of people who
   * were considering it and none of them are in the ride's room. This is the
   * same emit the transition route sends, and the payload is an id and a state
   * — nothing that was not already public in a listing.
   */
  const io = getIO();
  if (io) {
    for (const ride of stale) {
      io.emit('ride:status', { rideId: ride.id, status: 'cancelled' });
    }
  }

  return { found: stale.length, changed: result.count, dryRun: false, samples };
}

/**
 * Settles squads whose stored status has outlived their meeting.
 *
 * The decision is not made here. Each candidate goes to `syncSquadLifecycle`,
 * the same function a page load calls, which brings with it the compare-and-set
 * that stops two instances completing one squad twice, the member release that
 * clears stale positions, and the socket emit. An earlier draft of this file
 * wrote `status` and `isActive` directly and skipped all three — which would
 * have left members of a completed squad sitting in `travelling` with live
 * coordinates.
 *
 * The one thing suppressed is the member notification; see SyncOptions for why.
 * Candidates are narrowed by the ceiling first because the lifecycle costs a
 * member query per squad, and below that ceiling it cannot decide anything.
 */
export async function sweepStaleSquads(options: { dryRun?: boolean } = {}): Promise<SweepResult> {
  const dryRun = options.dryRun ?? false;
  const now = new Date();

  /**
   * The wider of the two ceilings the lifecycle applies, so the candidate net is
   * never narrower than the rule it feeds. A squad that turns out not to be
   * expired comes back unchanged and costs one query.
   */
  const ceilingHours = Math.max(LIFECYCLE.HARD_MAX_HOURS, LIFECYCLE.UNSCHEDULED_MAX_HOURS);
  const ceiling = new Date(now.getTime() - ceilingHours * 60 * 60 * 1000);

  const candidates = await prisma.squad.findMany({
    /**
     * Filtered on `status`, not on `isActive`. `isLiveStatus` is the single
     * definition of liveness and `isActive` is a denormalised copy kept in step
     * on write — so a row whose copy has drifted, or which predates the column,
     * is precisely the kind of row this sweep exists to find. Matching on the
     * copy would skip them.
     *
     * Neither branch below mentions `meetingAt: null`, and that is the point.
     * Prisma compiles a null check on MongoDB to "the field exists and holds
     * null", which is not the same question as "the squad has no meeting time"
     * — two Squad documents in production are missing the field outright, and a
     * live one would have been invisible to this sweep forever. The `createdAt`
     * branch says nothing about `meetingAt` at all, so it catches them however
     * the absence is spelled.
     *
     * The cost is a wider net: a squad created long ago that meets tomorrow now
     * comes back as a candidate. `evaluateLifecycle` returns `before-meeting`
     * and it is skipped, for one member query. Being too broad here is
     * recoverable; being too narrow is a row nothing ever fixes.
     */
    where: {
      status: { in: ['active', 'in_progress'] },
      OR: [{ meetingAt: { lt: ceiling } }, { createdAt: { lt: ceiling } }],
    },
    select: {
      id: true,
      name: true,
      status: true,
      meetingAt: true,
      durationMinutes: true,
      createdAt: true,
      lastActivityAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: SQUAD_BATCH,
  });

  const samples: string[] = [];
  let found = 0;
  let changed = 0;

  for (const squad of candidates) {
    /**
     * Evaluated here before being handed to `syncSquadLifecycle`, which
     * evaluates it again. The repeat is deliberate and cheap.
     *
     * `evaluateLifecycle` is pure — that is the whole point of the way
     * squadLifecycle is written — so calling it costs one member query and
     * writes nothing. That is what lets a dry run report the status each squad
     * would actually settle to, and the reason it settled, rather than listing
     * candidates and declining to predict. It also keeps `found` meaning the
     * same thing it means for rides: rows that will change, not rows examined.
     *
     * The sweep runs hourly over a handful of squads; paying one extra read per
     * changed row to keep the preview honest is the right trade.
     */
    const members = await prisma.squadMember.findMany({
      where: { squadId: squad.id },
      select: { status: true, locationAt: true },
    });

    const decision = evaluateLifecycle(squad, members, now);
    if (!decision.changed) continue;

    found += 1;
    if (samples.length < 5) {
      samples.push(`${squad.name} → ${decision.status} (${decision.reason})`);
    }
    if (dryRun) continue;

    const settled = await syncSquadLifecycle(squad, now, { notifyMembers: false });
    if (!isLiveStatus(settled.status)) changed += 1;
  }

  return { found, changed, dryRun, samples };
}

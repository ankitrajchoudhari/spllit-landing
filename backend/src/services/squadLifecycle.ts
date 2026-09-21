import prisma from '../utils/prisma.js';
import { ACTIVE_MEMBER_STATUSES } from './squads.js';
import { notify } from './notifications.js';
import { getIO } from './live.js';

/**
 * When a squad ends, decided from data rather than from a timer.
 *
 * A squad must not depend on its creator remembering to press End Squad. But
 * closing one while somebody is still walking to the meeting point strands them
 * with no chat, no navigation and no explanation, so every rule here fails in
 * the direction of staying open.
 *
 * This module is pure: no database, no clock, no network. `evaluateLifecycle`
 * takes the squad, its members and the current time, and returns what the
 * status should be. Persistence and side effects belong to the caller, which is
 * what makes the expiry arithmetic testable without waiting four hours.
 *
 * It is evaluated on read rather than by a scheduled job because the API runs on
 * Cloud Run: it scales to zero, so a timer armed for 11:15 never fires if no
 * request arrives, and it runs multiple instances, so every instance would fire
 * the same transition and complete the squad N times. Deriving the state on
 * demand is immune to both. See docs/SQUAD-LIFECYCLE.md.
 */

/**
 * Tunable from real usage later. They live here, named, rather than scattered
 * through the call sites — the point of centralising them is that changing one
 * is a one-line edit in a reviewed place.
 */
export const LIFECYCLE = {
  /** Assumed length of a squad that did not state one. */
  DEFAULT_DURATION_MINUTES: 45,
  /** Added to the expected end before expiry is even considered. */
  GRACE_MINUTES: 90,
  /** Silence required past soft expiry before a squad is completed. */
  QUIET_MINUTES: 30,
  /** Ceiling after the meeting time, regardless of activity. */
  HARD_MAX_HOURS: 4,
  /**
   * Arrivals needed before a squad may complete on the strength of them.
   *
   * Two, not one: a lone member reaching the point would otherwise end the
   * squad the instant they got there, which reads as the app cancelling their
   * plan. It also covers the case where only one person shares location at all
   * — their arrival says nothing about anyone else.
   */
  MIN_ARRIVAL_QUORUM: 2,
  /**
   * Ceiling for a squad that never named a meeting time, measured from when it
   * was created.
   *
   * Such a squad is not scheduled — it was made to happen now — so creation is
   * the only honest anchor for it. Before this existed it had no clock at all
   * and could be closed only by hand, which meant one made by accident, or made
   * and forgotten, stayed live indefinitely: still discoverable, still holding
   * its members, still accepting joins.
   *
   * Longer than HARD_MAX_HOURS because the anchor is weaker. Four hours past a
   * stated meeting time is strong evidence the squad is over; four hours past
   * "somebody opened the form" is not, since the trip itself may not have
   * started when the squad was created.
   */
  UNSCHEDULED_MAX_HOURS: 6,
} as const;

/** Stored values. `active` is the pre-start state, labelled "Scheduled" in UI. */
export type SquadLifecycleStatus = 'active' | 'in_progress' | 'completed' | 'cancelled';

const TERMINAL: readonly string[] = ['completed', 'cancelled'];

export interface LifecycleSquad {
  status: string;
  meetingAt: Date | null;
  durationMinutes: number | null;
  lastActivityAt: Date | null;
  /** Fallback clock for a squad that never named a meeting time. */
  createdAt: Date;
}

export interface LifecycleMember {
  /** pending | active | travelling | arrived | left */
  status: string;
  /** Null means this member has never reported a position. */
  locationAt: Date | null;
}

export interface LifecycleDecision {
  status: SquadLifecycleStatus;
  /** Why, for logging and for the notification the caller may send. */
  reason:
    | 'unchanged'
    | 'no-meeting-time'
    | 'terminal'
    | 'before-meeting'
    | 'meeting-started'
    | 'arrival-quorum'
    | 'quiet'
    | 'hard-expiry'
    | 'unscheduled-expiry';
  /** True when the caller must persist this. */
  changed: boolean;
}

const MINUTE = 60_000;

/**
 * The members whose arrival is allowed to speak for the squad.
 *
 * Two exclusions, for different reasons. `pending` and `left` are not in the
 * squad — a join request nobody approved and someone who walked away must not
 * hold it open. A member who has never reported a position is excluded because
 * they *cannot* satisfy the test: denying location permission leaves lat/lng
 * null, so arrival detection can never flip them, and counting them would mean
 * the arrival path never fires for any squad containing one. That is the common
 * case, not the rare one.
 *
 * A member who shared location and then went silent is still counted. They were
 * travelling, and their silence is what the expiry rules are for.
 */
function arrivalQuorum(members: LifecycleMember[]): LifecycleMember[] {
  return members.filter(
    (m) =>
      (ACTIVE_MEMBER_STATUSES as readonly string[]).includes(m.status) && m.locationAt !== null,
  );
}

export function evaluateLifecycle(
  squad: LifecycleSquad,
  members: LifecycleMember[],
  now: Date,
): LifecycleDecision {
  const settled = (status: SquadLifecycleStatus, reason: LifecycleDecision['reason']) => ({
    status,
    reason,
    changed: status !== squad.status,
  });

  // Terminal states are final. `now` comes from a machine clock, and skew or a
  // correction must never resurrect a squad that has ended.
  if (TERMINAL.includes(squad.status)) {
    return { status: squad.status as SquadLifecycleStatus, reason: 'terminal', changed: false };
  }

  /**
   * No meeting time: the squad was made to happen now, so creation is the
   * clock.
   *
   * This used to return `active` unconditionally, on the reasoning that there
   * was no correct value to backfill into `meetingAt`. That is still true — and
   * nothing is backfilled here — but it left such a squad with no expiry at
   * all, so one created by mistake stayed live, discoverable and joinable
   * forever. Creation is a weaker signal than a stated meeting time, which is
   * why it gets its own, longer ceiling rather than reusing HARD_MAX_HOURS.
   *
   * Arrival still ends it early. Everyone reaching the meeting point means the
   * squad is over whether or not anybody wrote down a time.
   */
  if (!squad.meetingAt) {
    const unscheduledQuorum = arrivalQuorum(members);
    if (
      unscheduledQuorum.length >= LIFECYCLE.MIN_ARRIVAL_QUORUM &&
      unscheduledQuorum.every((m) => m.status === 'arrived')
    ) {
      return settled('completed', 'arrival-quorum');
    }

    const unscheduledEndMs =
      squad.createdAt.getTime() + LIFECYCLE.UNSCHEDULED_MAX_HOURS * 60 * MINUTE;
    if (now.getTime() >= unscheduledEndMs) return settled('completed', 'unscheduled-expiry');

    return settled('active', 'no-meeting-time');
  }

  if (now < squad.meetingAt) return settled('active', 'before-meeting');

  const meetingMs = squad.meetingAt.getTime();
  const nowMs = now.getTime();

  const durationMinutes = squad.durationMinutes ?? LIFECYCLE.DEFAULT_DURATION_MINUTES;
  const expectedEndMs = meetingMs + durationMinutes * MINUTE;
  const softExpiryMs = expectedEndMs + LIFECYCLE.GRACE_MINUTES * MINUTE;
  /**
   * Never earlier than soft expiry. A genuinely long squad — say five hours —
   * would otherwise be killed by the four-hour ceiling before the grace period
   * it was granted had even elapsed.
   */
  const hardExpiryMs = Math.max(meetingMs + LIFECYCLE.HARD_MAX_HOURS * 60 * MINUTE, softExpiryMs);

  // Arrival first, so a squad that ended the way it was meant to says so,
  // rather than reporting whichever expiry rule happened to also apply.
  const quorum = arrivalQuorum(members);
  if (
    quorum.length >= LIFECYCLE.MIN_ARRIVAL_QUORUM &&
    quorum.every((m) => m.status === 'arrived')
  ) {
    return settled('completed', 'arrival-quorum');
  }

  // The backstop against a phone left in a pocket reporting position forever.
  if (nowMs >= hardExpiryMs) return settled('completed', 'hard-expiry');

  /**
   * Past soft expiry and quiet for long enough.
   *
   * This is what "active navigation extends the squad" means without storing an
   * extension that could itself go stale: a squad still being used keeps
   * failing this test on every read, and so keeps living, until it goes quiet or
   * hits the ceiling above.
   *
   * With no activity ever recorded, the squad has been quiet since the meeting
   * time — that is the honest reading, not a reason to keep it open.
   *
   * Position reports count without needing their own column. `locationAt` is
   * already written on the member row by `recordPosition`, so reading it here
   * gives "somebody is still navigating" for free rather than adding a second
   * write to the hottest path in the squad.
   */
  const newestPositionMs = members.reduce(
    (newest, m) => Math.max(newest, m.locationAt?.getTime() ?? 0),
    0,
  );
  const lastActivityMs = Math.max(squad.lastActivityAt?.getTime() ?? meetingMs, newestPositionMs);
  if (nowMs >= softExpiryMs && nowMs - lastActivityMs >= LIFECYCLE.QUIET_MINUTES * MINUTE) {
    return settled('completed', 'quiet');
  }

  return settled('in_progress', 'meeting-started');
}

/**
 * Whether a squad is live, derived rather than stored.
 *
 * `Squad.isActive` was a second liveness flag beside `status`, and two sources
 * of truth drift the moment one write path updates one and not the other. This
 * is the single definition; the column is kept in step from it on write so the
 * existing discovery index keeps working.
 */
export function isLiveStatus(status: string): boolean {
  return status === 'active' || status === 'in_progress';
}

/** Statuses that still accept new members. Late arrivals may still join. */
export function acceptsJoins(status: string): boolean {
  return isLiveStatus(status);
}

/** Bumps `lastActivityAt`. Never call this from a read path — see the schema note. */
export async function markSquadActivity(squadId: string, at = new Date()): Promise<void> {
  try {
    await prisma.squad.update({ where: { id: squadId }, data: { lastActivityAt: at } });
  } catch {
    // Losing an activity stamp must never fail the action that caused it. The
    // worst case is a squad expiring earlier than it strictly had to.
  }
}

/**
 * Evaluates a squad and persists the transition, at most once.
 *
 * The write is a compare-and-set rather than a blind update. Two instances may
 * evaluate the same squad in the same millisecond and both decide `completed`;
 * guarding the update on the status we read means exactly one of them changes
 * the row. `count === 1` is what earns the right to send the notification —
 * without it, lazy evaluation would reintroduce the duplicate-notification bug
 * that a scheduled job was rejected for.
 *
 * Returns the squad with its effective status, so a caller can pass through the
 * result without re-reading.
 */
export interface SyncOptions {
  /**
   * Whether members are told the squad ended. Default true.
   *
   * Only ever false for the backlog sweep in services/staleSweep.ts, which
   * settles squads whose meeting time passed weeks ago. Those members do not
   * need a push notification now telling them a squad from August has
   * finished — they know. The release itself still happens; it is the
   * announcement that is suppressed, because the announcement is the part that
   * is addressed to a person and the person has moved on.
   */
  notifyMembers?: boolean;
}

export async function syncSquadLifecycle<T extends LifecycleSquad & { id: string }>(
  squad: T,
  now = new Date(),
  options: SyncOptions = {},
): Promise<T> {
  const members = await prisma.squadMember.findMany({
    where: { squadId: squad.id },
    select: { userId: true, status: true, locationAt: true },
  });

  const decision = evaluateLifecycle(squad, members, now);
  if (!decision.changed) return squad;

  const claim = await prisma.squad.updateMany({
    where: { id: squad.id, status: squad.status },
    data: {
      status: decision.status,
      isActive: isLiveStatus(decision.status),
      // Stamped only on the way into a terminal state, and only by the
      // instance that won the claim above — so it is written exactly once.
      // Chat retention measures both its windows from this. See
      // services/squadChatRetention.ts.
      ...(TERMINAL.includes(decision.status) ? { endedAt: now } : {}),
    },
  });

  if (claim.count === 0) {
    // Another instance got there first. Report what is actually stored rather
    // than what this evaluation decided.
    const current = await prisma.squad.findUnique({
      where: { id: squad.id },
      select: { status: true },
    });
    return { ...squad, status: current?.status ?? squad.status };
  }

  if (TERMINAL.includes(decision.status)) {
    await releaseSquad(squad.id, decision.reason, options.notifyMembers ?? true);
  }

  getIO()?.emit('squad:status', { squadId: squad.id, status: decision.status });

  return { ...squad, status: decision.status };
}

/**
 * Ends a squad's live state: members released, positions dropped, everyone told.
 *
 * Mirrors what the leader's own End Squad does, deliberately — a squad that
 * finished by itself and one that was ended by hand must leave the same state
 * behind, or "completed" would mean two different things depending on how it
 * got there. Chat is untouched: the thread and its messages stay as read-only
 * history.
 */
async function releaseSquad(
  squadId: string,
  reason: LifecycleDecision['reason'],
  notifyMembers = true,
): Promise<void> {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    select: { name: true },
  });

  const members = await prisma.squadMember.findMany({
    where: { squadId, status: { in: [...ACTIVE_MEMBER_STATUSES, 'pending'] } },
    select: { userId: true },
  });

  await prisma.squadMember.updateMany({
    where: { squadId },
    data: { status: 'left', lat: null, lng: null, locationAt: null },
  });

  if (notifyMembers) {
    await Promise.all(
      members.map((member) =>
        notify({
          userId: member.userId,
          type: 'squad.joined',
          title: `${squad?.name ?? 'Your squad'} has finished`,
          body:
            reason === 'arrival-quorum'
              ? 'Everyone made it to the meeting point.'
              : 'Thanks for travelling together.',
          href: '/squads',
          data: { squadId },
        }),
      ),
    );
  }

  getIO()?.to(`squad:${squadId}`).emit('squad:members-changed', { squadId });
}

import prisma from '../utils/prisma.js';

/**
 * What happens to a squad's conversation after the trip is over.
 *
 * Three states, in order:
 *
 *   open    — the squad is live, or ended less than LOCK_HOURS ago. Read and
 *             write as normal. People still settle up and say goodbye after
 *             arriving, so chat does not stop the moment the squad closes.
 *   locked  — ended more than LOCK_HOURS ago. The thread still appears in the
 *             list, showing who you travelled with, but it cannot be opened
 *             and nothing can be sent. The conversation is over.
 *   erased  — ended more than ERASE_DAYS ago. The messages are deleted.
 *
 * The gap between locked and erased is deliberate. Locking is instant and
 * reversible; deletion is neither. Keeping the messages for a few days after
 * they stop being readable is what makes a harassment report actionable — the
 * person reporting it has lost access, but the moderator has not. After that
 * the content is gone for good.
 *
 * ## Anchored on endedAt, never on updatedAt
 *
 * `Squad.endedAt` is written once, on the transition into a terminal state.
 * `updatedAt` moves whenever anything touches the row, so a squad modified by
 * a cleanup pass would look freshly ended and quietly restart both windows.
 *
 * A squad that ended before `endedAt` existed reads null. Those are treated as
 * open rather than erased: retroactively deleting conversations because a
 * column was added later would be an unpleasant surprise, and the number of
 * such squads only shrinks.
 */
export const CHAT_RETENTION = {
  /** Chat stays usable this long after the squad ends. */
  LOCK_HOURS: 6,
  /** Messages are destroyed this long after the squad ends. */
  ERASE_DAYS: 4,
} as const;

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ChatAccess = 'open' | 'locked' | 'erased';

export interface RetentionSquad {
  status: string;
  endedAt: Date | null;
  /**
   * Fallback anchors, for squads that reached a terminal state before
   * `endedAt` existed. See `inferEndedAt`.
   */
  meetingAt?: Date | null;
  durationMinutes?: number | null;
  updatedAt?: Date | null;
}

const TERMINAL: readonly string[] = ['completed', 'cancelled'];

/** Assumed length of a squad that never said, mirroring the lifecycle default. */
const ASSUMED_DURATION_MINUTES = 45;

/**
 * When a terminal squad most likely ended, for rows written before `endedAt`.
 *
 * The first version of this module treated a null `endedAt` as "leave it
 * alone", reasoning that retroactively closing conversations because a column
 * was added later would be an unpleasant surprise. In practice that was the
 * wrong call: *every* squad that existed before the column was terminal with a
 * null anchor, so the retention rule applied to nothing at all. Month-old
 * cancelled squads kept fully usable chats, which is the exact situation the
 * rule was written to prevent.
 *
 * So a terminal squad without an explicit end is dated from the best evidence
 * on the row instead:
 *
 *   - `meetingAt` plus its duration, which is when the trip was expected to be
 *     over — the same arithmetic the lifecycle uses to expire a squad;
 *   - failing that, `updatedAt`. For a cancelled squad the last write is
 *     usually the cancellation itself, which is close enough for a window
 *     measured in hours and days.
 *
 * Returns null only when there is genuinely nothing to measure from, and such
 * a squad stays open — inventing an end date from no evidence would be worse
 * than leaving one conversation readable.
 */
export function inferEndedAt(squad: RetentionSquad): Date | null {
  if (squad.endedAt) return squad.endedAt;
  if (!TERMINAL.includes(squad.status)) return null;

  if (squad.meetingAt) {
    const minutes = squad.durationMinutes ?? ASSUMED_DURATION_MINUTES;
    return new Date(squad.meetingAt.getTime() + minutes * 60_000);
  }

  return squad.updatedAt ?? null;
}

/**
 * The one definition of what a viewer may do with a squad conversation.
 *
 * Pure, so the rule can be tested without a database and cannot drift between
 * the list endpoint, the message endpoint and the send endpoint — which is
 * exactly how "read-only" surfaces usually end up still accepting writes.
 */
export function chatAccess(squad: RetentionSquad, now: Date = new Date()): ChatAccess {
  // Live squads are always open, whatever endedAt happens to hold.
  if (!TERMINAL.includes(squad.status)) return 'open';

  // Explicit end if we have one, inferred from the row if we do not.
  const endedAt = inferEndedAt(squad);
  if (!endedAt) return 'open';

  const since = now.getTime() - endedAt.getTime();
  if (since >= CHAT_RETENTION.ERASE_DAYS * DAY_MS) return 'erased';
  if (since >= CHAT_RETENTION.LOCK_HOURS * HOUR_MS) return 'locked';
  return 'open';
}

/** True when the viewer may read the messages and post new ones. */
export function isChatOpen(squad: RetentionSquad, now: Date = new Date()): boolean {
  return chatAccess(squad, now) === 'open';
}

/** The moment before which an ended squad's messages must no longer exist. */
export function eraseCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - CHAT_RETENTION.ERASE_DAYS * DAY_MS);
}

/**
 * Permanently deletes the messages of squads that ended long enough ago.
 *
 * The thread row itself is kept on purpose: it is what still shows a person who
 * they travelled with. Only the contents go.
 *
 * Bounded by `limit` so one call cannot turn into an unbounded delete against
 * the largest collection in the database. It reports how much it did, and the
 * caller can decide whether to come back for more.
 *
 * Safe to run concurrently. Two instances racing will both try to delete the
 * same messages and one will simply find none left; `deleteMany` on an already
 * empty set is not an error.
 */
/**
 * Writes an inferred `endedAt` onto terminal squads that never got one.
 *
 * Reads already infer the anchor, so this is not what makes the rule correct —
 * it is what lets the *sweep* find these rows at all. `deleteMany` filters in
 * the database, and a where clause cannot run `inferEndedAt`; without the
 * backfill, every squad that ended before the column existed would stay
 * unreachable by the erase pass forever, locked to users but never cleaned up.
 *
 * Writing it down once also freezes the anchor. An inferred value recomputed
 * from `updatedAt` on every read would move each time anything touched the row,
 * which is precisely the drift `endedAt` exists to avoid.
 *
 * Bounded, and safe to run repeatedly: it only ever fills nulls.
 */
export async function backfillEndedAt(limit = 200): Promise<number> {
  const missing = await prisma.squad.findMany({
    where: { status: { in: [...TERMINAL] }, endedAt: null },
    select: { id: true, status: true, endedAt: true, meetingAt: true, durationMinutes: true, updatedAt: true },
    take: limit,
  });

  let filled = 0;
  for (const squad of missing) {
    const inferred = inferEndedAt(squad);
    if (!inferred) continue;
    // Guarded on endedAt still being null so two instances racing cannot
    // overwrite each other with slightly different inferences.
    const { count } = await prisma.squad.updateMany({
      where: { id: squad.id, endedAt: null },
      data: { endedAt: inferred },
    });
    filled += count;
  }

  if (filled > 0) console.log(`[chat retention] backfilled endedAt on ${filled} squads`);
  return filled;
}

export async function sweepErasedChats(
  now: Date = new Date(),
  limit = 50,
): Promise<{ squads: number; messages: number }> {
  // Squads terminal before endedAt existed are invisible to the query below
  // until they have an anchor. Fill them first.
  await backfillEndedAt();

  const due = await prisma.squad.findMany({
    where: {
      status: { in: [...TERMINAL] },
      endedAt: { not: null, lt: eraseCutoff(now) },
    },
    select: { id: true },
    take: limit,
  });

  if (due.length === 0) return { squads: 0, messages: 0 };

  const threads = await prisma.chatThread.findMany({
    where: { contextType: 'squad', contextId: { in: due.map((s) => s.id) } },
    select: { id: true },
  });

  if (threads.length === 0) return { squads: due.length, messages: 0 };

  const { count } = await prisma.threadMessage.deleteMany({
    where: { threadId: { in: threads.map((t) => t.id) } },
  });

  return { squads: due.length, messages: count };
}

/**
 * Runs the erase sweep occasionally, from whatever request happens to be
 * passing.
 *
 * Same constraint as the rest of this codebase: Cloud Run scales to zero and
 * runs several instances, so a timer is not available — see
 * services/squadLifecycle.ts. Attaching the sweep to a read means it happens
 * while the app is in use, which is when it matters.
 *
 * Throttled per instance so it is not attempted on every request, and never
 * awaited: a retention sweep must not put latency on a user's screen, and its
 * failure must not fail their request. Anything it misses this pass is still
 * due on the next one, and the messages are already unreachable either way.
 *
 * This is best-effort by construction. An app nobody opens sweeps nothing. If
 * the erase needs to be a guarantee rather than a strong tendency — and for a
 * deletion promise it eventually should — the honest answer is Cloud Scheduler
 * calling an endpoint on a fixed cadence, not this.
 */
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

export function sweepErasedChatsInBackground(now: Date = new Date()): void {
  if (now.getTime() - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now.getTime();

  void sweepErasedChats(now)
    .then(({ squads, messages }) => {
      if (messages > 0) {
        console.log(`[chat retention] erased ${messages} messages from ${squads} ended squads`);
      }
    })
    .catch((error) => {
      // Reset so a failure does not cost a full interval of not trying.
      lastSweepAt = 0;
      console.error('[chat retention] sweep failed', error);
    });
}

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
}

const TERMINAL: readonly string[] = ['completed', 'cancelled'];

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
  // Ended before the column existed. Nothing to measure from, so leave it be.
  if (!squad.endedAt) return 'open';

  const since = now.getTime() - squad.endedAt.getTime();
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
export async function sweepErasedChats(
  now: Date = new Date(),
  limit = 50,
): Promise<{ squads: number; messages: number }> {
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

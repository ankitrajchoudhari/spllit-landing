import prisma from '../utils/prisma.js';

/**
 * Recording that a user was here today.
 *
 * This is called from the authentication middleware, which runs on every
 * authenticated request in Spllit. Two consequences shape everything below:
 *
 * 1. It is the hottest path in the application, so it must not add a database
 *    write per request. An in-memory set collapses a user's whole day of
 *    traffic into a single upsert.
 * 2. It must never fail a request. A user's ride cannot 500 because an
 *    analytics row would not write.
 */

/** `<userId>:<day>` for everyone already recorded today, in this process. */
const marked = new Set<string>();

/** The day `marked` refers to. When this changes, the set is stale. */
let markedDay = '';

/** UTC day key, matching MetricRollup and ActiveUserDay. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records that `userId` was active today, at most once per process per day.
 *
 * The cache is per-container, not global. Several containers each write the
 * same user once, which is exactly why `ActiveUserDay.id` is
 * `<userId>:<day>` — the upsert collapses those duplicates at the database
 * rather than trusting any one process to have seen everything.
 *
 * Fire-and-forget. Callers must not await it.
 */
export function markActive(userId: string | null | undefined): void {
  if (!userId) return;

  const day = today();

  // Midnight rolled over. Dropping the whole set is right: every key in it
  // refers to yesterday, and keeping them would suppress today's first write
  // for every user still online.
  if (day !== markedDay) {
    marked.clear();
    markedDay = day;
  }

  const key = `${userId}:${day}`;
  if (marked.has(key)) return;

  // Added before the write, not after. Two concurrent requests would otherwise
  // both find it absent and both issue an upsert.
  marked.add(key);

  void (async () => {
    try {
      await prisma.activeUserDay.upsert({
        where: { id: key },
        create: { id: key, userId, day },
        // Nothing to change — the row existing *is* the fact being recorded.
        update: {},
      });
    } catch (error) {
      // Dropped from the cache so a transient failure can be retried by this
      // user's next request rather than being lost for the rest of the day.
      marked.delete(key);
      console.error('[activeUsers/markActive]', error);
    }
  })();
}

/** Test seam: forgets what this process has recorded. */
export function resetActiveCache(): void {
  marked.clear();
  markedDay = '';
}

/** How many users this process has recorded today. Reported on system health. */
export function markedTodayCount(): number {
  return markedDay === today() ? marked.size : 0;
}

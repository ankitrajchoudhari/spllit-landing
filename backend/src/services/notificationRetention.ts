import prisma from '../utils/prisma.js';

/**
 * A notification is kept for a short while after it has been seen, then goes.
 *
 * The inbox is a queue of things that still need attention, not an archive.
 * Everything a notification points at — the squad, the ride, the message — is
 * still reachable from the app itself once the notification has done its job,
 * so keeping read rows forever only buries the unread ones underneath them.
 *
 * Deliberately anchored on `readAt`, not `createdAt`: an unread notification is
 * never removed no matter how old, because nobody has dealt with it yet.
 *
 * ## Why this is not a scheduled job
 *
 * Same constraint as services/squadLifecycle.ts. The API runs on Cloud Run: it
 * scales to zero, so a timer armed for two hours from now never fires if no
 * request arrives, and it runs several instances, so each would run the same
 * sweep concurrently. So the rule is applied two ways, and neither is a clock:
 *
 *   - `unexpiredWhere` hides expired rows on read, which makes the rule true
 *     from the user's point of view the instant it applies, regardless of
 *     whether anything has been deleted yet;
 *   - `sweepRead` actually removes them, run opportunistically when the owner
 *     next reads their own notifications.
 *
 * The consequence worth stating plainly: somebody who stops opening the app
 * leaves read rows in the collection indefinitely. They are invisible either
 * way, and this costs storage rather than correctness. If that storage ever
 * matters, the fix is Cloud Scheduler calling a sweep endpoint — not a timer
 * inside a process that is about to be shut down.
 */
export const READ_RETENTION_HOURS = 2;

/** The moment before which a read notification is no longer offered. */
export function readCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - READ_RETENTION_HOURS * 3600 * 1000);
}

/**
 * `where` fragment matching the notifications a user should still be shown.
 *
 * Unread rows always pass. Read rows pass only while inside the window.
 */
export function unexpiredWhere(now: Date = new Date()) {
  return {
    OR: [{ readAt: null }, { readAt: { gte: readCutoff(now) } }],
  };
}

/**
 * Deletes this user's read-and-expired notifications.
 *
 * Scoped to one user rather than the whole collection: it is called on a read
 * path, so it must stay proportional to what that request already touches.
 * `@@index([userId, readAt])` serves this exactly.
 *
 * Never throws. A failed cleanup must not turn into a failed inbox — the rows
 * it would have removed are hidden by `unexpiredWhere` regardless, so the user
 * sees the correct list either way and the next read tries again.
 */
export async function sweepRead(userId: string, now: Date = new Date()): Promise<number> {
  try {
    const { count } = await prisma.notification.deleteMany({
      where: { userId, readAt: { not: null, lt: readCutoff(now) } },
    });
    return count;
  } catch (error) {
    console.error('[notifications] retention sweep failed', error);
    return 0;
  }
}

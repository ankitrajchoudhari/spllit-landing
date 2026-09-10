import prisma from '../utils/prisma.js';
import { emitToAdmins } from './adminSocket.js';

/**
 * The console's event layer.
 *
 * One domain write produces three things here: a lifetime counter increment, a
 * daily rollup increment, and a line on the activity feed — then a fan-out to
 * whichever admins are connected.
 *
 * The rule that shapes every function below: **this must never fail the action
 * that triggered it.** A signup that succeeded and then threw because a metrics
 * counter was unreachable is strictly worse than a metric that is briefly
 * wrong. Everything is wrapped, nothing is awaited by the caller, and errors go
 * to stderr rather than upward.
 */

/** Event names, matching the catalogue in docs/ADMIN-CONSOLE.md. */
export const ADMIN_EVENTS = [
  'USER_CREATED',
  'USER_SUSPENDED',
  'USER_RESTORED',
  'RIDE_CREATED',
  'MATCH_CREATED',
  'SQUAD_CREATED',
  'SQUAD_MEMBER_JOINED',
  'EVENT_CREATED',
  'EVENT_CANCELLED',
  'COMMUNITY_CREATED',
  'MESSAGE_SENT',
  'NOTIFICATION_SENT',
  'EMERGENCY_RAISED',
  'ADMIN_ACTION',
] as const;

export type AdminEventType = (typeof ADMIN_EVENTS)[number];

/** The metric key each event increments. */
export const METRIC_FOR: Record<AdminEventType, string> = {
  USER_CREATED: 'user.created',
  USER_SUSPENDED: 'user.suspended',
  USER_RESTORED: 'user.restored',
  RIDE_CREATED: 'ride.created',
  MATCH_CREATED: 'match.created',
  SQUAD_CREATED: 'squad.created',
  SQUAD_MEMBER_JOINED: 'squad.member_joined',
  EVENT_CREATED: 'event.created',
  EVENT_CANCELLED: 'event.cancelled',
  COMMUNITY_CREATED: 'community.created',
  MESSAGE_SENT: 'message.sent',
  NOTIFICATION_SENT: 'notification.sent',
  EMERGENCY_RAISED: 'emergency.raised',
  ADMIN_ACTION: 'admin.action',
};

/**
 * Events too frequent to put on the feed.
 *
 * Chat messages and notifications are counted but never listed. At any real
 * volume they would push everything else off the feed within seconds, which
 * turns a page meant to show what is happening into a chat log nobody can read.
 */
const NOT_ON_FEED = new Set<AdminEventType>(['MESSAGE_SENT', 'NOTIFICATION_SENT']);

export interface AdminEventInput {
  type: AdminEventType;
  title: string;
  subtitle?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
  severity?: 'info' | 'warning' | 'danger';
}

/** UTC day key. Local time would double-count across a zone change. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * How many feed rows to keep, and how often to check.
 *
 * Pruning on a fraction of writes rather than every one: the feed only needs to
 * stay roughly bounded, and running a delete on every signup would cost more
 * than the rows save. At 2% and a 500-row ceiling the collection settles a
 * little above the ceiling and never grows without limit.
 */
const FEED_LIMIT = 500;
const PRUNE_CHANCE = 0.02;

async function prune(): Promise<void> {
  const cutoff = await prisma.activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    skip: FEED_LIMIT,
    take: 1,
    select: { createdAt: true },
  });

  const oldest = cutoff[0]?.createdAt;
  if (!oldest) return;

  await prisma.activityEvent.deleteMany({ where: { createdAt: { lt: oldest } } });
}

/**
 * Records one event and tells the console about it.
 *
 * Fire-and-forget by design — see the header. Callers must not await this, and
 * nothing in here is allowed to reject.
 */
export function publish(input: AdminEventInput): void {
  const metric = METRIC_FOR[input.type];
  const day = today();
  const at = new Date();

  /**
   * Emitted before the writes, not after.
   *
   * The socket message is what makes the console feel live, and it does not
   * depend on the counter write having landed. Waiting would add a database
   * round trip to the one path where latency is the entire point.
   */
  emitToAdmins('activity', {
    type: input.type,
    metric,
    title: input.title,
    subtitle: input.subtitle ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    href: input.href ?? null,
    severity: input.severity ?? 'info',
    createdAt: at.toISOString(),
  });

  void (async () => {
    try {
      await Promise.all([
        // Atomic increments, so two concurrent signups cannot read the same
        // value and both write n+1.
        prisma.metricCounter.upsert({
          where: { key: metric },
          create: { key: metric, value: 1 },
          update: { value: { increment: 1 } },
        }),
        prisma.metricRollup.upsert({
          where: { id: `${metric}:${day}` },
          create: { id: `${metric}:${day}`, metric, day, count: 1 },
          update: { count: { increment: 1 } },
        }),
        NOT_ON_FEED.has(input.type)
          ? Promise.resolve(null)
          : prisma.activityEvent.create({
              data: {
                type: input.type,
                title: input.title,
                subtitle: input.subtitle ?? null,
                entityType: input.entityType ?? null,
                entityId: input.entityId ?? null,
                href: input.href ?? null,
                severity: input.severity ?? 'info',
                createdAt: at,
              },
            }),
      ]);

      if (Math.random() < PRUNE_CHANCE) await prune();
    } catch (error) {
      console.error('[adminEvents/publish]', input.type, error);
    }
  })();
}

/**
 * Every lifetime counter, as a plain object.
 *
 * One query for all of them. Missing keys are simply absent rather than zero,
 * so a caller can tell "nothing has happened yet" from "this metric is not
 * being recorded", which matters while rollups are still filling.
 */
export async function readCounters(): Promise<Record<string, number>> {
  const rows = await prisma.metricCounter.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/**
 * Daily counts for one metric over a window, zero-filled.
 *
 * Zero-filling here rather than in the client: a gap in the data and a day with
 * no activity are different things, and only this layer knows which days were
 * actually requested.
 */
export async function readSeries(
  metric: string,
  days: number,
): Promise<{ date: string; count: number }[]> {
  const now = Date.now();
  const buckets = new Map<string, number>();

  for (let i = days - 1; i >= 0; i -= 1) {
    buckets.set(new Date(now - i * 86_400_000).toISOString().slice(0, 10), 0);
  }

  const rows = await prisma.metricRollup.findMany({
    where: { metric, day: { in: [...buckets.keys()] } },
    select: { day: true, count: true },
  });

  for (const row of rows) buckets.set(row.day, row.count);

  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

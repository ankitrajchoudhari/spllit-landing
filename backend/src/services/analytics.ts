import prisma from '../utils/prisma.js';
import { distinctCount, distinctUsersAcross } from './distinctCount.js';

/**
 * Founder analytics, computed from `ActiveUserDay` and the existing models.
 *
 * A note on cost, because it is the thing that decides whether any of this
 * survives growth. Every figure here is bounded by the number of *active*
 * users in the window, never by the size of the User collection — a distinct
 * count over a 30-day window touches one row per active user per day and
 * nothing else. That is affordable at Spllit's scale and stays affordable as
 * signups grow, because a user who never returns costs nothing to ignore.
 *
 * What that trades away is stated plainly rather than hidden: these are read
 * on demand, not pre-aggregated. If MAU ever takes long enough to notice, the
 * fix is a nightly rollup of the distinct counts, not an index.
 */

const DAY_MS = 86_400_000;

/** UTC day key, matching ActiveUserDay and MetricRollup. */
function dayKey(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** The last `count` UTC day keys, oldest first. */
function lastDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => dayKey(count - 1 - i));
}

/**
 * Distinct users active across a set of days.
 *
 * `groupBy` rather than a count: there is one row per user per day, so the
 * number of groups *is* the distinct user count. The result set is bounded by
 * the answer itself — asking for MAU returns exactly MAU rows.
 */
async function distinctActive(days: string[]): Promise<number> {
  if (days.length === 0) return 0;

  const groups = await prisma.activeUserDay.groupBy({
    by: ['userId'],
    where: { day: { in: days } },
  });

  return groups.length;
}

export interface ActiveUsers {
  dau: number;
  wau: number;
  mau: number;
  /** DAU per day, oldest first. */
  series: { date: string; count: number }[];
  /**
   * Ratio of DAU to MAU, the usual "stickiness" figure — how much of a
   * month's audience shows up on an average day. Null when MAU is zero rather
   * than a division by zero rendered as NaN in the UI.
   */
  stickiness: number | null;
}

export async function activeUsers(seriesDays = 30): Promise<ActiveUsers> {
  const window = lastDays(Math.min(Math.max(seriesDays, 1), 90));

  const [dau, wau, mau, rows] = await Promise.all([
    distinctActive([dayKey(0)]),
    distinctActive(lastDays(7)),
    distinctActive(lastDays(30)),
    prisma.activeUserDay.groupBy({
      by: ['day'],
      where: { day: { in: window } },
      _count: { _all: true },
    }),
  ]);

  // One row per user per day means the per-day count is already distinct.
  const byDay = new Map(rows.map((row) => [row.day, row._count._all]));

  return {
    dau,
    wau,
    mau,
    series: window.map((date) => ({ date, count: byDay.get(date) ?? 0 })),
    stickiness: mau > 0 ? Math.round((dau / mau) * 1000) / 10 : null,
  };
}

export interface RetentionRow {
  /** The signup day this cohort is keyed on. */
  cohort: string;
  size: number;
  /** Share of the cohort seen on or after each offset, as a percentage. */
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/**
 * Retention by signup-day cohort.
 *
 * "Retained on day N" means active on that specific day, not merely active at
 * some point since. The looser definition only ever goes up with time and so
 * flatters every cohort; this one answers whether people actually came back.
 *
 * A cohort too young to have reached day N reports null rather than zero — a
 * cohort that signed up yesterday has not failed its D7, it simply has no D7
 * yet, and rendering that as 0% would make every recent cohort look like a
 * catastrophe.
 */
export async function retention(cohortCount = 14): Promise<RetentionRow[]> {
  const cohorts = lastDays(Math.min(Math.max(cohortCount, 1), 30));
  const earliest = new Date(`${cohorts[0]}T00:00:00.000Z`);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: earliest } },
    select: { id: true, createdAt: true },
  });

  // Cohort membership, keyed by signup day.
  const membership = new Map<string, string[]>();
  for (const user of users) {
    const day = user.createdAt.toISOString().slice(0, 10);
    if (!membership.has(day)) membership.set(day, []);
    membership.get(day)!.push(user.id);
  }

  const cohortUserIds = [...membership.values()].flat();
  if (cohortUserIds.length === 0) {
    return cohorts.map((cohort) => ({ cohort, size: 0, d1: null, d7: null, d30: null }));
  }

  // Every activity day for everyone in any of these cohorts, in one query.
  const activity = await prisma.activeUserDay.findMany({
    where: { userId: { in: cohortUserIds } },
    select: { userId: true, day: true },
  });

  const activeDays = new Map<string, Set<string>>();
  for (const row of activity) {
    if (!activeDays.has(row.userId)) activeDays.set(row.userId, new Set());
    activeDays.get(row.userId)!.add(row.day);
  }

  const todayKey = dayKey(0);

  function rate(cohort: string, ids: string[], offset: number): number | null {
    const target = new Date(new Date(`${cohort}T00:00:00.000Z`).getTime() + offset * DAY_MS)
      .toISOString()
      .slice(0, 10);

    // Not yet reachable — see the note above about null versus zero.
    if (target > todayKey) return null;
    if (ids.length === 0) return null;

    const returned = ids.filter((id) => activeDays.get(id)?.has(target)).length;
    return Math.round((returned / ids.length) * 1000) / 10;
  }

  return cohorts.map((cohort) => {
    const ids = membership.get(cohort) ?? [];
    return {
      cohort,
      size: ids.length,
      d1: rate(cohort, ids, 1),
      d7: rate(cohort, ids, 7),
      d30: rate(cohort, ids, 30),
    };
  });
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Share of the first step. */
  share: number;
  note?: string;
}

/**
 * The activation funnel: signed up → finished onboarding → did something.
 *
 * Each step counts *distinct users who reached it*, not events — a user with
 * nine rides is one person who reached "created a ride", and counting rides
 * here would make the funnel widen at the bottom.
 *
 * The later steps use `distinct` on the owning field rather than a join,
 * because Ride, Squad and Event hold a bare `userId` with no Prisma relation
 * to User on MongoDB.
 */
export async function activationFunnel(): Promise<FunnelStep[]> {
  /**
   * Every figure is counted in the database.
   *
   * These were `findMany({ distinct })` calls, which on MongoDB deduplicate in
   * Prisma's query engine — meaning the whole collection is fetched and then
   * reduced to a number. See services/distinctCount.ts.
   */
  const [signedUp, onboarded, riders, squadMembers, participants] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { onboarded: true } }),
    distinctCount('Ride', 'userId'),
    distinctCount('SquadMember', 'userId'),
    // "Did something" is the union, not the sum: one person who both hosted a
    // ride and joined a squad must count once. The union happens in Mongo.
    distinctUsersAcross([
      { collection: 'Ride', field: 'userId' },
      { collection: 'Squad', field: 'leaderId' },
      { collection: 'Event', field: 'hostId' },
      { collection: 'SquadMember', field: 'userId' },
    ]),
  ]);

  const share = (value: number) => (signedUp > 0 ? Math.round((value / signedUp) * 1000) / 10 : 0);

  return [
    { key: 'signed_up', label: 'Signed up', count: signedUp, share: 100 },
    {
      key: 'onboarded',
      label: 'Finished onboarding',
      count: onboarded,
      share: share(onboarded),
      note: 'Username and college set.',
    },
    {
      key: 'participated',
      label: 'Did something',
      count: participants,
      share: share(participants),
      note: 'Created a ride, led or joined a squad, or hosted an event.',
    },
    { key: 'created_ride', label: 'Created a ride', count: riders, share: share(riders) },
    { key: 'joined_squad', label: 'Joined a squad', count: squadMembers, share: share(squadMembers) },
  ];
}

export interface AdoptionRow {
  feature: string;
  users: number;
  share: number;
}

/**
 * How many people have ever used each feature.
 *
 * Lifetime reach rather than recent usage, and labelled that way in the UI: a
 * feature shipped last week and one retired last year both read as "used" here,
 * and only the time series can tell them apart.
 */
export async function featureAdoption(): Promise<{ total: number; rows: AdoptionRow[] }> {
  /**
   * Counted in the database, for the same reason as the funnel above.
   *
   * `Chat` was the worst of these: ThreadMessage is the highest-volume
   * collection in Spllit, and asking Prisma for distinct senders read every
   * message ever sent in order to return one integer.
   */
  const [total, rides, squads, events, communities, messages] = await Promise.all([
    prisma.user.count(),
    distinctCount('Ride', 'userId'),
    distinctCount('SquadMember', 'userId'),
    distinctCount('EventAttendee', 'userId'),
    distinctCount('CommunityMember', 'userId'),
    distinctCount('ThreadMessage', 'senderId'),
  ]);

  const share = (value: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

  const rows: AdoptionRow[] = [
    { feature: 'Rides', users: rides, share: share(rides) },
    { feature: 'Squads', users: squads, share: share(squads) },
    { feature: 'Events', users: events, share: share(events) },
    { feature: 'Communities', users: communities, share: share(communities) },
    { feature: 'Chat', users: messages, share: share(messages) },
  ];

  return { total, rows: rows.sort((a, b) => b.users - a.users) };
}

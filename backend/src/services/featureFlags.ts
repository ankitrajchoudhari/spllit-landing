import { createHash } from 'crypto';

import prisma from '../utils/prisma.js';

/**
 * Runtime feature flags.
 *
 * The console can already edit these; this is what makes editing them mean
 * something. Two properties matter more than the storage:
 *
 * 1. **Evaluation is stable.** A user inside a 20% rollout stays inside it on
 *    every subsequent request. A random draw per call would flicker people
 *    between variants mid-session, which is worse than not having the rollout.
 * 2. **Reads are cached.** A flag check that costs a database round trip is one
 *    nobody can afford to put on a hot path, and a flag nobody puts on a hot
 *    path is not a feature flag.
 */

export interface FlagState {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUserIds: string[];
  environments: string[];
}

/** Cached flag table, refreshed on a short interval rather than per call. */
let cache: Map<string, FlagState> | null = null;
let cachedAt = 0;

/**
 * How long a flag change takes to reach the fleet.
 *
 * Thirty seconds is the deliberate trade: short enough that turning something
 * off during an incident feels immediate, long enough that the flag table is
 * not read on every request. A toggle is not an emergency stop — a genuinely
 * urgent shutdown is a deploy or a kill switch, not a cached lookup.
 */
const CACHE_MS = 30_000;

async function load(): Promise<Map<string, FlagState>> {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  try {
    const rows = await prisma.featureFlag.findMany();
    cache = new Map(
      rows.map((row) => [
        row.key,
        {
          key: row.key,
          enabled: row.enabled,
          rolloutPercentage: row.rolloutPercentage,
          targetUserIds: row.targetUserIds,
          environments: row.environments,
        },
      ]),
    );
    cachedAt = Date.now();
  } catch (error) {
    // Serve the stale table rather than failing the caller. A flag lookup that
    // throws would take down whatever it was gating, which is the opposite of
    // what a flag is for.
    console.error('[featureFlags/load]', error);
    if (!cache) cache = new Map();
  }

  return cache;
}

/** Drops the cache so the next read is fresh. Called after a console edit. */
export function invalidateFlagCache(): void {
  cache = null;
  cachedAt = 0;
}

/**
 * Stable bucket for a user, 0–99.
 *
 * A hash of the flag key *and* the user id, not the user id alone — otherwise
 * every 20% rollout on the platform would contain the same 20% of people, and
 * an unlucky cohort would receive every experiment at once.
 */
export function bucketFor(key: string, userId: string): number {
  const digest = createHash('sha1').update(`${key}:${userId}`).digest();
  // Two bytes is ample resolution for a percentage and avoids the sign issues
  // of reading a 32-bit integer out of a Buffer.
  return digest.readUInt16BE(0) % 100;
}

/**
 * Whether a flag is on for a given user.
 *
 * `enabled: false` means off for everyone, including targeted users — off is
 * off, and a rollout percentage on a disabled flag is not a partial state.
 */
export function evaluate(
  flag: FlagState | undefined,
  userId: string | null | undefined,
  environment: string,
): boolean {
  if (!flag) return false;
  if (!flag.enabled) return false;

  // An empty list means every environment, so this only narrows when set.
  if (flag.environments.length > 0 && !flag.environments.includes(environment)) return false;

  // Explicit targets bypass the percentage — that is what makes it possible to
  // put yourself inside a 1% rollout to check it before widening it.
  if (userId && flag.targetUserIds.includes(userId)) return true;

  if (flag.rolloutPercentage >= 100) return true;
  if (flag.rolloutPercentage <= 0) return false;

  // An anonymous caller cannot be bucketed stably, so a partial rollout is off
  // for them rather than a coin flip on every request.
  if (!userId) return false;

  return bucketFor(flag.key, userId) < flag.rolloutPercentage;
}

const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

/** Is this flag on for this user? Cached; never throws. */
export async function isEnabled(key: string, userId?: string | null): Promise<boolean> {
  const flags = await load();
  return evaluate(flags.get(key), userId, ENVIRONMENT);
}

/** Every flag resolved for one user — what a client fetches on startup. */
export async function resolveAll(userId?: string | null): Promise<Record<string, boolean>> {
  const flags = await load();
  const out: Record<string, boolean> = {};
  for (const [key, flag] of flags) out[key] = evaluate(flag, userId, ENVIRONMENT);
  return out;
}

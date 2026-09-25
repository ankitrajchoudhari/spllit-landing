import prisma from '../utils/prisma.js';

/**
 * Which accounts are suspended, answered without a query per request.
 *
 * Suspension used to be `isActive = false`, and nothing that authenticates a
 * request ever read it — a suspended user kept full access, and /auth/refresh
 * kept issuing them tokens. The backend-JWT path in identify is deliberately
 * DB-free (it is the hottest path in the app), so checking a row there would
 * add a round trip to every request. Instead the suspended ids — a handful —
 * are held in memory and re-read at most every CACHE_MS.
 *
 * Exact on this instance: the suspend routes call invalidateSuspensions(), and
 * Cloud Run runs one instance (DEPLOY.md). Refreshed on read, never on a timer,
 * because CPU is throttled between requests.
 */

const CACHE_MS = 30_000;

let cache: Set<string> | null = null;
let cachedAt = 0;

async function suspendedIds(): Promise<Set<string>> {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
  try {
    const rows = await prisma.user.findMany({
      where: { suspendedAt: { not: null } },
      select: { id: true },
    });
    cache = new Set(rows.map((r) => r.id));
    cachedAt = Date.now();
  } catch (error) {
    // Keep the last known set rather than letting everyone through, or
    // locking everyone out, because the database blinked.
    console.error('[suspension/load]', error);
    if (!cache) cache = new Set();
  }
  return cache;
}

export async function isSuspended(userId: string): Promise<boolean> {
  return (await suspendedIds()).has(userId);
}

export function invalidateSuspensions(): void {
  cache = null;
  cachedAt = 0;
}

/** The write for suspending or restoring, so every route sets both fields. */
export function suspensionPatch(isActive: boolean): { isActive: boolean; suspendedAt: Date | null } {
  return { isActive, suspendedAt: isActive ? null : new Date() };
}

export const SUSPENDED_MESSAGE = 'This account has been suspended.';

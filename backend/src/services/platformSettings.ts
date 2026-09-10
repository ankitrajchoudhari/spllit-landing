import prisma from '../utils/prisma.js';

/**
 * Platform settings, read by the code they configure.
 *
 * This is what stops the Settings page being decorative. A setting nobody reads
 * is a row in a table pretending to be a control, and the console would be
 * showing an admin a switch that does nothing.
 *
 * Every getter takes a fallback and returns it on any failure — a missing row,
 * a wrong type, an unreachable database. A setting that cannot be read must
 * degrade to the built-in default rather than taking down the feature it was
 * meant to tune.
 */

let cache: Map<string, unknown> | null = null;
let cachedAt = 0;

/** Same interval as feature flags, for the same reasons. */
const CACHE_MS = 30_000;

async function load(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  try {
    const rows = await prisma.platformSetting.findMany({ select: { key: true, value: true } });
    cache = new Map(rows.map((row) => [row.key, row.value]));
    cachedAt = Date.now();
  } catch (error) {
    console.error('[platformSettings/load]', error);
    if (!cache) cache = new Map();
  }

  return cache;
}

/** Drops the cache so the next read is fresh. Called after a console edit. */
export function invalidateSettingsCache(): void {
  cache = null;
  cachedAt = 0;
}

export async function getNumber(key: string, fallback: number): Promise<number> {
  const value = (await load()).get(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export async function getBoolean(key: string, fallback: boolean): Promise<boolean> {
  const value = (await load()).get(key);
  return typeof value === 'boolean' ? value : fallback;
}

export async function getString(key: string, fallback: string): Promise<string> {
  const value = (await load()).get(key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * A number constrained to a range.
 *
 * The clamp is the point: these are edited from a web form by a person, and a
 * mistyped broadcast cap of 5000000 must not become the number the send loop
 * actually uses. The bounds live in code beside the thing being limited, where
 * an admin cannot edit them.
 */
export async function getBounded(
  key: string,
  fallback: number,
  min: number,
  max: number,
): Promise<number> {
  const value = await getNumber(key, fallback);
  return Math.min(Math.max(Math.round(value), min), max);
}

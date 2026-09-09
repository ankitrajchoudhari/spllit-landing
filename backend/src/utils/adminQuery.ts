/**
 * Shared query helpers for the admin console routes.
 *
 * Extracted so that pagination, sorting and search behave identically on every
 * list endpoint. The alternative — each handler parsing `req.query` its own way
 * — is how one table quietly ends up with no upper bound on `limit` and becomes
 * the endpoint that can pull the whole collection into memory.
 */

/** Page size, clamped. A caller cannot ask for the whole collection. */
export function pagination(query: Record<string, unknown>, defaultLimit = 25) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Escapes a user-supplied search term.
 *
 * Prisma passes `contains` through to a Mongo regex, so an unescaped term is
 * not merely wrong — a search for `.*` scans every document, and a
 * pathological pattern is a denial-of-service against the database from a
 * search box.
 */
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a validated `orderBy` from query params.
 *
 * `allowed` is a whitelist, not a suggestion: sorting is passed straight to the
 * database, and an arbitrary field name from the client either errors or sorts
 * on something unindexed. Anything unrecognised falls back to the default.
 */
export function sorting<T extends string>(
  query: Record<string, unknown>,
  allowed: readonly T[],
  fallback: T,
): Record<string, 'asc' | 'desc'> {
  const requested = String(query.sort ?? '');
  const field = (allowed as readonly string[]).includes(requested) ? requested : fallback;
  const direction = String(query.dir ?? 'desc') === 'asc' ? 'asc' : 'desc';
  return { [field]: direction };
}

/** Standard envelope for a paginated list, so every table reads the same. */
export function paged<T>(rows: T[], total: number, page: number, limit: number) {
  return { rows, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) };
}

/**
 * Resolves user ids to display names in one query.
 *
 * Most console tables show "who created this", and the models hold a bare
 * `userId` rather than a Prisma relation — MongoDB relations are only defined
 * where the schema declares them, and Squad/Event/Community deliberately do
 * not. Without this, rendering a 25-row table means 25 extra lookups.
 */
export async function resolveUsers(
  prisma: {
    user: {
      findMany: (args: {
        where: { id: { in: string[] } };
        select: { id: true; name: true; email: true; username: true };
      }) => Promise<{ id: string; name: string; email: string; username: string | null }[]>;
    };
  },
  ids: (string | null | undefined)[],
): Promise<Map<string, { id: string; name: string; email: string; username: string | null }>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true, username: true },
  });

  return new Map(users.map((user) => [user.id, user]));
}

/** Trimmed string from a query param, or '' when absent. */
export function str(value: unknown): string {
  return String(value ?? '').trim();
}

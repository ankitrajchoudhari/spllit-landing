import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

/**
 * Drop the cached careers pages the moment the console saves.
 *
 * The careers page is cached and refreshed every thirty seconds, which means
 * closing or removing a role could stay visible for half a minute after the
 * console said it was gone — and removing a role is precisely the thing done
 * in a hurry. The console now says so here instead of waiting to be asked.
 *
 * The thirty-second refresh stays as the floor. If this endpoint is never
 * called, or its secret is not configured, nothing breaks: the page is simply
 * as fresh as it was before. That matters because the backend and this site
 * deploy separately, so one of them is always briefly ahead of the other.
 */

/** Paths whose content comes from the console, and nothing else. */
const PATHS = ['/careers'] as const;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would leak the length,
  // so compare padded buffers and check the length separately.
  const len = Math.max(a.length, b.length);
  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);
  return crypto.timingSafeEqual(pa, pb) && a.length === b.length;
}

/**
 * Role ids from the caller, used only to build apply-page paths.
 *
 * Validated rather than trusted: the caller holds the secret, but a path is
 * still built from this, and a cap keeps one save from turning into an
 * unbounded number of renders.
 */
async function readRoleIds(request: Request): Promise<string[]> {
  try {
    const body = await request.json();
    if (!body || !Array.isArray(body.roleIds)) return [];
    return body.roleIds
      .filter((id: unknown): id is string => typeof id === 'string')
      .map((id: string) => id.trim())
      .filter((id: string) => /^[a-z0-9-]{1,80}$/.test(id))
      .slice(0, 25);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET?.trim();

  // Fail closed. Without a secret this is a way for anyone to force the page
  // to be rebuilt on demand, which is a slow request multiplied by however
  // often somebody cares to ask for it.
  if (!expected) {
    return NextResponse.json(
      { ok: false, message: 'Revalidation is not configured' },
      { status: 503 },
    );
  }

  const provided = request.headers.get('x-spllit-revalidate-secret') ?? '';
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false, message: 'Invalid secret' }, { status: 401 });
  }

  for (const path of PATHS) revalidatePath(path);
  // Every apply page at once: they are one route with a parameter, and a role
  // that was just removed has to stop resolving along with the board.
  revalidatePath('/careers/[id]/apply', 'page');

  /**
   * Rebuild them here rather than leaving the next visitor to do it.
   *
   * revalidatePath only drops the cache; whoever asks next is the one who
   * waits for the backend to answer, and measured cold that is ~2.6s against
   * ~0.5s warm. After a save the next visitor is usually the person who just
   * saved, checking their change — the worst possible moment to be slow.
   *
   * Bounded and best-effort: a handful of roles, a short timeout, and failures
   * ignored, because the pages are already correct. This only decides who pays
   * for the first render.
   */
  const roleIds = await readRoleIds(request);
  const origin = new URL(request.url).origin;
  const warm = [
    ...PATHS,
    ...roleIds.map((roleId) => `/careers/${encodeURIComponent(roleId)}/apply`),
  ];
  await Promise.allSettled(
    warm.map((path) =>
      fetch(origin + path, {
        cache: 'no-store',
        headers: { 'user-agent': 'spllit-revalidate' },
        signal: AbortSignal.timeout(8000),
      }),
    ),
  );

  return NextResponse.json({ ok: true, revalidated: warm.length, paths: warm });
}

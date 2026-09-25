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
const PATHS = ['/careers', '/blog'] as const;

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
  revalidatePath('/blog/[slug]', 'page');

  /**
   * Answer at once. Rebuilding is the caller’s job, and has to be.
   *
   * revalidatePath expires the entry, and that expiry is flushed when this
   * request ends — so anything fetched from inside it is served the very
   * page about to be discarded, and the next real visitor still pays for the
   * regeneration. Measured at ~2.4s for them either way. Warming has to be a
   * separate request, made after this one has returned.
   */
  return NextResponse.json({ ok: true, revalidated: [...PATHS, '/careers/[id]/apply'] });
}

'use client';

import Link from 'next/link';
import { CalendarX, CheckCircle2 } from 'lucide-react';

import { formatRelative } from '@/lib/utils';

/**
 * Says plainly that a squad or ride is over.
 *
 * ## The failure this fixes
 *
 * Every link to a squad outlives the squad. The creation email says "Open the
 * squad", a join code sits in a group chat, someone bookmarks the page — and
 * all of them still resolve after the leader cancels it. Until now the page
 * rendered exactly as it had before: the destination, the meeting point, the
 * members, the map. Nothing said it was over, so somebody arriving from an
 * email a day later read it as a live plan and turned up.
 *
 * The server was already right about this — it returns `status` and excludes
 * cancelled squads from discovery. Only the page was silent.
 *
 * ## Why a banner and not a modal
 *
 * A modal has to be dismissed, and once dismissed it is gone — so the person
 * who clicks through without reading is left on a page that looks live, which
 * is the exact state this is meant to prevent. This cannot be dismissed and
 * cannot be scrolled past: it sits above the heading, in the first thing the
 * eye lands on.
 *
 * It also does not hide the squad. The leader who cancelled it, and members
 * working out what happened, both have reason to see what it was. Answering
 * "what happened to this?" with a blank page is its own kind of confusion.
 */
export function EndedNotice({
  kind,
  status,
  endedAt,
}: {
  kind: 'squad' | 'ride';
  status: string;
  /** Optional: the ride API does not return a terminal timestamp today, and a
      missing "when" is better than withholding the whole notice. */
  endedAt?: string | null;
}) {
  if (status !== 'cancelled' && status !== 'completed') return null;

  const cancelled = status === 'cancelled';
  const when = endedAt ? formatRelative(endedAt) : null;

  return (
    <div
      // Announced to screen readers on arrival: somebody who cannot see the
      // colour must not have to find this by exploring the page.
      role="status"
      className={[
        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center',
        cancelled
          ? 'border-danger bg-danger-muted'
          : 'border-line bg-surface-sunken',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {cancelled ? (
          <CalendarX className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">
            {cancelled
              ? `This ${kind} was cancelled`
              : kind === 'squad'
                ? 'This trip is done'
                : 'This ride is finished'}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
            {cancelled
              ? kind === 'squad'
                ? 'The leader called it off, so nobody is meeting. Anything below is what it was going to be.'
                : 'The host called it off, so this one is not running. Anything below is what it was going to be.'
              : 'Everyone has arrived, or the departure time has long passed.'}
            {when ? ` ${when}.` : null}
          </p>
        </div>
      </div>

      {/* Somewhere to go. A dead end tells you the bad news and leaves you on
          a page with nothing to do; the whole reason most people opened this
          was that they wanted a lift. */}
      <Link
        href={kind === 'squad' ? '/squads' : '/rides'}
        className="shrink-0 rounded-full bg-brand px-4 py-2 text-center text-[13px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
      >
        {cancelled ? `Find another ${kind}` : `See your ${kind}s`}
      </Link>
    </div>
  );
}

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarPlus, Car, Users } from 'lucide-react';

import { VerificationGate } from '@/components/shared/verification-gate';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The one place the two products are offered side by side.
 *
 * "+" used to open a bottom sheet listing every creatable thing. A sheet is the
 * wrong shape for a decision that leads somewhere: it has no address, no Back,
 * and it covers the screen you were reading to make the choice. This is a
 * screen, so it can be linked to, returned from, and prefilled.
 *
 * Ride and Squad stay separate all the way down — separate screens, separate
 * APIs, separate models. This only puts the fork in one visible place instead
 * of leaving people to discover /rides/new and /squads/new on their own.
 */
const OPTIONS = [
  {
    href: '/rides/new',
    Icon: Car,
    title: 'Offer a ride',
    body: 'You are driving. Publish your route and seats, and people going the same way can join you.',
    role: 'You become the host',
  },
  {
    href: '/squads/new',
    Icon: Users,
    title: 'Start a group ride',
    body: 'You are travelling with others. Pick a destination and meeting point, and approve who joins.',
    role: 'You become the leader',
  },
  /**
   * Events, carried over from the bottom sheet this screen replaces.
   *
   * Not part of the travel flow, and listed last for that reason — but the
   * sheet was its only entry point, so dropping it here would have removed the
   * ability to create an event at all while looking like a tidy-up.
   */
  {
    href: '/events/new',
    Icon: CalendarPlus,
    title: 'Host an event',
    body: 'Something happening on campus. People can see it and plan how to get there together.',
    role: 'You become the organiser',
  },
] as const;

function CreateChooser() {
  const router = useRouter();
  const params = useSearchParams();

  /**
   * Carries the search forward. Someone arriving from an empty results screen
   * has already said where and when they are going; asking again is the kind of
   * small betrayal that makes a flow feel careless.
   */
  const query = params.toString();
  const withSearch = (href: string) => (query ? `${href}?${query}` : href);

  return (
    <div className="mx-auto w-full max-w-lg px-1 pb-6">
      <div className="flex items-center gap-2 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-1 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
          Create
        </h1>
      </div>

      {/* Creating is gated where joining is. The gate replaces both options
          rather than letting someone pick one and meet a 403 on save. */}
      <VerificationGate action="create a ride or group ride">
        <ul className="space-y-2.5">
          {OPTIONS.map((option) => (
            <li key={option.href}>
              <Link
                href={withSearch(option.href)}
                className="group flex items-start gap-3.5 rounded-2xl border border-line bg-surface px-4 py-4 transition-colors duration-snap hover:border-brand hover:bg-brand-muted"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink">
                  <option.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15.5px] font-semibold text-ink">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">
                    {option.body}
                  </span>
                  <span className="mt-1.5 block text-[12px] font-medium text-ink-subtle">
                    {option.role}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-1 h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-snap group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </Link>
            </li>
          ))}
        </ul>
      </VerificationGate>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg space-y-2.5 px-1 py-6">
          <Skeleton className="h-[118px] w-full rounded-2xl" />
          <Skeleton className="h-[118px] w-full rounded-2xl" />
        </div>
      }
    >
      <CreateChooser />
    </Suspense>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Car, Plus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ridesService } from '@/lib/services/rides';
import { squadsService } from '@/lib/services/squads';
import { SQUAD_PURPOSES } from '@/lib/squad-purpose';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LottieLoader } from '@/components/ui/lottie-loader';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { readTab, readTripSearch, shortPlace, tripSearchParams, type TripTab } from '@/lib/trip-search';
import type { Ride, Squad } from '@/types';

const NO_RIDES: Ride[] = [];
const NO_SQUADS: Squad[] = [];

function when(iso: string | null): string {
  if (!iso) return 'Time not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time not set';
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Results for one destination, split by what is actually being offered.
 *
 * Rides and squads are different products with different rules — a ride has
 * seats and is joined outright, a squad has a leader, a member limit, an
 * approval step and a ₹2 fee. They are shown side by side because the user's
 * question ("who is going to X?") is the same, and separated into tabs because
 * the answer and the next action are not.
 */
export function TripResults() {
  const router = useRouter();
  const params = useSearchParams();
  const search = readTripSearch(new URLSearchParams(params.toString()));
  const tab = readTab(new URLSearchParams(params.toString()));

  const destinationName = shortPlace(search.destinationLabel) || 'your destination';

  const setTab = (next: TripTab) => {
    const q = tripSearchParams({ ...search, tab: next });
    // replace, not push: switching tabs is not a step to go back through.
    router.replace(`/trips?${q.toString()}`);
  };

  /**
   * Browsing is intentionally on the ungated endpoint.
   *
   * /rides/search is the corridor match but requires a verified institute and
   * answers 403 otherwise — which the previous screen rendered as "no rides
   * found". Telling someone nothing exists when the real answer is "you are not
   * allowed to look" is the worst of both. Discovery uses /rides/nearby with a
   * destination, and verification is enforced where it belongs: at join and
   * create.
   */
  const ridesQuery = useQuery({
    queryKey: ['trips', 'rides', search.origin, search.destination, search.departAt],
    queryFn: () =>
      ridesService.list({
        near: search.origin ?? undefined,
        radiusKm: 25,
        /**
         * Without this the list answered "who is setting off near you" while
         * the heading above it said "Trips to <destination>" — so a search for
         * Coir Lane returned a host driving Velachery → Golden Fortune Cross
         * Lane, which starts nearby and then goes somewhere else entirely.
         * The squads query has always filtered on destination; rides was the
         * one that did not.
         */
        headingTo: search.destination,
        limit: 20,
      }),
    enabled: tab === 'rides' && Boolean(search.origin),
  });

  const squadsQuery = useQuery({
    queryKey: ['trips', 'squads', search.origin, search.destination, search.departAt],
    queryFn: () =>
      squadsService.nearby({
        near: search.origin ?? undefined,
        radiusKm: 25,
        destination: search.destination,
        destRadiusKm: 5,
        // Without this the ranking cannot weigh departure time at all.
        departAt: search.departAt,
        limit: 20,
      }),
    enabled: tab === 'squads' && Boolean(search.origin),
  });

  const rides = ridesQuery.data?.items ?? NO_RIDES;
  const squads = squadsQuery.data?.items ?? NO_SQUADS;

  const active = tab === 'rides' ? ridesQuery : squadsQuery;
  const isEmpty = tab === 'rides' ? rides.length === 0 : squads.length === 0;

  /**
   * Creating carries the search forward, so the destination and time just
   * entered are never asked for a second time.
   */
  const goCreate = () =>
    router.push(
      tab === 'rides'
        ? `/rides/new?${tripSearchParams(search).toString()}`
        : `/squads/new?${tripSearchParams(search).toString()}`,
    );

  const backToSearch = () => router.push('/home');

  return (
    <div className="mx-auto w-full max-w-2xl px-1 pb-4">
      {/* Back is a real control, not a browser affordance — on a phone
          installed to the home screen there is no browser chrome to fall back
          on. */}
      <div className="flex items-center gap-2 py-3">
        <button
          type="button"
          onClick={backToSearch}
          aria-label="Back to search"
          className="-ml-1 rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[17px] font-semibold tracking-[-0.02em] text-ink sm:text-[20px]">
            Trips to {destinationName}
          </h1>
          <p className="truncate text-[12px] text-ink-muted">
            {search.originLabel ? `From ${shortPlace(search.originLabel)} · ` : ''}
            {search.departAt ? when(search.departAt) : 'Leaving now'}
          </p>
        </div>
      </div>

      {/* Two products, stated plainly. Buttons rather than a segmented control
          so each one is a full-height touch target at 320px. */}
      <div
        role="tablist"
        aria-label="Trip type"
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1"
      >
        {(
          [
            { key: 'rides', label: 'Rides', Icon: Car },
            { key: 'squads', label: 'Squads', Icon: Users },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            role="tab"
            aria-selected={tab === option.key}
            onClick={() => setTab(option.key)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg text-[13.5px] font-medium',
              'transition-colors duration-snap',
              tab === option.key
                ? 'bg-ink text-canvas'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
            )}
          >
            <option.Icon className="h-4 w-4" />
            {option.label}
          </button>
        ))}
      </div>

      {/*
        One create action, defined once and used by both the empty state and
        the bar below the results. They were previously the same intent written
        twice, which is how the populated list ended up with no way to create at
        all: the CTA lived inside the empty branch only, so finding one squad
        that did not suit you left you with no next step but the browser Back
        button. Whether results exist changes where the action sits, never
        whether it exists.
      */}
      {active.isPending ? (
        /*
          Two halves of one answer. The animation says the app is working; the
          skeletons say where the results will land, at the height the cards
          actually are, so nothing shifts when they arrive.

          The variant follows `tab`, which is the same value the enabled query
          is keyed on — so the scooter can never be playing over a squad search.
          Rendering is conditional on `isPending` alone, which is what
          guarantees the animation is unmounted (and lottie-web torn down) the
          moment the request settles, rather than looping on invisibly.
        */
        <div className="space-y-2">
          <LottieLoader
            variant={tab === 'rides' ? 'host' : 'squad'}
            caption={tab === 'rides' ? 'Finding nearby hosts…' : 'Finding nearby squads…'}
            className="py-2 sm:py-3"
          />
          <Skeleton className="h-[92px] w-full rounded-2xl" />
          <Skeleton className="h-[92px] w-full rounded-2xl" />
          <Skeleton className="h-[92px] w-full rounded-2xl" />
        </div>
      ) : active.isError ? (
        <EmptyState
          title="Could not load trips"
          description={
            active.error instanceof ApiError
              ? active.error.message
              : 'Something went wrong. Try again.'
          }
          action={<Button onClick={() => void active.refetch()}>Try again</Button>}
        />
      ) : isEmpty ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-8 text-center">
          <p className="font-display text-[16px] font-semibold text-ink">
            {tab === 'rides' ? 'No hosts available yet' : 'No squads heading there yet'}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            {tab === 'rides'
              ? `We couldn't find anyone going to ${destinationName} at this time.`
              : 'No squads are heading this way yet. Create one and let others travelling the same way join you.'}
          </p>
          {/*
            The create CTA carries the search forward, so the destination and
            time the user just entered are not asked for a second time.
            Verification is checked by the create screen, not hidden here — an
            empty state must never stand in for "you are not allowed".
          */}
          <Button size="sm" className="mt-4" onClick={goCreate}>
            + {tab === 'rides' ? 'Create a trip' : 'Create a Squad'}
          </Button>
        </div>
      ) : tab === 'rides' ? (
        <ul className="space-y-2">
          {rides.map((ride) => (
            <li key={ride.id}>
              <Link
                href={`/rides/${ride.id}`}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors duration-snap hover:border-line-strong"
              >
                <Avatar
                  src={ride.host?.profilePhoto ?? null}
                  name={ride.host?.name ?? 'Host'}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[14px] font-semibold text-ink">
                      {ride.host?.name ?? 'Host'}
                    </span>
                    {ride.host?.rating ? (
                      <span className="shrink-0 text-[12px] text-ink-muted">
                        ★ {ride.host.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
                    {shortPlace(ride.origin)} → {shortPlace(ride.destination)}
                  </span>
                  <span className="mt-1 block truncate text-[12px] text-ink-subtle">
                    {when(ride.departureTime)} · {ride.vehicleType} ·{' '}
                    {Math.max(ride.seats - ride.seatsTaken, 0)} seats left
                  </span>
                </span>
                <span className="shrink-0 self-center text-[12.5px] font-semibold text-brand">
                  View
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {squads.map((squad, index) => {
            const purpose = SQUAD_PURPOSES.find((p) => p.value === squad.type);
            /**
             * "Best match" only on the top row, and only when the server
             * actually ranked (it returns null with nothing to rank against).
             * A badge on every card ranks nothing.
             */
            const best = index === 0 && typeof squad.matchScore === 'number' && squads.length > 1;
            const reasons = squad.matchReasons ?? [];
            const full =
              squad.memberLimit !== null &&
              squad.memberLimit !== undefined &&
              squad.memberCount >= squad.memberLimit;
            return (
              <li key={squad.id}>
                <Link
                  href={`/squads/${squad.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors duration-snap hover:border-line-strong"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[18px]">
                    <span aria-hidden="true">{purpose?.icon ?? '👥'}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-ink">
                        {squad.name}
                      </span>
                      {best ? (
                        <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brand">
                          Best match
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
                      {shortPlace(squad.destination?.label) || purpose?.label} ·{' '}
                      {squad.leader?.name ?? 'Leader'}
                    </span>
                    <span className="mt-1 block truncate text-[12px] text-ink-subtle">
                      {squad.memberCount}
                      {squad.memberLimit ? `/${squad.memberLimit}` : ''} joined
                      {squad.meetingAt ? ` · ${when(squad.meetingAt)}` : ''}
                    </span>
                    {/* Why this one, in the terms it was actually scored on.
                        Capped at two so the card stays a card. */}
                    {reasons.length ? (
                      <span className="mt-1 block truncate text-[11.5px] text-brand">
                        {reasons.slice(0, 2).join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 self-center text-[12.5px] font-semibold',
                      full ? 'text-ink-subtle' : 'text-brand',
                    )}
                  >
                    {full ? 'Full' : 'View'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        Secondary by design. The results are the answer to what was asked, and
        an outline button under them offers the alternative without competing
        with the squads it sits below. Hidden while the empty state is showing,
        because that state carries the same action as its primary button —
        offering it twice on one screen is not twice as findable.
      */}
      {!active.isPending && !active.isError && !isEmpty ? (
        <div className="pt-1">
          <Button variant="outline" className="w-full" onClick={goCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {tab === 'rides' ? 'Create a trip' : 'Create a Squad'}
          </Button>
          <p className="mt-2 text-center text-[12px] leading-relaxed text-ink-subtle">
            {tab === 'rides'
              ? 'Driving yourself? Offer your spare seats instead.'
              : 'None of these fit? Start your own and let others join you.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

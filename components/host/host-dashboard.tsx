'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Car, Route, Star } from 'lucide-react';

import { cn } from '@/lib/utils';
import { hostService } from '@/lib/services/host';
import { ridesService } from '@/lib/services/rides';
import { useAuth } from '@/lib/auth/auth-provider';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleList } from '@/components/host/vehicle-list';

/**
 * Host dashboard.
 *
 * Reads status from the server rather than inferring it from what the host has
 * filled in — `pending` and `active` are decided by HostProfile.syncHostStatus,
 * and a screen that guessed would eventually disagree with the API that
 * actually refuses the ride.
 */

function Stat({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Route;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <Icon className="h-4 w-4 text-ink-subtle" />
      <p className="mt-3 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="text-[12.5px] text-ink-muted">{label}</p>
    </div>
  );
}

export function HostDashboard() {
  const { profile } = useAuth();

  const { data: host, isPending } = useQuery({
    queryKey: ['host', 'me'],
    queryFn: () => hostService.me(),
  });

  const { data: trips } = useQuery({
    queryKey: ['host', 'trips'],
    queryFn: () => ridesService.mine(),
    enabled: host?.profile.status === 'active',
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!host) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted">
          <Car className="h-5 w-5 text-brand" />
        </span>
        <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
          Drive with Spllit
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-muted">
          You already make the trip. Offer the empty seats to people on your
          campus going the same way, and split what it costs.
        </p>
        <ButtonLink href="/host/setup" className="mt-5">Become a host</ButtonLink>
      </div>
    );
  }

  const { profile: hostProfile, vehicles } = host;
  const active = hostProfile.status === 'active';
  const upcoming = (trips ?? []).filter(
    (ride) => ride.userId === profile?.id && ride.status !== 'completed' && ride.status !== 'cancelled',
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
            Host dashboard
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            {hostProfile.phone} · {vehicles.filter((v) => v.status === 'verified').length} verified{' '}
            {vehicles.length === 1 ? 'vehicle' : 'vehicles'}
          </p>
        </div>
        {active ? (
          <ButtonLink href="/rides/new" size="sm">Offer a ride</ButtonLink>
        ) : null}
      </div>

      {/* The one thing that matters when it applies: why they cannot drive. */}
      {hostProfile.status === 'suspended' ? (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-muted px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[13px] leading-relaxed text-danger">
            {hostProfile.suspendedReason ?? 'Host mode is suspended on this account.'}
          </p>
        </div>
      ) : !active ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3',
            'rounded-2xl bg-warning-muted px-4 py-3.5',
          )}
        >
          <p className="text-[13px] leading-relaxed text-ink">
            {vehicles.length === 0
              ? 'Add a vehicle to finish setting up host mode.'
              : 'Your vehicle is being reviewed. You can offer seats once it is approved.'}
          </p>
          {vehicles.length === 0 ? (
            <ButtonLink href="/host/setup" size="sm" variant="outline">Add a vehicle</ButtonLink>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Trips hosted" value={String(hostProfile.ridesHosted)} Icon={Route} />
        <Stat
          label={hostProfile.ratingCount === 1 ? '1 rating' : `${hostProfile.ratingCount} ratings`}
          // A single decimal from zero ratings is a lie; show a dash until
          // somebody has actually rated a trip.
          value={hostProfile.ratingCount > 0 ? hostProfile.rating.toFixed(1) : '—'}
          Icon={Star}
        />
        <Stat label="Vehicles" value={String(vehicles.length)} Icon={Car} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">Upcoming trips</h2>
          <Link href="/host/trips" className="text-[12.5px] font-medium text-brand">
            All trips
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No trips posted"
            description={
              active
                ? 'Post where you are driving and riders going the same way will find it.'
                : 'You can post a trip once your vehicle is approved.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.slice(0, 4).map((ride) => (
              <li key={ride.id}>
                <Link
                  href={`/rides/${ride.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors duration-snap hover:border-line-strong"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">
                      {ride.origin} → {ride.destination}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {new Date(ride.departureTime).toLocaleString(undefined, {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      · {ride.seatsTaken}/{ride.seats} seats taken
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">Vehicles</h2>
          <Link href="/host/vehicles" className="text-[12.5px] font-medium text-brand">
            Manage
          </Link>
        </div>
        <VehicleList vehicles={vehicles} editable={false} />
      </section>
    </div>
  );
}

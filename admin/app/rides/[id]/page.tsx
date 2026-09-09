'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { rideTone } from '@/app/rides/page';
import {
  EmptyState,
  ErrorState,
  NotImplementedState,
  PermissionState,
  SkeletonRows,
} from '@/components/ui/states';

interface Person {
  id: string;
  name: string;
  email: string;
}

interface RideDetail {
  ride: {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    vehicleType: string;
    seats: number;
    fare: number | null;
    genderPref: string;
    status: string;
    createdAt: string;
    acceptedAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
  };
  host: Person | null;
  matches: {
    id: string;
    status: string;
    initiatedBy: string;
    matchedAt: string;
    acceptedAt: string | null;
    declinedAt: string | null;
    host: Person | null;
    guest: Person | null;
  }[];
  unavailable: { key: string; reason: string }[];
}

export default function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const detail = useQuery({
    queryKey: ['ride', id],
    queryFn: () => api<RideDetail>(`/rides/${id}`),
  });

  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.isForbidden) {
      return <PermissionState permission="content.view" />;
    }
    return <ErrorState title="Could not load this ride" description={detail.error.message} />;
  }

  if (detail.isLoading || !detail.data) return <SkeletonRows rows={6} />;

  const { ride, host, matches } = detail.data;

  /**
   * The lifecycle, as timestamps that actually exist.
   *
   * Built by filtering rather than rendering a fixed set of rows, so a ride
   * that was cancelled before it started does not show an empty "Started" step
   * implying something is missing.
   */
  const timeline = [
    { label: 'Created', at: ride.createdAt },
    { label: 'Accepted', at: ride.acceptedAt },
    { label: 'Started', at: ride.startedAt },
    { label: 'Finished', at: ride.finishedAt },
    { label: 'Cancelled', at: ride.cancelledAt },
  ].filter((step): step is { label: string; at: string } => Boolean(step.at));

  return (
    <>
      <PageHeader
        title={`${ride.origin} → ${ride.destination}`}
        description={`Departs ${formatAbsolute(ride.departureTime)}`}
        actions={<Badge tone={rideTone(ride.status)}>{ride.status.replace(/_/g, ' ')}</Badge>}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Ride</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <Field label="Vehicle" value={ride.vehicleType} />
            <Field label="Seats" value={String(ride.seats)} />
            <Field label="Fare" value={ride.fare ? `₹${ride.fare}` : 'Not set'} />
            <Field label="Gender preference" value={ride.genderPref} />
            <Field label="Ride ID" value={ride.id} mono />
          </dl>
          {ride.cancelReason ? (
            <p className="rounded-md bg-danger-muted px-3 py-2 text-sm text-ink">
              <span className="font-semibold">Cancelled:</span> {ride.cancelReason}
            </p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Host</h2>
          {host ? (
            <Link
              href={`/users/${host.id}`}
              className="flex flex-col rounded-md border border-line px-3 py-2 transition-colors duration-snap hover:border-line-strong"
            >
              <span className="font-semibold text-ink">{host.name}</span>
              <span className="font-mono text-xs text-ink-subtle">{host.email}</span>
            </Link>
          ) : (
            <p className="text-sm text-ink-subtle">The host account no longer exists.</p>
          )}

          <h2 className="pt-2 text-sm font-bold text-ink">Lifecycle</h2>
          <ol className="flex flex-col gap-1.5">
            {timeline.map((step) => (
              <li key={step.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-muted">{step.label}</span>
                <span className="text-ink-subtle" title={formatAbsolute(step.at)}>
                  {formatRelative(step.at)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
          Matches ({matches.length})
        </h2>

        {matches.length === 0 ? (
          <EmptyState
            title="No matches"
            description="Nobody has been matched to this ride. This is a real zero — matching exists and produced none."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {matches.map((match) => (
              <Card key={match.id} className="flex flex-wrap items-center gap-3 p-3">
                <Badge
                  tone={
                    match.status === 'accepted'
                      ? 'good'
                      : match.status === 'rejected' || match.status === 'cancelled'
                        ? 'bad'
                        : 'warn'
                  }
                >
                  {match.status}
                </Badge>
                {match.guest ? (
                  <Link
                    href={`/users/${match.guest.id}`}
                    className="flex min-w-0 flex-1 flex-col hover:text-brand"
                  >
                    <span className="truncate text-sm text-ink">{match.guest.name}</span>
                    <span className="truncate font-mono text-xs text-ink-subtle">
                      {match.guest.email}
                    </span>
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-ink-subtle">Deleted account</span>
                )}
                <span className="text-xs text-ink-subtle">initiated by {match.initiatedBy}</span>
                <span className="text-xs text-ink-subtle" title={formatAbsolute(match.matchedAt)}>
                  {formatRelative(match.matchedAt)}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>

      {detail.data.unavailable.map((item) => (
        <NotImplementedState key={item.key} title="Reports" reason={item.reason} />
      ))}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className={`text-sm text-ink ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

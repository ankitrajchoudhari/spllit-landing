'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Phone, UserPlus, Users, UserCheck } from 'lucide-react';

import {
  formatCountdown,
  formatCurrency,
  formatDistance,
  formatDuration,
  formatTime,
} from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { RideCandidates } from '@/components/host/ride-candidates';
import { RideRequests } from '@/components/host/ride-requests';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonMap, Skeleton } from '@/components/ui/skeleton';
import { MapCanvas } from '@/components/map/map-canvas';
import { useAuth } from '@/lib/auth/auth-provider';
import { useJoinRide, useRide, useRideTransition } from '@/lib/hooks/queries';
import { VerificationGate } from '@/components/shared/verification-gate';
import { useRideTracking } from '@/lib/live/use-live';
import type { MapEntity } from '@/lib/map/types';
import type { LivePosition, RideStatus } from '@/types';

/** Host-side control set, keyed by the ride's current state. */
const HOST_ACTIONS: Partial<Record<RideStatus, { to: RideStatus; label: string }>> = {
  accepted: { to: 'arriving', label: "I'm on my way" },
  arriving: { to: 'in_progress', label: 'Start ride' },
  in_progress: { to: 'completed', label: 'Complete ride' },
};

export default function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile } = useAuth();
  const { data: ride, isPending, isError } = useRide(id);
  const tracking = useRideTracking(id);
  const transition = useRideTransition(id);
  const join = useJoinRide(id);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-7 w-48" />
        <SkeletonMap className="h-[280px]" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !ride) {
    return (
      <EmptyState
        tone="error"
        title="Ride not found"
        description="This ride may have been cancelled or completed."
        action={
          <Link href="/rides">
            <Button size="sm" variant="secondary">
              Back to rides
            </Button>
          </Link>
        }
      />
    );
  }

  const isHost = profile?.id === ride.userId;
  const seatsLeft = Math.max(0, ride.seats - ride.seatsTaken);
  const hostAction = isHost ? HOST_ACTIONS[ride.status] : undefined;
  const viewerJoined = ride.passengers.some((p) => p.id === profile?.id);

  const entities: MapEntity[] = [];
  if (ride.originLat !== null && ride.originLng !== null) {
    entities.push({
      id: `pickup:${ride.id}`,
      layer: 'rides',
      position: [ride.originLng, ride.originLat],
      title: 'Pickup',
      subtitle: ride.origin,
    });
  }
  entities.push({
    id: `drop:${ride.id}`,
    layer: 'rides',
    position: [ride.destLng, ride.destLat],
    title: 'Destination',
    subtitle: ride.destination,
  });

  // The driver's live frame is rendered as a moving puck rather than a static
  // marker, so it animates between updates instead of remounting.
  const livePositions = new Map<string, LivePosition>();
  if (tracking) {
    livePositions.set(ride.userId, {
      userId: ride.userId,
      lat: tracking.lat,
      lng: tracking.lng,
      heading: tracking.heading,
      updatedAt: tracking.updatedAt,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/rides"
          aria-label="Back to rides"
          className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
            {ride.destination}
          </h1>
          <p className="truncate text-[13px] text-ink-muted">from {ride.origin}</p>
        </div>
        <div className="ml-auto shrink-0">
          {ride.status === 'arriving' || ride.status === 'in_progress' ? (
            <Badge tone="live">{ride.status === 'arriving' ? 'Arriving' : 'On the way'}</Badge>
          ) : (
            <Badge>{ride.status.replace('_', ' ')}</Badge>
          )}
        </div>
      </div>

      <div className="h-[min(38dvh,280px)] overflow-hidden rounded-lg border border-line sm:h-[280px]">
        <MapCanvas
          mode="focused-ride"
          layers={['rides']}
          entities={entities}
          livePositions={livePositions}
          center={
            ride.originLat !== null && ride.originLng !== null
              ? [ride.originLng, ride.originLat]
              : [ride.destLng, ride.destLat]
          }
          showSelf={false}
        />
      </div>

      {/* Live ETA banner — server-computed, never recalculated per render. */}
      {tracking?.etaSeconds !== null && tracking?.etaSeconds !== undefined ? (
        <div className="flex items-center justify-between rounded-lg bg-brand-muted px-4 py-3">
          <span className="text-[13px] font-medium text-brand">
            {isHost ? 'You are' : `${ride.host?.name ?? 'Your host'} is`}{' '}
            {formatDuration(tracking.etaSeconds)} away
          </span>
          {tracking.distanceMetres !== null ? (
            <span className="text-[13px] tabular-nums text-brand">
              {formatDistance(tracking.distanceMetres)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/profile/${ride.userId}`} className="flex min-w-0 items-center gap-3">
            <Avatar src={ride.host?.profilePhoto} name={ride.host?.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">
                {ride.host?.name ?? 'Host'}
              </p>
              <p className="truncate text-[13px] text-ink-muted">
                {ride.host?.college ?? 'Spllit member'}
                {ride.host?.rating ? ` · ${ride.host.rating.toFixed(1)} ★` : ''}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 gap-2">
            <Link href={`/chat?context=ride&id=${ride.id}`}>
              <Button size="icon" variant="secondary" aria-label="Chat with host">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </Link>
            {ride.host && !isHost ? (
              <Button size="icon" variant="secondary" aria-label="Call host" disabled>
                <Phone className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center sm:gap-4">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-subtle">Leaves</dt>
            <dd className="mt-1 text-[13px] font-medium text-ink">
              {formatTime(ride.departureTime)}
            </dd>
            <dd className="text-[11px] text-ink-subtle">
              {formatCountdown(ride.departureTime)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-subtle">Vehicle</dt>
            <dd className="mt-1 text-[13px] font-medium capitalize text-ink">
              {ride.vehicleType}
            </dd>
            <dd className="text-[11px] text-ink-subtle">
              {seatsLeft} of {ride.seats} free
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-subtle">Share</dt>
            <dd className="mt-1 text-[13px] font-medium text-ink">
              {ride.fare !== null ? formatCurrency(ride.fare) : '—'}
            </dd>
            <dd className="text-[11px] text-ink-subtle">per person</dd>
          </div>
        </dl>
      </div>

      {/* Host-only, and above "riders going your way" on purpose: somebody who
          has already asked is waiting on an answer, while a candidate has not
          asked for anything. Answering people who are waiting comes first. */}
      {isHost && ride.status !== 'completed' && ride.status !== 'cancelled' ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <UserCheck className="h-4 w-4 text-ink-subtle" />
            Asking for a seat
          </h2>
          <RideRequests rideId={ride.id} />
        </div>
      ) : null}

      {/* Host-only: who is looking to travel this exact route. The endpoint
          refuses anyone else, so this is presentation, not the gate. */}
      {isHost && ride.status !== 'completed' && ride.status !== 'cancelled' ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <UserPlus className="h-4 w-4 text-ink-subtle" />
            Riders going your way
          </h2>
          <RideCandidates rideId={ride.id} />
        </div>
      ) : null}

      {ride.passengers.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Users className="h-4 w-4 text-ink-subtle" />
              Riding along
            </h2>
            <AvatarStack users={ride.passengers} max={6} size="sm" />
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-24 flex flex-col gap-2 sm:flex-row lg:bottom-4">
        {hostAction ? (
          <Button
            size="lg"
            className="flex-1"
            loading={transition.isPending}
            onClick={() => transition.mutate({ to: hostAction.to })}
          >
            {hostAction.label}
          </Button>
        ) : null}

        {!isHost && !viewerJoined && seatsLeft > 0 && ride.status === 'requested' ? (
          /* POST /rides/:id/join is behind requireVerifiedInstitute and answers
             403. Showing the button anyway meant the refusal arrived as a raw
             error after the tap; the gate says so before it, and carries the
             verification flow rather than a link to it. */
          <VerificationGate action="join this ride" className="flex-1">
            <Button
              size="lg"
              className="w-full"
              loading={join.isPending}
              onClick={() => join.mutate(1)}
            >
              Join
            </Button>
          </VerificationGate>
        ) : null}

        {(isHost || viewerJoined) &&
        ride.status !== 'completed' &&
        ride.status !== 'cancelled' ? (
          <Button
            size="lg"
            variant="outline"
            className={hostAction ? '' : 'flex-1'}
            onClick={() => setCancelOpen(true)}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {/* Cancelling is terminal — a ride cannot move back out of `cancelled`,
          and every passenger loses their seat. */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() =>
          transition.mutate(
            { to: 'cancelled' },
            { onSuccess: () => setCancelOpen(false) },
          )
        }
        eyebrow="Cancel ride"
        title={ride.destination}
        description={
          isHost
            ? 'This cannot be undone. Everyone riding along is notified and loses their seat.'
            : 'This cannot be undone. You will give up your seat on this ride.'
        }
        details={
          isHost && ride.passengers.length > 0
            ? [
                {
                  label: `${ride.passengers.length} passenger${
                    ride.passengers.length === 1 ? '' : 's'
                  } affected`,
                  items: ride.passengers.map((passenger) => passenger.name),
                },
              ]
            : undefined
        }
        confirmLabel="Cancel ride"
        confirmTone="danger"
        cancelLabel="Keep it"
        loading={transition.isPending}
        error={
          transition.isError
            ? transition.error instanceof Error
              ? transition.error.message
              : 'That change was rejected.'
            : null
        }
      />

      {transition.isError ? (
        <p role="alert" className="text-[13px] text-danger">
          {transition.error instanceof Error
            ? transition.error.message
            : 'That change was rejected.'}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Car, Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { adminService, type AdminVehicle } from '@/lib/services/admin';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import type { VehicleStatus } from '@/types';

const FILTERS: { value: VehicleStatus; label: string }[] = [
  { value: 'pending', label: 'In review' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

/**
 * Host vehicle verification.
 *
 * This is the step that gives the host gate meaning: vehicles are created
 * `pending` and only a decision here moves them. Approving the first one is
 * what flips the host to `active`, so the server returns the recomputed host
 * status rather than letting this screen assume it.
 */
export function VehicleQueue() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<VehicleStatus>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'vehicles', status],
    queryFn: () => adminService.vehicleQueue(status),
  });

  const review = useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: 'verified' | 'rejected';
      note?: string;
    }) => adminService.reviewVehicle(id, decision, note),
    onSuccess: () => {
      setError(null);
      // The row leaves this list and joins another, so both are stale.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vehicles'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not record the decision.'),
  });

  return (
    <div className="space-y-4">
      <Tabs value={status} onChange={setStatus} items={FILTERS} layoutId="vehicle-queue-tab" />

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-[110px] w-full rounded-lg" />
          <Skeleton className="h-[110px] w-full rounded-lg" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting' : 'Nothing here'}
          description={
            status === 'pending'
              ? 'New vehicles appear here as hosts register them.'
              : 'No vehicles with this status.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {data?.map((vehicle) => (
            <VehicleRow
              key={vehicle.id}
              vehicle={vehicle}
              note={notes[vehicle.id] ?? ''}
              onNote={(value) => setNotes((prev) => ({ ...prev, [vehicle.id]: value }))}
              busy={review.isPending && review.variables?.id === vehicle.id}
              onDecide={(decision) =>
                review.mutate({ id: vehicle.id, decision, note: notes[vehicle.id] })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function VehicleRow({
  vehicle,
  note,
  onNote,
  busy,
  onDecide,
}: {
  vehicle: AdminVehicle;
  note: string;
  onNote: (value: string) => void;
  busy: boolean;
  onDecide: (decision: 'verified' | 'rejected') => void;
}) {
  const Icon = vehicle.type === 'bike' ? Bike : Car;

  return (
    <li
      className={cn(
        'rounded-lg border border-line bg-surface p-4',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken">
          <Icon className="h-[18px] w-[18px] text-ink-muted" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">
            {vehicle.brandLabel} {vehicle.modelLabel}
            {vehicle.colour ? ` · ${vehicle.colour}` : ''}
          </p>
          <p className="font-mono text-[13px] tracking-[0.1em] text-ink">
            {vehicle.plateFormatted}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {vehicle.seats} {vehicle.seats === 1 ? 'seat' : 'seats'} · registered{' '}
            {new Date(vehicle.createdAt).toLocaleDateString()}
          </p>
        </div>

        {vehicle.user ? (
          <div className="flex shrink-0 items-center gap-2">
            <Avatar src={vehicle.user.profilePhoto} name={vehicle.user.name} size="sm" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13px] font-medium text-ink">{vehicle.user.name}</p>
              <p className="truncate text-[11.5px] text-ink-muted">
                {vehicle.user.college || vehicle.user.email}
              </p>
              {vehicle.hostPhone ? (
                <p className="truncate text-[11.5px] text-ink-subtle">{vehicle.hostPhone}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {vehicle.status === 'rejected' && vehicle.rejectionNote ? (
        <p className="mt-3 rounded-md bg-danger-muted px-3 py-2 text-[12.5px] text-danger">
          {vehicle.rejectionNote}
        </p>
      ) : null}

      {vehicle.status === 'pending' ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Reason (required to reject)"
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              // The API refuses a reasonless rejection; disabling here means
              // the reviewer finds out before they click, not after.
              disabled={!note.trim()}
              onClick={() => onDecide('rejected')}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button size="sm" onClick={() => onDecide('verified')}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

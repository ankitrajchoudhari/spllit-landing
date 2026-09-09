'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike, Car, Check, Clock, Trash2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { hostService } from '@/lib/services/host';
import { Badge } from '@/components/ui/badge';
import type { HostAccount, Vehicle, VehicleStatus, VehicleType } from '@/types';

const TYPE_ICON: Record<VehicleType, typeof Car> = { cab: Car, bike: Bike, auto: Car };

const STATUS: Record<VehicleStatus, { label: string; Icon: typeof Check; tone: string }> = {
  verified: { label: 'Verified', Icon: Check, tone: 'text-brand' },
  pending: { label: 'In review', Icon: Clock, tone: 'text-warning' },
  rejected: { label: 'Rejected', Icon: X, tone: 'text-danger' },
};

export function VehicleList({
  vehicles,
  editable = true,
}: {
  vehicles: Vehicle[];
  editable?: boolean;
}) {
  const queryClient = useQueryClient();

  /** Both mutations return the whole account — status can flip either way. */
  const apply = (account: HostAccount) => queryClient.setQueryData(['host', 'me'], account);

  const makePrimary = useMutation({
    mutationFn: (id: string) => hostService.makePrimary(id),
    onSuccess: apply,
  });

  const remove = useMutation({
    mutationFn: (id: string) => hostService.removeVehicle(id),
    onSuccess: apply,
  });

  if (vehicles.length === 0) return null;

  return (
    <ul className="space-y-2">
      {vehicles.map((vehicle) => {
        const Icon = TYPE_ICON[vehicle.type];
        const status = STATUS[vehicle.status];
        const busy =
          (makePrimary.isPending && makePrimary.variables === vehicle.id) ||
          (remove.isPending && remove.variables === vehicle.id);

        return (
          <li
            key={vehicle.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5',
              vehicle.isPrimary ? 'border-brand' : 'border-line',
              busy && 'opacity-60',
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken">
              <Icon className="h-[18px] w-[18px] text-ink-muted" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium text-ink">
                  {vehicle.brandLabel} {vehicle.modelLabel}
                </span>
                {vehicle.isPrimary ? <Badge>Default</Badge> : null}
              </span>
              <span className="block truncate font-mono text-[12.5px] tracking-[0.08em] text-ink-muted">
                {vehicle.plateFormatted}
              </span>
              <span className={cn('mt-0.5 flex items-center gap-1 text-[12px]', status.tone)}>
                <status.Icon className="h-3 w-3" />
                {status.label}
                <span className="text-ink-subtle">
                  {' '}
                  · {vehicle.seats} {vehicle.seats === 1 ? 'seat' : 'seats'}
                  {vehicle.colour ? ` · ${vehicle.colour}` : ''}
                </span>
              </span>
              {/* The reviewer's note is the only way to know what to fix. */}
              {vehicle.status === 'rejected' && vehicle.rejectionNote ? (
                <span className="mt-1 block text-[12px] leading-relaxed text-danger">
                  {vehicle.rejectionNote}
                </span>
              ) : null}
            </span>

            {editable ? (
              <span className="flex shrink-0 items-center gap-1">
                {/* Only a verified vehicle can be the default, so the option is
                    absent rather than shown and then refused. */}
                {vehicle.status === 'verified' && !vehicle.isPrimary ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makePrimary.mutate(vehicle.id)}
                    className="rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                  >
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${vehicle.brandLabel} ${vehicle.modelLabel}`}
                  onClick={() => remove.mutate(vehicle.id)}
                  className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-danger-muted hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { hostService } from '@/lib/services/host';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { HostAccount, VehicleType } from '@/types';

/**
 * Vehicle registration.
 *
 * The brand and model come from the API's catalogue rather than free text, so
 * "Maruti" and "Maruti Suzuki" cannot become two brands, and the seat count is
 * capped by the model the host actually picked — the server enforces the same
 * cap, this only stops the user reaching for a number it will reject.
 */

const CLASS_LABEL: Record<VehicleType, string> = {
  cab: 'Car',
  bike: 'Two-wheeler',
  auto: 'Auto-rickshaw',
};

const CLASS_ORDER: VehicleType[] = ['cab', 'bike', 'auto'];

/** Mirrors backend/src/data/vehicles.ts — display grouping only. */
function groupPlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function VehicleForm({ onAdded }: { onAdded?: (account: HostAccount) => void }) {
  const queryClient = useQueryClient();

  const { data: brands, isPending } = useQuery({
    queryKey: ['host', 'catalogue'],
    queryFn: () => hostService.catalogue(),
    // Reference data. Refetching it on every mount would be pure waste.
    staleTime: 24 * 60 * 60_000,
  });

  const [vehicleClass, setVehicleClass] = useState<VehicleType>('cab');
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [plate, setPlate] = useState('');
  const [colour, setColour] = useState('');
  const [seats, setSeats] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forClass = (brands ?? []).filter((brand) => brand.type === vehicleClass);
  const brand = forClass.find((entry) => entry.id === brandId) ?? null;
  const model = brand?.models.find((entry) => entry.id === modelId) ?? null;

  const add = useMutation({
    mutationFn: () =>
      hostService.addVehicle({
        brandId,
        modelId,
        plate: groupPlate(plate),
        ...(colour.trim() ? { colour: colour.trim() } : {}),
        ...(seats !== null ? { seats } : {}),
      }),
    onSuccess: async () => {
      setPlate('');
      setColour('');
      setSeats(null);
      setModelId('');
      setError(null);
      // Refetch rather than patch: adding the first vehicle can flip the whole
      // profile to active, and only the server knows whether it did.
      const account = await queryClient.fetchQuery({
        queryKey: ['host', 'me'],
        queryFn: () => hostService.me(),
      });
      if (account) onAdded?.(account);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not add the vehicle.'),
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  const selectClass =
    'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand disabled:opacity-50';

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (brand && model) add.mutate();
      }}
    >
      <div>
        <span className="mb-2 block text-[13px] font-medium text-ink">Vehicle type</span>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {CLASS_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={vehicleClass === option}
              onClick={() => {
                setVehicleClass(option);
                // The brand list is per class, so a stale selection here would
                // submit a brand that does not exist for the new type.
                setBrandId('');
                setModelId('');
                setSeats(null);
              }}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-snap',
                vehicleClass === option
                  ? 'bg-ink text-canvas'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {CLASS_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Brand">
        <select
          className={selectClass}
          value={brandId}
          onChange={(event) => {
            setBrandId(event.target.value);
            setModelId('');
            setSeats(null);
          }}
        >
          <option value="">Select a brand</option>
          {forClass.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Model">
        <select
          className={selectClass}
          value={modelId}
          disabled={!brand}
          onChange={(event) => {
            setModelId(event.target.value);
            setSeats(null);
          }}
        >
          <option value="">{brand ? 'Select a model' : 'Pick a brand first'}</option>
          {(brand?.models ?? []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Registration number"
        hint="Indian plates only, e.g. TN 07 CV 1234 or 22 BH 1234 AA."
      >
        <Input
          value={plate}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="TN 07 CV 1234"
          onChange={(event) => setPlate(event.target.value.toUpperCase())}
          className="font-mono tracking-[0.08em]"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Colour" hint="Optional">
          <Input
            value={colour}
            maxLength={30}
            placeholder="White"
            onChange={(event) => setColour(event.target.value)}
          />
        </Field>

        <Field
          label="Seats offered"
          hint={model ? `Up to ${model.seats}` : 'Pick a model first'}
        >
          <select
            className={selectClass}
            disabled={!model}
            value={seats ?? model?.seats ?? ''}
            onChange={(event) => setSeats(Number(event.target.value))}
          >
            {Array.from({ length: model?.seats ?? 0 }, (_, index) => index + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={add.isPending}
        disabled={!brand || !model || plate.trim().length < 6}
      >
        Add vehicle
      </Button>

      <p className="text-center text-[12px] leading-relaxed text-ink-subtle">
        Vehicles are reviewed before they go live. You&apos;ll be able to offer
        seats as soon as yours is approved.
      </p>
    </form>
  );
}

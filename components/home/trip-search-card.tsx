'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Circle, Clock, Search, Square, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { PlacePicker, type PickedPlace } from '@/components/shared/place-picker';
import { CalendarWithTimePresets } from '@/components/ui/calendar-with-time-presets';
import { prefetchLottie } from '@/components/ui/lottie-loader';
import type { LngLat } from '@/types';
import { tripSearchParams, type TripTab } from '@/lib/trip-search';

/**
 * The whole of Home: where from, where to, when, go.
 *
 * This replaces a 1,353-line planner that put the search form, both result
 * lists, the purpose/vehicle filters and a live map on one screen. On a phone
 * that meant the answer to "where are you going" was below three folds of
 * controls for questions the user had not been asked yet.
 *
 * Everything that used to sit under this now lives on /trips, reached by the
 * button. The search itself travels in the URL, so the results screen can be
 * refreshed, shared and returned to.
 */
export function TripSearchCard() {
  const router = useRouter();
  const { center } = useGeolocation();

  const [pickup, setPickup] = useState<PickedPlace | null>(null);
  const [destination, setDestination] = useState<PickedPlace | null>(null);
  const [departNow, setDepartNow] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [departAt, setDepartAt] = useState(() => new Date(Date.now() + 30 * 60_000));
  /**
   * Host or Squad, chosen before searching rather than after.
   *
   * These are different products — a host is already driving and has seats; a
   * squad is people agreeing to travel together, with a leader who approves.
   * Deciding on the results screen meant the search ran, returned, and only
   * then asked what the user had been looking for. Asking here also lets the
   * button name the thing it will find.
   */
  const [mode, setMode] = useState<TripTab>('rides');

  /**
   * Origin falls back twice: the typed pickup, then the device, then the
   * configured city. The last step matters — the corridor search requires an
   * origin and returns 400 without one, so a denied location prompt would
   * otherwise make the button do nothing with no explanation.
   */
  const originPoint: LngLat =
    pickup
      ? [pickup.lng, pickup.lat]
      : center ?? [config.defaultLocation.lng, config.defaultLocation.lat];

  const originLabel =
    pickup?.label ?? (center ? 'Current location' : config.defaultLocation.label);

  const canSearch = Boolean(destination);

  const submit = () => {
    if (!destination) return;
    /**
     * Start the artwork downloading now, not when /trips renders its pending
     * state. The animation JSON and the results route chunk then load in
     * parallel, so the loader is usually complete on its first frame instead of
     * fading in a beat after the skeletons.
     */
    prefetchLottie(mode === 'rides' ? 'host' : 'squad');
    const params = tripSearchParams({
      origin: originPoint,
      originLabel,
      destination: [destination.lng, destination.lat],
      destinationLabel: destination.label,
      departAt: departNow ? null : departAt.toISOString(),
      tab: mode,
    });
    router.push(`/trips?${params.toString()}`);
  };

  return (
    <section className="mx-auto w-full max-w-lg">
      <div className="rounded-2xl border border-line bg-surface shadow-soft">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink sm:text-[22px]">
            Where are you going?
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Find people already heading the same way.
          </p>
        </div>

        <div className="space-y-2.5 px-4 py-4 sm:px-5">
          {/* The two points, with the connector that makes them read as one
              journey rather than two unrelated fields. */}
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center pt-3.5">
              <Circle className="h-2.5 w-2.5 fill-ink text-ink" />
              <span className="my-1 h-6 w-px bg-line-strong" />
              <Square className="h-2.5 w-2.5 fill-ink text-ink" />
            </div>

            <div className="min-w-0 flex-1 space-y-2.5">
              <PlacePicker
                label="Pickup"
                value={pickup}
                onChange={setPickup}
                placeholder={originLabel}
                proximity={originPoint}
                allowCurrentLocation
              />
              <PlacePicker
                label="Destination"
                value={destination}
                onChange={setDestination}
                placeholder="Where to?"
                proximity={originPoint}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
            <div className="flex w-full items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (departNow) {
                    setDepartNow(false);
                    setCalendarOpen(true);
                  } else {
                    setCalendarOpen((open) => !open);
                  }
                }}
                aria-expanded={calendarOpen}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Clock className="h-4 w-4 shrink-0 text-ink-subtle" />
                <span className="flex-1 truncate text-sm text-ink">
                  {departNow
                    ? 'Leave now'
                    : departAt.toLocaleString(undefined, {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDepartNow((now) => !now);
                  setCalendarOpen(departNow);
                }}
                className="shrink-0 text-[12.5px] font-medium text-brand"
              >
                {departNow ? 'Schedule' : 'Now'}
              </button>
            </div>

            {!departNow && calendarOpen ? (
              <CalendarWithTimePresets
                value={departAt}
                onChange={setDepartAt}
                onDone={() => setCalendarOpen(false)}
                className="mt-2.5"
              />
            ) : null}
          </div>

          {/*
            Two full-width halves, not a segmented pill: at 320px a pill with
            two labels and two icons leaves each target under 44px, and this is
            the choice the whole search depends on.
          */}
          <div
            role="tablist"
            aria-label="What are you looking for?"
            className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-sunken p-1"
          >
            {(
              [
                { key: 'rides', label: 'Host', Icon: Car, hint: 'Someone already driving' },
                { key: 'squads', label: 'Group Ride', Icon: Users, hint: 'Travel together' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={mode === option.key}
                onClick={() => setMode(option.key)}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-lg',
                  'text-[13.5px] font-medium transition-colors duration-snap',
                  mode === option.key
                    ? 'bg-ink text-canvas shadow-soft'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                <option.Icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>

          <p className="text-center text-[12px] leading-relaxed text-ink-subtle">
            {mode === 'rides'
              ? 'Find someone already travelling your way and take a seat.'
              : 'Find people going the same way and travel together.'}
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!canSearch}
            className={cn(
              // h-12 is a comfortable thumb target at every width, and the
              // button is in normal flow — not absolutely positioned — so it
              // cannot end up over the keyboard or off-screen.
              'flex h-12 w-full items-center justify-center gap-2 rounded-xl',
              'bg-ink text-[15px] font-medium text-canvas',
              'transition-all duration-snap hover:opacity-90 active:scale-[0.99]',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <Search className="h-4 w-4" />
            {mode === 'rides' ? 'Find hosts' : 'Find group rides'}
          </button>

          {!canSearch ? (
            <p className="text-center text-[12px] text-ink-subtle">
              Add a destination to search.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

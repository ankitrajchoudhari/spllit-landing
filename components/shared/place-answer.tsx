'use client';

import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Navigation } from 'lucide-react';

import {
  geocode,
  reverseGeocode,
  type Candidate,
  type PickedPlace,
} from '@/components/shared/place-picker';
import { getPreciseLocation, type FixFailure } from '@/lib/hooks/use-geolocation';
import { cn, formatDistance } from '@/lib/utils';
import type { LngLat } from '@/types';

/**
 * Answering "where?" inside the assistant.
 *
 * `PlacePicker` does this everywhere else and does it well, but it puts its
 * results in a portalled panel that is `position: fixed` and measured against
 * the window — and inside a full-screen conversation on a phone that is the
 * wrong shape twice over.
 *
 * It floats over the conversation instead of taking its place in it, so the
 * chat scrolls underneath it. And its measurement is against
 * `window.innerHeight`, which on mobile browsers does not shrink when the
 * on-screen keyboard appears — so the list gets positioned into the space the
 * keyboard occupies and the lower half cannot be reached. The picker also keeps
 * itself open by asking whether the panel `matches(':hover')`, and a
 * touchscreen has no hover: that check is simply false, so a tap on a
 * suggestion could dismiss the list before the tap resolved.
 *
 * So the results are rendered here in normal flow. They grow downward and push
 * what follows, nothing is hidden behind them, there is nothing to measure and
 * nothing to mis-measure, and choosing one is an ordinary button press.
 *
 * The *searching* is not reimplemented: `geocode` is the picker's own, so
 * ranking, the second local pass and the verified-point merge are all shared.
 * Two search paths that ranked differently would be the real bug.
 */

/** Two, not the picker's three: someone typing "IIT" deserves an answer. */
const MIN_QUERY = 2;

/**
 * Shorter than the picker's 300 ms.
 *
 * "Suggestions come late" is mostly this: at 300 ms plus a round trip the list
 * lands after the next keystroke has been typed, so it never feels connected to
 * the typing. Requests abort on every keystroke anyway, so asking sooner costs
 * little.
 */
const DEBOUNCE_MS = 160;

export function PlaceAnswer({
  placeholder,
  proximity,
  initialQuery,
  allowCurrentLocation = false,
  onQueryChange,
  onPick,
  autoFocus,
}: {
  placeholder: string;
  proximity?: LngLat | null;
  initialQuery?: string;
  allowCurrentLocation?: boolean;
  onQueryChange?: (value: string) => void;
  onPick: (place: PickedPlace) => void;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [input, setInput] = useState(initialQuery ?? '');
  const [debounced, setDebounced] = useState(initialQuery ?? '');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<FixFailure | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const query = debounced.trim();
  const searchable = query.length >= MIN_QUERY;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['concierge-place', query, proximity],
    queryFn: ({ signal }) => geocode(query, proximity ?? undefined, signal),
    enabled: searchable,
    staleTime: 5 * 60_000,
  });

  const results = data ?? [];

  /**
   * Previous results stay on screen while a new query is in flight.
   *
   * Emptying the list on every keystroke is the other half of feeling slow: the
   * row somebody is already reaching for vanishes from under their finger.
   * Holding the last good answer with a quiet spinner beside it is calmer and
   * just as honest.
   */
  const showing = searchable && (results.length > 0 || isFetching || isError);

  const pick = (place: Candidate) => {
    onPick({
      lat: place.center[1],
      lng: place.center[0],
      label: place.name,
      address: place.address,
      // The provider's own word for what this is, and the integer derived from
      // it — never the reverse.
      ...(place.featureType === undefined ? {} : { featureType: place.featureType }),
      precision: place.precision,
      // Chosen off a list of named places: the provider's own coordinate.
      source: 'search',
    });
  };

  /**
   * Resolves to a real fix or to the reason there is not one, never to a
   * substitute — and the coordinate is still turned into a place by the same
   * reverse geocoder the picker uses, so a device pin carries a street rather
   * than a pair of numbers.
   */
  const locate = async () => {
    setLocating(true);
    setLocateError(null);

    const fix = await getPreciseLocation();
    if (fix.status !== 'ok') {
      setLocateError(fix.status);
      setLocating(false);
      return;
    }

    const place = await reverseGeocode(fix.point);
    setLocating(false);
    onPick({ ...place, accuracyMetres: fix.accuracyMetres, source: 'device' });
  };

  return (
    <div>
      <div
        className={cn(
          'flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4',
          'transition-colors focus-within:border-brand',
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
        <input
          id={inputId}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            onQueryChange?.(event.target.value);
            setLocateError(null);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle"
        />
        {isFetching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-subtle" aria-hidden />
        ) : null}
      </div>

      {allowCurrentLocation ? (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className={cn(
            'mt-2 flex min-h-[46px] w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-4',
            'text-[14px] font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-60',
          )}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
          ) : (
            <Navigation className="h-4 w-4 text-brand" aria-hidden />
          )}
          {locating ? 'Finding you…' : 'Use my current location'}
        </button>
      ) : null}

      {locateError ? (
        <p role="alert" className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          Couldn&apos;t get your location. Search for the place instead.
        </p>
      ) : null}

      {/*
        In flow, not floating: the list grows downward and pushes what follows,
        so nothing sits behind it and nothing has to be positioned by hand.
      */}
      {showing ? (
        <ul className="mt-2 space-y-1.5" aria-live="polite">
          {results.slice(0, 6).map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => pick(place)}
                className={cn(
                  'flex min-h-[54px] w-full items-start gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left',
                  'transition-colors hover:border-brand hover:bg-surface-sunken active:bg-surface-sunken',
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <MapPin className="h-3.5 w-3.5 text-brand" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">
                    {place.name}
                  </span>
                  {place.address ? (
                    <span className="block truncate text-[12.5px] text-ink-muted">
                      {place.address}
                    </span>
                  ) : null}
                </span>
                {Number.isFinite(place.distanceKm) ? (
                  <span className="mt-0.5 shrink-0 text-[12px] tabular-nums text-ink-subtle">
                    {formatDistance(place.distanceKm * 1000)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}

          {/* Skeletons only on a first search, so refining a query never blanks
              the rows somebody is already reaching for. */}
          {isFetching && results.length === 0
            ? [0, 1, 2].map((row) => (
                <li
                  key={`skeleton-${row}`}
                  className="h-[54px] animate-pulse rounded-2xl border border-line bg-surface-sunken"
                />
              ))
            : null}

          {isError && results.length === 0 ? (
            <li className="rounded-2xl bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-muted">
              Search is having trouble. Try again in a moment.
            </li>
          ) : null}

          {!isFetching && !isError && results.length === 0 ? (
            <li className="rounded-2xl bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-muted">
              Nothing matched <span className="font-medium text-ink">{query}</span>. Try a nearby
              landmark.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

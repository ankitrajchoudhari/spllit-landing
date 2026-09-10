'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  Flag,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinOff,
  RotateCw,
} from 'lucide-react';

import { config } from '@/lib/config';
import { cn, formatDistance, haversine } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RequireAuth } from '@/components/auth/require-auth';
import { MapCanvas } from '@/components/map/map-canvas';
import { reverseGeocode, type PickedPlace } from '@/components/shared/place-picker';
import { pickupService } from '@/lib/services/pickup';
import { pickupAdvice, type GeoSource } from '@/lib/pickup-advice';
import {
  getPreciseLocation,
  useGeolocation,
  VAGUE_FIX_METRES,
  type FixFailure,
} from '@/lib/hooks/use-geolocation';
import { readSquadDraft, squadNewHref } from '@/lib/squad-draft';
import type { LayerKey } from '@/lib/map/config';
import type { MapEntity } from '@/lib/map/types';
import type { LngLat } from '@/types';

/**
 * Module-scope constants, not inline literals.
 *
 * SplitMap recomputes its visible set from `[entities, layers]` and re-pushes
 * the GeoJSON source whenever that identity changes. A fresh `['squads']` array
 * on every render would do that work on every render, for a list of at most two
 * pins that did not move.
 */
const PICK_LAYERS: LayerKey[] = ['squads'];

/**
 * Street level. Above CLUSTER_MAX_ZOOM (15) on purpose: at or below it the
 * destination flag and the meeting flag collapse into a green cluster circle
 * once they are within ~56px of each other, and the whole point of this screen
 * is seeing the two of them as separate places.
 */
const PICK_ZOOM = 16;

/**
 * What the user has pointed at, and how far the name lookup has got.
 *
 * `unnamed` is a real state rather than an error to swallow: Mapbox genuinely
 * has no name for a lot of perfectly good kerbside meeting spots, and the
 * coordinates are still valid. It changes what the card says, not whether the
 * pin counts.
 */
type Selection =
  | { status: 'resolving'; point: LngLat }
  | { status: 'named'; point: LngLat; place: PickedPlace }
  | { status: 'unnamed'; point: LngLat; place: PickedPlace };

function MeetingPointPicker({ query }: { query: string }) {
  const router = useRouter();
  const { center: deviceCenter } = useGeolocation();

  /**
   * The draft arrives as a *string* rather than as URLSearchParams.
   *
   * `useSearchParams()` hands back a new object on every render, so memoising
   * on it would never hit. That matters more here than usual: `center` is
   * derived from the draft and is passed to the map, and SplitMap's camera
   * effect calls `easeTo` whenever the center identity changes. An unstable
   * center would re-fly the camera on every render and fight the user's pan.
   */
  const draft = useMemo(() => readSquadDraft(new URLSearchParams(query)), [query]);

  const [selection, setSelection] = useState<Selection | null>(null);

  /**
   * Lookup ticket. Taps can be faster than the network, and a slow lookup for
   * an abandoned point must not overwrite the point the user is now looking at.
   */
  const ticketRef = useRef(0);

  /**
   * How the point being resolved was arrived at. Defaults to a tap on the map,
   * which is what every call that does not say otherwise is.
   */
  const resolve = useCallback(
    (
      point: LngLat,
      origin: { accuracyMetres?: number; source?: GeoSource } = {},
    ) => {
    const ticket = ++ticketRef.current;
    setSelection({ status: 'resolving', point });

    void reverseGeocode(point).then((named) => {
      if (ticket !== ticketRef.current) return;
      /**
       * Accuracy and provenance are carried on the place rather than looked up:
       * they are properties of how the point was *obtained*, not of the point. A
       * tapped pin is exact by definition — the user pointed at it — so it has no
       * accuracy figure, and only a device fix does.
       */
      const place: PickedPlace = {
        ...named,
        ...(origin.accuracyMetres === undefined ? {} : { accuracyMetres: origin.accuracyMetres }),
        source: origin.source ?? 'manual',
      };
      /**
       * reverseGeocode never rejects — on a failed or empty lookup it returns
       * formatted coordinates with a null address, by design, so a pin is never
       * lost to a geocoding outage. That null is therefore the only honest
       * signal that nothing was identified here, and it is what this keys on.
       * No address is invented either way.
       */
      setSelection({ status: place.address ? 'named' : 'unnamed', point, place });
    });
    },
    [],
  );

  const retry = useCallback(() => {
    if (!selection) return;
    // Keep the provenance the point arrived with: retrying the *name* must not
    // quietly upgrade a vague device fix into an exact-looking manual pin.
    resolve(
      selection.point,
      selection.status === 'resolving'
        ? {}
        : {
            ...(selection.place.accuracyMetres === undefined
              ? {}
              : { accuracyMetres: selection.place.accuracyMetres }),
            ...(selection.place.source ? { source: selection.place.source } : {}),
          },
    );
  }, [selection, resolve]);

  /** Locating is its own action with its own outcome, like in the picker. */
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<FixFailure | null>(null);

  /**
   * "Where I am now" as a meeting point, in one tap.
   *
   * The whole flow the pin already has, entered from the device instead of from
   * a tap: it drops the pin, names it, checks whether a driver can reach it, and
   * leaves it adjustable. Deliberately not `useGeolocation`'s `center`, which
   * falls back to the last known position and then to the configured city — a
   * button that drops a "you are here" pin on Chennai's centroid after the
   * permission was denied would be worse than one that says it was denied.
   */
  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocateError(null);

    const fix = await getPreciseLocation();
    setLocating(false);

    if (fix.status !== 'ok') {
      setLocateError(fix.status);
      return;
    }
    resolve(fix.point, { accuracyMetres: fix.accuracyMetres, source: 'device' });
  }, [resolve]);

  /**
   * Can a driver get to the pin?
   *
   * Keyed on the rounded coordinate, so tapping the same spot twice — or
   * accepting a roadside suggestion and landing back on it — is free. The pin's
   * *name* comes from the ticket-guarded lookup above; this is a second, separate
   * question about the same point, and react-query's key makes staleness
   * impossible in the same way.
   */
  const pinKey = selection
    ? `${selection.point[0].toFixed(5)},${selection.point[1].toFixed(5)}`
    : null;

  const roadQuery = useQuery({
    queryKey: ['pickup-road', pinKey],
    queryFn: () => pickupService.nearestRoad(selection!.point),
    enabled: pinKey !== null,
    staleTime: 10 * 60_000,
  });

  /**
   * Null while the answer is unknown *or* the lookup failed, and that is the
   * point: a road-network outage says nothing about this place, so it renders as
   * nothing rather than as a warning the user cannot act on.
   */
  const advice = roadQuery.data ? pickupAdvice(roadQuery.data) : null;

  /**
   * Camera target, in priority order: a meeting point already chosen, then the
   * destination, then the device. Stable across renders — see the note on
   * `draft` for why that is load-bearing.
   */
  const focus = draft.meetingPoint ?? draft.destination;
  const center = useMemo<LngLat | null>(
    () => (focus ? [focus.lng, focus.lat] : deviceCenter),
    [focus, deviceCenter],
  );

  /**
   * Both flags on one map. The destination is drawn even though it cannot be
   * moved here, because "where we are going" and "where we meet first" are the
   * two things this screen must never let anyone confuse — and MarkerCard
   * already gives them a different colour *and* a different glyph.
   */
  const entities = useMemo<MapEntity[]>(() => {
    const out: MapEntity[] = [];

    if (draft.destination) {
      out.push({
        id: 'draft-destination',
        layer: 'squads',
        position: [draft.destination.lng, draft.destination.lat],
        title: draft.destination.label,
        marker: 'destination',
      });
    }

    if (selection) {
      out.push({
        id: 'draft-meeting',
        layer: 'squads',
        position: selection.point,
        title: selection.status === 'resolving' ? 'Meeting point' : selection.place.label,
        marker: 'meeting',
      });
    }

    return out;
  }, [draft.destination, selection]);

  /** Sanity-check line on the card: how far the pin is from the destination. */
  const offsetFromDestination = useMemo(() => {
    if (!draft.destination || !selection) return null;
    return haversine(
      [draft.destination.lng, draft.destination.lat],
      [selection.point[0], selection.point[1]],
    );
  }, [draft.destination, selection]);

  /** Leaving without choosing returns the draft exactly as it arrived. */
  const backHref = squadNewHref(draft);

  const confirm = () => {
    if (!selection || selection.status === 'resolving') return;
    /**
     * `replace`, not `push`: the user arrived here from the create form, so
     * pushing would leave /location sitting between the form and itself and
     * make Back bounce them into the picker they just finished with.
     *
     * Only `meetingPoint` is replaced. Every other field — destination
     * included — is passed straight back out of the draft it came in on.
     */
    const snap = roadQuery.data;

    /**
     * The road distance is attached here rather than when it arrives.
     *
     * It is a second, slower answer about the same pin, and folding it into
     * state as it lands would re-render the card for a number the card does not
     * show. `roadQuery` is keyed on the pin's own coordinates, so by the time
     * this runs the answer either belongs to this pin or is absent.
     *
     * Only a positive confirmation is carried. `no-road` and a failed lookup
     * both leave it off entirely — there is no coordinate to invent and no
     * distance to claim, and absent already means "not confirmed".
     */
    const meetingPoint: PickedPlace = {
      ...selection.place,
      ...(snap?.status === 'ok' ? { roadDistanceMetres: snap.distanceMetres } : {}),
    };

    router.replace(squadNewHref({ ...draft, meetingPoint }));
  };

  if (!config.mapbox.token) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <MapPinOff className="h-6 w-6 text-ink-subtle" />
        <div>
          <p className="font-display text-[15px] font-semibold text-ink">Map unavailable</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            The map can&apos;t load right now, so a meeting point can&apos;t be picked here.
            You can still search for one by name on the squad form.
          </p>
        </div>
        <Link href={backHref}>
          <Button variant="secondary">Back to squad</Button>
        </Link>
      </div>
    );
  }

  return (
    /**
     * Column, not a card floating over the map.
     *
     * mapbox-gl attaches its logo control to the bottom-left of the canvas
     * unconditionally — `attributionControl: false` does not remove it — so a
     * full-width card absolutely positioned at the bottom sits directly on top
     * of it at phone widths, which is both a covered map control and a Mapbox
     * attribution the terms require to stay visible. Docking the card *below*
     * the canvas removes the overlap by construction rather than by guessing an
     * offset that would have to track the card's changing height.
     *
     * overflow-hidden is the backstop for the "no horizontal scroll" rule.
     */
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-canvas">
      {/* min-h-0 lets this actually shrink: a flex child defaults to its
          content's minimum size, which for a map canvas would push the card
          off the bottom of the screen. */}
      <div className="relative min-h-0 flex-1">
        <MapCanvas
          mode="explore"
          layers={PICK_LAYERS}
          entities={entities}
          center={center}
          zoom={PICK_ZOOM}
          onMapClick={resolve}
          /* The self puck is drawn at `center`, which here is usually the
             destination rather than the device — it would plant a "you are here"
             dot somewhere the user is not. */
          showSelf={false}
        />

        {/* --- header -------------------------------------------------------
            Overlaid rather than docked, so it costs the map no height. Top-left
            is safe: the only control mapbox renders is the bottom-left logo.
            pointer-events-none on the tray means the map stays pannable
            everywhere around the panel. */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0',
            'pt-[calc(0.75rem+env(safe-area-inset-top))]',
            'pl-[calc(0.75rem+env(safe-area-inset-left))]',
            'pr-[calc(0.75rem+env(safe-area-inset-right))]',
          )}
        >
          <div className="pointer-events-auto mx-auto flex w-full max-w-md items-start gap-2 rounded-xl border border-line bg-surface p-2.5 shadow-float backdrop-blur-sm">
            <Link
              href={backHref}
              aria-label="Back to squad"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </Link>

            <div className="min-w-0 flex-1 py-0.5">
              <h1 className="truncate font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">
                Choose meeting point
              </h1>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                Choose where everyone should meet before travelling together.
              </p>

              {/* The destination, restated. Someone who taps into a full-screen
                  map two screens deep loses track of which of the two places
                  they are answering for, and picking the destination again as
                  the meeting point is the specific mistake that produces a
                  squad where nobody actually meets. */}
              {draft.destination ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-subtle">
                  <Flag className="h-3 w-3 shrink-0" style={{ color: '#2979ff' }} aria-hidden />
                  <span className="truncate">
                    Going to{' '}
                    <span className="text-ink-muted">
                      {draft.destination.label.split(',')[0]}
                    </span>
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* --- locate me ----------------------------------------------------
            Bottom-right of the canvas: mapbox's logo control is bottom-left and
            has to stay visible, and the top is taken by the header panel. */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0',
            'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
            'pr-[calc(0.75rem+env(safe-area-inset-right))]',
          )}
        >
          <div className="mx-auto flex w-full max-w-md justify-end">
            <button
              type="button"
              onClick={() => void locateMe()}
              disabled={locating}
              aria-label="Drop the pin at my current location"
              className={cn(
                'pointer-events-auto flex h-11 items-center gap-2 rounded-xl border border-line',
                'bg-surface px-3.5 text-[13px] font-medium text-ink shadow-float backdrop-blur-sm',
                'transition-colors hover:bg-surface-sunken disabled:opacity-70',
              )}
            >
              {locating ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span role={locating ? 'status' : undefined}>
                {locating ? 'Finding you…' : 'My location'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* --- confirmation card ------------------------------------------------
          Always mounted, contents swap by state, so the map does not resize
          under the user's finger between tapping and confirming. */}
      <div
        className={cn(
          'shrink-0 border-t border-line bg-surface px-4 pt-4',
          'pb-[calc(1rem+env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            Meeting point
          </p>

          {/* Capped and scrollable so a long address in landscape, where the
              whole viewport is ~320px tall, cannot grow the card until the map
              has no room left. The button lives outside this box and so can
              never be scrolled out of reach. */}
          <div className="mt-2.5 max-h-[34dvh] min-h-[46px] overflow-y-auto">
            {selection === null ? (
              <p className="text-[13.5px] leading-relaxed text-ink-muted">
                Tap anywhere on the map to drop a pin where everyone regroups
                {draft.destination ? ' before heading out' : ''}.
              </p>
            ) : selection.status === 'resolving' ? (
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-ink-subtle" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink" role="status">
                    Finding this place…
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] tabular-nums text-ink-subtle">
                    {selection.point[1].toFixed(5)}, {selection.point[0].toFixed(5)}
                  </p>
                </div>
              </div>
            ) : selection.status === 'named' ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0">
                  {/* break-words, not truncate: a meeting point people have to
                      find is the one string on this card that must be readable
                      in full, and at 320px an address does not fit on a line. */}
                  <p className="break-words text-[14px] font-medium leading-snug text-ink">
                    {selection.place.label}
                  </p>
                  {selection.place.address ? (
                    <p className="mt-0.5 break-words text-[12.5px] leading-snug text-ink-muted">
                      {selection.place.address}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink" role="status">
                    Couldn&apos;t identify this location
                  </p>
                  {/* The coordinates are real and were tapped by the user, so
                      they are shown and can be confirmed. No address is
                      invented to fill the gap. */}
                  <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                    Confirm the pin at{' '}
                    <span className="tabular-nums">
                      {selection.point[1].toFixed(5)}, {selection.point[0].toFixed(5)}
                    </span>
                    , try again, or tap somewhere else.
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-2.5"
                    onClick={retry}
                    aria-label="Look up this location again"
                  >
                    <RotateCw className="h-4 w-4" aria-hidden />
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* --- can a driver get here? ---------------------------------------
              The searched place and the place a car can stop are not the same
              thing, and this is the whole of the difference. Nothing below moves
              the pin on its own: the roadside point is offered as a tap, and
              anything further out is reported and left alone. */}
          {selection && selection.status !== 'resolving' && advice ? (
            advice.kind === 'roadside' ? (
              <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-subtle">
                <Car className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>A driver can pull up right here.</span>
              </p>
            ) : advice.kind === 'suggest' ? (
              <div className="mt-2.5 rounded-lg bg-surface-sunken px-3 py-2.5">
                <p className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted">
                  <Car className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    This spot is {formatDistance(advice.distanceMetres)} from the nearest road a
                    car can use.
                  </span>
                </p>
                <button
                  type="button"
                  /* The one place a pin may land somewhere the user did not point
                     at — and only because they tapped this to accept it. The
                     provenance is recorded as `roadside` so what is saved says
                     plainly that it was a suggestion, not a direct choice. */
                  onClick={() => resolve(advice.point, { source: 'suggestion' })}
                  className="mt-2 min-h-[36px] rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-sunken"
                >
                  Move the pin to the roadside
                </button>
              </div>
            ) : advice.kind === 'far' ? (
              <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                {/* No coordinate is offered at this distance. The nearest road
                    could be on the far side of a wall, a railway line or a
                    river, and moving the pin there would be a guess dressed up
                    as help. */}
                <span>
                  The nearest road a car can use is {formatDistance(advice.distanceMetres)} away.
                  Fine to walk to — but a driver can&apos;t reach this exact spot.
                </span>
              </p>
            ) : advice.kind === 'no-road' ? (
              <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <span>No road a car can use was found near this pin.</span>
              </p>
            ) : null
          ) : null}

          {/* A device fix is only as good as the fix. Saying so is the whole
              difference between a meeting point and a rough area. */}
          {selection &&
          selection.status !== 'resolving' &&
          selection.place.accuracyMetres !== undefined &&
          selection.place.accuracyMetres > VAGUE_FIX_METRES ? (
            <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                Your device placed you to within about{' '}
                {formatDistance(selection.place.accuracyMetres)}. Drag the map and tap the exact
                spot if that isn&apos;t close enough.
              </span>
            </p>
          ) : null}

          {locateError ? (
            <p
              role="status"
              className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                {locateError === 'denied'
                  ? 'Location permission is off, so we can’t place you. Tap the map instead.'
                  : locateError === 'timeout'
                    ? 'Finding you took too long. Try again, or tap the map instead.'
                    : 'Your device couldn’t provide a location. Tap the map instead.'}
              </span>
            </p>
          ) : null}

          {offsetFromDestination !== null && draft.destination ? (
            <p className="mt-2.5 border-t border-line pt-2.5 text-[12px] leading-snug text-ink-subtle">
              {formatDistance(offsetFromDestination)} from{' '}
              {draft.destination.label.split(',')[0]}
            </p>
          ) : null}

          {/* Nothing to carry back to yet, so this is the honest state to show
              rather than pretending a squad is waiting. The pin is still kept:
              confirming takes it to the create form and asks for a destination
              there. */}
          {!draft.destination ? (
            <p className="mt-2.5 rounded-lg bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
              No squad in progress. Confirming keeps this pin and takes you to the squad
              form to pick a destination.
            </p>
          ) : null}

          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={selection === null}
            loading={selection?.status === 'resolving'}
            onClick={confirm}
          >
            Confirm meeting point
          </Button>
        </div>
      </div>
    </div>
  );
}

function MeetingPointParams() {
  const params = useSearchParams();
  return <MeetingPointPicker query={params.toString()} />;
}

/**
 * Full-screen meeting-point picker.
 *
 * Deliberately outside the `(app)` route group. This screen owns the whole
 * viewport and carries its own back button and title, so the shell's top bar
 * would be a second header, and its floating dock and help button would sit on
 * top of the confirmation card at exactly the bottom of the screen. `RequireAuth`
 * is applied directly instead, so the route is gated exactly as the rest of the
 * app is, without the chrome. Providers are mounted at the root layout, so the
 * auth session and query client are already in scope here.
 *
 * `useSearchParams` needs a Suspense boundary or the production build fails on
 * this route — same pattern as `/squads/new`.
 */
export default function ChooseMeetingPointPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="flex h-dvh w-full items-center justify-center bg-canvas">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand"
              role="status"
              aria-label="Loading map"
            />
          </div>
        }
      >
        <MeetingPointParams />
      </Suspense>
    </RequireAuth>
  );
}

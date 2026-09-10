'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Car, Circle, Clock, Search, Square, User, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { ridesService } from '@/lib/services/rides';
import { squadsService } from '@/lib/services/squads';
import { SQUAD_PURPOSES } from '@/lib/squad-purpose';
import { MapCanvas } from '@/components/map/map-canvas';
import { PlacePicker, reverseGeocode, type PickedPlace } from '@/components/shared/place-picker';
import { CalendarWithTimePresets } from '@/components/ui/calendar-with-time-presets';
import { PublishTripToggle } from '@/components/trip/publish-trip-toggle';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { zoomForPlace, type LayerKey } from '@/lib/map/config';
import type { MapEntity, RouteGeometry } from '@/lib/map/types';
import type {
  CompanionKind,
  LngLat,
  Ride,
  RideSearchHit,
  Squad,
  SquadType,
  TripCompanion,
  VehicleType,
} from '@/types';

/**
 * The trip planner — the app's dashboard.
 *
 * One layout serves both modes. "For me" and "Squad" differ only in what the
 * middle column asks and what the map is showing; the trip form on the left
 * and the map on the right are the same components with the same state, so
 * switching modes never loses a half-entered trip.
 */

type Mode = 'me' | 'squad';

const RIDE_OPTIONS: {
  type: VehicleType;
  label: string;
  note: string;
  seats: number;
  Icon: typeof Car;
}[] = [
  { type: 'cab', label: 'Cab', note: 'Sedan or similar', seats: 4, Icon: Car },
  { type: 'auto', label: 'Auto', note: 'Three-wheeler', seats: 3, Icon: Car },
  { type: 'bike', label: 'Bike', note: 'Pillion seat', seats: 1, Icon: Bike },
];

/**
 * Pin colours. These are the legend — each one means a different next action,
 * so they must stay distinguishable from each other and from the route line.
 */
const COMPANION_ACCENT: Record<CompanionKind, string> = {
  /** Has already created a ride there — you can join it. */
  host: 'var(--brand)',
  /** Already riding along on someone's ride. */
  passenger: 'var(--accent)',
  /** Online near you, same campus, no ride yet — invite them. */
  online: '#f5a524',
};

const COMPANION_LABEL: Record<CompanionKind, string> = {
  host: 'Created a ride',
  passenger: 'Going along',
  online: 'Online nearby',
};

const DESTINATION_ACCENT = '#121212';
const MEETING_ACCENT = '#8b5cf6';
/** A matched host — the answer to the search, so it outranks browse pins. */
const MATCH_ACCENT = 'var(--brand)';

const PLANNER_LAYERS: LayerKey[] = ['rides', 'squads', 'friends'];

/**
 * Stable empties. `data?.items ?? []` allocates a fresh array on every render
 * while a query is pending, which defeats memoisation of everything derived
 * from it — including the map's entity list.
 */
const NO_COMPANIONS: TripCompanion[] = [];
const NO_MATCHES: RideSearchHit[] = [];
const NO_RIDES: Ride[] = [];
const NO_SQUADS: Squad[] = [];

function formatWhen(iso: string | null): string {
  if (!iso) return 'Time not set';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time not set';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "walk 300 m" reads better than "0.3 km"; past a kilometre the reverse. */
function formatWalk(metres: number): string {
  return metres < 950 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}

function formatDistance(metres: number | null): string | null {
  if (metres === null) return null;
  return metres < 1000 ? `${metres} m away` : `${(metres / 1000).toFixed(1)} km away`;
}

export function TripPlanner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { center } = useGeolocation();

  const [mode, setMode] = useState<Mode>('me');
  const [pickup, setPickup] = useState<PickedPlace | null>(null);
  const [destination, setDestination] = useState<PickedPlace | null>(null);
  const [departNow, setDepartNow] = useState(true);
  /** Calendar visibility, separate from `departNow` so it can be collapsed. */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [departAt, setDepartAt] = useState(() => new Date(Date.now() + 30 * 60_000));
  const [vehicle, setVehicle] = useState<VehicleType | null>(null);
  /** Squad-mode counterpart of `vehicle` — filters the purpose rows. */
  const [purpose, setPurpose] = useState<SquadType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * The corridor search is explicit, not reactive. It costs real Directions
   * requests per candidate, so it runs when the user asks for it — and the
   * trip they asked about is frozen here so editing the form afterwards does
   * not silently invalidate the results they are reading.
   */
  const [searchedTrip, setSearchedTrip] = useState<{
    origin: LngLat;
    destination: LngLat;
    departAt: string;
  } | null>(null);

  const [meetingPoint, setMeetingPoint] = useState<PickedPlace | null>(null);
  /**
   * Bumped only when a pin is dropped, and used to remount the meeting-point
   * field so it shows the new label. Keying on the point itself would remount
   * mid-typing, because typing clears the value on its way to a new one.
   */
  const [pinNonce, setPinNonce] = useState(0);
  const [pinPending, setPinPending] = useState(false);

  /**
   * The pickup the user typed wins; otherwise wherever they actually are.
   *
   * Memoised, and that is load-bearing rather than tidiness. These are passed to
   * the map as `center`, and SplitMap's camera effect calls `easeTo` whenever
   * `center` changes identity — so a fresh array on every render re-flew the
   * camera on every render, which is what made the map fight a user trying to
   * pan it. The dependency is the coordinate, not the object.
   */
  const originPoint = useMemo<LngLat | null>(
    () => (pickup ? [pickup.lng, pickup.lat] : center),
    // `pickup` and `destination` are state: their identity only changes when a
    // place is actually chosen, so depending on the objects is both correct and
    // as stable as picking the two numbers out of them would have been.
    [pickup, center],
  );
  const destinationPoint = useMemo<LngLat | null>(
    () => (destination ? [destination.lng, destination.lat] : null),
    [destination],
  );

  /**
   * How close to frame the place that was chosen — a building tighter than a
   * city. Undefined once neither end has a feature type to score, which leaves
   * the camera where it is rather than moving it for no reason.
   */
  const placeZoom = zoomForPlace(destination?.precision ?? pickup?.precision);
  const departIso = departNow ? new Date().toISOString() : departAt.toISOString();

  // --- data ---------------------------------------------------------------

  const ridesQuery = useQuery({
    queryKey: ['planner-rides', originPoint, destination?.label, vehicle],
    queryFn: () =>
      ridesService.list({
        near: originPoint ?? undefined,
        radiusKm: 20,
        ...(vehicle ? { vehicleType: vehicle } : {}),
        limit: 20,
      }),
    enabled: mode === 'me' && Boolean(originPoint),
  });

  /**
   * The per-vehicle counts, from the server.
   *
   * Separate from `ridesQuery` on purpose. That one is a capped, optionally
   * vehicle-filtered *page* — deriving counts from it meant the number was
   * really a page size, and picking a vehicle dropped every other row to 0
   * because the refetch excluded them. This asks a different question ("how
   * many exist"), so it is a different request, and it keeps its counts while
   * the list below filters.
   */
  const availabilityQuery = useQuery({
    queryKey: [
      'planner-availability',
      originPoint,
      destinationPoint,
      departIso,
    ],
    queryFn: () =>
      ridesService.availability({
        near: originPoint as LngLat,
        destination: destinationPoint,
        departAt: departIso,
        windowMins: 120,
        radiusKm: 20,
      }),
    enabled: mode === 'me' && Boolean(originPoint),
  });

  const searchQuery = useQuery({
    queryKey: ['ride-search', searchedTrip],
    queryFn: () =>
      ridesService.search({
        origin: searchedTrip!.origin,
        destination: searchedTrip!.destination,
        departAt: searchedTrip!.departAt,
        windowMins: 120,
      }),
    enabled: Boolean(searchedTrip),
  });

  const companionsQuery = useQuery({
    queryKey: ['planner-companions', destinationPoint, departIso, originPoint],
    queryFn: () =>
      ridesService.companions({
        destination: destinationPoint as LngLat,
        destRadiusKm: 5,
        departAt: departIso,
        windowMins: 90,
        near: originPoint,
      }),
    // Without a destination there is nothing to match on — the whole search is
    // "who else is going *there*".
    enabled: mode === 'squad' && Boolean(destinationPoint),
  });

  /**
   * Squads to join. Destination-filtered once one is set, so the list answers
   * "who else is going where I'm going" rather than "what is near me".
   */
  const squadsQuery = useQuery({
    queryKey: ['planner-squads', originPoint, destinationPoint, purpose],
    queryFn: () =>
      squadsService.nearby({
        near: originPoint ?? undefined,
        radiusKm: 25,
        destination: destinationPoint,
        destRadiusKm: 5,
        type: purpose,
        limit: 50,
      }),
    enabled: mode === 'squad' && Boolean(originPoint),
  });

  /** Per-purpose counts, server-side over the whole set — see rides equivalent. */
  const squadCountsQuery = useQuery({
    queryKey: ['planner-squad-counts', originPoint, destinationPoint],
    queryFn: () =>
      squadsService.availability({
        near: originPoint,
        destination: destinationPoint,
        destRadiusKm: 5,
        radiusKm: 25,
      }),
    enabled: mode === 'squad' && Boolean(originPoint),
  });

  /**
   * The squad the user already belongs to, if any.
   *
   * Drives two things that were previously guesswork: the "your squad" card at
   * the top of the list, and the one-squad-at-a-time guard — a join attempt
   * while this is set has to explain that the existing squad must be cancelled
   * first, rather than failing with a 409 the UI turns into "something went
   * wrong".
   */
  const mySquadsQuery = useQuery({
    queryKey: ['squads', 'mine'],
    queryFn: () => squadsService.mine(),
    enabled: mode === 'squad',
  });
  const mySquad = mySquadsQuery.data?.[0] ?? null;

  /**
   * Publishes a hidden squad. Invalidates both the caller's own squads and the
   * discovery queries — the squad moves *into* the nearby list for everyone
   * else the moment this succeeds, and a stale "none nearby" underneath would
   * be the same confusion in a different place.
   */
  const publishSquad = useMutation({
    mutationFn: (id: string) => squadsService.setVisibility(id, 'public'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['squads', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['planner-squads'] });
      void queryClient.invalidateQueries({ queryKey: ['planner-squad-counts'] });
    },
  });

  /**
   * Already filtered by the server — by destination, by purpose, and to squads
   * with room left. The client no longer re-filters: doing both meant the
   * purpose row could show a count the list contradicted.
   */
  const nearbySquads = squadsQuery.data?.items ?? NO_SQUADS;
  const visibleSquads = nearbySquads;
  const matches = searchQuery.data?.items ?? NO_MATCHES;
  const companions = companionsQuery.data?.items ?? NO_COMPANIONS;
  const rides = ridesQuery.data?.items ?? NO_RIDES;

  // --- map ----------------------------------------------------------------

  // Not wrapped in useMemo: the React Compiler is enabled for this project and
  // memoises this automatically from the values it reads, which it can only do
  // if we do not hand-roll a memo it has to preserve.
  const entities: MapEntity[] = (() => {
    const list: MapEntity[] = [];

    if (destinationPoint && destination) {
      list.push({
        id: 'trip-destination',
        layer: 'rides',
        position: destinationPoint,
        title: destination.label,
        subtitle: 'Destination',
        accent: DESTINATION_ACCENT,
      });
    }

    if (meetingPoint) {
      list.push({
        id: 'trip-meeting-point',
        layer: 'squads',
        position: [meetingPoint.lng, meetingPoint.lat],
        title: meetingPoint.label,
        subtitle: 'Meeting point',
        accent: MEETING_ACCENT,
      });
    }

    for (const hit of matches) {
      if (hit.ride.originLat === null || hit.ride.originLng === null) continue;
      list.push({
        id: `match-${hit.ride.id}`,
        layer: 'rides',
        position: [hit.ride.originLng, hit.ride.originLat],
        title: hit.ride.host?.name ?? hit.ride.origin,
        subtitle: `${formatWalk(hit.pickupWalkMetres)} walk`,
        accent: MATCH_ACCENT,
        href: `/rides/${hit.ride.id}`,
      });
    }

    if (mode === 'squad') {
      /**
       * Squads themselves, pinned where they are forming.
       *
       * The map previously showed only *people* in squad mode — companions and
       * the meeting point — so a screen headed "choose a squad" never plotted a
       * single squad. `lat`/`lng` is the squad's centre, which is where its
       * members are gathering from, so the pin answers "is anything happening
       * near me" at a glance rather than requiring a read of the list.
       *
       * The same rows the list uses, so the two cannot disagree: already
       * filtered by the server to public, active, not-full, not-yours, and
       * heading to the searched destination when there is one.
       */
      for (const squad of visibleSquads) {
        if (squad.lat === null || squad.lng === null) continue;
        list.push({
          id: `squad-${squad.id}`,
          layer: 'squads',
          position: [squad.lng, squad.lat],
          title: squad.destination?.label?.split(',')[0] ?? squad.name,
          subtitle: `${squad.memberCount}${
            squad.memberLimit ? `/${squad.memberLimit}` : ''
          } joined${squad.meetingAt ? ` · ${formatWhen(squad.meetingAt)}` : ''}`,
          href: `/squads/${squad.id}`,
        });
      }

      // Your own squad is excluded from the list on purpose, but it belongs on
      // the map — otherwise the one squad you care about is the only one
      // missing from it.
      if (mySquad && mySquad.lat !== null && mySquad.lng !== null) {
        list.push({
          id: `squad-mine-${mySquad.id}`,
          layer: 'squads',
          position: [mySquad.lng, mySquad.lat],
          title: mySquad.name,
          subtitle: 'Your squad',
          accent: MEETING_ACCENT,
          href: `/squads/${mySquad.id}`,
        });
      }

      for (const companion of companions) {
        list.push({
          id: `companion-${companion.user.id}`,
          layer: 'friends',
          position: [companion.lng, companion.lat],
          title: companion.user.name,
          subtitle: COMPANION_LABEL[companion.kind],
          accent: COMPANION_ACCENT[companion.kind],
          live: companion.live,
          imageUrl: companion.user.profilePhoto,
          ...(companion.rideId ? { href: `/rides/${companion.rideId}` } : {}),
        });
      }
    } else {
      for (const ride of rides) {
        if (ride.originLat === null || ride.originLng === null) continue;
        list.push({
          id: `ride-${ride.id}`,
          layer: 'rides',
          position: [ride.originLng, ride.originLat],
          title: ride.destination,
          subtitle: formatWhen(ride.departureTime),
          href: `/rides/${ride.id}`,
        });
      }
    }

    return list;
  })();

  /**
   * The host's road route, drawn only for the match the user is looking at.
   * Painting every candidate's route at once turns the map into spaghetti and
   * hides the one thing the selection is meant to answer.
   */
  const selectedMatch = matches.find((hit) => selectedId === `match-${hit.ride.id}`) ?? null;
  const selectedRoute: RouteGeometry | null = selectedMatch?.route
    ? { coordinates: selectedMatch.route }
    : null;

  const canSearchSquad = Boolean(destinationPoint);
  const meetingSuggestion = companionsQuery.data?.meetingSuggestion ?? null;

  /** Shared by the pin-drop handler and the "use the midpoint" shortcut. */
  const adoptMeetingPoint = (point: LngLat) => {
    setPinPending(true);
    void reverseGeocode(point)
      .then((place) => {
        setMeetingPoint(place);
        setPinNonce((nonce) => nonce + 1);
      })
      .finally(() => setPinPending(false));
  };

  /**
   * Only armed in squad mode. Handing the map a click handler in "For me" mode
   * would turn every dismissing tap into an accidental meeting point.
   */
  const handleMapClick = mode === 'squad' ? adoptMeetingPoint : undefined;

  // --- render -------------------------------------------------------------

  return (
    /**
     * Recessed page, raised panels.
     *
     * This used to force `bg-surface-sunken` because the canvas was a near-white
     * two percent off the panels, so nothing had an edge. The canvas now sits a
     * proper step below the surface globally, so this uses it — the workaround
     * would otherwise make the planner visibly darker than every other screen.
     */
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col gap-3 bg-canvas p-3 sm:gap-4 sm:p-4 xl:h-[calc(100dvh-4rem)] xl:flex-row">
      {/* Left: the trip itself. Identical in both modes by design — switching
          to Squad must never make someone re-enter where they are going. */}
      <aside className="shrink-0 rounded-2xl border border-line bg-surface shadow-soft xl:flex xl:w-[356px] xl:flex-col">
        <div className="border-b border-line px-5 py-4">
          {/*
            Mode-aware. "Find a trip" described the ride flow and stayed put
            when the tabs switched, so squad mode opened with a heading about
            trips over a body about people. The panel is shared; the words
            about what it is for cannot be.
          */}
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-ink">
            {mode === 'squad' ? 'Find your travel partner' : 'Find a trip'}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {/* Curly apostrophe, not &apos;: these are JS string literals, not
                JSX text, so an HTML entity would render as the literal
                characters. The lint rule that wants &apos; only applies to the
                latter. */}
            {mode === 'squad'
              ? 'Where you’re going, and who else is going there.'
              : 'Where you’re going, and who with.'}
          </p>
        </div>

        <div className="px-5 py-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Circle className="mt-3.5 h-3 w-3 shrink-0 fill-ink text-ink" />
            <div className="min-w-0 flex-1">
              <PlacePicker
                label="Pickup point"
                value={pickup}
                onChange={setPickup}
                placeholder={center ? 'Current location' : 'Pickup point'}
                proximity={center}
                /* Where you are is a plausible pickup point, so this field is one
                   of the four that offers to fetch it. The destination field
                   below deliberately does not. */
                allowCurrentLocation
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Square className="mt-3.5 h-3 w-3 shrink-0 fill-ink text-ink" />
            <div className="min-w-0 flex-1">
              <PlacePicker
                label="Destination"
                value={destination}
                onChange={setDestination}
                placeholder="Where to?"
                proximity={center}
              />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
            {/*
              Two controls, not one. The row's right-hand action switches
              between "now" and "scheduled"; tapping the row itself opens or
              closes the calendar. Previously the calendar's visibility *was*
              `!departNow`, so it could only be closed by reverting to "now" —
              which is why it stayed open over the rest of the form after a
              date and time had already been chosen.
            */}
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
                  {departNow ? 'Pick up now' : formatWhen(departAt.toISOString())}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDepartNow((now) => !now);
                  setCalendarOpen(departNow);
                }}
                className="shrink-0 text-[12px] font-medium text-brand"
              >
                {departNow ? 'Schedule' : 'Now'}
              </button>
            </div>
            {!departNow && calendarOpen ? (
              <CalendarWithTimePresets
                value={departAt}
                onChange={setDepartAt}
                // Collapse once a time is tapped: the choice is complete, and
                // the search button below it is the next thing wanted.
                onDone={() => setCalendarOpen(false)}
                className="mt-2.5"
              />
            ) : null}
          </div>

          {/* Mode switch. Both options render the same three-column shell —
              only the middle column and the map layers change. */}
          <div
            role="tablist"
            aria-label="Who is this trip for"
            className="flex gap-1 rounded-lg border border-line bg-surface p-1"
          >
            {(
              [
                /*
                 * "For me" was ambiguous — it reads as a filter scope ("my
                 * stuff") rather than a way of travelling. Both labels now name
                 * the arrangement: alone in someone else's vehicle, or as a
                 * group traveling together.
                 */
                { key: 'me', label: 'Solo ride', Icon: User },
                { key: 'squad', label: 'Group squad', Icon: Users },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                role="tab"
                aria-selected={mode === option.key}
                onClick={() => {
                  setMode(option.key);
                  setSelectedId(null);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium',
                  'transition-colors duration-snap',
                  mode === option.key
                    ? 'bg-ink text-canvas'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <option.Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!originPoint || !destinationPoint || searchQuery.isFetching}
            onClick={() =>
              originPoint &&
              destinationPoint &&
              setSearchedTrip({
                origin: originPoint,
                destination: destinationPoint,
                departAt: departIso,
              })
            }
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-xl',
              'bg-ink text-[15px] font-medium text-canvas transition-all duration-snap',
              'hover:opacity-90 active:scale-[0.99]',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <Search className="h-4 w-4" />
            {searchQuery.isFetching
              ? 'Searching…'
              : mode === 'squad'
                ? 'Find squad'
                : 'Find a ride'}
          </button>

          {/*
            PublishTripToggle used to sit here, directly under Find a ride.
            Two full-width buttons stacked in the search form read as two ways
            to do the same thing, when they are opposite roles: one searches for
            a host, the other advertises you *to* hosts. Neither is useful until
            the search has actually come back empty, so it now lives in the
            empty state where it answers a question the guest has just been
            asked. See the "No rides going yet" branch.
          */}
          {!destinationPoint ? (
            <p className="text-center text-[12px] text-ink-subtle">
              Add a destination to search.
            </p>
          ) : null}
        </div>

        {mode === 'squad' ? (
          <div className="mt-5">
            <h3 className="text-[13px] font-semibold text-ink">Meeting point</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              Search for a spot, or click anywhere on the map to drop a pin.
            </p>
            <div className="mt-2.5">
              <PlacePicker
                label="Meeting point"
                key={`meeting-${pinNonce}`}
                value={meetingPoint}
                onChange={setMeetingPoint}
                placeholder={pinPending ? 'Reading the pin…' : 'Somewhere in the middle'}
                proximity={originPoint}
                allowCurrentLocation
              />
            </div>
            {meetingSuggestion && !meetingPoint ? (
              <button
                type="button"
                onClick={() =>
                  adoptMeetingPoint([meetingSuggestion.lng, meetingSuggestion.lat])
                }
                className="mt-2 text-[12px] font-medium text-brand hover:underline"
              >
                Use the midpoint of everyone&apos;s pickups
              </button>
            ) : null}

            <dl className="mt-5 space-y-2">
              {(Object.keys(COMPANION_ACCENT) as CompanionKind[]).map((kind) => (
                <div key={kind} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COMPANION_ACCENT[kind] }}
                  />
                  <dt className="text-[12px] text-ink-muted">{COMPANION_LABEL[kind]}</dt>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: MEETING_ACCENT }}
                />
                <dt className="text-[12px] text-ink-muted">Meeting point</dt>
              </div>
            </dl>
          </div>
        ) : null}
        </div>
      </aside>

      {/* Centre: what you can actually pick. */}
      {/**
       * `overflow-y-auto` at every width, not just xl.
       *
       * This was `overflow-hidden` with scrolling added back only at xl. Below
       * that the section is a `flex-1` item — basis 0 — so anything taller than
       * the space it was given was clipped with no scrollbar to reach it. Squad
       * mode has more rows than ride mode, so its lower half simply vanished.
       */}
      <section className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-2xl border border-line bg-surface px-5 py-6 shadow-soft sm:px-7 sm:py-7">
        {mode === 'me' ? (
          <>
            {/* "Choose a ride" read like a fare picker — as if tapping Cab
                would hail one. It does not: this is a filter over rides other
                students have already posted. The heading now names the
                situation, and the line under it says what the rows do. */}
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
              {searchedTrip ? 'Rides going your way' : 'Travelling on your own?'}
            </h1>
            {searchedTrip ? null : (
              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-muted">
                Hop in with someone already driving your way and split the fare.
                Pick what you&apos;d ride in — we&apos;ll show who&apos;s going.
              </p>
            )}

            {searchedTrip ? (
              <div className="mt-6">
                {searchQuery.isFetching ? (
                  <div className="space-y-2">
                    <Skeleton className="h-[86px] w-full rounded-2xl" />
                    <Skeleton className="h-[86px] w-full rounded-2xl" />
                  </div>
                ) : searchQuery.isError ? (
                  <EmptyState
                    tone="error"
                    title="Search failed"
                    description={
                      searchQuery.error instanceof Error
                        ? searchQuery.error.message
                        : 'Something went wrong.'
                    }
                    action={
                      <Button size="sm" onClick={() => void searchQuery.refetch()}>
                        Retry
                      </Button>
                    }
                  />
                ) : matches.length === 0 ? (
                  <EmptyState
                    title="Nobody driving past yet"
                    description={`No host's route passes within ${formatWalk(
                      searchQuery.data?.corridorMetres ?? 1500,
                    )} of both your pickup and your drop-off in this window. Post the trip and let a host find you.`}
                    action={
                      <Button size="sm" onClick={() => router.push('/rides/new')}>
                        Post it
                      </Button>
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {matches.map((hit) => (
                      <MatchRow
                        key={hit.ride.id}
                        hit={hit}
                        selected={selectedId === `match-${hit.ride.id}`}
                        onHover={() => setSelectedId(`match-${hit.ride.id}`)}
                      />
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setSearchedTrip(null)}
                  className="mt-5 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  ← Back to browsing
                </button>
              </div>
            ) : (
            <>
            <ul className="mt-6 space-y-1">
              {RIDE_OPTIONS.map((option) => {
                const matching = availabilityQuery.data?.counts[option.type] ?? 0;
                const active = vehicle === option.type;
                return (
                  <li key={option.type}>
                    <button
                      type="button"
                      onClick={() => setVehicle(active ? null : option.type)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left',
                        'transition-colors duration-snap',
                        active
                          ? 'border-ink bg-surface-sunken'
                          : 'border-transparent hover:bg-surface-sunken',
                      )}
                    >
                      <option.Icon className="h-8 w-8 shrink-0 text-ink" strokeWidth={1.25} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-display text-[19px] font-semibold text-ink">
                            {option.label}
                          </span>
                          <span className="flex items-center gap-0.5 text-[12px] text-ink-muted">
                            <User className="h-3 w-3" />
                            {option.seats}
                          </span>
                        </span>
                        <span className="block truncate text-[13px] text-ink-muted">
                          {option.note}
                        </span>
                      </span>
                      {/*
                        "nearby" vs "going your way": with a destination set the
                        count is corridor-filtered, so calling it "nearby" would
                        under-describe it — and worse, a guest comparing "2
                        nearby" against an empty list would think the list was
                        broken when the two were answering different questions.
                      */}
                      <span className="shrink-0 text-[13px] font-medium text-ink-muted">
                        {availabilityQuery.isPending
                          ? '—'
                          : `${matching} ${
                              availabilityQuery.data?.directional ? 'going your way' : 'nearby'
                            }`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 border-t border-line pt-6">
              {ridesQuery.isPending && originPoint ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : rides.length === 0 ? (
                /**
                 * The empty state is where the two roles get separated.
                 *
                 * It previously offered only "Offer a ride" — a host action, on
                 * a screen someone reached by looking for a seat. Combined with
                 * the publish toggle in the sidebar it gave two create buttons
                 * meaning different things, neither labelled by role.
                 *
                 * Now the primary action matches why the guest is here: nobody
                 * is driving this route yet, so make yourself visible and let a
                 * host come to you. Driving is offered underneath, named as the
                 * different thing it is.
                 */
                <div className="rounded-2xl border border-line bg-surface-sunken px-5 py-6 text-center">
                  <p className="font-display text-[16px] font-semibold text-ink">
                    No rides going your way yet
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                    {destination
                      ? `Nobody has posted a ride to ${destination.label.split(',')[0]} around this time.`
                      : 'Nobody has posted a ride near you for this window.'}{' '}
                    Publish your trip and drivers heading this way can offer you a seat.
                  </p>

                  <div className="mx-auto mt-4 max-w-sm text-left">
                    <PublishTripToggle
                      pickup={pickup}
                      destination={destination}
                      originPoint={originPoint}
                      departAt={departIso}
                    />
                  </div>

                  <p className="mt-4 text-[12.5px] text-ink-subtle">
                    Driving yourself?{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/rides/new')}
                      className="font-medium text-brand hover:underline"
                    >
                      Offer a ride instead
                    </button>
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {rides.slice(0, 8).map((ride) => (
                    <li key={ride.id}>
                      <Link
                        href={`/rides/${ride.id}`}
                        onMouseEnter={() => setSelectedId(`ride-${ride.id}`)}
                        className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors duration-snap hover:border-line-strong"
                      >
                        <Avatar
                          src={ride.host?.profilePhoto ?? null}
                          name={ride.host?.name ?? 'Host'}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-ink">
                            {ride.origin} → {ride.destination}
                          </span>
                          <span className="block truncate text-[12.5px] text-ink-muted">
                            {formatWhen(ride.departureTime)} ·{' '}
                            {Math.max(ride.seats - ride.seatsTaken, 0)} seats left
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
              Choose a squad
            </h1>
            <p className="mt-2 text-[14px] text-ink-muted">
              {destination
                ? `Spllit users heading to ${destination.label} around ${formatWhen(departIso)}.`
                : 'Set a destination and we will find people heading there at the same time.'}
            </p>

            {/* Same structure as "Choose a ride": pick the kind of trip first,
                then look at who is going. Squad mode used to jump straight to a
                list of faces, which gave it no way in and made the two modes
                feel like different products. */}
            {/*
              The squad you are already in, pinned above the list.
              /nearby deliberately excludes it — it is not something to join —
              but it still has to be reachable, and this is the screen people
              land on. Without it, a leader had no route back to their own squad
              from here and the "you already have a squad" rule looked arbitrary.
            */}
            {mySquad ? (
              <div className="mt-5 rounded-2xl border border-brand/40 bg-brand-muted px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-[18px]">
                    <span aria-hidden="true">
                      {SQUAD_PURPOSES.find((p) => p.value === mySquad.type)?.icon ?? '👥'}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {mySquad.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                      Your squad ·{' '}
                      {mySquad.memberCount === 1
                        ? 'nobody has joined yet'
                        : `${mySquad.memberCount} members`}
                      {mySquad.memberLimit
                        ? ` of ${mySquad.memberLimit}`
                        : ''}
                    </p>
                  </div>
                  <Link
                    href={`/squads/${mySquad.id}`}
                    className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
                  >
                    See details
                  </Link>
                </div>

                {/*
                  An invite-only squad is excluded from discovery by design, and
                  nothing said so — the leader saw a healthy squad while every
                  other account saw nothing, which is indistinguishable from
                  discovery being broken. Two test accounts found exactly this.
                  State it where the squad is, and make it one tap to fix.
                */}
                {mySquad.visibility !== 'public' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-muted px-3.5 py-2.5">
                    <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
                      <span className="font-medium text-ink">Invite only.</span> Nobody
                      can find this squad by searching — it opens only to people you
                      send the link or code to.
                    </p>
                    <button
                      type="button"
                      disabled={publishSquad.isPending}
                      onClick={() => publishSquad.mutate(mySquad.id)}
                      className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {publishSquad.isPending ? 'Publishing…' : 'Make it public'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ul className="mt-6 space-y-1">
              {SQUAD_PURPOSES.slice(0, 5).map((option) => {
                // Server-side count over the whole set, not a filter of the
                // capped page below — which is why every row used to read 0.
                const matching = squadCountsQuery.data?.counts[option.value] ?? 0;
                const active = purpose === option.value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => setPurpose(active ? null : option.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left',
                        'transition-colors duration-snap',
                        active
                          ? 'border-ink bg-surface-sunken'
                          : 'border-transparent hover:bg-surface-sunken',
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[22px]">
                        <span aria-hidden="true">{option.icon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[19px] font-semibold text-ink">
                          {option.label}
                        </span>
                        <span className="block truncate text-[13px] text-ink-muted">
                          {matching === 0
                            ? destination
                              ? 'None heading there yet'
                              : 'None forming near you'
                            : `${matching} squad${matching === 1 ? '' : 's'} ${
                                squadCountsQuery.data?.directional
                                  ? 'heading there'
                                  : 'forming nearby'
                              }`}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-medium text-ink-muted">
                        {squadCountsQuery.isPending ? '—' : matching}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Squads matching the chosen purpose. Selecting a row has to *do*
                something — a filter that only recolours itself is a control
                that lies about being one. */}
            {purpose ? (
              <div className="mt-5">
                {squadsQuery.isPending ? (
                  /* Skeletons rather than a premature "none found": the two are
                     indistinguishable to a reader, and telling someone nothing
                     exists while still looking is the more damaging of the two
                     to get wrong. */
                  <div className="space-y-2">
                    <Skeleton className="h-[68px] w-full rounded-2xl" />
                    <Skeleton className="h-[68px] w-full rounded-2xl" />
                  </div>
                ) : visibleSquads.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-surface-sunken px-5 py-6 text-center">
                    <p className="font-display text-[16px] font-semibold text-ink">
                      {destination
                        ? 'No squad heading there yet'
                        : 'No squad forming near you'}
                    </p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                      {destination
                        ? `Nobody has started a ${
                            SQUAD_PURPOSES.find((p) => p.value === purpose)?.label.toLowerCase() ??
                            ''
                          } squad to ${destination.label.split(',')[0]} yet. Start one and people going the same way can find it.`
                        : 'Start one and people going the same way can find it.'}
                    </p>
                    {mySquad ? (
                      /* One squad at a time. Saying so here — where the button
                         would be — beats letting them press it and meet a 409
                         they cannot act on. */
                      <p className="mx-auto mt-4 max-w-sm rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                        You already lead <span className="font-medium text-ink">{mySquad.name}</span>.
                        Cancel it from its page before starting another.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={() => router.push('/squads/new')}
                      >
                        Start a squad
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {visibleSquads.slice(0, 6).map((squad) => {
                      const full =
                        squad.memberLimit !== null &&
                        squad.memberLimit !== undefined &&
                        squad.memberCount >= squad.memberLimit;
                      return (
                      <li key={squad.id}>
                        <Link
                          href={`/squads/${squad.id}`}
                          onMouseEnter={() => setSelectedId(`squad-${squad.id}`)}
                          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-soft transition-colors duration-snap hover:border-line-strong"
                        >
                          <Avatar
                            src={squad.leader?.profilePhoto ?? null}
                            name={squad.leader?.name ?? 'Leader'}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-ink">
                              {squad.destination?.label?.split(',')[0] ?? squad.name}
                            </span>
                            <span className="block truncate text-[12.5px] text-ink-muted">
                              {squad.memberCount}
                              {squad.memberLimit ? `/${squad.memberLimit}` : ''} joined
                              {squad.meetingAt ? ` · ${formatWhen(squad.meetingAt)}` : ''}
                            </span>
                          </span>
                          {/*
                            A full squad should not reach this list at all — the
                            server filters them out. This badge is the safety
                            net for the gap between a join landing elsewhere and
                            this page refetching, so the row degrades to "Full"
                            instead of inviting a click that cannot succeed.
                          */}
                          {full ? (
                            <span className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted">
                              Full
                            </span>
                          ) : (
                            <span className="shrink-0 text-[12.5px] font-semibold text-brand">
                              Join
                            </span>
                          )}
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="mt-7 border-t border-line pt-6">
              {!canSearchSquad ? (
                <EmptyState
                  title="Where are you going?"
                  description="Pick a destination on the left. We match on where you are heading, not where you start — two people leaving from opposite ends of campus for the same airport are exactly the point."
                />
              ) : companionsQuery.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-[76px] w-full rounded-2xl" />
                  <Skeleton className="h-[76px] w-full rounded-2xl" />
                  <Skeleton className="h-[76px] w-full rounded-2xl" />
                </div>
              ) : companionsQuery.isError ? (
                <EmptyState
                  title="Could not run the search"
                  description={
                    companionsQuery.error instanceof Error
                      ? companionsQuery.error.message
                      : 'Something went wrong.'
                  }
                  action={
                    <Button onClick={() => void companionsQuery.refetch()}>Try again</Button>
                  }
                />
              ) : companions.length === 0 ? (
                <EmptyState
                  title="Nobody yet"
                  description="No one is heading there in this window. Post the ride yourself and people going the same way will find it."
                  action={
                    <Button size="sm" onClick={() => router.push('/rides/new')}>
                      Offer a ride
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {companions.map((companion) => (
                    <CompanionRow
                      key={companion.user.id}
                      companion={companion}
                      selected={selectedId === `companion-${companion.user.id}`}
                      onHover={() => setSelectedId(`companion-${companion.user.id}`)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      {/* Right: the map. Same component in both modes; only the pins differ. */}
      <div className="relative h-[300px] shrink-0 overflow-hidden rounded-2xl border border-line shadow-soft sm:h-[380px] xl:h-auto xl:w-[40%]">
        <MapCanvas
          layers={PLANNER_LAYERS}
          entities={entities}
          center={destinationPoint ?? originPoint}
          {...(placeZoom !== undefined ? { zoom: placeZoom } : {})}
          selectedId={selectedId}
          onSelect={(entity) => setSelectedId(entity?.id ?? null)}
          route={selectedRoute}
          {...(handleMapClick ? { onMapClick: handleMapClick } : {})}
          showSelf={!pickup}
        />

        {/* Top-edge scrim. Mapbox's own place labels run right to the corner
            and collide with the card radius; a short fade gives the card a
            clean top without covering anything the user placed. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent"
        />

        {mode === 'squad' ? (
          // Sits above the floating dock, which overlays the bottom of the map
          // at every size below xl where the map is full width.
          <p className="pointer-events-none absolute inset-x-3 bottom-24 rounded-full border border-white/25 bg-neutral-900/80 px-3 py-2 text-center text-[12px] font-medium text-white backdrop-blur-sm xl:bottom-4">
            Click the map to set a meeting point
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One corridor match.
 *
 * The two walk distances are the headline, not the fare: they are the number
 * that decides whether this ride is usable, and they are exactly what a "rides
 * starting near me" list cannot tell you.
 */
function MatchRow({
  hit,
  selected,
  onHover,
}: {
  hit: RideSearchHit;
  selected: boolean;
  onHover: () => void;
}) {
  const full = hit.seatsLeft === 0;

  return (
    <li onMouseEnter={onHover}>
      <Link
        href={`/rides/${hit.ride.id}`}
        className={cn(
          'flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5',
          'transition-colors duration-snap',
          selected ? 'border-brand' : 'border-line hover:border-line-strong',
          full && 'opacity-55',
        )}
      >
        <Avatar
          src={hit.ride.host?.profilePhoto ?? null}
          name={hit.ride.host?.name ?? 'Host'}
          size="md"
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-ink">
              {hit.ride.host?.name ?? 'Host'}
            </span>
            {full ? (
              <span className="shrink-0 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                Full
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[12.5px] text-ink-muted">
            {formatWhen(hit.ride.departureTime)} · {hit.seatsLeft} seats left
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-subtle">
            {formatWalk(hit.pickupWalkMetres)} to pickup ·{' '}
            {formatWalk(hit.dropoffWalkMetres)} from drop-off
            {/* Says so plainly when the match came from a straight line rather
                than real roads, because the walk figures are then optimistic. */}
            {hit.routed ? '' : ' · approx.'}
          </span>
        </span>
      </Link>
    </li>
  );
}

function CompanionRow({
  companion,
  selected,
  onHover,
}: {
  companion: TripCompanion;
  selected: boolean;
  onHover: () => void;
}) {
  const distance = formatDistance(companion.distanceMetres);
  const accent = COMPANION_ACCENT[companion.kind];

  const body = (
    <>
      <span className="relative shrink-0">
        <Avatar src={companion.user.profilePhoto} name={companion.user.name} size="md" />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface"
          style={{ backgroundColor: accent }}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">
          {companion.user.name}
        </span>
        <span className="block truncate text-[12.5px] text-ink-muted">
          {COMPANION_LABEL[companion.kind]}
          {companion.origin ? ` · from ${companion.origin}` : ''}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-subtle">
          {[
            companion.departureTime ? formatWhen(companion.departureTime) : null,
            companion.seatsLeft !== null ? `${companion.seatsLeft} seats left` : null,
            distance,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </>
  );

  const className = cn(
    'flex w-full items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5 text-left',
    'transition-colors duration-snap',
    selected ? 'border-line-strong' : 'border-line hover:border-line-strong',
  );

  return (
    <li onMouseEnter={onHover}>
      {companion.rideId ? (
        <Link href={`/rides/${companion.rideId}`} className={className}>
          {body}
        </Link>
      ) : (
        // No ride to open — this person is just online and going the same way.
        <Link href={`/profile/${companion.user.id}`} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

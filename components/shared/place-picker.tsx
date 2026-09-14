'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, LocateFixed, MapPin, SearchX } from 'lucide-react';

import { cn, formatDistance, haversine } from '@/lib/utils';
import { config } from '@/lib/config';
import { useClickOutside } from '@/lib/hooks/use-click-outside';
import { everyMatchIsWeak, featurePrecision } from '@/lib/place-ranking';
import { searchPlaces, SearchFailed, type SearchCandidate } from '@/lib/place-search';
import { matchPickupPoints } from '@/content/pickup-points';
import type { GeoSource } from '@/lib/pickup-advice';
import {
  getPreciseLocation,
  VAGUE_FIX_METRES,
  type FixFailure,
} from '@/lib/hooks/use-geolocation';
import {
  describeFeature,
  parseSearchBoxFeature,
  type GeocodeFeature,
  type SearchBoxFeature,
} from '@/lib/place-feature';
import { Input } from '@/components/ui/input';
import type { LngLat, PlaceResult } from '@/types';

/**
 * Place search, against Mapbox's Search Box API.
 *
 * Not the Geocoding API, which is what this used to call and which is the
 * reason results looked like an atlas rather than a destination picker.
 * Geocoding v5 carries almost no POI data for India: "IIT Madras Research Park"
 * against it returns "Road to IIT Madras Research Park Gate", three unrelated
 * roads with "Madras" in the name and the city of Chennai, and no combination
 * of `types`, `proximity` or `bbox` improves that, because the building is not
 * in the index to be found. The same query against Search Box returns "IIT
 * Madras Research Park Block C". Ranking cannot promote a result that was never
 * returned, so the index had to change first.
 *
 * `/forward` rather than `/suggest` + `/retrieve`: the two-step flow exists to
 * defer resolving coordinates until a selection is made, and it needs a session
 * token to do it. `/forward` answers with full features — coordinates included
 * — in one request, which is what a list that has to show distances needs, and
 * it keeps the picker's shape exactly as it was.
 *
 * Uses the public token because this is an interactive, user-typed lookup that
 * has to feel instant. Directions and ETA still go through the server with the
 * secret token — those are the calls that would otherwise burn quota on every
 * render (Section 6.2).
 */
/** Roughly 110km at Indian latitudes — a plausible "same city or next town". */
const LOCAL_DEGREES = 1;

/** Below this a query matches too much to be worth a request. */
const MIN_QUERY = 3;

/**
 * Below `poi`, so a place Spllit has verified outranks anything Mapbox returns
 * at the same distance. See the merge in `geocode`.
 */
const VERIFIED_PRECISION = -1;

/**
 * Exported so the assistant can render the same candidates inline instead of
 * in this component's floating panel. Same shape, same ranking, same source —
 * only the presentation differs.
 */
export interface Candidate extends PlaceResult, SearchCandidate {
  relevance: number;
  distanceKm: number;
  precision: number;
  /** The provider's own type, kept alongside the integer derived from it. */
  featureType?: string | undefined;
}

async function request(
  query: string,
  near: LngLat,
  local: boolean,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/forward');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', config.mapbox.token);
  // 10 is the API maximum. At 5, a city with several branches of the same name
  // returned a couple of them and silently dropped the rest.
  url.searchParams.set('limit', '10');
  url.searchParams.set('country', 'IN');
  // Without this Mapbox answers in the feature's own local language, so a
  // Chennai search typed in Latin script comes back partly in Tamil script and
  // matches nothing the user can read back against what they typed.
  url.searchParams.set('language', 'en');
  url.searchParams.set('proximity', `${near[0]},${near[1]}`);

  if (local) {
    const [lng, lat] = near;
    url.searchParams.set(
      'bbox',
      [lng - LOCAL_DEGREES, lat - LOCAL_DEGREES, lng + LOCAL_DEGREES, lat + LOCAL_DEGREES]
        .map((value) => value.toFixed(4))
        .join(','),
    );
  }

  // `signal` is react-query's: it aborts the moment the query key changes, so a
  // request for "iit mad" is cancelled outright rather than raced against
  // "iit madras". Ordering was already safe — a stale response lands in the
  // cache entry for its own query and can never overwrite a newer one — this
  // stops us paying for the answer we would have thrown away.
  const response = await fetch(url.toString(), signal ? { signal } : {});
  if (!response.ok) throw new SearchFailed(response.status);
  const payload = (await response.json()) as { features?: SearchBoxFeature[] };
  const features = payload.features ?? [];

  return features.flatMap((feature, index) => {
    const parsed = parseSearchBoxFeature(feature);
    if (!parsed) return [];
    return [
      {
        id: parsed.id,
        name: parsed.name,
        address: parsed.address,
        // Exactly what Mapbox returned for this feature, carried through to
        // `pick` untouched. Nothing downstream substitutes a city or a
        // locality centroid for it.
        center: parsed.center,
        /**
         * Search Box scores results by ordering them rather than by returning
         * a number, so position is the only confidence signal there is. It is
         * normalised so the two passes are comparable, and it is only ever a
         * late tiebreak — see `comparePlaces`.
         */
        relevance: (features.length - index) / features.length,
        distanceKm: haversine(near, parsed.center) / 1000,
        // Both: the string is what a chosen place carries away and what is
        // eventually stored, the integer is what ranking and the camera read.
        // The integer is always derived from the string, never the reverse.
        featureType: parsed.featureType,
        precision: featurePrecision(parsed.featureType),
      },
    ];
  });
}

/**
 * Mapbox, wired into the provider-shaped hole in `searchPlaces`.
 *
 * Everything about *how many* times to ask and *what* to ask the second time
 * lives in `lib/place-search`, which knows nothing about Mapbox and can therefore
 * be tested with a fake provider and a request counter. This function is the part
 * that genuinely is about Mapbox: a URL, a token and a reference point.
 *
 * That reference point is whatever the caller passes — the trip's origin where
 * one has been chosen, otherwise the device position, otherwise the configured
 * default city. It is never a hardcoded location.
 */
/**
 * Exported for the assistant, which needs these results but not this
 * component's dropdown. Duplicating it would mean two search paths that rank
 * differently, and the whole point of `place-ranking` is that there is one.
 */
export async function geocode(
  query: string,
  proximity?: LngLat | null,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  if (!config.mapbox.token) return [];

  const near: LngLat = proximity ?? [config.defaultLocation.lng, config.defaultLocation.lat];

  /**
   * Spllit's own verified pickup points, handed in as candidates.
   *
   * Empty today — see `content/pickup-points.ts` — so this contributes nothing
   * and costs one filter over an empty array. It is wired now because the shape
   * of the merge is the part worth settling: verified points join the same
   * candidate list and go through the same comparator as everything else, rather
   * than being pinned to the top of the list.
   *
   * `VERIFIED_PRECISION` makes them the most specific kind of thing there is, so
   * they win every tie against a Mapbox POI — but they still have to match what
   * was typed and they are still ordered by distance, so a verified gate in Delhi
   * cannot lead a search made in Chennai.
   */
  const verified: Candidate[] = matchPickupPoints(query).map((point) => ({
    id: point.id,
    name: point.name,
    address: point.address,
    center: point.center,
    // Ours, and confirmed by a human: nothing to be uncertain about.
    relevance: 1,
    distanceKm: haversine(near, point.center) / 1000,
    precision: VERIFIED_PRECISION,
  }));

  return searchPlaces<Candidate>(
    query,
    (text, bounded, abort) => request(text, near, bounded, abort),
    { verified },
    signal,
  );
}

export interface PickedPlace {
  lat: number;
  lng: number;
  label: string;
  address: string | null;
  /**
   * What this coordinate is, in the provider's own words — `poi`, `street`,
   * `locality`. Undefined for a pin on a blank stretch of map, which nothing
   * named.
   *
   * This is the durable half of the old `precision` field, and the only half
   * that is ever stored. `featurePrecision()` turns it into the integer the
   * ranking and the camera want, and that integer stays derived — its meaning
   * comes from a table we tune, so a stored copy would silently go stale.
   */
  featureType?: string;
  /**
   * How specific a kind of thing this is — `featurePrecision`'s scale, 0 being a
   * building. Carried so a map can choose a sensible zoom for it instead of
   * showing a shop doorway at city scale.
   *
   * Client-side only, and never persisted anywhere. Derived from `featureType`
   * wherever it is read back rather than carried across a boundary.
   */
  precision?: number;
  /**
   * GPS accuracy in metres, set only when `source` is `device`. Kept so a vague
   * fix can say it is vague rather than being drawn as a precise pin.
   */
  accuracyMetres?: number;
  /**
   * Metres to the nearest road a car can use, when a lookup confirmed one.
   * Undefined means not confirmed — never "no road".
   */
  roadDistanceMetres?: number;
  /**
   * How this coordinate was arrived at — see `GeoSource`.
   *
   * Optional because a place read back out of an old URL or an existing squad
   * predates the field. Absent means "not recorded", never "exact".
   */
  source?: GeoSource;
}

/**
 * Turns a dropped pin into something a human can read back.
 *
 * Stays on Geocoding v5 while search has moved to Search Box, because for this
 * direction v5 is the better index: asked about a point inside the IIT Madras
 * campus, Search Box `/reverse` answers "Way inside IITM RP" with no address at
 * all, where v5 gives a street. Search wants the POI table; a pin wants the
 * address table.
 *
 * Falls back to formatted coordinates rather than failing: a meeting point the
 * group agreed on by pointing at the map is still valid when Mapbox has no
 * name for that patch of road, and refusing to show it would lose the pin.
 */
/** A recognisable place near the pin, for describing where to meet. */
export interface NearbyLandmark {
  id: string;
  /** What people call it — "Gajendra Circle", "Main Gate". */
  name: string;
  /** Street line beneath the name, when the provider gives one. */
  address: string | null;
  /** Straight-line metres from the pin. Not a walking distance. */
  distanceMetres: number;
}

/**
 * How far out to look, and how far is still worth showing.
 *
 * A landmark two kilometres away does not help anybody find a gate, and a list
 * that offers one invites somebody to pick it. 600 m is roughly the distance
 * across a campus quadrangle — far enough to reach the next recognisable thing,
 * close enough that the name still means "over there" rather than "somewhere in
 * this city".
 */
const LANDMARK_RADIUS_METRES = 600;

/**
 * Distance at which a landmark stops describing the pin and starts being it.
 *
 * Inside this the label reads "Main Gate"; beyond it, "Near Main Gate". The
 * distinction matters because the coordinate does not move either way — calling
 * a spot eighty metres off "Main Gate" would send people to the gate itself.
 */
export const LANDMARK_IS_HERE_METRES = 30;

/**
 * Recognisable places around a point, nearest first.
 *
 * The same v5 geocoding endpoint and public token `reverseGeocode` uses, asking
 * for POIs rather than one best answer. Deliberately not the Search Box
 * category API: that needs a session token and a category taxonomy, and this
 * wants "whatever is notable here", which is exactly what a POI reverse lookup
 * returns.
 *
 * Returns an empty list rather than throwing. A missing landmark list is a step
 * the user skips, never an error that blocks confirming a pin they already
 * chose.
 */
export async function nearbyLandmarks(point: LngLat): Promise<NearbyLandmark[]> {
  if (!config.mapbox.token) return [];

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point[0]},${point[1]}.json`,
    );
    url.searchParams.set('access_token', config.mapbox.token);
    url.searchParams.set('language', 'en');
    // POIs only. `address` and `neighborhood` describe where the pin is, which
    // the card above already says; this list answers "what is it next to".
    url.searchParams.set('types', 'poi');
    // Over-fetch, because the radius filter below removes some and duplicates
    // remove more. Ten leaves enough to fill a six-card grid.
    url.searchParams.set('limit', '10');

    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const payload = (await response.json()) as { features?: GeocodeFeature[] };
    const seen = new Set<string>();
    const out: NearbyLandmark[] = [];

    for (const feature of payload.features ?? []) {
      const lines = describeFeature(feature);
      if (!lines.name) continue;

      // Mapbox returns the same place under several ids often enough that a
      // grid of six can otherwise be the same café three times.
      const key = lines.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const distanceMetres = haversine(point, feature.center);
      if (distanceMetres > LANDMARK_RADIUS_METRES) continue;

      out.push({
        id: feature.id,
        name: lines.name,
        address: lines.address ?? null,
        distanceMetres,
      });
    }

    return out.sort((a, b) => a.distanceMetres - b.distanceMetres);
  } catch {
    // Same reasoning as the empty returns above — never block the pin.
    return [];
  }
}

/**
 * The label a pin should carry once a landmark has been chosen.
 *
 * Kept beside the fetch so the "is here" threshold and the wording that depends
 * on it cannot drift apart.
 */
export function labelForLandmark(landmark: NearbyLandmark): string {
  return landmark.distanceMetres <= LANDMARK_IS_HERE_METRES
    ? landmark.name
    : `Near ${landmark.name}`;
}

export async function reverseGeocode(point: LngLat): Promise<PickedPlace> {
  const fallback: PickedPlace = {
    lat: point[1],
    lng: point[0],
    label: `${point[1].toFixed(5)}, ${point[0].toFixed(5)}`,
    address: null,
  };

  if (!config.mapbox.token) return fallback;

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point[0]},${point[1]}.json`,
    );
    url.searchParams.set('access_token', config.mapbox.token);
    url.searchParams.set('limit', '1');
    url.searchParams.set('language', 'en');
    /**
     * Street-level types only, and `place` is deliberately not among them.
     *
     * It used to be, and it is the one remaining way this app could present a
     * city as an exact meeting point: for a pin in a coverage gap, v5's most
     * specific answer is the enclosing city, so the card said "Chennai" about a
     * spot someone had tapped to within a few metres and offered it as the place
     * everyone should meet.
     *
     * Losing the answer entirely is better, and is already handled — a null
     * address puts `/location` into its `unnamed` state, which shows the
     * coordinates, says plainly that the place could not be identified, and
     * still lets the pin be confirmed. An honest "we don't know" beats a
     * confident "Chennai".
     */
    url.searchParams.set('types', 'address,poi,neighborhood');

    const response = await fetch(url.toString());
    if (!response.ok) return fallback;

    const payload = (await response.json()) as { features?: GeocodeFeature[] };
    const feature = payload.features?.[0];
    if (!feature) return fallback;

    const { name, address, featureType } = describeFeature(feature);
    return {
      lat: point[1],
      lng: point[0],
      label: name || fallback.label,
      /**
       * The provider named something here, so what it named is worth keeping —
       * a pin on a `poi` and a pin on a `neighborhood` are different answers to
       * "what is this coordinate", whichever way the pin was dropped.
       */
      ...(featureType === undefined ? {} : { featureType }),
      /**
       * `place_name` is kept as the backstop rather than dropped.
       * `/location` reads a null address as "Mapbox could not identify this
       * pin", and a feature that came back named but with nothing left to say
       * about where it is has been identified — it must not be reported as an
       * unnamed patch of road.
       */
      address: address ?? feature.place_name ?? null,
    };
  } catch {
    return fallback;
  }
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  /** Clamped so the list can never run off the top or bottom of the screen. */
  maxHeight: number;
}

/** Breathing room between the list and the viewport edge. */
const VIEWPORT_GUTTER = 12;
/** Below this the list flips above the input instead of being squashed. */
const MIN_BELOW = 180;

/** What the device said when the user asked to be located. */
const FIX_MESSAGE: Record<FixFailure, string> = {
  denied: 'Location permission is off. Turn it on for this site, or search instead.',
  unavailable: 'Your device could not provide a location. Try searching instead.',
  timeout: 'Finding you took too long. Try again, or search instead.',
};

export function PlacePicker({
  value,
  onChange,
  placeholder = 'Search for a place',
  proximity,
  label,
  allowCurrentLocation = false,
  initialQuery,
  onQueryChange,
}: {
  value: PickedPlace | null;
  onChange: (place: PickedPlace | null) => void;
  placeholder?: string;
  proximity?: LngLat | null;
  /** Accessible name. The visible caption is rendered by Field, not here. */
  label?: string;
  /**
   * Offer "Use my current location".
   *
   * Off by default and opted into per field, because it only makes sense for one
   * end of a journey. Where you are is a plausible pickup point or meeting point;
   * it is never a plausible *destination*, and offering it on the "where are you
   * going" field would be a row that is always wrong.
   */
  allowCurrentLocation?: boolean;
  /**
   * Text to start the search box with when there is no value yet.
   *
   * For the assistant, which asks "where are you going?" after the user has
   * already typed a place name: without this they would have to type it a
   * second time into an empty box, having just been shown that it was
   * understood. Only ever an opening query — the user still picks the result,
   * so the coordinate is still Mapbox's and still theirs to confirm.
   */
  initialQuery?: string;
  /**
   * Reports what is currently typed, before anything is picked.
   *
   * The assistant needs it to tell a place name from a whole sentence while the
   * user is still typing: "taramani" is answered by the suggestions below,
   * "tomorrow 9am Velachery to IITM" is not, and it offers to read that instead.
   * Nothing here acts on it — the value is only observed.
   */
  onQueryChange?: (value: string) => void;
}) {
  const inputId = useId();
  const [input, setInput] = useState(value?.label ?? initialQuery ?? '');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  /** Locating is its own request with its own outcome, not part of the query. */
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<FixFailure | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  /** Long enough to be worth asking about. Below it nothing is requested. */
  const searchable = debounced.trim().length >= MIN_QUERY;

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['geocode', debounced, proximity],
    queryFn: ({ signal }) => geocode(debounced, proximity ?? undefined, signal),
    enabled: searchable && open,
    staleTime: 5 * 60_000,
    /**
     * One retry, and only for the total failure. Mapbox's occasional 5xx is
     * worth absorbing silently; a rate limit or a bad token is not going to fix
     * itself, and three attempts would just make the error state slower to
     * arrive.
     */
    retry: 1,
  });

  /**
   * `data` belongs to whatever `debounced` was when it was fetched, and the key
   * changes with it — so this is scoped to a searchable query rather than trusted
   * on its own, and a result for a query that has since been cut below the
   * minimum cannot linger on screen.
   */
  const results = searchable ? data ?? [] : [];

  /**
   * The four states that used to be one blank nothing.
   *
   * `isFetching` rather than `isPending`: a cached query is never pending, and a
   * refetch of one should not blank the list that is already correct.
   */
  const searching = searchable && isFetching;
  const failed = searchable && isError && !isFetching;
  const empty = searchable && !isFetching && !isError && data !== undefined && data.length === 0;
  const tooShort = !searchable && input.trim().length > 0;

  /**
   * Results, but none of them a real answer — see `everyMatchIsWeak`. Said out
   * loud rather than silently substituted, which is the whole rule: a full list
   * of near-misses looks exactly like a good one, and the user has no way to
   * tell from the rows themselves.
   */
  const lowConfidence = results.length > 0 && everyMatchIsWeak(debounced, results);

  /**
   * The panel is now shown for states, not just for results — including with no
   * query at all when there is a current-location row to offer, which is what
   * makes that row reachable before the user has typed anything.
   */
  const showPanel =
    open &&
    (allowCurrentLocation ||
      locating ||
      locateError !== null ||
      searching ||
      failed ||
      empty ||
      tooShort ||
      results.length > 0);
  const showList = showPanel && results.length > 0;

  /**
   * Which suggestion the keyboard is on. -1 means none, and that is the
   * starting value on purpose: Enter used to select `results[0]` outright, so
   * typing "fortune tower" and pressing Enter silently picked whatever Mapbox
   * happened to rank first — which could be a building 1,600km away. A
   * destination is now only ever chosen by an explicit tap or an explicit
   * arrow-key selection.
   */
  const [active, setActive] = useState(-1);

  /**
   * Clamped on read rather than reset from an effect.
   *
   * A slow query can deliver a shorter list while a highlight is sitting past
   * its end, and resetting that in an effect would be a second render pass for
   * something already knowable during the first. Typing resets the highlight at
   * source, and results only ever change as a consequence of typing, so this
   * clamp is the only other case there is.
   */
  const activeIndex = active >= 0 && active < results.length ? active : -1;

  /**
   * The list is portalled to <body> and positioned against the input's own
   * rect.
   *
   * Rendering it inside the field looked fine in isolation and broke in every
   * real container: the trip planner's panel is `overflow-hidden` for its
   * rounded corners and clipped it outright, and inside a scrolling column it
   * scrolled away from its own input. A portal has no ancestor that can clip
   * it.
   */
  useLayoutEffect(() => {
    if (!showPanel) return;

    const measure = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      /**
       * The list is measured against the viewport and clamped, rather than
       * being allowed to size to its content.
       *
       * Ten results at ~56px each is ~560px — taller than a 320×568 phone
       * screen. Anchored under an input halfway down the page it ran off the
       * bottom, and the results below the fold could not be reached because the
       * list is `position: fixed` and does not scroll with the page.
       */
      const below = window.innerHeight - rect.bottom - VIEWPORT_GUTTER - 4;
      const above = rect.top - VIEWPORT_GUTTER - 4;

      // Flip above the field only when below is genuinely too cramped *and*
      // there is more room up there — on a short screen both can be tight.
      const flip = below < MIN_BELOW && above > below;

      setAnchor({
        top: flip ? Math.max(VIEWPORT_GUTTER, rect.top - 4 - Math.min(above, 420)) : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(flip ? above : below, 420)),
      });
    };

    measure();
    // `true` captures scrolls on any ancestor, not just the window, so the
    // list tracks a field inside a scrolling panel.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
    // The status rows change the panel's height, so each of them re-measures.
  }, [
    showPanel,
    results.length,
    searching,
    failed,
    empty,
    tooShort,
    lowConfidence,
    locating,
    locateError,
  ]);

  // Covers both the input and the portalled panel, so clicking a suggestion —
  // or the locate button, which lives in the same portal — is not treated as
  // clicking outside.
  useClickOutside(wrapperRef, () => {
    if (!panelRef.current?.matches(':hover')) setOpen(false);
  });

  const pick = (place: Candidate) => {
    onChange({
      lat: place.center[1],
      lng: place.center[0],
      label: place.name,
      address: place.address,
      // The provider's own word for what this is — stored — and the integer
      // derived from it so the map can zoom appropriately — not stored.
      ...(place.featureType === undefined ? {} : { featureType: place.featureType }),
      precision: place.precision,
      // Chosen off a list of named places: exactly what the provider holds for
      // it, and not a coordinate anything downstream may substitute.
      source: 'search',
    });
    setInput(place.name);
    setOpen(false);
  };

  /**
   * Locate, name, and hand back — the whole of "use my current location".
   *
   * The reverse lookup is what makes it usable: a pair of coordinates is not
   * something anyone can agree to meet at, and every other path through this
   * component produces a named place. It cannot fail in a way that loses the
   * position, because `reverseGeocode` degrades to formatted coordinates rather
   * than throwing.
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
    onChange({ ...place, accuracyMetres: fix.accuracyMetres, source: 'device' });
    setInput(place.label);
    setLocating(false);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={inputId}
        aria-label={label ?? placeholder}
        icon={<MapPin className="h-4 w-4" />}
        placeholder={placeholder}
        value={input}
        onFocus={() => setOpen(true)}
        role="combobox"
        // Expanded describes the *listbox*, not the panel: a panel showing only
        // "searching…" has no options to move through, and announcing it as
        // expanded would promise a list that is not there.
        aria-expanded={showList}
        aria-controls={showPanel ? `${inputId}-listbox` : undefined}
        aria-busy={searching || locating}
        aria-activedescendant={
          activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
            return;
          }
          if (!showList) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => (i + 1) % results.length);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
            return;
          }
          if (event.key === 'Enter') {
            /**
             * Only a deliberately highlighted result is taken. Enter on an
             * un-navigated list does nothing rather than guessing — see the
             * note on `active`.
             */
            const chosen = activeIndex >= 0 ? results[activeIndex] : undefined;
            if (chosen) {
              event.preventDefault();
              pick(chosen);
            }
          }
        }}
        onChange={(event) => {
          setInput(event.target.value);
          onQueryChange?.(event.target.value);
          setOpen(true);
          setActive(-1);
          // A new query supersedes whatever the last locate attempt said.
          setLocateError(null);
          // Editing invalidates the resolved place: the text no longer
          // describes the coordinates we are holding.
          if (value) onChange(null);
        }}
      />

      {/*
        A vague fix is reported rather than drawn as though it were exact. This
        is the one thing about a chosen place that the field itself has to say:
        the label reads like any other named place, and only the accuracy knows
        that it might be a street away.
      */}
      {value?.accuracyMetres !== undefined && value.accuracyMetres > VAGUE_FIX_METRES ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-muted">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            Your location is only accurate to about {formatDistance(value.accuracyMetres)} — check
            it on the map before you rely on it.
          </span>
        </p>
      ) : null}

      {showPanel && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                maxHeight: anchor.maxHeight,
              }}
              className="z-[60] overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface shadow-float"
            >
              {/* --- use my current location ------------------------------------
                  First, and outside the listbox, because it is not one of the
                  search results — it is the way to answer without searching. */}
              {allowCurrentLocation ? (
                <button
                  type="button"
                  disabled={locating}
                  // pointerdown for the same reason the options use it: on touch,
                  // mousedown is synthesised only after the browser decides the
                  // gesture was not a scroll, and inside a scrollable sheet it
                  // frequently decides wrong and emits nothing.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    void locate();
                  }}
                  className={cn(
                    'flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left',
                    'text-[13.5px] font-medium text-brand transition-colors hover:bg-surface-sunken',
                    'disabled:opacity-70',
                    results.length > 0 || searching || failed || empty || tooShort || lowConfidence
                      ? 'border-b border-line'
                      : '',
                  )}
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span role={locating ? 'status' : undefined}>
                    {locating ? 'Finding your location…' : 'Use my current location'}
                  </span>
                </button>
              ) : null}

              {locateError ? (
                <p
                  role="status"
                  className="flex items-start gap-2 border-b border-line px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-muted"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                  {FIX_MESSAGE[locateError]}
                </p>
              ) : null}

              {/* --- search states ---------------------------------------------
                  Four outcomes that used to render as an identical blank list.
                  Each one says which it is, and the only one that can be acted
                  on carries the action. */}
              {tooShort ? (
                <p className="px-3.5 py-2.5 text-[12.5px] text-ink-muted">
                  Keep typing — at least {MIN_QUERY} characters.
                </p>
              ) : null}

              {searching && results.length === 0 ? (
                <p
                  role="status"
                  className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] text-ink-muted"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Searching for “{debounced.trim()}”…
                </p>
              ) : null}

              {failed ? (
                <div className="px-3.5 py-3">
                  <p role="status" className="flex items-start gap-2 text-[13px] text-ink">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                    <span>
                      Place search isn’t responding.
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">
                        Nothing was found because the lookup failed, not because the place
                        doesn’t exist.
                      </span>
                    </span>
                  </p>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      void refetch();
                    }}
                    className="mt-2 min-h-[36px] rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-sunken"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {empty ? (
                <p
                  role="status"
                  className="flex items-start gap-2 px-3.5 py-3 text-[13px] text-ink-muted"
                >
                  <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span>
                    No place matches “{debounced.trim()}”.
                    <span className="mt-0.5 block text-[12.5px] leading-snug">
                      Try a nearby landmark, or pick the spot on the map instead.
                    </span>
                  </span>
                </p>
              ) : null}

              {lowConfidence ? (
                <p className="flex items-start gap-2 border-b border-line px-3.5 py-2.5 text-[12.5px] leading-snug text-ink-muted">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    Nothing matches “{debounced.trim()}” closely. These are the nearest
                    guesses — check one on the map before you rely on it.
                  </span>
                </p>
              ) : null}

              <ul
                id={`${inputId}-listbox`}
                role="listbox"
                aria-label={label ?? placeholder}
                // Hidden rather than unmounted when empty, so `aria-controls` on
                // the input always points at an element that exists.
                hidden={results.length === 0}
              >
              {results.map((place, index) => (
                <li key={place.id}>
                  <button
                    type="button"
                    /**
                     * pointerdown, not mousedown.
                     *
                     * Selecting before blur is still the point — the old
                     * blur-then-timeout dance dropped clicks and left a place
                     * looking picked when it was not. But `mousedown` is a
                     * *synthesised* event on touch: the browser emits it only
                     * after it has decided the gesture was a tap and not a
                     * scroll, and on a list inside a scrollable sheet it
                     * frequently decides scroll and emits nothing at all. The
                     * suggestion highlighted and the field stayed empty.
                     *
                     * pointerdown fires immediately for touch, pen and mouse
                     * alike, before any scroll arbitration, so the tap always
                     * lands.
                     */
                    id={`${inputId}-option-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pick(place);
                    }}
                    className={cn(
                      // min-h keeps every row a 44px touch target even when the
                      // place has no address line to give it height.
                      'flex min-h-[52px] w-full items-start gap-2.5 px-3.5 py-2.5 text-left',
                      'transition-colors hover:bg-surface-sunken',
                      activeIndex === index && 'bg-surface-sunken',
                    )}
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {place.name}
                      </span>
                      {place.address ? (
                        <span className="block truncate text-[12px] text-ink-muted">
                          {place.address}
                        </span>
                      ) : null}
                    </span>
                    {/*
                      Distance is not decoration now that results are no longer
                      confined to one city. Searching a chain name legitimately
                      returns the same building in four states, and the address
                      line truncates before the city is visible — so without
                      this the only way to tell a 2km match from a 1,600km one
                      is to pick it and look at the map.
                    */}
                    {typeof place.distanceKm === 'number' ? (
                      // whitespace-nowrap as well as shrink-0: at 320px the
                      // column is narrow enough that "1.2 km" would otherwise
                      // break after the number and take the row to two lines.
                      <span className="mt-0.5 shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-subtle">
                        {formatDistance(place.distanceKm * 1000)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

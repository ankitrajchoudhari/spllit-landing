import { config } from '@/lib/config';
import type { LngLat } from '@/types';

/**
 * The single map configuration. Every screen that renders a map imports from
 * here — style, camera defaults, layer ids and marker tokens are never
 * re-declared per page (Section 1, Section 6.2).
 */

export type MapMode =
  | 'explore'
  | 'focused-ride'
  | 'focused-squad'
  | 'focused-event'
  /** Landing page: low interactivity, no auth-gated actions. */
  | 'preview';

/** Marker categories. Adding a Phase 2 type means adding one entry here. */
export type LayerKey =
  | 'rides'
  | 'squads'
  | 'events'
  | 'communities'
  | 'friends'
  // Phase 2 — registered but not yet emitted by any service.
  | 'rentals'
  | 'marketplace';

export interface LayerConfig {
  key: LayerKey;
  label: string;
  /** CSS colour token used for the marker accent and cluster fill. */
  color: string;
  /** Whether the layer is on by default in explore mode. */
  defaultOn: boolean;
  /** Phase 2 layers render nothing until their services exist. */
  comingSoon?: boolean;
}

export const LAYERS: Record<LayerKey, LayerConfig> = {
  rides: { key: 'rides', label: 'Rides', color: 'var(--brand)', defaultOn: true },
  squads: { key: 'squads', label: 'Group Rides', color: 'var(--accent)', defaultOn: true },
  events: { key: 'events', label: 'Events', color: '#f5a524', defaultOn: true },
  communities: { key: 'communities', label: 'Communities', color: '#8b5cf6', defaultOn: false },
  friends: { key: 'friends', label: 'Friends', color: '#ec4899', defaultOn: true },
  rentals: {
    key: 'rentals',
    label: 'Rentals',
    color: '#64748b',
    defaultOn: false,
    comingSoon: true,
  },
  marketplace: {
    key: 'marketplace',
    label: 'Marketplace',
    color: '#64748b',
    defaultOn: false,
    comingSoon: true,
  },
};

export const ACTIVE_LAYERS = Object.values(LAYERS).filter((l) => !l.comingSoon);

export const DEFAULT_LAYERS: LayerKey[] = ACTIVE_LAYERS.filter((l) => l.defaultOn).map(
  (l) => l.key,
);

/** Stable ids so add/remove operations never guess at a name. */
export const SOURCE_IDS = {
  entities: 'spllit-entities',
  route: 'spllit-route',
} as const;

export const LAYER_IDS = {
  clusters: 'spllit-clusters',
  clusterCount: 'spllit-cluster-count',
  routeLine: 'spllit-route-line',
  routeCasing: 'spllit-route-casing',
} as const;

/** Camera presets per mode. */
export const CAMERA: Record<MapMode, { zoom: number; pitch: number }> = {
  explore: { zoom: 13, pitch: 0 },
  'focused-ride': { zoom: 14.5, pitch: 35 },
  'focused-squad': { zoom: 14, pitch: 20 },
  'focused-event': { zoom: 15, pitch: 20 },
  preview: { zoom: 12.2, pitch: 30 },
};

/**
 * How close to fly for a place of a given kind — `featurePrecision`'s scale,
 * where 0 is a building.
 *
 * This exists because an exact coordinate shown at city scale reads as a vague
 * result. Picking "IIT Madras Research Park Block C" used to leave the planner's
 * camera at the `explore` preset of zoom 13, which frames about eight kilometres:
 * the pin was on precisely the right building and the screen showed a third of
 * Chennai, so the search looked like it had returned an overview when it had not.
 *
 * The values are deliberately moderate at the specific end. 15.5 for a building
 * frames roughly a 400 m box — close enough to see which side of the road the pin
 * is on, wide enough that the surrounding streets, and any other pins near it,
 * are still on screen. Going to 17 would answer "where exactly" by destroying the
 * answer to "where".
 */
const PLACE_ZOOM = [
  15.5, // 0 poi
  16, //   1 address — a specific door is worth the extra half step
  14.5, // 2 street
  13.5, // 3 neighborhood
  13, //   4 locality
  11.5, // 5 place (a city)
] as const;

/** Anything coarser than a city: a postcode, a district, a state, a country. */
const BROAD_ZOOM = 9;

export function zoomForPlace(precision: number | undefined): number | undefined {
  // Undefined in, undefined out: a place read back out of a URL has no feature
  // type to score, and guessing a zoom for it would move a camera the user may
  // have already put where they wanted it.
  if (precision === undefined) return undefined;
  // A verified Spllit pickup point scores below 0 so it can outrank a POI. It is
  // the most specific thing there is, so it takes the closest zoom rather than
  // falling off the end of the table into the broad one.
  return PLACE_ZOOM[Math.max(0, precision)] ?? BROAD_ZOOM;
}

export const DEFAULT_CENTER: LngLat = [
  config.defaultLocation.lng,
  config.defaultLocation.lat,
];

/**
 * Below this many points we render individual HTML markers; above it Mapbox
 * clusters them server-side in the GL layer. Chosen so a dense campus still
 * shows real cards rather than a wall of overlapping pills.
 */
export const CLUSTER_THRESHOLD = 24;
export const CLUSTER_RADIUS = 56;
export const CLUSTER_MAX_ZOOM = 15;

export function styleForTheme(dark: boolean): string {
  return dark ? config.mapbox.styleDark : config.mapbox.styleLight;
}

'use client';

import { Loader2, MapPin } from 'lucide-react';

import { cn, formatDistance } from '@/lib/utils';
import {
  LANDMARK_IS_HERE_METRES,
  type NearbyLandmark,
} from '@/components/shared/place-picker';

/**
 * "What is this next to?" — the second step of picking a meeting point.
 *
 * The pin is already chosen by the time this appears, and its coordinates never
 * change here. This only decides what the point is *called*, because a squad
 * finds each other by name long before anybody opens a map: "by the main gate"
 * is a usable instruction and "12.99129, 80.21855" is not.
 *
 * Everything offered is a real place the map returned near the pin. There is no
 * fixed list of building types, because the useful answer is not what kind of
 * thing it is — it is which recognisable thing it is beside.
 */
export function LandmarkPicker({
  landmarks,
  loading,
  selectedId,
  onSelect,
}: {
  landmarks: NearbyLandmark[];
  loading: boolean;
  /** Null means "none of these" — the reverse-geocoded label is kept. */
  selectedId: string | null;
  onSelect: (landmark: NearbyLandmark | null) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-ink-muted">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        Looking for places nearby…
      </div>
    );
  }

  /**
   * Nothing nearby is a real answer, not a failure.
   *
   * A pin on an empty stretch of road genuinely has no landmark, and saying so
   * is better than an empty grid that looks like something failed to load. The
   * point stays confirmable either way.
   */
  if (landmarks.length === 0) {
    return (
      <div className="flex flex-col gap-1 py-4">
        <p className="text-[13.5px] text-ink-muted">Nothing recognisable is close to this pin.</p>
        <p className="text-[12px] text-ink-subtle">
          The exact spot still works — your squad will see it on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        Two columns, like any picker of this shape. The cards carry a name and a
        distance rather than an icon: an icon for "Gajendra Circle" would be a
        generic pin on every card, which is decoration standing where the one
        distinguishing fact could go.
      */}
      <div className="grid grid-cols-2 gap-2">
        {landmarks.slice(0, 6).map((landmark) => {
          const selected = landmark.id === selectedId;
          const isHere = landmark.distanceMetres <= LANDMARK_IS_HERE_METRES;

          return (
            <button
              key={landmark.id}
              type="button"
              onClick={() => onSelect(landmark)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors duration-snap',
                selected
                  ? 'border-brand bg-brand-muted'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <MapPin
                className={cn('h-4 w-4 shrink-0', selected ? 'text-brand' : 'text-ink-subtle')}
                aria-hidden
              />
              <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
                {landmark.name}
              </span>
              <span className="text-[11.5px] text-ink-subtle">
                {/*
                  "Right here" rather than "8 m". Below the threshold the pin is
                  the place, and a distance that small reads as false precision
                  from a straight-line measurement.
                */}
                {isHere ? 'Right here' : formatDistance(landmark.distanceMetres)}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        Always available, never the default. Somebody who tapped a precise spot
        between two buildings should not have to attach it to whichever of them
        the map happened to name.
      */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className={cn(
          'rounded-xl border px-3 py-2.5 text-[13px] transition-colors duration-snap',
          selectedId === null
            ? 'border-brand bg-brand-muted font-semibold text-ink'
            : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
        )}
      >
        None of these — keep the exact spot
      </button>
    </div>
  );
}

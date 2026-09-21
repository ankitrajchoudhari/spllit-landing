'use client';

import { useEffect, useRef, useState } from 'react';

import { squadMembersService } from '@/lib/services/squads';

/**
 * Reports the caller's position to a squad on the spec's cadence: every 5s
 * while moving, every 30s while still.
 *
 * The two-speed loop is the point. A fixed 5s tick drains a phone that is
 * sitting in a lecture theatre, and a fixed 30s tick makes a moving marker
 * jump between blocks — the interval follows what the device is actually
 * doing.
 */

const MOVING_MS = 5_000;
const STATIONARY_MS = 30_000;
/** Movement under this between fixes is GPS noise, not walking. */
const MOVEMENT_THRESHOLD_METRES = 12;

interface Battery {
  level: number;
  addEventListener?: (type: string, listener: () => void) => void;
}

/** Metres between two nearby points. Flat-earth is exact enough at this scale. */
function metresBetween(a: GeolocationCoordinates, b: { lat: number; lng: number }): number {
  const dLat = (a.latitude - b.lat) * 111_320;
  const dLng =
    (a.longitude - b.lng) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export interface SquadPresenceState {
  sharing: boolean;
  arrived: boolean;
  distanceMetres: number | null;
  error: string | null;
}

export function useSquadPresence(
  squadId: string,
  { enabled }: { enabled: boolean },
): SquadPresenceState {
  const [state, setState] = useState<SquadPresenceState>(() => ({
    sharing: false,
    arrived: false,
    distanceMetres: null,
    // Derived at init rather than corrected by the effect: a device with no
    // geolocation API will never have one, so setting it from inside the
    // effect would only cost a second render pass to say something already
    // knowable on the first.
    error:
      typeof navigator !== 'undefined' && !navigator.geolocation
        ? 'This device cannot share location.'
        : null,
  }));

  // Held in refs, not state: the loop reads them on every tick and writing
  // state here would restart the effect and the geolocation watch with it.
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const latest = useRef<GeolocationCoordinates | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !squadId) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latest.current = position.coords;
        setState((prev) => (prev.sharing ? prev : { ...prev, sharing: true, error: null }));
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          sharing: false,
          error:
            error.code === error.PERMISSION_DENIED
              ? 'Location permission is off, so the group ride cannot see you.'
              : 'Could not read your location.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    /** Battery is optional and Chromium-only; absent is a normal answer. */
    const readBattery = async (): Promise<number | undefined> => {
      const getBattery = (
        navigator as Navigator & { getBattery?: () => Promise<Battery> }
      ).getBattery;
      if (!getBattery) return undefined;
      try {
        const battery = await getBattery.call(navigator);
        return Math.round(battery.level * 100);
      } catch {
        return undefined;
      }
    };

    const tick = async () => {
      const coords = latest.current;
      if (cancelled || !coords || inFlight.current) return;

      const previous = lastSent.current;
      const moved = previous
        ? metresBetween(coords, previous) >= MOVEMENT_THRESHOLD_METRES
        : true;
      const due = previous
        ? Date.now() - previous.at >= (moved ? MOVING_MS : STATIONARY_MS)
        : true;

      if (!due) return;

      inFlight.current = true;
      try {
        const result = await squadMembersService.reportPosition(squadId, {
          lat: coords.latitude,
          lng: coords.longitude,
          ...(await readBattery().then((battery) =>
            battery === undefined ? {} : { battery },
          )),
          // Coarse only — enough to explain a stalled marker, never a fingerprint.
          ...(navigator.onLine ? {} : { network: 'offline' }),
        });

        if (cancelled) return;
        lastSent.current = {
          lat: coords.latitude,
          lng: coords.longitude,
          at: Date.now(),
        };
        setState((prev) => ({
          ...prev,
          sharing: true,
          error: null,
          // Arrival is the server's verdict, not a radius recomputed here that
          // could disagree with the one the leader is shown.
          arrived: result.arrived || prev.arrived,
          distanceMetres: result.distanceMetres,
        }));
      } catch {
        // A dropped report is not worth surfacing — the next tick retries, and
        // an error banner that flickers on every tunnel is worse than silence.
      } finally {
        inFlight.current = false;
      }
    };

    // Polled at the fast rate and gated inside `tick`, so switching between
    // moving and still takes effect on the next beat rather than needing the
    // interval to be torn down and rebuilt.
    void tick();
    const timer = setInterval(() => void tick(), MOVING_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [squadId, enabled]);

  return state;
}

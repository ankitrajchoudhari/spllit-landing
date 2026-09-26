'use client';

import { useEffect, useRef, useState } from 'react';

import { holdInBackground, joinRoom, onEvent, rooms } from '@/lib/live/socket';
import type { LivePosition, Presence, RideTracking } from '@/types';

/**
 * Live positions for a bounded set of rooms. Positions arrive as individual
 * frames and are merged into a keyed map so a single moving marker never
 * re-renders the whole list.
 */
export function useLivePositions(roomNames: string[]): Map<string, LivePosition> {
  const [positions, setPositions] = useState<Map<string, LivePosition>>(new Map());

  // Stable key so an inline array literal from the caller doesn't re-subscribe
  // on every render. The rooms are derived back out of the key inside the
  // effect rather than held in a ref — room names never contain '|', so the
  // round-trip is exact, and it keeps the effect's only input its dependency.
  const key = roomNames.join('|');

  useEffect(() => {
    const rooms = key.split('|').filter(Boolean);
    if (!rooms.length) return;
    const leaves = rooms.map((room) => joinRoom(room));

    const off = onEvent('position:update', (payload) => {
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(payload.userId, payload);
        return next;
      });
    });

    return () => {
      off();
      for (const leave of leaves) leave();
    };
  }, [key]);

  return positions;
}

export function usePresence(roomNames: string[]): Map<string, Presence> {
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const key = roomNames.join('|');

  useEffect(() => {
    const rooms = key.split('|').filter(Boolean);
    if (!rooms.length) return;
    const leaves = rooms.map((room) => joinRoom(room));
    const off = onEvent('presence:update', (payload) => {
      setPresence((prev) => new Map(prev).set(payload.userId, payload));
    });
    return () => {
      off();
      for (const leave of leaves) leave();
    };
  }, [key]);

  return presence;
}

/** Driver position + server-computed ETA for one ride. */
export function useRideTracking(rideId: string | null): RideTracking | null {
  const [tracking, setTracking] = useState<RideTracking | null>(null);

  useEffect(() => {
    if (!rideId) return;
    const leave = joinRoom(rooms.ride(rideId));
    const off = onEvent('ride:tracking', (payload) => {
      if (payload.rideId === rideId) setTracking(payload);
    });
    return () => {
      off();
      leave();
      setTracking(null);
    };
  }, [rideId]);

  return tracking;
}

/**
 * Publishes this device's GPS to the backend while `enabled` is true.
 * Throttled to one write per `intervalMs` regardless of how chatty the
 * Geolocation API is, to keep socket traffic and battery use sane.
 */
export function usePublishLocation(enabled: boolean, intervalMs = 5000) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;

    // A shared position is the one thing that must keep flowing from a
    // background tab, so it opts out of the idle-tab socket suspension.
    const release = holdInBackground();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < intervalMs) return;
        lastSent.current = now;

        void import('@/lib/live/socket').then(({ connectSocket }) => {
          connectSocket().emit('position:publish', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          });
        });
      },
      () => {
        // Permission denied or unavailable — the caller already handles the
        // fallback location, so publishing simply stays off.
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      release();
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, intervalMs]);
}

'use client';

import { useQuery } from '@tanstack/react-query';

import { MapCanvas } from '@/components/map/map-canvas';
import { publicService } from '@/lib/services/public';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import type { MapEntity } from '@/lib/map/types';

/**
 * The landing page background is a real, interactive Mapbox map — not a video
 * and not a screenshot.
 *
 * PRIVACY: the markers come from /public/map-preview, which returns positions
 * snapped to a coarse grid and aggregate counts only. No user, ride or squad
 * identity crosses the pre-auth boundary. If the endpoint returns nothing the
 * map renders empty; we never substitute invented markers to make it look busy.
 */
export function LiveBackdrop() {
  const { center } = useGeolocation();

  const { data } = useQuery({
    queryKey: ['public', 'map-preview', center],
    queryFn: () => publicService.mapPreview(center ?? undefined),
    staleTime: 60_000,
    // A failed preview must never block the hero from rendering.
    retry: 1,
  });

  const entities: MapEntity[] = (data ?? []).map((marker) => ({
    id: marker.id,
    layer:
      marker.kind === 'ride' ? 'rides' : marker.kind === 'squad' ? 'squads' : 'events',
    position: marker.position,
    title:
      marker.kind === 'ride'
        ? `${marker.count} ride${marker.count === 1 ? '' : 's'}`
        : marker.kind === 'squad'
          ? `${marker.count} group ride${marker.count === 1 ? '' : 's'}`
          : `${marker.count} event${marker.count === 1 ? '' : 's'}`,
    subtitle: 'active nearby',
    live: true,
  }));

  return (
    <div className="absolute inset-0 z-0">
      <MapCanvas
        mode="preview"
        layers={['rides', 'squads', 'events']}
        entities={entities}
        center={center}
        // Pan and zoom are allowed; there is nothing here to act on, so no
        // selection handler is wired up.
        interactive
        showSelf={false}
      />

      {/* Legibility is handled by the page-level top fade, which also covers
          the nav. A second scrim here would grey the map out entirely. Only the
          bottom edge is softened so the section blends into what follows. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] sm:h-[280px]"
        style={{
          /**
           * Eased, not linear. A two-stop canvas-to-transparent ramp
           * spends its whole length visibly greying the map and still lands
           * on a readable line where the section ends — the map looked cut
           * off rather than dissolved. These stops hold near-transparent
           * through the top two thirds, so the map stays itself for longer,
           * then close on solid canvas well before the edge so there is no
           * boundary left to see.
           */
          background:
            'linear-gradient(0deg, var(--canvas) 0%, var(--canvas) 7%, color-mix(in srgb, var(--canvas) 84%, transparent) 21%, color-mix(in srgb, var(--canvas) 54%, transparent) 43%, color-mix(in srgb, var(--canvas) 24%, transparent) 66%, color-mix(in srgb, var(--canvas) 7%, transparent) 85%, transparent 100%)',
        }}
      />
    </div>
  );
}

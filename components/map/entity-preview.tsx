'use client';

import Link from 'next/link';
import { Check, MessageCircle, Navigation } from 'lucide-react';

import { config } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { LAYERS } from '@/lib/map/config';
import { entityDomainId } from '@/lib/map/adapters';
import { useJoinSquad } from '@/lib/hooks/queries';
import { formatDistance, haversine } from '@/lib/utils';
import type { MapEntity } from '@/lib/map/types';
import type { LngLat } from '@/types';

/**
 * Join-request button for a squad marker.
 *
 * Its own component so the mutation hook is only mounted for squad markers —
 * hooks cannot be called conditionally inside EntityPreview, which serves every
 * layer.
 */
function SquadJoinAction({ squadId }: { squadId: string }) {
  const join = useJoinSquad(squadId);
  const status = join.data?.viewerStatus;

  if (status === 'active') {
    return (
      <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-brand">
        <Check className="h-3.5 w-3.5" />
        You&apos;re in this group ride.
      </p>
    );
  }

  if (status === 'pending') {
    return (
      <p className="mt-4 flex items-center gap-1.5 text-[13px] text-ink-muted">
        <Check className="h-3.5 w-3.5 text-brand" />
        Request sent — waiting for the leader.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <Button size="sm" className="w-full" loading={join.isPending} onClick={() => join.mutate()}>
        Ask to join
      </Button>
      {join.isError ? (
        <p role="alert" className="mt-2 text-[12.5px] text-danger">
          {join.error instanceof Error ? join.error.message : "Couldn't send the request."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Marker preview — bottom sheet on mobile, floating side panel on desktop.
 * The sheet never covers the whole viewport: the map stays visible and
 * interactive behind it (Section 6.2).
 */
export function EntityPreview({
  entity,
  onClose,
  origin,
}: {
  entity: MapEntity | null;
  onClose: () => void;
  /** Viewer position, used to show how far the marker is. Optional — the sheet
   *  simply omits the distance when location is unavailable. */
  origin?: LngLat | null;
}) {
  const layer = entity ? LAYERS[entity.layer] : null;
  const domainId = entity ? entityDomainId(entity.id) : null;
  const distance = entity && origin ? haversine(origin, entity.position) : null;

  const directionsHref = entity
    ? `https://www.google.com/maps/dir/?api=1&destination=${entity.position[1]},${entity.position[0]}`
    : '#';

  // Chat context is derived from the marker layer so one sheet serves rides,
  // squads and events without branching into three components.
  const chatHref =
    entity && domainId
      ? entity.layer === 'squads'
        ? `/chat?context=squad&id=${domainId}`
        : entity.layer === 'rides'
          ? `/chat?context=ride&id=${domainId}`
          : null
      : null;

  return (
    <Sheet
      open={Boolean(entity)}
      onClose={onClose}
      // Backdrop must not swallow map interaction while a preview is open.
      dismissOnBackdrop={false}
    >
      {entity && layer ? (
        <div>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase text-white"
              style={{ backgroundColor: layer.color }}
            >
              {entity.title.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight text-ink">
                {entity.title}
              </p>
              {entity.subtitle ? (
                <p className="mt-1 text-[13px] text-ink-muted">{entity.subtitle}</p>
              ) : null}
              <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-ink-subtle">
                {layer.label}
                {distance !== null ? ` · ${formatDistance(distance)} away` : ''}
              </p>
            </div>
          </div>

          {entity.facts?.length ? (
            <dl className="mt-4 space-y-1.5 border-t border-line pt-4">
              {entity.facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[12.5px] text-ink-subtle">{fact.label}</dt>
                  <dd className="truncate text-[13px] font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {entity.layer === 'squads' && domainId ? (
            <SquadJoinAction squadId={domainId} />
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-2">
            {entity.href ? (
              <Link href={entity.href} className="col-span-1">
                <Button size="sm" className="w-full">
                  Open
                </Button>
              </Link>
            ) : null}

            {chatHref ? (
              <Link href={chatHref}>
                <Button size="sm" variant="secondary" className="w-full">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chat
                </Button>
              </Link>
            ) : null}

            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className={chatHref && entity.href ? '' : 'col-span-2'}
            >
              <Button size="sm" variant="secondary" className="w-full">
                <Navigation className="h-3.5 w-3.5" />
                Directions
              </Button>
            </a>
          </div>

          {!config.mapbox.token ? (
            <p className="mt-4 text-[12px] text-ink-subtle">
              Set NEXT_PUBLIC_MAPBOX_TOKEN to enable in-app directions.
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

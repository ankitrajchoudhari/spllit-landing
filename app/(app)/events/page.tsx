'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { EventCard } from '@/components/shared/entity-cards';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { useEvents } from '@/lib/hooks/queries';
import { featuredEventsService } from '@/lib/services/featured-events';
import { EventSpotlight } from '@/components/landing/event-spotlight';

export default function EventsPage() {
  const { center } = useGeolocation();
  const { data, isPending, isError } = useEvents(
    { near: center ?? undefined, limit: 30 },
    Boolean(center),
  );
  const events = data?.items ?? [];

  /**
   * The event featured from the console — the same one the home page shows,
   * in the same shopfront, at the top of this screen. Signed-in students land
   * here, not on the home page, so this is where most of them will see it.
   * It needs no location: it is one event for everyone.
   */
  const featured = useQuery({
    queryKey: ['featured-events'],
    queryFn: () => featuredEventsService.list(),
    staleTime: 60_000,
  });
  const [mountedAt] = useState(() => Date.now());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">
            Events
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            What&apos;s happening around you, with live attendance.
          </p>
        </div>
        <Link href="/events/new" className="shrink-0">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Host
          </Button>
        </Link>
      </header>

      {featured.data && featured.data.length > 0 ? (
        <EventSpotlight
          variant="card"
          events={featured.data}
          renderedAt={mountedAt}
          fallback={null}
        />
      ) : null}

      {isPending || !center ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Couldn't load events"
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nothing scheduled nearby"
          description="Host something and it'll appear on the map for everyone around you."
          action={
            <Link href="/events/new">
              <Button size="sm">Host an event</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

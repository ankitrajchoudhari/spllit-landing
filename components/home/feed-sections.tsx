'use client';

import Link from 'next/link';
import { Car, CalendarDays, MapPin, Users } from 'lucide-react';

import { Section, Rail } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRail } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { RideCard, SquadCard, EventCard } from '@/components/shared/entity-cards';
import {
  useEvents,
  useNearbyPeople,
  useRides,
  useSquads,
} from '@/lib/hooks/queries';
import type { LngLat } from '@/types';

/**
 * Each section owns its own query, skeleton and empty state. None of them
 * awaits another — that independence is the whole point (Section 7.2).
 */

export function RidesNearYou({ center }: { center: LngLat | null }) {
  const { data, isPending, isError } = useRides(
    { near: center ?? undefined, limit: 6 },
    Boolean(center),
  );
  const rides = data?.items ?? [];

  return (
    <Section
      title="Rides near you"
      description="People heading somewhere in the next few hours."
      href="/rides"
    >
      {isPending || !center ? (
        <SkeletonRail />
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<Car className="h-5 w-5" />}
          title="Couldn't load rides"
          description="We'll retry automatically. Check your connection if this sticks around."
        />
      ) : rides.length === 0 ? (
        <EmptyState
          icon={<Car className="h-5 w-5" />}
          title="No rides posted near you yet"
          description="Be the first — post where you're going and let someone split the fare."
          action={
            <Link href="/rides/new">
              <Button size="sm">Offer a ride</Button>
            </Link>
          }
        />
      ) : (
        <Rail>
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} className="w-[248px] shrink-0 sm:w-[280px]" />
          ))}
        </Rail>
      )}
    </Section>
  );
}

export function NearbySquads({ center }: { center: LngLat | null }) {
  const { data, isPending, isError } = useSquads(
    { near: center ?? undefined, limit: 6 },
    Boolean(center),
  );
  const squads = data?.items ?? [];

  return (
    <Section title="Group Rides nearby" description="Groups gathering around you." href="/squads">
      {isPending || !center ? (
        <SkeletonRail />
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<Users className="h-5 w-5" />}
          title="Couldn't load group rides"
        />
      ) : squads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No group rides forming nearby"
          description="Start one, drop a meeting point, and everyone will see how far away they are."
          action={
            <Link href="/squads/new">
              <Button size="sm">Start a group ride</Button>
            </Link>
          }
        />
      ) : (
        <Rail>
          {squads.map((squad) => (
            <SquadCard key={squad.id} squad={squad} className="w-[248px] shrink-0 sm:w-[280px]" />
          ))}
        </Rail>
      )}
    </Section>
  );
}

export function TrendingEvents({ center }: { center: LngLat | null }) {
  const { data, isPending, isError } = useEvents(
    { near: center ?? undefined, limit: 6 },
    Boolean(center),
  );
  const events = data?.items ?? [];

  return (
    <Section title="Happening soon" description="Events near you this week." href="/events">
      {isPending || !center ? (
        <SkeletonRail />
      ) : isError ? (
        <EmptyState
          tone="error"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Couldn't load events"
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nothing on the calendar nearby"
          description="Hosting something? Put it on the map and people around you will find it."
          action={
            <Link href="/events/new">
              <Button size="sm">Host an event</Button>
            </Link>
          }
        />
      ) : (
        <Rail>
          {events.map((event) => (
            <EventCard key={event.id} event={event} className="w-[248px] shrink-0 sm:w-[280px]" />
          ))}
        </Rail>
      )}
    </Section>
  );
}

export function FriendsNearby({ center }: { center: LngLat | null }) {
  const { data, isPending } = useNearbyPeople(center);
  const people = data ?? [];

  if (!center) return null;

  return (
    <Section title="Around you right now" href="/map" hrefLabel="Open map">
      {isPending ? (
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-10 w-10 rounded-full" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="No one from your network is nearby"
          description="As more people from your campus join, they'll show up here and on the map."
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/profile/${person.id}`}
              className="flex flex-col items-center gap-1.5"
            >
              <Avatar src={person.profilePhoto} name={person.name} size="md" online />
              <span className="max-w-[64px] truncate text-[11px] text-ink-muted">
                {person.name.split(' ')[0]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}


'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Search as SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  RideCard,
  SquadCard,
  EventCard,
} from '@/components/shared/entity-cards';
import { useSearch } from '@/lib/hooks/queries';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import type { SearchTab } from '@/types';

const TABS: { value: SearchTab; label: string }[] = [
  { value: 'people', label: 'People' },
  { value: 'squads', label: 'Group Rides' },
  { value: 'events', label: 'Events' },
  { value: 'places', label: 'Places' },
  { value: 'rides', label: 'Rides' },
];

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const { center } = useGeolocation();

  const initial = params.get('q') ?? '';
  const [input, setInput] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [tab, setTab] = useState<SearchTab>('people');

  // Debounce so typing doesn't fire a request per keystroke. The search itself
  // is server-side — this never filters a local array.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      const search = new URLSearchParams();
      if (input.trim()) search.set('q', input.trim());
      router.replace(`/search${search.toString() ? `?${search}` : ''}`, { scroll: false });
    }, 280);
    return () => clearTimeout(timer);
  }, [input, router]);

  const { data, isPending, isFetching } = useSearch(query, undefined, center ?? undefined);

  const counts: Record<SearchTab, number> = {
    people: data?.people.length ?? 0,
    squads: data?.squads.length ?? 0,
    events: data?.events.length ?? 0,
    places: data?.places.length ?? 0,
    rides: data?.rides.length ?? 0,
  };

  const short = query.trim().length < 2;
  const empty = !short && !isFetching && counts[tab] === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Input
        icon={<SearchIcon className="h-4 w-4" />}
        placeholder="Search people, group rides, events, places"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoFocus
        className="h-12"
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({ ...t, count: short ? undefined : counts[t.value] }))}
        layoutId="search-tab"
      />

      {short ? (
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title="Search across Spllit"
          description="Type at least two characters to search people, group rides, events, places and rides."
        />
      ) : isPending || isFetching ? (
        <SkeletonList count={4} />
      ) : empty ? (
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title={`No ${tab} matched "${query}"`}
          description="Try a different spelling, or search another tab."
        />
      ) : (
        <div className="space-y-3">
          {tab === 'people'
            ? data?.people.map((person) => (
                <Link
                  key={person.id}
                  href={`/profile/${person.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <Avatar src={person.profilePhoto} name={person.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{person.name}</p>
                    <p className="truncate text-[12.5px] text-ink-muted">
                      {person.username ? `@${person.username}` : (person.college ?? '')}
                    </p>
                  </div>
                </Link>
              ))
            : null}

          {tab === 'squads'
            ? data?.squads.map((squad) => <SquadCard key={squad.id} squad={squad} />)
            : null}

          {tab === 'events'
            ? data?.events.map((event) => <EventCard key={event.id} event={event} />)
            : null}


          {tab === 'rides'
            ? data?.rides.map((ride) => <RideCard key={ride.id} ride={ride} />)
            : null}

          {tab === 'places'
            ? data?.places.map((place) => (
                <Link
                  key={place.id}
                  href={`/map?lng=${place.center[0]}&lat=${place.center[1]}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{place.name}</p>
                    {place.address ? (
                      <p className="truncate text-[12.5px] text-ink-muted">{place.address}</p>
                    ) : null}
                  </div>
                </Link>
              ))
            : null}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <SearchView />
    </Suspense>
  );
}

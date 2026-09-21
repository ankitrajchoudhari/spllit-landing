'use client';

import { SectionTabs } from '@/components/section-tabs';
import RidesPage from '@/app/rides/page';
import SquadsPage from '@/app/squads/page';
import EventsPage from '@/app/events/page';
import CommunitiesPage from '@/app/communities/page';

/**
 * Everything people create, behind one heading.
 *
 * Rides, Squads, Events and Communities were four sidebar rows asking the same
 * question — "what has been made, by whom, and what state is it in". Four rows
 * compete for one glance; one row with four tabs does not.
 *
 * The detail routes (/rides/[id] and friends) are untouched, so every link
 * already in an audit row, a notification or somebody's bookmark still lands
 * where it did.
 */
export default function ContentPage() {
  return (
    <SectionTabs
      title="Content"
      description="Everything people have created, newest first."
      tabs={[
        { key: 'rides', label: 'Rides', permission: 'content.view', render: () => <RidesPage embedded /> },
        { key: 'squads', label: 'Group Rides', permission: 'content.view', render: () => <SquadsPage embedded /> },
        { key: 'events', label: 'Events', permission: 'content.view', render: () => <EventsPage embedded /> },
        { key: 'communities', label: 'Communities', permission: 'content.view', render: () => <CommunitiesPage embedded /> },
      ]}
    />
  );
}

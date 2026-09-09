'use client';

import { EntityPage } from '@/components/entity-page';
import { Badge } from '@/components/ui/primitives';
import { useEntityList } from '@/lib/use-entity-list';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import type { Column } from '@/components/ui/data-table';

interface EventRow {
  id: string;
  title: string;
  college: string | null;
  category: string | null;
  startsAt: string;
  ticketType: string;
  price: number | null;
  capacity: number | null;
  attendeeCount: number;
  status: string;
  host: { id: string; name: string; email: string } | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
] as const;

const COLUMNS: Column<EventRow>[] = [
  {
    key: 'title',
    header: 'Event',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.title}</span>
        <span className="text-xs text-ink-subtle">
          {row.category ?? 'Uncategorised'}
          {row.college ? ` · ${row.college}` : ''}
        </span>
      </div>
    ),
  },
  {
    key: 'host',
    header: 'Host',
    cell: (row) =>
      row.host ? (
        <div className="flex flex-col">
          <span className="text-ink">{row.host.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{row.host.email}</span>
        </div>
      ) : (
        <span className="text-ink-subtle">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => (
      <div className="flex flex-wrap gap-1">
        <Badge
          tone={
            row.status === 'published'
              ? 'good'
              : row.status === 'cancelled'
                ? 'bad'
                : row.status === 'completed'
                  ? 'info'
                  : 'neutral'
          }
        >
          {row.status}
        </Badge>
        {row.ticketType === 'paid' ? <Badge tone="info">₹{row.price ?? 0}</Badge> : null}
      </div>
    ),
  },
  {
    key: 'attendees',
    header: 'Going',
    numeric: true,
    cell: (row) => (row.capacity ? `${row.attendeeCount}/${row.capacity}` : row.attendeeCount),
  },
  {
    key: 'starts',
    header: 'Starts',
    cell: (row) => (
      <span className="text-ink-muted" title={formatAbsolute(row.startsAt)}>
        {formatRelative(row.startsAt)}
      </span>
    ),
  },
];

export default function EventsPage() {
  const list = useEntityList<EventRow>('events', '/events');

  return (
    <EntityPage
      title="Events"
      description="Everything scheduled on Spllit, with its host and attendance."
      permission="content.view"
      searchPlaceholder="Search title, college or category"
      filters={FILTERS}
      columns={COLUMNS}
      hrefFor={(row) => `/events/${row.id}`}
      list={list}
    />
  );
}

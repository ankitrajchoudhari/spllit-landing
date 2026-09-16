'use client';

import { EntityPage } from '@/components/entity-page';
import { Badge } from '@/components/ui/primitives';
import { useEntityList } from '@/lib/use-entity-list';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import type { Column } from '@/components/ui/data-table';

interface RideRow {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  vehicleType: string;
  seats: number;
  fare: number | null;
  status: string;
  createdAt: string;
  creator: { id: string; name: string; email: string } | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

/** Ride states, mapped to a tone. Mirrors the schema's documented machine. */
export function rideTone(status: string): 'good' | 'info' | 'warn' | 'bad' | 'neutral' {
  if (status === 'completed') return 'good';
  if (status === 'cancelled') return 'bad';
  if (status === 'in_progress' || status === 'arriving') return 'info';
  if (status === 'requested' || status === 'pending') return 'warn';
  return 'neutral';
}

const COLUMNS: Column<RideRow>[] = [
  {
    key: 'route',
    header: 'Route',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.origin}</span>
        <span className="text-xs text-ink-subtle">→ {row.destination}</span>
      </div>
    ),
  },
  {
    key: 'host',
    header: 'Host',
    cell: (row) =>
      row.creator ? (
        <div className="flex flex-col">
          <span className="text-ink">{row.creator.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{row.creator.email}</span>
        </div>
      ) : (
        <span className="text-ink-subtle">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <Badge tone={rideTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>,
  },
  { key: 'vehicle', header: 'Vehicle', cell: (row) => <span className="text-ink-muted">{row.vehicleType}</span> },
  { key: 'seats', header: 'Seats', numeric: true, cell: (row) => row.seats },
  {
    key: 'departs',
    header: 'Departs',
    cell: (row) => (
      <span className="text-ink-muted" title={formatAbsolute(row.departureTime)}>
        {formatRelative(row.departureTime)}
      </span>
    ),
  },
];

export default function RidesPage({ embedded }: { embedded?: boolean } = {}) {
  const list = useEntityList<RideRow>('rides', '/rides');

  return (
    <EntityPage
      embedded={embedded}
      title="Rides"
      description="Every ride created in Spllit, with its host and current state."
      permission="content.view"
      searchPlaceholder="Search origin or destination"
      filters={FILTERS}
      columns={COLUMNS}
      hrefFor={(row) => `/rides/${row.id}`}
      list={list}
    />
  );
}

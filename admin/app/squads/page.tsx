'use client';

import { EntityPage } from '@/components/entity-page';
import { Badge } from '@/components/ui/primitives';
import { useEntityList } from '@/lib/use-entity-list';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import type { Column } from '@/components/ui/data-table';

interface SquadRow {
  id: string;
  name: string;
  college: string | null;
  type: string;
  visibility: string;
  status: string;
  memberCount: number;
  memberLimit: number | null;
  meetingAt: string | null;
  createdAt: string;
  leader: { id: string; name: string; email: string } | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

/**
 * `active` is labelled "Scheduled".
 *
 * The stored value keeps its original name so no query has to be rewritten,
 * but showing an admin "active" for a squad that has not started yet — next to
 * `in_progress`, which is also active — reads as a contradiction.
 */
const STATUS_LABELS: Record<string, string> = {
  active: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const COLUMNS: Column<SquadRow>[] = [
  {
    key: 'name',
    header: 'Group Ride',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.name}</span>
        <span className="text-xs text-ink-subtle">
          {row.type}
          {row.college ? ` · ${row.college}` : ''}
        </span>
      </div>
    ),
  },
  {
    key: 'leader',
    header: 'Leader',
    cell: (row) =>
      row.leader ? (
        <div className="flex flex-col">
          <span className="text-ink">{row.leader.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{row.leader.email}</span>
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
            row.status === 'completed'
              ? 'good'
              : row.status === 'cancelled'
                ? 'bad'
                : row.status === 'in_progress'
                  ? 'info'
                  : 'neutral'
          }
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
        {row.visibility !== 'public' ? <Badge tone="warn">{row.visibility}</Badge> : null}
      </div>
    ),
  },
  {
    key: 'members',
    header: 'Members',
    numeric: true,
    cell: (row) => (row.memberLimit ? `${row.memberCount}/${row.memberLimit}` : row.memberCount),
  },
  {
    key: 'meets',
    header: 'Meets',
    cell: (row) =>
      row.meetingAt ? (
        <span className="text-ink-muted" title={formatAbsolute(row.meetingAt)}>
          {formatRelative(row.meetingAt)}
        </span>
      ) : (
        <span className="text-ink-subtle">Not set</span>
      ),
  },
];

export default function SquadsPage({ embedded }: { embedded?: boolean } = {}) {
  const list = useEntityList<SquadRow>('squads', '/squads');

  return (
    <EntityPage
      embedded={embedded}
      title="Group Rides"
      description="Groups travelling together, with their leader and current lifecycle state."
      permission="content.view"
      searchPlaceholder="Search group ride name or college"
      filters={FILTERS}
      columns={COLUMNS}
      hrefFor={(row) => `/squads/${row.id}`}
      list={list}
    />
  );
}

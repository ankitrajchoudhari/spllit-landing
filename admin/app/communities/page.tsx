'use client';

import { EntityPage } from '@/components/entity-page';
import { Badge } from '@/components/ui/primitives';
import { useEntityList } from '@/lib/use-entity-list';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import type { Column } from '@/components/ui/data-table';

interface CommunityRow {
  id: string;
  name: string;
  slug: string;
  college: string | null;
  visibility: string;
  memberCount: number;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
}

const COLUMNS: Column<CommunityRow>[] = [
  {
    key: 'name',
    header: 'Community',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.name}</span>
        <span className="font-mono text-xs text-ink-subtle">/{row.slug}</span>
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Owner',
    cell: (row) =>
      row.owner ? (
        <div className="flex flex-col">
          <span className="text-ink">{row.owner.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{row.owner.email}</span>
        </div>
      ) : (
        <span className="text-ink-subtle">—</span>
      ),
  },
  {
    key: 'visibility',
    header: 'Visibility',
    cell: (row) => (
      <Badge tone={row.visibility === 'public' ? 'good' : 'warn'}>{row.visibility}</Badge>
    ),
  },
  { key: 'college', header: 'College', cell: (row) => <span className="text-ink-muted">{row.college ?? '—'}</span> },
  { key: 'members', header: 'Members', numeric: true, cell: (row) => row.memberCount },
  {
    key: 'created',
    header: 'Created',
    cell: (row) => (
      <span className="text-ink-muted" title={formatAbsolute(row.createdAt)}>
        {formatRelative(row.createdAt)}
      </span>
    ),
  },
];

export default function CommunitiesPage({ embedded }: { embedded?: boolean } = {}) {
  const list = useEntityList<CommunityRow>('communities', '/communities');

  return (
    <EntityPage
      embedded={embedded}
      title="Communities"
      description="Groups and their channels, with ownership and membership size."
      permission="content.view"
      searchPlaceholder="Search name, slug or college"
      columns={COLUMNS}
      hrefFor={(row) => `/communities/${row.id}`}
      list={list}
    />
  );
}

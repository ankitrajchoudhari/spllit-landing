'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, PageHeader, Stat } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import {
  EmptyState,
  ErrorState,
  NotImplementedState,
  PermissionState,
  SkeletonRows,
} from '@/components/ui/states';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface NotificationsResponse {
  rows: NotificationRow[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  openedCount: number;
  unavailable: { key: string; reason: string }[];
}

const COLUMNS: Column<NotificationRow>[] = [
  {
    key: 'title',
    header: 'Notification',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.title}</span>
        <span className="line-clamp-1 text-xs text-ink-subtle">{row.body}</span>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    cell: (row) => <code className="font-mono text-xs text-ink-muted">{row.type}</code>,
  },
  {
    key: 'recipient',
    header: 'Recipient',
    cell: (row) =>
      row.user ? (
        <div className="flex flex-col">
          <span className="text-ink">{row.user.name}</span>
          <span className="font-mono text-xs text-ink-subtle">{row.user.email}</span>
        </div>
      ) : (
        <span className="text-ink-subtle">—</span>
      ),
  },
  {
    key: 'opened',
    header: 'Opened',
    cell: (row) =>
      row.readAt ? (
        <Badge tone="good">
          <span title={formatAbsolute(row.readAt)}>{formatRelative(row.readAt)}</span>
        </Badge>
      ) : (
        <Badge tone="neutral">Unopened</Badge>
      ),
  },
  {
    key: 'sent',
    header: 'Sent',
    cell: (row) => (
      <span className="text-ink-muted" title={formatAbsolute(row.createdAt)}>
        {formatRelative(row.createdAt)}
      </span>
    ),
  },
];

export default function NotificationsPage() {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api<NotificationsResponse>('/notifications', { query: { page, limit: 25 } }),
    placeholderData: keepPreviousData,
  });

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isForbidden) {
      return <PermissionState permission="content.view" />;
    }
    return (
      <ErrorState
        title="Could not load notifications"
        description={query.error instanceof ApiError ? query.error.message : 'Something went wrong.'}
      />
    );
  }

  const data = query.data;
  const openRate = data && data.total > 0 ? Math.round((data.openedCount / data.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="What Spllit has actually sent, and whether it was opened."
      />

      {query.isLoading && !data ? (
        <SkeletonRows rows={8} />
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Total sent" value={formatCount(data.total)} />
            <Stat label="Opened" value={formatCount(data.openedCount)} />
            <Stat label="Open rate" value={`${openRate}%`} />
          </div>

          {/*
            Stated rather than left to inference. An "open rate" next to nothing
            else invites the reading that unopened means undelivered, and Spllit
            cannot tell the difference.
          */}
          {data.unavailable.map((item) => (
            <NotImplementedState key={item.key} title="Delivery reporting" reason={item.reason} />
          ))}

          {data.rows.length === 0 ? (
            <EmptyState
              title="No notifications sent yet"
              description="Notifications appear here as the app sends them."
            />
          ) : (
            <DataTable data={data} columns={COLUMNS} onPage={setPage} />
          )}
        </>
      )}
    </>
  );
}

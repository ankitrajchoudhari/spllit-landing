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

interface ModerationStatus {
  reporting: { available: boolean; reason: string };
  available: {
    emergencies: { open: number; label: string };
    blocks: { total: number; label: string };
  };
}

interface EmergencyRow {
  id: string;
  emergencyType: string;
  message: string;
  status: string;
  locationLat: number;
  locationLng: number;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string; email: string } | null;
}

const COLUMNS: Column<EmergencyRow>[] = [
  {
    key: 'type',
    header: 'Alert',
    cell: (row) => (
      <div className="flex flex-col">
        <span className="font-semibold text-ink">{row.emergencyType}</span>
        <span className="line-clamp-1 text-xs text-ink-subtle">{row.message}</span>
      </div>
    ),
  },
  {
    key: 'user',
    header: 'Raised by',
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
    key: 'status',
    header: 'Status',
    cell: (row) => (
      <Badge
        tone={row.status === 'active' ? 'bad' : row.status === 'resolved' ? 'good' : 'warn'}
      >
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'where',
    header: 'Location',
    cell: (row) => (
      // Coordinates, not a map embed: this is an operational reference for
      // someone already on a call, and rendering a live map of a person in
      // distress into an admin list is more exposure than the task needs.
      <code className="font-mono text-xs text-ink-muted">
        {row.locationLat.toFixed(4)}, {row.locationLng.toFixed(4)}
      </code>
    ),
  },
  {
    key: 'raised',
    header: 'Raised',
    cell: (row) => (
      <span className="text-ink-muted" title={formatAbsolute(row.createdAt)}>
        {formatRelative(row.createdAt)}
      </span>
    ),
  },
];

export default function ModerationPage() {
  const [page, setPage] = useState(1);

  const status = useQuery({
    queryKey: ['moderation-status'],
    queryFn: () => api<ModerationStatus>('/moderation/status'),
  });

  const emergencies = useQuery({
    queryKey: ['emergencies', page],
    queryFn: () =>
      api<{
        rows: EmergencyRow[];
        page: number;
        limit: number;
        total: number;
        pages: number;
      }>('/emergencies', { query: { page, limit: 25 } }),
    placeholderData: keepPreviousData,
  });

  if (status.isError) {
    if (status.error instanceof ApiError && status.error.isForbidden) {
      return <PermissionState permission="moderation.view" />;
    }
    return <ErrorState title="Could not load moderation" description={status.error.message} />;
  }

  return (
    <>
      <PageHeader
        title="Moderation"
        description="What Spllit can currently act on."
      />

      {status.isLoading || !status.data ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          {/*
            The honest answer, first and prominently.

            An empty moderation queue and a non-existent reporting feature look
            identical in a table, and only one of them means nobody needs to do
            anything. Showing a zero here would be a false measurement.
          */}
          {!status.data.reporting.available ? (
            <NotImplementedState
              title="Reports queue"
              reason={status.data.reporting.reason}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              label={status.data.available.emergencies.label}
              value={formatCount(status.data.available.emergencies.open)}
              sub="Currently open"
              tone={status.data.available.emergencies.open > 0 ? 'bad' : 'good'}
            />
            <Stat
              label={status.data.available.blocks.label}
              value={formatCount(status.data.available.blocks.total)}
              sub="User-initiated, all time"
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              SOS alerts
            </h2>

            {emergencies.isLoading && !emergencies.data ? (
              <SkeletonRows rows={5} />
            ) : emergencies.isError ? (
              <ErrorState
                title="Could not load SOS alerts"
                description={
                  emergencies.error instanceof ApiError
                    ? emergencies.error.message
                    : 'Something went wrong.'
                }
              />
            ) : !emergencies.data || emergencies.data.rows.length === 0 ? (
              <EmptyState
                title="No SOS alerts"
                description="Nobody has raised an emergency. This is a real zero — the SOS feature exists and has recorded nothing."
              />
            ) : (
              <DataTable data={emergencies.data} columns={COLUMNS} onPage={setPage} />
            )}
          </section>
        </>
      )}
    </>
  );
}

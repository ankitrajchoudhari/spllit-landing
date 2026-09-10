'use client';

import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { Badge, PageHeader, Stat } from '@/components/ui/primitives';
import {
  ErrorState,
  NotImplementedState,
  PermissionState,
  Skeleton,
} from '@/components/ui/states';

interface SystemHealth {
  checkedAt: string;
  api: { ok: boolean; uptimeSeconds: number };
  database: { ok: boolean; latencyMs: number | null };
  realtime: { connectedAdmins: number };
  memory: { heapUsedMb: number; rssMb: number };
  node: string;
  unavailable: { key: string; reason: string }[];
}

function uptime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export default function SystemPage() {
  const health = useQuery({
    queryKey: ['system'],
    queryFn: () => api<SystemHealth>('/system'),
    refetchInterval: 30_000,
  });

  if (health.isError) {
    const error = health.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="system.view" />;
    }
    return (
      <ErrorState
        title="Could not reach the backend"
        description="That is itself a signal: if this page cannot load, the API is not answering."
      />
    );
  }

  const data = health.data;

  return (
    <>
      <PageHeader
        title="System health"
        description="Measured from inside the API process. Anything the runtime cannot see is listed as unavailable rather than estimated."
        actions={
          data ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
              Checked {formatRelative(data.checkedAt)}
            </span>
          ) : null
        }
      />

      {health.isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone={data.api.ok ? 'good' : 'bad'}>
              API {data.api.ok ? 'up' : 'down'}
            </Badge>
            <Badge tone={data.database.ok ? 'good' : 'bad'}>
              Database {data.database.ok ? 'connected' : 'unreachable'}
            </Badge>
            <Badge tone={data.realtime.connectedAdmins > 0 ? 'good' : 'neutral'}>
              {data.realtime.connectedAdmins} admin
              {data.realtime.connectedAdmins === 1 ? '' : 's'} connected
            </Badge>
            <Badge tone="neutral">Node {data.node}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Uptime" value={uptime(data.api.uptimeSeconds)} />
            <Stat
              label="DB latency"
              value={data.database.latencyMs === null ? '—' : `${data.database.latencyMs}ms`}
              tone={
                data.database.latencyMs !== null && data.database.latencyMs > 500 ? 'warn' : 'neutral'
              }
            />
            <Stat label="Heap used" value={`${data.memory.heapUsedMb}MB`} />
            <Stat label="RSS" value={`${data.memory.rssMb}MB`} />
            <Stat
              label="Live sockets"
              value={data.realtime.connectedAdmins}
              sub="Consoles watching"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {data.unavailable.map((item) => (
              <NotImplementedState
                key={item.key}
                title={item.key === 'errorRate' ? 'Error rate' : 'Background jobs'}
                reason={item.reason}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

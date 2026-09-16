'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SystemHealth {
  api: { ok: boolean; uptimeSeconds: number };
  database: { ok: boolean; latencyMs: number | null };
  realtime: { connectedAdmins: number };
}

/**
 * "Is anything broken" answered without navigating.
 *
 * System health used to be its own sidebar row, which meant the only way to
 * learn the API was fine was to go and ask — so nobody did, and the page
 * existed for the ten minutes a year something was wrong.
 *
 * One line on the home screen inverts that. It is deliberately not four stat
 * tiles: healthy is the overwhelmingly common case, and healthy deserves a
 * glance, not a quarter of the screen. Trouble is what earns colour.
 */
export function HealthStrip() {
  const health = useQuery({
    queryKey: ['system'],
    queryFn: () => api<SystemHealth>('/system'),
    // Slower than the dashboard's own poll. This answers a question whose
    // answer is almost always the same, and a failing API announces itself
    // through every other request on the page long before this notices.
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  /**
   * A role without `system.view` sees nothing rather than an error.
   *
   * The strip is a convenience on somebody else's page; a permission notice
   * where a status line should be is worse than no status line.
   */
  if (health.isError) {
    if (health.error instanceof ApiError && health.error.isForbidden) return null;

    return (
      <p className="text-[12px] text-warning">
        Could not reach the API to check system health.
      </p>
    );
  }

  if (!health.data) return null;

  const { api: apiHealth, database, realtime } = health.data;
  const healthy = apiHealth.ok && database.ok;
  const slow = database.latencyMs !== null && database.latencyMs > 500;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            healthy ? 'bg-brand' : 'bg-danger',
          )}
          aria-hidden
        />
        <span className={healthy ? 'text-ink-muted' : 'font-semibold text-danger'}>
          {healthy ? 'All systems normal' : 'Something is down'}
        </span>
      </span>

      {/*
        The latency figure appears only when it is worth reacting to. A healthy
        number on screen at all times is noise that trains you to stop reading
        the line it sits in.
      */}
      {slow ? (
        <span className="tabular text-warning">Database {database.latencyMs}ms</span>
      ) : null}

      {realtime.connectedAdmins > 1 ? (
        <span className="tabular text-ink-subtle">
          {realtime.connectedAdmins} admins connected
        </span>
      ) : null}

      <Link
        href="/settings"
        className="ml-auto text-ink-subtle underline-offset-2 transition-colors duration-snap hover:text-ink hover:underline"
      >
        Details
      </Link>
    </div>
  );
}

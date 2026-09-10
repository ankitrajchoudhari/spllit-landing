'use client';

import { useEffect, useState } from 'react';

import { useLive, type LiveStatus } from '@/lib/live';
import { cn } from '@/lib/utils';

/**
 * Connection state, said plainly.
 *
 * The point of this component is that it must never claim to be live when it
 * is not. A stale dashboard that says "Live" is worse than one that says
 * "Reconnecting", because the first invites someone to act on figures that
 * stopped moving ten minutes ago.
 */

const LABELS: Record<LiveStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
  disabled: 'Polling',
};

const TITLES: Record<LiveStatus, string> = {
  connecting: 'Opening the realtime connection.',
  live: 'Connected. Figures update as events arrive.',
  reconnecting: 'The connection dropped and is being retried. Figures may be stale.',
  offline: 'No realtime connection. The console is falling back to polling every 60 seconds.',
  disabled: 'No socket address was configured at build time. Polling every 60 seconds.',
};

const DOT: Record<LiveStatus, string> = {
  connecting: 'bg-ink-subtle',
  live: 'bg-brand',
  reconnecting: 'bg-warning',
  offline: 'bg-danger',
  disabled: 'bg-ink-subtle',
};

export function LiveIndicator() {
  const { status, lastEventAt } = useLive();

  /**
   * The clock, advanced only by the interval below.
   *
   * Reading `Date.now()` while rendering makes the component impure — the same
   * props would produce different output on a re-render nobody asked for. So
   * the current time is state, and it starts at 0 rather than at now: with
   * `elapsed` clamped at zero, an event that has just arrived reads "just now"
   * on the first paint without anything having to be computed during it.
   */
  const [now, setNow] = useState(0);

  useEffect(() => {
    // Every 15 seconds, so "3m ago" does not sit there claiming "just now".
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const since = lastEventAt === null ? null : Math.max(Math.round((now - lastEventAt) / 1000), 0);
  const ago =
    since === null
      ? null
      : since < 10
        ? 'just now'
        : since < 60
          ? `${since}s ago`
          : `${Math.floor(since / 60)}m ago`;

  return (
    <span
      className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5"
      title={TITLES[status]}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {status === 'live' ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
        ) : null}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT[status])} />
      </span>

      <span
        className={cn(
          'font-mono text-[10px] font-semibold uppercase tracking-wider',
          status === 'live'
            ? 'text-brand'
            : status === 'reconnecting'
              ? 'text-warning'
              : status === 'offline'
                ? 'text-danger'
                : 'text-ink-subtle',
        )}
      >
        {LABELS[status]}
      </span>

      {status === 'live' && ago ? (
        <span className="hidden text-[10px] text-ink-subtle sm:inline">{ago}</span>
      ) : null}
    </span>
  );
}

'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaderboard } from '@/lib/hooks/queries';
import type { LeaderboardEntry } from '@/types';

/**
 * Where the top three sit. Below that a rank reads as a number, not a medal, so
 * the badge is deliberately plain — a wall of gold is a wall of noise.
 */
const MEDAL: Record<number, string> = {
  1: 'bg-warning-muted text-warning',
  2: 'bg-line text-ink-muted',
  3: 'bg-brand-muted text-brand',
};

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors',
        // The viewer's own row is the one thing people look for, so it is
        // filled rather than merely bolded.
        entry.isViewer ? 'bg-brand-muted' : 'hover:bg-surface-sunken',
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
          MEDAL[entry.rank] ?? 'text-ink-subtle',
        )}
      >
        {entry.rank}
      </span>

      <Avatar src={entry.user.profilePhoto} name={entry.user.name} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">
          {entry.user.name}
          {entry.isViewer ? ' (you)' : ''}
        </span>
        {entry.user.username ? (
          <span className="block truncate text-[11.5px] text-ink-subtle">
            @{entry.user.username}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-muted">
        {entry.score}
      </span>
    </li>
  );
}

export function LeaderboardCard({ className }: { className?: string }) {
  const { data, isPending, isError } = useLeaderboard();

  if (isPending) {
    return (
      <div className={cn('rounded-xl border border-line bg-surface p-4', className)}>
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // A leaderboard that cannot load is not worth an error state on a profile
  // page — it is supplementary, so it simply does not appear.
  if (isError || !data || data.entries.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-muted text-warning">
          <Trophy className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-subtle">
            {data.league}
          </p>
          <p className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Most rides shared
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-0.5">
        {data.entries.map((entry) => (
          <Row key={entry.user.id} entry={entry} />
        ))}
      </ul>

      {/* Shown only when the viewer missed the cut, so they always know where
          they stand rather than scanning a list they are not on. */}
      {!data.viewer.inTop ? (
        <div className="mt-2 border-t border-line pt-2">
          <div className="flex items-center gap-3 rounded-lg bg-brand-muted px-2.5 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold tabular-nums text-ink-muted">
              {data.viewer.rank}
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">You</span>
            <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-muted">
              {data.viewer.score}
            </span>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[11.5px] text-ink-subtle">
        Ranked on completed rides.{' '}
        <Link href="/rides" className="font-medium text-ink-muted hover:text-ink">
          Share a ride
        </Link>{' '}
        to climb.
      </p>
    </div>
  );
}

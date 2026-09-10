'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { mergeBacklog, useLive, type ActivityItem } from '@/lib/live';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/states';

/**
 * What is happening on Spllit, now.
 *
 * The backlog is fetched exactly once; everything after it arrives over the
 * socket. That is the whole point of Phase 3 — a feed that refreshed itself on
 * a timer would be the polling architecture this replaced, just with a smaller
 * query.
 */

const DOT: Record<ActivityItem['severity'], string> = {
  info: 'bg-ink-subtle',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ActivityFeed() {
  const { activity, status } = useLive();

  const backlog = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<{ rows: ActivityItem[] }>('/activity', { query: { limit: 40 } }),
    // Fetched once. Live events keep it current from here; refetching would
    // reintroduce polling through the back door.
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  if (backlog.isError) {
    if (backlog.error instanceof ApiError && backlog.error.isForbidden) return null;
    return (
      <ErrorState
        title="Could not load activity"
        description={backlog.error instanceof ApiError ? backlog.error.message : 'Something went wrong.'}
      />
    );
  }

  if (backlog.isLoading) return <SkeletonRows rows={5} />;

  const items = mergeBacklog(activity, backlog.data?.rows ?? []);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing has happened yet"
        description={
          status === 'live'
            ? 'The connection is open. New activity will appear here as it happens.'
            : 'Activity appears here as people use Spllit.'
        }
      />
    );
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, index) => {
        const body = (
          <>
            <span
              className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', DOT[item.severity])}
              aria-hidden="true"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-ink">{item.title}</span>
              {item.subtitle ? (
                <span className="truncate text-xs text-ink-subtle">{item.subtitle}</span>
              ) : null}
            </span>
            <span
              className="shrink-0 text-xs text-ink-subtle"
              title={formatAbsolute(item.createdAt)}
            >
              {formatRelative(item.createdAt)}
            </span>
          </>
        );

        // Keyed on time plus position: two events can share a millisecond, and
        // a duplicate key would make React reuse the wrong row on the next
        // event that arrives.
        const key = `${item.createdAt}-${item.type}-${index}`;

        return (
          <li key={key}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2 transition-colors duration-snap hover:border-line-strong"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-3 py-2">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw, Trash2 } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { mergeBacklog, useLive, type ActivityItem } from '@/lib/live';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';
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

/** How many rows show before "Show history". */
const RECENT = 6;

/**
 * Where "Clear" is remembered. Per browser, and only a view setting: clearing
 * hides rows from this feed and deletes nothing. The audit log is the record of
 * what admins did, and a console that let an admin erase it would make it
 * worthless as one.
 */
const CLEARED_KEY = 'spllit-console:activity-cleared-at';

function readCleared(): number {
  try {
    return Number(localStorage.getItem(CLEARED_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeCleared(at: number): void {
  try {
    if (at) localStorage.setItem(CLEARED_KEY, String(at));
    else localStorage.removeItem(CLEARED_KEY);
  } catch {
    // Private mode or blocked storage: the clear lasts until reload.
  }
}

/**
 * Signups that never set a name were recorded with their account id as one,
 * which put "HdxgyaAkDFTlWgI3kSErXqJ8J1A2 joined Spllit" in the feed. A single
 * 20+ character token with no spaces is an id, not a name.
 */
function readableTitle(item: ActivityItem): string {
  if (item.type === 'USER_CREATED' && /^[A-Za-z0-9]{20,}\s+joined Spllit$/.test(item.title)) {
    return 'A new user joined Spllit';
  }
  return item.title;
}

export function ActivityFeed() {
  const { activity, status } = useLive();
  const [expanded, setExpanded] = useState(false);
  const [clearedAt, setClearedAt] = useState(readCleared);

  const backlog = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<{ rows: ActivityItem[] }>('/activity', { query: { limit: 40 } }),
    // Fetched once. Live events keep it current from here; refetching would
    // reintroduce polling through the back door.
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  function clear() {
    const now = Date.now();
    writeCleared(now);
    setClearedAt(now);
    setExpanded(false);
  }

  function restore() {
    writeCleared(0);
    setClearedAt(0);
  }

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

  const all = mergeBacklog(activity, backlog.data?.rows ?? []).filter(
    (item) => new Date(item.createdAt).getTime() > clearedAt,
  );
  const items = expanded ? all : all.slice(0, RECENT);

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {all.length > RECENT ? (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((open) => !open)}>
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          {expanded ? 'Show less' : `Show history (${all.length - RECENT} more)`}
        </Button>
      ) : null}
      {all.length > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={clear}
          title="Hide everything up to now from this feed. Nothing is deleted."
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </Button>
      ) : null}
      {clearedAt ? (
        <Button size="sm" variant="ghost" onClick={restore}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Restore cleared
        </Button>
      ) : null}
    </div>
  );

  if (all.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {clearedAt ? toolbar : null}
        <EmptyState
          title={clearedAt ? 'All clear' : 'Nothing has happened yet'}
          description={
            clearedAt
              ? 'New activity will appear here as it happens. Admin actions stay in the Audit log.'
              : status === 'live'
                ? 'The connection is open. New activity will appear here as it happens.'
                : 'Activity appears here as people use Spllit.'
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {toolbar}
      <ol className={cn('flex flex-col gap-1.5', expanded && 'max-h-[480px] overflow-y-auto pr-1')}>
        {items.map((item, index) => {
          const body = (
            <>
              <span
                className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', DOT[item.severity])}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">{readableTitle(item)}</span>
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
    </div>
  );
}

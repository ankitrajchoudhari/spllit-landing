'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import type { AdminRole } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/permissions';
import { formatRelative, formatAbsolute, formatCount } from '@/lib/utils';
import { Badge, Button, Input, PageHeader } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface AdminUserRow {
  id: string;
  name: string;
  username: string | null;
  email: string;
  college: string;
  isActive: boolean;
  onboarded: boolean | null;
  /** Server-derived: see presentUser in routes/adminConsole.ts. */
  profile: 'complete' | 'incomplete' | 'legacy';
  displayName: string;
  contact: string;
  totalRides: number;
  trips: { hosted: number; joined: number; squads: number };
  createdAt: string;
  lastSeen: string;
  /** UTC day of the most recent recorded activity, e.g. "2026-09-25". */
  lastActiveDay: string | null;
  consoleRole: AdminRole | null;
}

/**
 * The later of the sign-in time and the last day with recorded activity.
 *
 * `lastSeen` is only written at sign-in, so on its own it reported someone who
 * uses the app daily but never signs out as "last seen" weeks ago. Activity is
 * recorded per UTC day, so it is shown as a day rather than an hour.
 */
function lastSeenLabel(user: AdminUserRow): { label: string; title: string } {
  const seen = new Date(user.lastSeen);
  const seenDay = seen.toISOString().slice(0, 10);
  if (!user.lastActiveDay || user.lastActiveDay <= seenDay) {
    return { label: formatRelative(user.lastSeen), title: formatAbsolute(user.lastSeen) };
  }
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${user.lastActiveDay}T00:00:00Z`)) / 86_400_000,
  );
  const label = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  return { label, title: `Active on ${user.lastActiveDay} (UTC)` };
}

interface UsersResponse {
  rows: AdminUserRow[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'onboarded', label: 'Onboarded' },
  { value: 'admins', label: 'Admins' },
] as const;

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const users = useQuery({
    queryKey: ['users', query, status, page],
    queryFn: () => api<UsersResponse>('/users', { query: { q: query, status, page, limit: 25 } }),
    // Without this the table empties on every keystroke-triggered refetch and
    // the page jumps as it collapses and reopens.
    placeholderData: keepPreviousData,
  });

  if (users.isError) {
    const error = users.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="users.view" />;
    }
    return (
      <ErrorState
        title="Could not load users"
        description={error instanceof ApiError ? error.message : 'Something went wrong.'}
        action={
          <Button variant="primary" onClick={() => void users.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const data = users.data;

  return (
    <>
      <PageHeader
        title="Users"
        description={
          data ? `${formatCount(data.total)} matching accounts.` : 'Search and filter accounts.'
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, username or college"
            className="pl-9"
            aria-label="Search users"
          />
        </form>

        <div className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={status === filter.value ? 'primary' : 'ghost'}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {users.isLoading && !data ? (
        <SkeletonRows rows={8} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title="No users match this search"
          description="Try a different term, or clear the filter."
        />
      ) : (
        <>
          <div className="scroll-x rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  {['User', 'College', 'Status', 'Trips', 'Joined', 'Last seen'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((user) => (
                  <tr key={user.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/users/${user.id}`}
                        className="flex flex-col transition-colors duration-snap hover:text-brand"
                      >
                        <span className="font-semibold text-ink">{user.displayName}</span>
                        <span className="font-mono text-xs text-ink-subtle">{user.contact}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{user.college || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={user.isActive ? 'good' : 'bad'}>
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                        {user.consoleRole ? (
                          <Badge tone="info">{ROLE_LABELS[user.consoleRole]}</Badge>
                        ) : null}
                        {user.profile === 'incomplete' ? (
                          <span title="Signed up but never finished setting up their profile">
                            <Badge tone="warn">Profile incomplete</Badge>
                          </span>
                        ) : null}
                        {user.profile === 'legacy' ? (
                          <span title="Joined on the previous app. They have no username yet and will be asked for one next time they sign in.">
                            <Badge tone="neutral">Old app</Badge>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="tabular px-4 py-3 text-ink-muted"
                      title={`Hosted ${user.trips.hosted} · joined ${user.trips.joined} rides · ${user.trips.squads} group rides`}
                    >
                      {user.totalRides}
                    </td>
                    <td className="px-4 py-3 text-ink-muted" title={formatAbsolute(user.createdAt)}>
                      {formatRelative(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted" title={lastSeenLabel(user).title}>
                      {lastSeenLabel(user).label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="tabular text-xs text-ink-subtle">
              Page {data.page} of {data.pages || 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={data.page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={data.page >= data.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Car,
  MessageCircle,
  ShieldAlert,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useLive } from '@/lib/live';
import { ActivityFeed } from '@/components/activity-feed';
import { formatCount, formatRelative } from '@/lib/utils';
import { Card, PageHeader, Stat } from '@/components/ui/primitives';
import {
  ErrorState,
  NotImplementedState,
  PermissionState,
  Skeleton,
} from '@/components/ui/states';

interface Overview {
  generatedAt: string;
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    activeToday: number;
    suspended: number;
    onboarded: number;
  };
  rides: { total: number; active: number; completed: number; cancelled: number };
  squads: { total: number; active: number };
  events: { total: number; upcoming: number };
  communities: { total: number };
  chat: { messages24h: number; threads: number };
  emergencies: { open: number };
  waitlist: { total: number };
  notifications: { sent24h: number };
  unavailable: { key: string; reason: string }[];
}

interface Signups {
  days: number;
  series: { date: string; count: number }[];
}

export default function DashboardPage() {
  const { deltaSince } = useLive();

  const overview = useQuery({
    queryKey: ['overview'],
    queryFn: () => api<Overview>('/overview'),
  });

  /**
   * A figure plus whatever has happened since it was fetched.
   *
   * `dataUpdatedAt` is the moment the number left the server, so the delta is
   * exactly the events it could not have included. On the 60-second refetch the
   * base moves forward and the delta collapses to zero on its own — no reset,
   * and no drift from counting the same event twice.
   */
  const live = (base: number, metric: string) =>
    base + deltaSince(metric, overview.dataUpdatedAt);

  const signups = useQuery({
    queryKey: ['signups', 30],
    queryFn: () => api<Signups>('/signups', { query: { days: 30 } }),
  });

  if (overview.isError) {
    const error = overview.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="dashboard.view" />;
    }
    return (
      <ErrorState
        title="Could not load the dashboard"
        description={error instanceof ApiError ? error.message : 'Something went wrong.'}
      />
    );
  }

  const data = overview.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live counts from the Spllit database."
        actions={
          data ? (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
              title={data.generatedAt}
            >
              Updated {formatRelative(data.generatedAt)}
            </span>
          ) : null
        }
      />

      {overview.isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              People
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Total users"
                value={formatCount(live(data.users.total, 'user.created'))}
                sub={`${formatCount(data.users.onboarded)} onboarded`}
                icon={<Users className="h-4 w-4" />}
              />
              <Stat
                label="New today"
                value={formatCount(live(data.users.newToday, 'user.created'))}
                sub={`${formatCount(data.users.newWeek)} this week`}
                icon={<UserPlus className="h-4 w-4" />}
              />
              <Stat
                label="Seen today"
                value={formatCount(data.users.activeToday)}
                sub="Approximated from last seen"
              />
              <Stat
                label="Suspended"
                value={formatCount(data.users.suspended)}
                tone={data.users.suspended > 0 ? 'warn' : 'neutral'}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Activity
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Active rides"
                value={formatCount(live(data.rides.active, 'ride.created'))}
                sub={`${formatCount(data.rides.completed)} completed all time`}
                icon={<Car className="h-4 w-4" />}
              />
              <Stat
                label="Active squads"
                value={formatCount(live(data.squads.active, 'squad.created'))}
                sub={`${formatCount(data.squads.total)} total`}
                icon={<UsersRound className="h-4 w-4" />}
              />
              <Stat
                label="Upcoming events"
                value={formatCount(live(data.events.upcoming, 'event.created'))}
                sub={`${formatCount(data.events.total)} total`}
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <Stat
                label="Messages 24h"
                value={formatCount(live(data.chat.messages24h, 'message.sent'))}
                sub={`${formatCount(data.chat.threads)} threads`}
                icon={<MessageCircle className="h-4 w-4" />}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Attention
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Open SOS"
                value={formatCount(live(data.emergencies.open, 'emergency.raised'))}
                tone={data.emergencies.open > 0 ? 'bad' : 'good'}
                icon={<ShieldAlert className="h-4 w-4" />}
              />
              <Stat label="Communities" value={formatCount(data.communities.total)} />
              <Stat label="Waitlist" value={formatCount(data.waitlist.total)} />
              <Stat label="Notifications 24h" value={formatCount(live(data.notifications.sent24h, 'notification.sent'))} />
            </div>
          </section>

          <SignupChart query={signups} />

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Live activity
            </h2>
            <ActivityFeed />
          </section>

          {data.unavailable.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
                Asked for, but not measurable yet
              </h2>
              <div className="grid gap-3 lg:grid-cols-3">
                {data.unavailable.map((item) => (
                  <NotImplementedState
                    key={item.key}
                    title={LABELS[item.key] ?? item.key}
                    reason={item.reason}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

const LABELS: Record<string, string> = {
  reports: 'Reports & moderation',
  posts: 'Posts & comments',
  analytics: 'Retention & funnels',
};

/**
 * Signups over 30 days, drawn as bars from the server-bucketed series.
 *
 * Hand-drawn rather than pulled from a chart library: it is one series of
 * thirty values, and a charting dependency would be the single largest thing
 * in this bundle for a graphic that is thirty divs.
 */
function SignupChart({ query }: { query: ReturnType<typeof useQuery<Signups>> }) {
  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) return null;

  const series = query.data.series;
  const peak = Math.max(...series.map((point) => point.count), 1);
  const total = series.reduce((sum, point) => sum + point.count, 0);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Signups</h2>
        <span className="tabular text-xs text-ink-muted">
          {formatCount(total)} over {query.data.days} days
        </span>
      </div>

      <div className="scroll-x">
        <div className="flex h-32 min-w-[480px] items-end gap-1">
          {series.map((point) => (
            <div
              key={point.date}
              className="group relative flex flex-1 items-end"
              style={{ height: '100%' }}
            >
              <div
                className="w-full rounded-sm bg-brand/70 transition-colors duration-snap group-hover:bg-brand"
                // Zero-count days still get a hairline, so a gap in the data
                // reads as "no signups" rather than as a rendering fault.
                style={{ height: `${Math.max((point.count / peak) * 100, 2)}%` }}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-surface-raised px-2 py-1 text-[10px] text-ink group-hover:block">
                {point.date}: {point.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

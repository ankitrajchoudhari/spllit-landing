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
import { HealthStrip } from '@/components/health-strip';
import { formatCount, formatRelative } from '@/lib/utils';
import { Card, PageHeader, SectionHeader, Stat } from '@/components/ui/primitives';
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
  rides: { total: number; active: number; stale: number; completed: number; cancelled: number };
  squads: { total: number; active: number; stale: number };
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

  /**
   * Signups this week against the week before, as a percentage.
   *
   * Computed from the series already fetched for the chart — no second request,
   * and no invented number. `undefined` whenever the comparison would be
   * meaningless: fewer than fourteen days of data, or a prior week of zero,
   * where any growth is division by nothing and renders as a spectacular
   * percentage that means "we had one signup".
   */
  const signupDelta = (() => {
    const series = signups.data?.series;
    if (!series || series.length < 14) return undefined;

    const sum = (points: typeof series) => points.reduce((total, p) => total + p.count, 0);
    const thisWeek = sum(series.slice(-7));
    const priorWeek = sum(series.slice(-14, -7));
    if (priorWeek === 0) return undefined;

    return Math.round(((thisWeek - priorWeek) / priorWeek) * 100);
  })();

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
          {/* Three at hero weight, and only three.
              The question this page answers on arrival is "how big is it, is it
              growing, and is anyone on it" — everything else is detail you go
              looking for. Giving sixteen numbers equal weight answers none of
              them. */}
          {/*
            Health first, and small. "Is anything broken" is the question you
            arrive with when something feels wrong, and it should not cost a
            navigation to answer.
          */}
          <HealthStrip />

          <section className="flex flex-col gap-3">
            <SectionHeader title="People" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                size="hero"
                label="Total users"
                value={formatCount(live(data.users.total, 'user.created'))}
                sub={`${formatCount(data.users.onboarded)} finished onboarding`}
                icon={<Users className="h-4 w-4" />}
              />
              <Stat
                size="hero"
                label="New this week"
                /**
                 * The week, not the day.
                 *
                 * This tile read "0  +400%" — a daily count beside a
                 * week-over-week delta, which says nothing true about either.
                 * A percentage has to describe the number it sits next to, so
                 * the number is now the one the percentage is about.
                 */
                value={formatCount(live(data.users.newWeek, 'user.created'))}
                sub={`${formatCount(data.users.newToday)} of them today`}
                icon={<UserPlus className="h-4 w-4" />}
                delta={signupDelta}
                deltaLabel="this week vs the week before"
              />
              <Stat
                size="hero"
                label="Seen today"
                value={formatCount(data.users.activeToday)}
                sub="From last seen, so approximate"
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Activity" aside="right now" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Active rides"
                value={formatCount(data.rides.active)}
                sub="Under way or still ahead"
                icon={<Car className="h-4 w-4" />}
              />
              <Stat
                label="Active group rides"
                value={formatCount(data.squads.active)}
                sub={`${formatCount(data.squads.total)} all time`}
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
            <SectionHeader title="Attention" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {/* SOS keeps full weight whatever the count. A zero here is a
                  reassurance somebody is looking for, and shrinking it to match
                  the supporting numbers would bury the one that is not
                  supporting. */}
              <Stat
                label="Open SOS"
                value={formatCount(live(data.emergencies.open, 'emergency.raised'))}
                tone={data.emergencies.open > 0 ? 'bad' : 'good'}
                icon={<ShieldAlert className="h-4 w-4" />}
              />
              {/*
                Surfaced rather than quietly excluded from the count above. A
                ride left open since April is somebody's abandoned plan still
                sitting in the data, and correcting the headline figure without
                showing these would fix the number and hide the problem.
              */}
              <Stat
                size="compact"
                label="Stale rides"
                value={formatCount(data.rides.stale)}
                tone={data.rides.stale > 0 ? 'warn' : 'neutral'}
                sub="Open, departure long past"
              />
              <Stat
                size="compact"
                label="Stale group rides"
                value={formatCount(data.squads.stale)}
                tone={data.squads.stale > 0 ? 'warn' : 'neutral'}
                sub="Live, meeting long past"
              />
              <Stat size="compact" label="Communities" value={formatCount(data.communities.total)} />
              <Stat size="compact" label="Waitlist" value={formatCount(data.waitlist.total)} />
              <Stat
                size="compact"
                label="Notifications 24h"
                value={formatCount(live(data.notifications.sent24h, 'notification.sent'))}
              />
            </div>
          </section>

          <SignupChart query={signups} />

          <section className="flex flex-col gap-3">
            <SectionHeader title="Live activity" />
            <ActivityFeed />
          </section>

          {data.unavailable.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Asked for, but not measurable yet" />
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
/** "14 Sep" from an ISO day key. Short, because it sits under a 12px bar. */
function dayLabel(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

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
        <div className="min-w-[480px]">
          {/*
            A scale, because bars without one are decoration. Two gridlines and
            the peak value are enough to read a height off — a full axis would
            cost more room than it earns on a strip this short.
          */}
          <div className="relative flex h-32 items-end gap-1">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line/60"
              aria-hidden
            />
            <span className="pointer-events-none absolute -top-1.5 right-0 tabular text-[10px] text-ink-subtle">
              {peak}
            </span>

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
                  {dayLabel(point.date)}: {point.count}
                </span>
              </div>
            ))}
          </div>

          {/*
            Three dates, not thirty. A label under every bar at this width is an
            unreadable smear; the ends and the middle are enough to place any
            bar you are looking at.
          */}
          <div className="mt-1.5 flex justify-between text-[10px] text-ink-subtle">
            <span>{dayLabel(series[0]?.date)}</span>
            <span>{dayLabel(series[Math.floor(series.length / 2)]?.date)}</span>
            <span>{dayLabel(series[series.length - 1]?.date)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

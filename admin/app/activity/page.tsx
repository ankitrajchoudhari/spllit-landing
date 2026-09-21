'use client';

import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';
import { Card, PageHeader, Stat } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

/**
 * Where and when people use Spllit.
 *
 * Three panels, each answering a question the rest of the console could not:
 * who is on their phone right now, which places journeys run between, and what
 * the week actually looks like.
 */

interface Place {
  label: string;
  count: number;
}

interface Activity {
  windowDays: number;
  live: { now: number; lastHour: number; today: number; thisWeek: number; onboarded: number };
  places: { origins: Place[]; destinations: Place[] };
  when: { grid: number[][]; plotted: number; peak: number };
  sampled: { rides: number; squads: number };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ActivityPage() {
  const { can } = useAuth();
  const allowed = can('analytics.view');

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<Activity>('/activity'),
    enabled: allowed,
    // People arrive and leave while this is open; a minute is often enough to
    // watch a morning rush build without hammering a scale-to-zero container.
    refetchInterval: 60_000,
  });

  if (!allowed) return <PermissionState permission="analytics.view" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity"
        description="Who is here now, where they travel, and when."
      />

      {isError ? (
        <ErrorState
          title="Could not load activity"
          description={error instanceof ApiError ? error.message : undefined}
        />
      ) : null}

      {isPending ? (
        <SkeletonRows />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/*
              "Now" is a five-minute window on lastSeen, which is written on
              authenticated requests. It is the closest honest answer to "on
              their phone right now" without a presence service — so the label
              says what it measures rather than implying a live socket count.
            */}
            <Stat label="On their phone" value={formatCount(data.live.now)} sub="seen in 5 min" />
            <Stat label="Last hour" value={formatCount(data.live.lastHour)} />
            <Stat label="Today" value={formatCount(data.live.today)} />
            <Stat
              label="This week"
              value={formatCount(data.live.thisWeek)}
              sub={`of ${formatCount(data.live.onboarded)} onboarded`}
            />
          </div>

          <WhenGrid when={data.when} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Places
              title="Where people set off from"
              places={data.places.origins}
              empty="No pickup points recorded yet."
            />
            <Places
              title="Where they are going"
              places={data.places.destinations}
              empty="No destinations recorded yet."
            />
          </div>

          <p className="text-xs text-ink-subtle">
            Last {data.windowDays} days · {formatCount(data.sampled.rides)} rides and{' '}
            {formatCount(data.sampled.squads)} group rides sampled.
          </p>
        </>
      ) : null}
    </div>
  );
}

/**
 * The week as a grid — the panel that genuinely wants to be a heat map.
 *
 * A campus has two spikes a day and a different weekend, and that shape *is*
 * the finding. 168 numbers in a table hide it; 168 cells show it instantly.
 *
 * Intensity is scaled against the busiest cell rather than a fixed ceiling, so
 * the pattern is readable on week one with a handful of trips and still
 * readable at a thousand. The trade — that colour means "relative to your
 * busiest hour", not an absolute volume — is stated under the grid rather than
 * left for somebody to infer.
 */
function WhenGrid({ when }: { when: { grid: number[][]; plotted: number; peak: number } }) {
  if (when.plotted === 0) {
    return (
      <Card>
        <EmptyState
          title="Nothing to plot yet"
          description="Once rides and group rides have departure times, the week fills in here."
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">When people travel</h2>
        <span className="tabular text-xs text-ink-muted">
          busiest hour: {formatCount(when.peak)}
        </span>
      </div>

      <div className="scroll-x">
        <div className="min-w-[620px]">
          {/* Hour ruler. Every third hour is labelled — all 24 collide at this
              width, and none leaves the grid unreadable. */}
          <div className="mb-1 flex gap-[2px] pl-9">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex-1 text-center text-[9px] text-ink-subtle">
                {hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>

          {when.grid.map((row, day) => (
            <div key={DAYS[day]} className="mb-[2px] flex items-center gap-[2px]">
              <div className="w-9 shrink-0 text-[10px] text-ink-muted">{DAYS[day]}</div>
              {row.map((count, hour) => {
                const share = when.peak > 0 ? count / when.peak : 0;
                return (
                  <div
                    key={hour}
                    title={`${DAYS[day]} ${String(hour).padStart(2, '0')}:00 — ${count}`}
                    className="group relative h-6 flex-1 rounded-[2px] bg-surface-sunken"
                  >
                    {count > 0 ? (
                      <div
                        className="h-full w-full rounded-[2px] bg-accent"
                        // Inline because the value is continuous — a Tailwind
                        // class cannot express "37% of the busiest hour", and
                        // rounding it into buckets would flatten the shape this
                        // panel exists to show.
                        //
                        // A floor of 0.12 so a single trip is visible at all;
                        // without it the quiet hours are indistinguishable from
                        // empty ones, which is a different claim.
                        style={{ opacity: Math.max(share, 0.12) }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-subtle">
        Times are IST, taken from when each trip was set to leave. Shade is relative to
        your busiest hour, not an absolute count.
      </p>
    </Card>
  );
}

function Places({
  title,
  places,
  empty,
}: {
  title: string;
  places: Place[];
  empty: string;
}) {
  const peak = Math.max(...places.map((place) => place.count), 1);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-bold text-ink">{title}</h2>

      {places.length === 0 ? (
        <EmptyState title="Nothing here yet" description={empty} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {places.map((place) => (
            <li key={place.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-ink">{place.label}</span>
                <span className="tabular shrink-0 text-xs text-ink-muted">
                  {formatCount(place.count)}
                </span>
              </div>
              {/* A bar rather than a number alone: the ranking matters less
                  than how far ahead the top one is. */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max((place.count / peak) * 100, 3)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

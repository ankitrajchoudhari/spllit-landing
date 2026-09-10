'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatCount, formatRelative } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, Stat } from '@/components/ui/primitives';
import {
  ErrorState,
  NotImplementedState,
  PermissionState,
  Skeleton,
} from '@/components/ui/states';

interface Analytics {
  generatedAt: string;
  days: number;
  active: {
    dau: number;
    wau: number;
    mau: number;
    series: { date: string; count: number }[];
    stickiness: number | null;
  };
  retention: {
    cohort: string;
    size: number;
    d1: number | null;
    d7: number | null;
    d30: number | null;
  }[];
  funnel: { key: string; label: string; count: number; share: number; note?: string }[];
  adoption: { total: number; rows: { feature: string; users: number; share: number }[] };
  notes: { key: string; text: string }[];
}

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);

  const analytics = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => api<Analytics>('/analytics', { query: { days } }),
    // Analytics are read on demand and are expensive relative to a counter
    // read. Nothing here changes meaningfully inside five minutes.
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });

  if (analytics.isError) {
    if (analytics.error instanceof ApiError && analytics.error.isForbidden) {
      return <PermissionState permission="analytics.view" />;
    }
    return (
      <ErrorState
        title="Could not load analytics"
        description={
          analytics.error instanceof ApiError ? analytics.error.message : 'Something went wrong.'
        }
      />
    );
  }

  const data = analytics.data;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Who comes back, where they drop off, and what they actually use."
        actions={
          <div className="flex gap-1">
            {RANGES.map((range) => (
              <Button
                key={range.value}
                variant={days === range.value ? 'primary' : 'ghost'}
                onClick={() => setDays(range.value)}
                aria-pressed={days === range.value}
              >
                {range.label}
              </Button>
            ))}
          </div>
        }
      />

      {analytics.isLoading || !data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/*
            Stated up front, not in a footnote. Every figure below is derived
            from activity recorded since this shipped, and a reader who assumes
            it covers Spllit's whole history will misread all of it.
          */}
          {data.notes.map((note) => (
            <NotImplementedState key={note.key} title="Reading these figures" reason={note.text} />
          ))}

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Active users
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="DAU" value={formatCount(data.active.dau)} sub="Today" />
              <Stat label="WAU" value={formatCount(data.active.wau)} sub="Last 7 days" />
              <Stat label="MAU" value={formatCount(data.active.mau)} sub="Last 30 days" />
              <Stat
                label="Stickiness"
                value={data.active.stickiness === null ? '—' : `${data.active.stickiness}%`}
                sub="DAU / MAU"
              />
            </div>

            <ActiveChart series={data.active.series} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Activation funnel
            </h2>
            <Card className="flex flex-col gap-3">
              {data.funnel.map((step) => (
                <div key={step.key} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{step.label}</span>
                    <span className="tabular text-sm text-ink-muted">
                      {formatCount(step.count)}
                      <span className="ml-2 text-ink-subtle">{step.share}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-brand/70"
                      style={{ width: `${Math.min(step.share, 100)}%` }}
                    />
                  </div>
                  {step.note ? <p className="text-xs text-ink-subtle">{step.note}</p> : null}
                </div>
              ))}
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Retention by signup day
            </h2>
            <div className="scroll-x rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line-strong">
                    {['Cohort', 'Size', 'D1', 'D7', 'D30'].map((heading, index) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle ${
                          index === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.retention.map((row) => (
                    <tr key={row.cohort} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 text-ink-muted">{row.cohort}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink">{row.size}</td>
                      <RetentionCell value={row.d1} />
                      <RetentionCell value={row.d7} />
                      <RetentionCell value={row.d30} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-subtle">
              A dash means the cohort has not reached that day yet — not that nobody returned.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Feature adoption
            </h2>
            <Card className="flex flex-col gap-3">
              <p className="text-xs text-ink-subtle">
                Share of all {formatCount(data.adoption.total)} accounts that have{' '}
                <em>ever</em> used each feature.
              </p>
              {data.adoption.rows.map((row) => (
                <div key={row.feature} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink">{row.feature}</span>
                    <span className="tabular text-sm text-ink-muted">
                      {formatCount(row.users)}
                      <span className="ml-2 text-ink-subtle">{row.share}%</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${Math.min(row.share, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          </section>

          <p className="text-xs text-ink-subtle">
            Generated {formatRelative(data.generatedAt)}.
          </p>
        </>
      )}
    </>
  );
}

function RetentionCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-4 py-2.5 text-right text-ink-subtle">—</td>;
  }

  return (
    <td className="px-4 py-2.5 text-right">
      <Badge tone={value >= 40 ? 'good' : value >= 15 ? 'warn' : 'neutral'}>{value}%</Badge>
    </td>
  );
}

/** Daily active users, drawn from the server-bucketed series. */
function ActiveChart({ series }: { series: { date: string; count: number }[] }) {
  const peak = Math.max(...series.map((point) => point.count), 1);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-ink">Daily active users</h3>
        <span className="tabular text-xs text-ink-muted">peak {formatCount(peak)}</span>
      </div>

      <div className="scroll-x">
        <div className="flex h-32 min-w-[480px] items-end gap-1">
          {series.map((point) => (
            <div key={point.date} className="group relative flex flex-1 items-end" style={{ height: '100%' }}>
              <div
                className="w-full rounded-sm bg-accent/70 transition-colors duration-snap group-hover:bg-accent"
                // A hairline for zero days, so an empty day reads as no
                // activity rather than as a rendering fault.
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

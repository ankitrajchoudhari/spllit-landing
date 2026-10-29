'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { formatCount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CurveChart, SERIES_COLORS } from '@/components/curve-chart';
import { Button, Card } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/states';

type MetricKey = 'users' | 'active' | 'rides' | 'squads' | 'events';

interface Trends {
  months: number;
  /** The current month, which is still filling up. */
  partialMonth: string;
  metrics: { key: MetricKey; label: string }[];
  rows: ({ month: string } & Record<MetricKey, number>)[];
}

const COLORS: Record<MetricKey, string> = {
  users: SERIES_COLORS.brand,
  active: SERIES_COLORS.accent,
  rides: SERIES_COLORS.warning,
  squads: SERIES_COLORS.violet,
  events: SERIES_COLORS.danger,
};

/** "Oct 2026" from "2026-10". */
function monthLabel(key: string, long = false): string {
  const date = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('en-IN', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : '2-digit',
    timeZone: 'UTC',
  });
}

/**
 * Month-by-month comparison of the platform's main numbers.
 *
 * The change column compares the last two *complete* months. The current month
 * is still on the chart, marked "so far", but measuring it against a full one
 * would report a drop every month until the last day.
 */
export function TrendCompare() {
  const [months, setMonths] = useState(6);
  const [selected, setSelected] = useState<MetricKey[]>(['users', 'active']);

  const trends = useQuery({
    queryKey: ['trends', months],
    queryFn: () => api<Trends>('/trends', { query: { months } }),
    staleTime: 5 * 60_000,
  });

  if (trends.isLoading) return <Skeleton className="h-80 w-full" />;
  if (trends.isError || !trends.data) return null;

  const { rows, metrics, partialMonth } = trends.data;

  function toggle(key: MetricKey) {
    setSelected((current) =>
      current.includes(key)
        ? current.length > 1
          ? current.filter((k) => k !== key)
          : current // always at least one line on the chart
        : [...current, key],
    );
  }

  const lastFull = rows[rows.length - 2];
  const priorFull = rows[rows.length - 3];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Compare month by month</h2>
          <p className="text-xs text-ink-subtle">
            Pick what to compare. Hover the chart for exact numbers.
          </p>
        </div>
        <div className="flex gap-1">
          {[6, 12].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={months === value ? 'primary' : 'ghost'}
              onClick={() => setMonths(value)}
              aria-pressed={months === value}
            >
              {value} months
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {metrics.map((metric) => {
          const on = selected.includes(metric.key);
          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => toggle(metric.key)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-snap',
                on
                  ? 'border-line-strong bg-surface-raised text-ink'
                  : 'border-line text-ink-subtle hover:text-ink-muted',
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: on ? COLORS[metric.key] : 'var(--line-strong)',
                }}
              />
              {metric.label}
            </button>
          );
        })}
      </div>

      <CurveChart
        labels={rows.map((row) => row.month)}
        tickLabel={(i) => {
          const month = rows[i]?.month ?? '';
          return monthLabel(month) + (month === partialMonth ? '*' : '');
        }}
        describe={(i) => {
          const month = rows[i]?.month ?? '';
          return monthLabel(month, true) + (month === partialMonth ? ' (so far)' : '');
        }}
        area={selected.length <= 2}
        series={metrics
          .filter((metric) => selected.includes(metric.key))
          .map((metric) => ({
            key: metric.key,
            label: metric.label,
            color: COLORS[metric.key],
            values: rows.map((row) => row[metric.key]),
          }))}
        height={260}
      />
      <p className="text-[11px] text-ink-subtle">
        * {monthLabel(partialMonth, true)} is still in progress.
      </p>

      {lastFull && priorFull ? (
        <div className="scroll-x">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                {[
                  '',
                  monthLabel(priorFull.month, true),
                  monthLabel(lastFull.month, true),
                  'Change',
                ].map((heading, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={cn(
                      'px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle',
                      index === 0 ? 'text-left' : 'text-right',
                    )}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => {
                const before = priorFull[metric.key];
                const after = lastFull[metric.key];
                // No percentage from a zero base: growth from nothing is not a
                // number, and "+∞%" or "+900%" from one signup misleads.
                const change = before === 0 ? null : Math.round(((after - before) / before) * 100);
                return (
                  <tr key={metric.key} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: COLORS[metric.key] }}
                        />
                        {metric.label}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-ink-muted">
                      {formatCount(before)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-ink">{formatCount(after)}</td>
                    <td
                      className={cn(
                        'tabular px-3 py-2 text-right font-semibold',
                        change === null
                          ? 'text-ink-subtle'
                          : change > 0
                            ? 'text-brand'
                            : change < 0
                              ? 'text-danger'
                              : 'text-ink-muted',
                      )}
                    >
                      {change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { formatCount } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { EmptyState, ErrorState, PermissionState, Skeleton } from '@/components/ui/states';

interface Dimension {
  key: string;
  label: string;
  kind: 'time' | 'category';
}

interface Dataset {
  key: string;
  label: string;
  dimensions: Dimension[];
}

interface Result {
  dataset: string;
  dimension: string;
  days: number;
  total: number;
  rows: { key: string; label: string; count: number }[];
  truncated: boolean;
  previousTotal: number | null;
}

const RANGES = [7, 30, 90, 365] as const;

/**
 * The founder data explorer.
 *
 * The builder sends the *names* of a dataset and a dimension plus a range —
 * never a query. Everything about how that becomes a database call is resolved
 * server-side against a whitelist, so nothing here can widen what is readable.
 */
export default function ExplorePage() {
  const toast = useToast();
  const [dataset, setDataset] = useState('users');
  const [chosenDimension, setChosenDimension] = useState('__day');
  const [days, setDays] = useState<number>(30);
  const [compare, setCompare] = useState(true);

  const schema = useQuery({
    queryKey: ['explore-schema'],
    queryFn: () => api<{ datasets: Dataset[] }>('/explore/schema'),
    staleTime: Infinity,
  });

  const datasets = useMemo(() => schema.data?.datasets ?? [], [schema.data]);
  const current = datasets.find((candidate) => candidate.key === dataset);

  /**
   * The dimension actually used, derived rather than corrected.
   *
   * Switching from Rides to Communities while "Vehicle" is selected would
   * otherwise send a dimension the server does not recognise and show an error
   * the user did nothing to cause. Fixing that in an effect would mean a render
   * with the invalid value followed by a second one — so instead the fallback
   * is computed: every dataset has a time dimension, so it is always valid.
   */
  const dimension =
    current?.dimensions.some((candidate) => candidate.key === chosenDimension)
      ? chosenDimension
      : '__day';

  const result = useQuery({
    queryKey: ['explore', dataset, dimension, days, compare],
    queryFn: () =>
      api<Result>('/explore', { query: { dataset, dimension, days, compare } }),
    enabled: Boolean(current),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (schema.isError) {
    if (schema.error instanceof ApiError && schema.error.isForbidden) {
      return <PermissionState permission="analytics.view" />;
    }
    return <ErrorState title="Could not load the explorer" description={schema.error.message} />;
  }

  const data = result.data;
  const delta =
    data && data.previousTotal !== null && data.previousTotal > 0
      ? Math.round(((data.total - data.previousTotal) / data.previousTotal) * 1000) / 10
      : null;

  function exportCsv() {
    if (!data || data.rows.length === 0) return;

    // Built from what is already on screen rather than re-fetched: this is the
    // table the reader is looking at, and a second request could return
    // something subtly different.
    const header = `"${current?.label ?? data.dataset}","count"`;
    const body = data.rows
      .map((row) => `"${row.label.replace(/"/g, '""')}","${row.count}"`)
      .join('\n');

    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `spllit-${data.dataset}-${data.dimension}-${days}d.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success('Exported the table below.');
  }

  const peak = Math.max(...(data?.rows ?? []).map((row) => row.count), 1);

  return (
    <>
      <PageHeader
        title="Explore"
        description="Pick a dataset and a dimension. Queries are built on the server from a fixed list — the browser never sends one."
      />

      {schema.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : datasets.length === 0 ? (
        <EmptyState
          title="No datasets available to your role"
          description="Exploring requires the analytics or audit permission."
        />
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-muted">Dataset</span>
                <select
                  value={dataset}
                  onChange={(event) => setDataset(event.target.value)}
                  className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                >
                  {datasets.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-muted">Group by</span>
                <select
                  value={dimension}
                  onChange={(event) => setChosenDimension(event.target.value)}
                  className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                >
                  {(current?.dimensions ?? []).map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-muted">Range</span>
              {RANGES.map((range) => (
                <Button
                  key={range}
                  variant={days === range ? 'primary' : 'ghost'}
                  onClick={() => setDays(range)}
                  aria-pressed={days === range}
                >
                  {range === 365 ? '1 year' : `${range} days`}
                </Button>
              ))}

              <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(event) => setCompare(event.target.checked)}
                  className="accent-brand"
                />
                Compare to previous period
              </label>
            </div>
          </Card>

          {result.isError ? (
            <ErrorState
              title="That query failed"
              description={
                result.error instanceof ApiError ? result.error.message : 'Something went wrong.'
              }
            />
          ) : result.isLoading && !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !data ? null : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Total" value={formatCount(data.total)} sub={`Last ${days} days`} />
                <Stat
                  label="Previous period"
                  value={data.previousTotal === null ? '—' : formatCount(data.previousTotal)}
                />
                <Stat
                  label="Change"
                  value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                  tone={delta === null ? 'neutral' : delta < 0 ? 'bad' : 'good'}
                />
                <Stat label="Groups" value={formatCount(data.rows.length)} />
              </div>

              {data.truncated ? (
                <p className="text-xs text-warning">
                  Showing the 50 largest groups. There are more — this dimension has high
                  cardinality.
                </p>
              ) : null}

              {data.rows.length === 0 ? (
                <EmptyState
                  title="Nothing in this range"
                  description="No rows matched. Try a longer range."
                />
              ) : (
                <>
                  <Card className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-bold text-ink">
                        {current?.label} by{' '}
                        {current?.dimensions.find((d) => d.key === dimension)?.label}
                      </h2>
                      <Button variant="secondary" onClick={exportCsv}>
                        <Download className="h-4 w-4" aria-hidden="true" />
                        CSV
                      </Button>
                    </div>

                    {/*
                      Bars rather than a chart library. It is one series, and a
                      charting dependency would be the largest thing in this
                      bundle for a graphic that is a list of divs.
                    */}
                    <div className="flex flex-col gap-1.5">
                      {data.rows.slice(0, 25).map((row) => (
                        <div key={row.key} className="flex items-center gap-3">
                          <span
                            className="w-32 shrink-0 truncate text-xs text-ink-muted"
                            title={row.label}
                          >
                            {row.label}
                          </span>
                          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
                            <div
                              className="h-full rounded-sm bg-brand/70"
                              style={{ width: `${Math.max((row.count / peak) * 100, 1)}%` }}
                            />
                          </div>
                          <span className="tabular w-16 shrink-0 text-right text-xs text-ink">
                            {formatCount(row.count)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {data.rows.length > 25 ? (
                      <p className="text-xs text-ink-subtle">
                        Charting the top 25 of {data.rows.length}. The CSV has all of them.
                      </p>
                    ) : null}
                  </Card>

                  <div className="scroll-x rounded-lg border border-line bg-surface">
                    <table className="w-full min-w-[360px] text-sm">
                      <thead>
                        <tr className="border-b border-line-strong">
                          <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                            {current?.dimensions.find((d) => d.key === dimension)?.label}
                          </th>
                          <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                            Count
                          </th>
                          <th className="px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                            Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row) => (
                          <tr key={row.key} className="border-b border-line last:border-0">
                            <td className="px-4 py-2.5 text-ink">{row.label}</td>
                            <td className="tabular px-4 py-2.5 text-right text-ink">
                              {formatCount(row.count)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Badge tone="neutral">
                                {data.total > 0
                                  ? `${Math.round((row.count / data.total) * 1000) / 10}%`
                                  : '—'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

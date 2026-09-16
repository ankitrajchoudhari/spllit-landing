'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAbsolute, formatRelative } from '@/lib/utils';
import { Badge, Button, Card, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import {
  EmptyState,
  ErrorState,
  NotImplementedState,
  PermissionState,
  SkeletonRows,
} from '@/components/ui/states';

interface Report {
  id: string;
  window: string;
  headline: string;
  body: string;
  model: string;
  trigger: 'schedule' | 'manual';
  actorEmail: string | null;
  error: string | null;
  createdAt: string;
}

interface ReportList {
  rows: Report[];
  page: number;
  pages: number;
  total: number;
  /** False when GEMINI_API_KEY is unset on the server. */
  configured: boolean;
}

const WINDOWS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '1h', label: 'Last hour' },
] as const;

/**
 * What the model wrote about how Spllit is doing.
 *
 * The newest report is shown in full because that is the one anybody opens this
 * for; the rest are a list you expand. A page of equally-weighted reports would
 * make the reader find today's among them.
 */
export default function ReportsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [window, setWindow] = useState<string>('24h');
  const [expanded, setExpanded] = useState<string | null>(null);

  const reports = useQuery({
    queryKey: ['reports', window],
    queryFn: () => api<ReportList>('/reports', { query: { window, limit: 20 } }),
    placeholderData: keepPreviousData,
  });

  const generate = useMutation({
    mutationFn: () => api<{ failed: boolean; error: string | null }>('/reports/generate', {
      method: 'POST',
      body: { window },
    }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      if (result.failed) toast.error(result.error ?? 'The report could not be written.');
      else toast.success('Report generated.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not generate a report.'),
  });

  if (reports.isError) {
    if (reports.error instanceof ApiError && reports.error.isForbidden) {
      return <PermissionState permission="analytics.view" />;
    }
    return <ErrorState title="Could not load reports" description={reports.error.message} />;
  }

  const data = reports.data;
  const rows = data?.rows ?? [];
  const [latest, ...older] = rows;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Written from aggregate figures only — no individual user data is sent to the model."
        actions={
          can('exports.run') ? (
            <Button
              variant="primary"
              disabled={generate.isPending || data?.configured === false}
              title={data?.configured === false ? 'GEMINI_API_KEY is not set.' : undefined}
              onClick={() => generate.mutate()}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {generate.isPending ? 'Writing…' : 'Generate now'}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1">
        {WINDOWS.map((option) => (
          <Button
            key={option.value}
            variant={window === option.value ? 'primary' : 'ghost'}
            onClick={() => setWindow(option.value)}
            aria-pressed={window === option.value}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/*
        Said before the button is pressed, not as a 503 afterwards. Without a
        key nothing here can work, and a disabled button with no reason costs
        somebody an afternoon.
      */}
      {data?.configured === false ? (
        <NotImplementedState
          title="Reports are not configured"
          reason="GEMINI_API_KEY is not set on the API service, so no report can be written. Existing reports are still readable."
        />
      ) : null}

      {reports.isLoading && !data ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="One is written every hour, or press Generate now."
        />
      ) : (
        <>
          {latest ? <ReportCard report={latest} featured /> : null}

          {older.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
                Earlier
              </h2>
              {older.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  open={expanded === report.id}
                  onToggle={() => setExpanded(expanded === report.id ? null : report.id)}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function ReportCard({
  report,
  featured = false,
  open = false,
  onToggle,
}: {
  report: Report;
  featured?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const failed = report.error !== null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={failed ? 'bad' : 'good'}>{report.window}</Badge>
        {report.trigger === 'manual' ? <Badge tone="info">Manual</Badge> : null}
        {failed ? <Badge tone="bad">Failed</Badge> : null}
        <span
          className="ml-auto text-xs text-ink-subtle"
          title={formatAbsolute(report.createdAt)}
        >
          {formatRelative(report.createdAt)}
        </span>
      </div>

      {failed ? (
        <p className="text-sm text-danger">{report.error}</p>
      ) : featured || open ? (
        /*
          `whitespace-pre-line`, not a markdown renderer. The prompt forbids
          headings and lists, so the model returns paragraphs — and rendering
          markdown would invite it to start emitting some.
        */
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{report.body}</p>
      ) : (
        <p className="line-clamp-2 text-sm text-ink-muted">{report.headline}</p>
      )}

      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-ink-subtle">{report.model}</span>
        {report.actorEmail ? (
          <span className="truncate text-[11px] text-ink-subtle">by {report.actorEmail}</span>
        ) : null}
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto text-xs text-ink-muted transition-colors duration-snap hover:text-ink"
          >
            {open ? 'Collapse' : 'Read'}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, Button, Input, PageHeader } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface AuditRow {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  success: boolean;
  errorMessage: string | null;
  ip: string | null;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  page: number;
  pages: number;
  total: number;
}

export default function AuditPage() {
  const [actorInput, setActorInput] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ['audit', actor, page],
    queryFn: () => api<AuditResponse>('/audit', { query: { actor, page, limit: 25 } }),
    placeholderData: keepPreviousData,
  });

  if (audit.isError) {
    const error = audit.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="audit.view" />;
    }
    return (
      <ErrorState
        title="Could not load the audit log"
        description={error instanceof ApiError ? error.message : 'Something went wrong.'}
      />
    );
  }

  const data = audit.data;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every privileged action taken in this console, including the ones that failed."
      />

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setActor(actorInput.trim());
          setPage(1);
        }}
      >
        <Input
          value={actorInput}
          onChange={(event) => setActorInput(event.target.value)}
          placeholder="Filter by admin email"
          aria-label="Filter by admin email"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {audit.isLoading && !data ? (
        <SkeletonRows rows={8} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Actions appear here as soon as an admin changes something. An empty log on a new console is expected."
        />
      ) : (
        <>
          <span className="tabular text-xs text-ink-subtle">
            {formatCount(data.total)} entries
          </span>

          <div className="flex flex-col gap-2">
            {data.rows.map((row) => (
              <article
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs font-semibold text-ink">{row.action}</code>
                  <Badge tone={row.success ? 'good' : 'bad'}>
                    {row.success ? 'Applied' : 'Failed'}
                  </Badge>
                  <Badge tone="neutral">{row.targetType}</Badge>
                  <span
                    className="ml-auto text-xs text-ink-subtle"
                    title={formatAbsolute(row.createdAt)}
                  >
                    {formatRelative(row.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{row.actorEmail}</span>
                  <span className="text-ink-subtle"> ({row.actorRole})</span>
                  {row.targetLabel ? (
                    <>
                      {' → '}
                      <span className="font-semibold text-ink">{row.targetLabel}</span>
                    </>
                  ) : null}
                </p>

                {row.reason ? (
                  <p className="text-sm text-ink-muted">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                      Reason
                    </span>{' '}
                    {row.reason}
                  </p>
                ) : null}

                {row.errorMessage ? (
                  <p className="text-sm text-danger">{row.errorMessage}</p>
                ) : null}

                {row.before || row.after ? (
                  <div className="scroll-x rounded-md bg-surface-sunken p-3">
                    <table className="min-w-[320px] text-xs">
                      <tbody>
                        {Object.keys({ ...row.before, ...row.after }).map((key) => (
                          <tr key={key}>
                            <td className="py-0.5 pr-4 font-mono text-ink-subtle">{key}</td>
                            <td className="py-0.5 pr-3 font-mono text-danger line-through">
                              {JSON.stringify(row.before?.[key] ?? null)}
                            </td>
                            <td className="py-0.5 font-mono text-brand">
                              {JSON.stringify(row.after?.[key] ?? null)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            ))}
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

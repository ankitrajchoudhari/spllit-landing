'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAbsolute, formatCount } from '@/lib/utils';
import { Badge, PageHeader, Stat } from '@/components/ui/primitives';
import { DataTable, type Column, type Paged } from '@/components/ui/data-table';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';
import {
  AudiencePicker,
  audienceReady,
  type AudienceValue,
} from '@/components/audience-picker';

/**
 * Email announcements.
 *
 * BroadcastComposer is the in-app equivalent, and writes notifications. This is
 * the same act through a channel that cannot be recalled and that spends
 * sending reputation, so it carries more friction on purpose: the audience is
 * counted before sending, the confirmation asks for a written reason, and every
 * send writes an audit row.
 */

interface CampaignRow {
  id: string;
  subject: string;
  status: string;
  audience: number;
  sent: number;
  skipped: number;
  failed: number;
  createdName: string | null;
  createdAt: string;
}

interface CampaignsResponse {
  campaigns: CampaignRow[];
  audience: { reachable: number; total: number };
  available: boolean;
}

const MAX_SUBJECT = 120;
const MAX_BODY = 5000;

const COLUMNS: Column<CampaignRow>[] = [
  { key: 'subject', header: 'Subject', cell: (row) => row.subject },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => (
      <Badge tone={row.status === 'sent' ? 'good' : row.status === 'failed' ? 'bad' : 'warn'}>
        {row.status}
      </Badge>
    ),
  },
  { key: 'sent', header: 'Sent', numeric: true, cell: (row) => formatCount(row.sent) },
  { key: 'skipped', header: 'Skipped', numeric: true, cell: (row) => formatCount(row.skipped) },
  { key: 'by', header: 'By', cell: (row) => row.createdName ?? '—' },
  { key: 'when', header: 'When', cell: (row) => formatAbsolute(row.createdAt) },
];

export default function CampaignsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [target, setTarget] = useState<AudienceValue>({
    audience: 'all',
    college: '',
    recipients: [],
  });

  const allowed = can('notifications.send');

  /**
   * Re-counted whenever the target changes, so the send button always names the
   * number it is about to reach. Keyed on the whole target for the same reason:
   * a stale count beside a changed audience is how somebody sends to the wrong
   * list while reading the right number.
   */
  const targetKey = [target.audience, target.college, target.recipients.map((r) => r.id).join(',')];

  const data = useQuery({
    queryKey: ['campaigns', ...targetKey],
    queryFn: () =>
      api<CampaignsResponse>('/campaigns', {
        query: {
          audience: target.audience,
          college: target.college,
          userIds: target.recipients.map((person) => person.id).join(','),
        },
      }),
    enabled: allowed && audienceReady(target),
    placeholderData: keepPreviousData,
  });

  const send = useMutation({
    mutationFn: () =>
      api<CampaignRow>('/campaigns', {
        method: 'POST',
        // The server checks the confirmation too. A client-side guard on
        // something unrecallable is decoration.
        body: {
          subject,
          body,
          confirm: 'SEND',
          audience: target.audience,
          college: target.college,
          userIds: target.recipients.map((person) => person.id),
        },
      }),
    onSuccess: (result) => {
      setConfirming(false);
      setSubject('');
      setBody('');
      setTarget({ audience: 'all', college: '', recipients: [] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(
        `Sent to ${formatCount(result.sent)} — ${formatCount(result.skipped)} skipped.`,
      );
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(error instanceof ApiError ? error.message : 'Could not send the campaign.');
    },
  });

  if (!allowed) return <PermissionState permission="notifications.send" />;

  const ready =
    subject.trim().length > 0 && body.trim().length > 0 && audienceReady(target);
  const audience = data.data?.audience;
  const available = data.data?.available ?? false;

  const paged: Paged<CampaignRow> = {
    rows: data.data?.campaigns ?? [],
    page: 1,
    limit: 30,
    total: data.data?.campaigns.length ?? 0,
    pages: 1,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="One message, emailed to everyone who has not opted out."
      />

      {data.isError ? (
        <ErrorState
          title="Could not load campaigns"
          description={data.error instanceof ApiError ? data.error.message : undefined}
        />
      ) : null}

      {data.data && !available ? (
        /**
         * Explained rather than merely disabled. Campaigns need their own
         * sending domain because reputation is per-domain — an announcement is
         * the likeliest message to draw a complaint, and that must not be able
         * to stop "your request was accepted" arriving. A greyed-out button
         * with no reason costs somebody an afternoon.
         */
        <div className="rounded-lg border border-warning bg-warning-muted p-4 text-sm">
          <p className="font-medium text-ink">Campaign sending is not configured.</p>
          <p className="mt-1 text-ink-muted">
            Set <code className="font-mono text-xs">CAMPAIGN_EMAIL_FROM</code> to an address on a
            sending domain separate from transactional mail — for example{' '}
            <code className="font-mono text-xs">news.spllit.app</code>. Sharing the transactional
            domain would let one spam complaint damage delivery of sign-in and group ride email.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Reachable now" value={audience ? formatCount(audience.reachable) : '—'} />
        <Stat label="Accounts" value={audience ? formatCount(audience.total) : '—'} />
        <Stat
          label="Not reachable"
          value={audience ? formatCount(audience.total - audience.reachable) : '—'}
          sub="unverified, opted out or suppressed"
        />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
        <AudiencePicker value={target} onChange={setTarget} disabled={send.isPending} />

        <div>
          <label htmlFor="campaign-subject" className="mb-1.5 block text-sm font-medium text-ink">
            Subject
          </label>
          <input
            id="campaign-subject"
            value={subject}
            maxLength={MAX_SUBJECT}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="What is this about?"
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="campaign-body" className="mb-1.5 block text-sm font-medium text-ink">
            Message
          </label>
          <textarea
            id="campaign-body"
            value={body}
            maxLength={MAX_BODY}
            rows={8}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write it as you would say it. Plain text — no HTML."
            className="w-full resize-y rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-subtle">
            {body.length}/{MAX_BODY} · every message carries an unsubscribe link and is addressed
            to one recipient, so nobody sees anyone else&apos;s address.
          </p>
        </div>

        <div>
          <button
            type="button"
            disabled={!ready || send.isPending || !available}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {send.isPending
              ? 'Sending…'
              : `Send to ${audience ? formatCount(audience.reachable) : '…'}`}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Sent</h2>
        {data.isPending ? (
          <SkeletonRows />
        ) : paged.rows.length === 0 ? (
          <EmptyState title="Nothing sent yet" description="Announcements you send appear here." />
        ) : (
          <DataTable data={paged} columns={COLUMNS} onPage={() => undefined} />
        )}
      </div>

      {confirming ? (
        <ConfirmDialog
          title={`Send to ${formatCount(audience?.reachable ?? 0)} people?`}
          description={
            <>
              <strong className="block text-ink">{subject}</strong>
              <span className="block whitespace-pre-wrap pt-1">{body}</span>
              <span className="block pt-2 text-ink-subtle">
                Email cannot be recalled once sent.
              </span>
            </>
          }
          confirmLabel="Send now"
          destructive
          pending={send.isPending}
          onConfirm={() => send.mutate()}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}

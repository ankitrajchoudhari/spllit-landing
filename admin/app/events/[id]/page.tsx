'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface EventDetail {
  event: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    college: string | null;
    startsAt: string;
    endsAt: string | null;
    ticketType: string;
    price: number | null;
    capacity: number | null;
    attendeeCount: number;
    status: string;
    createdAt: string;
  };
  host: { id: string; name: string; email: string } | null;
  attendees: {
    id: string;
    status: string;
    joinedAt: string;
    user: { id: string; name: string; email: string } | null;
  }[];
  attendeesTruncated: boolean;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [confirming, setConfirming] = useState(false);

  const detail = useQuery({
    queryKey: ['event', id],
    queryFn: () => api<EventDetail>(`/events/${id}`),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      api(`/events/${id}/status`, { method: 'PATCH', body: { status: 'cancelled', reason } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setConfirming(false);
      toast.success('Event cancelled.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not cancel the event.'),
  });

  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.isForbidden) {
      return <PermissionState permission="content.view" />;
    }
    return <ErrorState title="Could not load this event" description={detail.error.message} />;
  }

  if (detail.isLoading || !detail.data) return <SkeletonRows rows={6} />;

  const { event, host, attendees, attendeesTruncated } = detail.data;
  const canCancel = can('content.delete') && event.status !== 'cancelled';

  return (
    <>
      <PageHeader
        title={event.title}
        description={event.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge
              tone={
                event.status === 'published'
                  ? 'good'
                  : event.status === 'cancelled'
                    ? 'bad'
                    : 'neutral'
              }
            >
              {event.status}
            </Badge>
            {canCancel ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Cancel event
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Going"
          value={event.capacity ? `${event.attendeeCount}/${event.capacity}` : event.attendeeCount}
        />
        <Stat label="Starts" value={formatRelative(event.startsAt)} />
        <Stat
          label="Ticket"
          value={event.ticketType === 'paid' ? `₹${event.price ?? 0}` : 'Free'}
        />
        <Stat label="Category" value={event.category ?? '—'} />
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Host</h2>
        {host ? (
          <Link
            href={`/users/${host.id}`}
            className="flex flex-col rounded-md border border-line px-3 py-2 transition-colors duration-snap hover:border-line-strong"
          >
            <span className="font-semibold text-ink">{host.name}</span>
            <span className="font-mono text-xs text-ink-subtle">{host.email}</span>
          </Link>
        ) : (
          <p className="text-sm text-ink-subtle">The host account no longer exists.</p>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2">
          <Field label="Starts" value={formatAbsolute(event.startsAt)} />
          <Field label="Ends" value={event.endsAt ? formatAbsolute(event.endsAt) : 'Not set'} />
          <Field label="College" value={event.college ?? '—'} />
          <Field label="Created" value={formatRelative(event.createdAt)} />
        </dl>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
          Attendees ({formatCount(event.attendeeCount)})
        </h2>

        {/*
          The list is capped server-side. Saying so stops a 100-row table
          reading as the complete guest list for a 400-person event.
        */}
        {attendeesTruncated ? (
          <p className="text-xs text-ink-subtle">
            Showing the 100 most recent of {formatCount(event.attendeeCount)}.
          </p>
        ) : null}

        {attendees.length === 0 ? (
          <EmptyState title="No attendees" description="Nobody has joined this event yet." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {attendees.map((attendee) => (
              <div
                key={attendee.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2"
              >
                {attendee.user ? (
                  <Link
                    href={`/users/${attendee.user.id}`}
                    className="flex min-w-0 flex-1 flex-col hover:text-brand"
                  >
                    <span className="truncate text-sm text-ink">{attendee.user.name}</span>
                    <span className="truncate font-mono text-xs text-ink-subtle">
                      {attendee.user.email}
                    </span>
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-ink-subtle">Deleted account</span>
                )}
                <Badge tone={attendee.status === 'going' ? 'good' : 'neutral'}>
                  {attendee.status}
                </Badge>
                <span className="text-xs text-ink-subtle" title={formatAbsolute(attendee.joinedAt)}>
                  {formatRelative(attendee.joinedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {confirming ? (
        <ConfirmDialog
          title={`Cancel “${event.title}”?`}
          description={`This is visible to all ${formatCount(event.attendeeCount)} attendees immediately.`}
          confirmLabel="Cancel event"
          destructive
          pending={cancel.isPending}
          error={cancel.error instanceof ApiError ? cancel.error.message : null}
          onCancel={() => {
            setConfirming(false);
            cancel.reset();
          }}
          onConfirm={(reason) => cancel.mutate(reason)}
        />
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

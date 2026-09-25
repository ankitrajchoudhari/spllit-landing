'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, type AdminRole } from '@/lib/permissions';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import {
  EmptyState,
  ErrorState,
  NotImplementedState,
  PermissionState,
  SkeletonRows,
} from '@/components/ui/states';

interface UserDetail {
  user: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    phone: string | null;
    college: string;
    isActive: boolean;
    onboarded: boolean | null;
    profile: 'complete' | 'incomplete' | 'legacy';
    displayName: string;
    contact: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    instituteVerified: boolean;
    rating: number;
    totalRides: number;
    createdAt: string;
    lastSeen: string;
    consoleRole: AdminRole | null;
  };
  counts: {
    rides: number;
    squads: number;
    events: number;
    communities: number;
    emergencies: number;
    notifications: number;
    blockedBy: number;
  };
  recentRides: {
    id: string;
    status: string;
    origin: string;
    destination: string;
    departureTime: string;
  }[];
  squads: { id: string; role: string; status: string; squad: { id: string; name: string } | null }[];
  events: {
    id: string;
    status: string;
    event: { id: string; title: string; startsAt: string } | null;
  }[];
  communities: {
    id: string;
    role: string;
    community: { id: string; name: string; slug: string } | null;
  }[];
  auditTrail: AuditEntry[];
  actedTrail: AuditEntry[];
  unavailable: { key: string; reason: string }[];
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  reason: string | null;
  success: boolean;
  createdAt: string;
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can, session } = useAuth();

  const [confirming, setConfirming] = useState<'suspend' | 'restore' | null>(null);

  const detail = useQuery({
    queryKey: ['user', id],
    queryFn: () => api<UserDetail>(`/users/${id}`),
  });

  const setStatus = useMutation({
    mutationFn: (input: { isActive: boolean; reason: string }) =>
      api(`/users/${id}/status`, { method: 'PATCH', body: input }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['user', id] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirming(null);
      toast.success(variables.isActive ? 'Account restored.' : 'Account suspended.');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the account.');
    },
  });

  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.isForbidden) {
      return <PermissionState permission="users.view" />;
    }
    return (
      <ErrorState
        title="Could not load this user"
        description={detail.error instanceof ApiError ? detail.error.message : 'Something went wrong.'}
      />
    );
  }

  if (detail.isLoading || !detail.data) return <SkeletonRows rows={8} />;

  const { user, counts, recentRides, squads, events, communities, auditTrail, actedTrail } =
    detail.data;

  // Cosmetic only — the backend refuses self-edits and equal-rank edits anyway.
  const isSelf = user.id === session?.userId;
  const canSuspend = can('users.suspend') && !isSelf;

  return (
    <>
      <PageHeader
        title={user.displayName}
        description={user.username ? `@${user.username} · ${user.contact}` : user.contact}
        actions={
          canSuspend ? (
            <Button
              variant={user.isActive ? 'danger' : 'primary'}
              onClick={() => setConfirming(user.isActive ? 'suspend' : 'restore')}
            >
              {user.isActive ? 'Suspend account' : 'Restore account'}
            </Button>
          ) : isSelf ? (
            <span className="text-xs text-ink-subtle">This is your own account.</span>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={user.isActive ? 'good' : 'bad'}>
          {user.isActive ? 'Active' : 'Suspended'}
        </Badge>
        {user.consoleRole ? <Badge tone="info">{ROLE_LABELS[user.consoleRole]}</Badge> : null}
        {user.profile === 'incomplete' ? <Badge tone="warn">Profile incomplete</Badge> : null}
        {user.profile === 'legacy' ? <Badge tone="neutral">Joined on the old app</Badge> : null}
        {user.emailVerified ? <Badge tone="neutral">Email verified</Badge> : null}
        {user.phoneVerified ? <Badge tone="neutral">Phone verified</Badge> : null}
        {user.instituteVerified ? <Badge tone="good">Institute verified</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rides" value={formatCount(counts.rides)} />
        <Stat label="Group Rides" value={formatCount(counts.squads)} />
        <Stat label="Events" value={formatCount(counts.events)} />
        <Stat label="Communities" value={formatCount(counts.communities)} />
        <Stat label="Notifications" value={formatCount(counts.notifications)} />
        <Stat
          label="SOS raised"
          value={formatCount(counts.emergencies)}
          tone={counts.emergencies > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Blocked by"
          value={formatCount(counts.blockedBy)}
          tone={counts.blockedBy > 2 ? 'warn' : 'neutral'}
          sub="Other users"
        />
        <Stat label="Rating" value={user.rating ? user.rating.toFixed(1) : '—'} />
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Account</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Field label="College" value={user.college || '—'} />
          <Field label="Phone" value={user.phone ?? 'Not provided'} />
          <Field label="Joined" value={formatAbsolute(user.createdAt)} />
          <Field label="Last seen" value={formatRelative(user.lastSeen)} />
          <Field label="User ID" value={user.id} mono />
        </dl>
      </Card>

      <Section title="Recent rides">
        {recentRides.length === 0 ? (
          <EmptyState title="No rides" description="This account has never created a ride." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentRides.map((ride) => (
              <Link
                key={ride.id}
                href={`/rides/${ride.id}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm transition-colors duration-snap hover:border-line-strong"
              >
                <span className="flex-1 text-ink">
                  {ride.origin} → {ride.destination}
                </span>
                <Badge tone="neutral">{ride.status.replace(/_/g, ' ')}</Badge>
                <span className="text-xs text-ink-subtle">
                  {formatRelative(ride.departureTime)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Group Rides">
        {squads.length === 0 ? (
          <EmptyState title="No group rides" description="Not a member of any group ride." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {squads.map((membership) => (
              <Link
                key={membership.id}
                href={membership.squad ? `/squads/${membership.squad.id}` : '#'}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm transition-colors duration-snap hover:border-line-strong"
              >
                <span className="flex-1 text-ink">{membership.squad?.name ?? 'Deleted group ride'}</span>
                <Badge tone={membership.role === 'leader' ? 'info' : 'neutral'}>
                  {membership.role}
                </Badge>
                <Badge tone="neutral">{membership.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Communities">
        {communities.length === 0 ? (
          <EmptyState title="No communities" description="Not a member of any community." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {communities.map((membership) => (
              <Link
                key={membership.id}
                href={membership.community ? `/communities/${membership.community.id}` : '#'}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm transition-colors duration-snap hover:border-line-strong"
              >
                <span className="flex-1 text-ink">
                  {membership.community?.name ?? 'Deleted community'}
                </span>
                <Badge tone={membership.role === 'member' ? 'neutral' : 'info'}>
                  {membership.role}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Events">
        {events.length === 0 ? (
          <EmptyState title="No events" description="Has not joined an event." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {events.map((attendance) => (
              <Link
                key={attendance.id}
                href={attendance.event ? `/events/${attendance.event.id}` : '#'}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm transition-colors duration-snap hover:border-line-strong"
              >
                <span className="flex-1 text-ink">
                  {attendance.event?.title ?? 'Deleted event'}
                </span>
                <Badge tone="neutral">{attendance.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Admin actions on this account">
        <AuditList rows={auditTrail} empty="No admin has ever acted on this account." />
      </Section>

      {actedTrail.length > 0 ? (
        <Section title="Admin actions taken by this account">
          <AuditList rows={actedTrail} empty="" />
        </Section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {detail.data.unavailable.map((item) => (
          <NotImplementedState
            key={item.key}
            title={item.key === 'posts' ? 'Posts & comments' : 'Reports'}
            reason={item.reason}
          />
        ))}
      </div>

      {confirming ? (
        <ConfirmDialog
          title={confirming === 'suspend' ? `Suspend ${user.displayName}?` : `Restore ${user.displayName}?`}
          description={
            confirming === 'suspend'
              ? 'They will lose access to Spllit immediately. Their rides, group rides and history are kept.'
              : 'They will be able to sign in and use Spllit again.'
          }
          confirmLabel={confirming === 'suspend' ? 'Suspend' : 'Restore'}
          destructive={confirming === 'suspend'}
          pending={setStatus.isPending}
          error={setStatus.error instanceof ApiError ? setStatus.error.message : null}
          onCancel={() => {
            setConfirming(null);
            setStatus.reset();
          }}
          onConfirm={(reason) =>
            setStatus.mutate({ isActive: confirming === 'restore', reason })
          }
        />
      ) : null}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className={`text-sm text-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AuditList({ rows, empty }: { rows: AuditEntry[]; empty: string }) {
  if (rows.length === 0) {
    return empty ? <EmptyState title="Nothing recorded" description={empty} /> : null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <code className="font-mono text-xs font-semibold text-ink">{row.action}</code>
          <Badge tone={row.success ? 'good' : 'bad'}>{row.success ? 'Applied' : 'Failed'}</Badge>
          <span className="flex-1 text-xs text-ink-muted">{row.actorEmail}</span>
          {row.reason ? (
            <span className="w-full text-xs text-ink-muted sm:w-auto">“{row.reason}”</span>
          ) : null}
          <span className="text-xs text-ink-subtle" title={formatAbsolute(row.createdAt)}>
            {formatRelative(row.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

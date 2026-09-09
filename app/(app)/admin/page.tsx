'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Car,
  CalendarDays,
  Hash,
  Mail,
  MessageCircle,
  Radio,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { cn, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { SignupChart } from '@/components/admin/signup-chart';
import { VehicleQueue } from '@/components/admin/vehicle-queue';
import { adminService, type ContentType } from '@/lib/services/admin';
import { ApiError } from '@/lib/api/client';

type Tab = 'overview' | 'users' | ContentType | 'vehicles' | 'broadcast';

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'users', label: 'Users' },
  { value: 'rides', label: 'Rides' },
  { value: 'squads', label: 'Squads' },
  { value: 'events', label: 'Events' },
  { value: 'communities', label: 'Communities' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'emergencies', label: 'SOS' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'broadcast', label: 'Broadcast' },
];

function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-surface p-4',
        tone === 'danger' && Number(value) > 0
          ? 'border-danger/40 bg-danger-muted'
          : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 text-ink-subtle">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-[26px] font-semibold leading-none tabular-nums text-ink">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12px] text-ink-muted">{sub}</p> : null}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();

  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminService.overview(),
    staleTime: 30_000,
    retry: false,
  });

  // A non-admin gets a 404 from the API by design — surface it as "no access"
  // rather than a generic error.
  const forbidden =
    overview.isError &&
    overview.error instanceof ApiError &&
    (overview.error.isNotFound || overview.error.isAuthError);

  if (forbidden) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" />}
        title="No admin access"
        description="This area is limited to Spllit administrators."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">
          Admin
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Everything on the platform, and the controls to act on it.
        </p>
      </header>

      <Tabs value={tab} onChange={setTab} items={TABS} layoutId="admin-tab" />

      {tab === 'vehicles' ? <VehicleQueue /> : null}

      {tab === 'overview' ? (
        overview.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-lg" />
            ))}
          </div>
        ) : overview.data ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Users"
                value={overview.data.users.total}
                sub={`+${overview.data.users.new24h} today · +${overview.data.users.new7d} this week`}
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Active rides"
                value={overview.data.rides.active}
                sub={`${overview.data.rides.today} posted today`}
                icon={<Car className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Squads"
                value={overview.data.squads.active}
                sub={`${overview.data.squads.total} all time`}
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Events"
                value={overview.data.events.upcoming}
                sub="upcoming"
                icon={<CalendarDays className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Communities"
                value={overview.data.communities.total}
                icon={<Hash className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Messages"
                value={overview.data.messages.last24h}
                sub="last 24 hours"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Waitlist"
                value={overview.data.waitlist.total}
                sub="across Phase 2"
                icon={<Mail className="h-3.5 w-3.5" />}
              />
              <Stat
                label="Open SOS"
                value={overview.data.emergencies.open}
                sub={overview.data.emergencies.open > 0 ? 'needs attention' : 'all clear'}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                tone="danger"
              />
            </div>

            <div className="rounded-lg border border-line bg-surface p-5">
              <SignupChart data={overview.data.signupTrend} />
            </div>
          </div>
        ) : null
      ) : null}

      {tab === 'users' ? <UsersTab /> : null}
      {tab === 'broadcast' ? <BroadcastTab /> : null}

      {['rides', 'squads', 'events', 'communities', 'waitlist', 'emergencies'].includes(
        tab,
      ) ? (
        <ContentTab
          type={tab as ContentType}
          onChanged={() => void qc.invalidateQueries({ queryKey: ['admin'] })}
        />
      ) : null}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const users = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: () => adminService.users(q, page),
    staleTime: 15_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminService.setUserActive(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'subadmin' | 'admin' }) =>
      adminService.setUserRole(id, role),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const items = users.data?.items ?? [];
  const total = users.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Input
        icon={<Search className="h-4 w-4" />}
        placeholder="Search by name, email, username or college"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      {users.isPending ? (
        <SkeletonList count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={q ? `No users matched "${q}"` : 'No users yet'}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <ul className="divide-y divide-line">
              {items.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar src={user.profilePhoto} name={user.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {user.name}
                      </p>
                      {user.role !== 'user' ? (
                        <Badge tone="accent">{user.role}</Badge>
                      ) : null}
                      {!user.isActive ? <Badge tone="danger">Suspended</Badge> : null}
                      {!user.onboarded ? <Badge>Incomplete</Badge> : null}
                    </div>
                    <p className="truncate text-[12.5px] text-ink-muted">
                      {user.email}
                      {user.college ? ` · ${user.college}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-subtle">
                      {user.totalRides} rides · joined {formatRelative(user.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        setRole.mutate({
                          id: user.id,
                          role: e.target.value as 'user' | 'subadmin' | 'admin',
                        })
                      }
                      aria-label={`Role for ${user.name}`}
                      className="h-8 rounded-md border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-brand"
                    >
                      <option value="user">user</option>
                      <option value="subadmin">subadmin</option>
                      <option value="admin">admin</option>
                    </select>
                    <Button
                      size="sm"
                      variant={user.isActive ? 'outline' : 'primary'}
                      loading={toggle.isPending && toggle.variables?.id === user.id}
                      onClick={() =>
                        toggle.mutate({ id: user.id, isActive: !user.isActive })
                      }
                    >
                      {user.isActive ? 'Suspend' : 'Restore'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-[12.5px] text-ink-muted">
            <span>
              {items.length} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page * (users.data?.perPage ?? 25) >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {setRole.isError ? (
        <p role="alert" className="text-[13px] text-danger">
          {setRole.error instanceof Error
            ? setRole.error.message
            : 'Could not change that role.'}
        </p>
      ) : null}
    </div>
  );
}

/** Column config per content type — keeps one table generic across six sources. */
const COLUMNS: Record<ContentType, { key: string; label: string }[]> = {
  rides: [
    { key: 'origin', label: 'From' },
    { key: 'destination', label: 'To' },
    { key: 'status', label: 'Status' },
  ],
  squads: [
    { key: 'name', label: 'Name' },
    { key: 'memberCount', label: 'Members' },
    { key: 'visibility', label: 'Visibility' },
  ],
  events: [
    { key: 'title', label: 'Title' },
    { key: 'attendeeCount', label: 'Going' },
    { key: 'status', label: 'Status' },
  ],
  communities: [
    { key: 'name', label: 'Name' },
    { key: 'memberCount', label: 'Members' },
    { key: 'visibility', label: 'Visibility' },
  ],
  waitlist: [
    { key: 'service', label: 'Service' },
    { key: 'email', label: 'Email' },
    { key: 'college', label: 'College' },
  ],
  emergencies: [
    { key: 'emergencyType', label: 'Type' },
    { key: 'message', label: 'Message' },
    { key: 'status', label: 'Status' },
  ],
};

function ContentTab({ type, onChanged }: { type: ContentType; onChanged: () => void }) {
  const qc = useQueryClient();

  const rows = useQuery({
    queryKey: ['admin', 'content', type],
    queryFn: () => adminService.content(type),
    staleTime: 15_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminService.removeContent(type, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'content', type] });
      onChanged();
    },
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      adminService.setEmergencyStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'content', type] });
      onChanged();
    },
  });

  const columns = COLUMNS[type];
  const items = rows.data ?? [];

  if (rows.isPending) return <SkeletonList count={5} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Hash className="h-5 w-5" />}
        title={`No ${type} yet`}
        description="Rows will appear here as the platform is used."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[600px] text-left text-[13px]">
        <thead className="border-b border-line bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle"
              >
                {column.label}
              </th>
            ))}
            <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle">
              Owner
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const owner = (row.host ?? row.leader ?? row.user) as
              | { name?: string; email?: string }
              | undefined;
            return (
              <tr key={row.id} className="border-b border-line last:border-0">
                {columns.map((column) => (
                  <td key={column.key} className="max-w-[220px] truncate px-4 py-3 text-ink">
                    {String(row[column.key] ?? '—')}
                  </td>
                ))}
                <td className="max-w-[180px] truncate px-4 py-3 text-ink-muted">
                  {owner?.name ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {type === 'emergencies' ? (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          resolve.mutate({ id: row.id, status: 'acknowledged' })
                        }
                      >
                        Ack
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolve.mutate({ id: row.id, status: 'resolved' })}
                      >
                        Resolve
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={remove.isPending && remove.variables === row.id}
                      onClick={() => remove.mutate(row.id)}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BroadcastTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [college, setCollege] = useState('');

  const send = useMutation({
    mutationFn: () =>
      adminService.broadcast({
        title: title.trim(),
        body: body.trim(),
        ...(college.trim() ? { college: college.trim() } : {}),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
    },
  });

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-muted px-4 py-3">
        <Radio className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          This sends an in-app notification and a push to every matching user. It cannot
          be recalled once sent.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-[13px] font-medium text-ink">Title</span>
        <Input
          placeholder="Spllit is live at your campus"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-medium text-ink">Message</span>
        <textarea
          rows={4}
          placeholder="What do you want them to know?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-brand"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-medium text-ink">College</span>
        <Input
          placeholder="Leave blank to send to everyone"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
        />
      </label>

      <Button
        size="lg"
        className="w-full"
        disabled={title.trim().length < 3 || body.trim().length < 3}
        loading={send.isPending}
        onClick={() => send.mutate()}
      >
        Send broadcast
      </Button>

      {send.isSuccess ? (
        <p className="text-[13px] text-brand">Sent to {send.data.sent} people.</p>
      ) : null}
      {send.isError ? (
        <p role="alert" className="text-[13px] text-danger">
          {send.error instanceof Error ? send.error.message : 'Broadcast failed.'}
        </p>
      ) : null}
    </div>
  );
}

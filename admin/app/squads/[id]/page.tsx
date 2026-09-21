'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface SquadDetail {
  squad: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    visibility: string;
    status: string;
    college: string | null;
    memberCount: number;
    memberLimit: number | null;
    meetingAt: string | null;
    durationMinutes: number | null;
    lastActivityAt: string | null;
    createdAt: string;
  };
  leader: { id: string; name: string; email: string } | null;
  members: {
    id: string;
    role: string;
    status: string;
    feePaid: boolean;
    joinedAt: string;
    arrivedAt: string | null;
    user: { id: string; name: string; email: string } | null;
  }[];
  chat: { exists: boolean; messageCount: number; lastMessageAt: string | null };
}

export default function SquadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const detail = useQuery({
    queryKey: ['squad', id],
    queryFn: () => api<SquadDetail>(`/squads/${id}`),
  });

  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.isForbidden) {
      return <PermissionState permission="content.view" />;
    }
    return <ErrorState title="Could not load this group ride" description={detail.error.message} />;
  }

  if (detail.isLoading || !detail.data) return <SkeletonRows rows={6} />;

  const { squad, leader, members, chat } = detail.data;

  return (
    <>
      <PageHeader
        title={squad.name}
        description={squad.description ?? undefined}
        actions={
          <div className="flex gap-1.5">
            <Badge
              tone={
                squad.status === 'completed'
                  ? 'good'
                  : squad.status === 'cancelled'
                    ? 'bad'
                    : squad.status === 'in_progress'
                      ? 'info'
                      : 'neutral'
              }
            >
              {squad.status === 'active' ? 'Scheduled' : squad.status.replace(/_/g, ' ')}
            </Badge>
            <Badge tone={squad.visibility === 'public' ? 'neutral' : 'warn'}>
              {squad.visibility}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Members"
          value={squad.memberLimit ? `${squad.memberCount}/${squad.memberLimit}` : squad.memberCount}
        />
        <Stat label="Type" value={squad.type} />
        <Stat
          label="Meets"
          value={squad.meetingAt ? formatRelative(squad.meetingAt) : 'Not set'}
        />
        <Stat label="Messages" value={formatCount(chat.messageCount)} sub="Count only" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Leader</h2>
          {leader ? (
            <Link
              href={`/users/${leader.id}`}
              className="flex flex-col rounded-md border border-line px-3 py-2 transition-colors duration-snap hover:border-line-strong"
            >
              <span className="font-semibold text-ink">{leader.name}</span>
              <span className="font-mono text-xs text-ink-subtle">{leader.email}</span>
            </Link>
          ) : (
            <p className="text-sm text-ink-subtle">The leader account no longer exists.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Chat</h2>
          {/*
            Volume, never content.

            A squad's chat is a private group conversation. How much traffic it
            carries is a legitimate operational signal; reading it without a
            report or support ticket naming the thread is not, and the console
            offers no route to the messages themselves.
          */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <Field label="Messages" value={formatCount(chat.messageCount)} />
            <Field
              label="Last message"
              value={chat.lastMessageAt ? formatRelative(chat.lastMessageAt) : 'None'}
            />
            <Field
              label="Last activity"
              value={squad.lastActivityAt ? formatRelative(squad.lastActivityAt) : 'None'}
            />
            <Field label="Created" value={formatRelative(squad.createdAt)} />
          </dl>
          <p className="text-xs text-ink-subtle">
            Message content is not readable from the console.
          </p>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
          Members ({members.length})
        </h2>

        {members.length === 0 ? (
          <EmptyState title="No members" description="Nobody has joined this group ride." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-3 py-2"
              >
                {member.user ? (
                  <Link
                    href={`/users/${member.user.id}`}
                    className="flex min-w-0 flex-1 flex-col hover:text-brand"
                  >
                    <span className="truncate text-sm text-ink">{member.user.name}</span>
                    <span className="truncate font-mono text-xs text-ink-subtle">
                      {member.user.email}
                    </span>
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-ink-subtle">Deleted account</span>
                )}
                <Badge tone={member.role === 'leader' ? 'info' : 'neutral'}>{member.role}</Badge>
                <Badge tone={member.status === 'pending' ? 'warn' : 'neutral'}>
                  {member.status}
                </Badge>
                {member.arrivedAt ? (
                  <span
                    className="text-xs text-ink-subtle"
                    title={formatAbsolute(member.arrivedAt)}
                  >
                    arrived {formatRelative(member.arrivedAt)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
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

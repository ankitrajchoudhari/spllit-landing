'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { formatAbsolute, formatCount, formatRelative } from '@/lib/utils';
import { Badge, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface CommunityDetail {
  community: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    college: string | null;
    visibility: string;
    memberCount: number;
    createdAt: string;
  };
  owner: { id: string; name: string; email: string } | null;
  channels: {
    id: string;
    name: string;
    slug: string;
    isReadOnly: boolean;
    createdAt: string;
  }[];
  memberCount: number;
  staff: {
    id: string;
    role: string;
    joinedAt: string;
    user: { id: string; name: string; email: string } | null;
  }[];
}

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const detail = useQuery({
    queryKey: ['community', id],
    queryFn: () => api<CommunityDetail>(`/communities/${id}`),
  });

  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.isForbidden) {
      return <PermissionState permission="content.view" />;
    }
    return <ErrorState title="Could not load this community" description={detail.error.message} />;
  }

  if (detail.isLoading || !detail.data) return <SkeletonRows rows={6} />;

  const { community, owner, channels, memberCount, staff } = detail.data;

  return (
    <>
      <PageHeader
        title={community.name}
        description={community.description ?? `/${community.slug}`}
        actions={
          <Badge tone={community.visibility === 'public' ? 'good' : 'warn'}>
            {community.visibility}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Members" value={formatCount(memberCount)} />
        <Stat label="Channels" value={formatCount(channels.length)} />
        <Stat label="Staff" value={formatCount(staff.length)} />
        <Stat label="Created" value={formatRelative(community.createdAt)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Owner</h2>
          {owner ? (
            <Link
              href={`/users/${owner.id}`}
              className="flex flex-col rounded-md border border-line px-3 py-2 transition-colors duration-snap hover:border-line-strong"
            >
              <span className="font-semibold text-ink">{owner.name}</span>
              <span className="font-mono text-xs text-ink-subtle">{owner.email}</span>
            </Link>
          ) : (
            <p className="text-sm text-ink-subtle">The owner account no longer exists.</p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2">
            <Field label="Slug" value={`/${community.slug}`} />
            <Field label="College" value={community.college ?? '—'} />
            <Field label="Created" value={formatAbsolute(community.createdAt)} />
          </dl>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">Channels</h2>
          {channels.length === 0 ? (
            <p className="text-sm text-ink-subtle">This community has no channels.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center gap-2 rounded-md border border-line px-3 py-2"
                >
                  <span className="flex-1 text-sm text-ink">
                    <span className="text-ink-subtle">#</span>
                    {channel.slug}
                  </span>
                  {channel.isReadOnly ? <Badge tone="warn">Read only</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
          Owners &amp; moderators
        </h2>

        {/*
          Staff only. The full member list is deliberately not inlined here —
          a community with ten thousand members would render ten thousand rows
          into a detail page nobody asked to paginate.
        */}
        {staff.length === 0 ? (
          <EmptyState
            title="No moderators"
            description="Nobody besides the owner has an elevated role here."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {staff.map((member) => (
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
                <Badge tone="info">{member.role}</Badge>
                <span className="text-xs text-ink-subtle" title={formatAbsolute(member.joinedAt)}>
                  {formatRelative(member.joinedAt)}
                </span>
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

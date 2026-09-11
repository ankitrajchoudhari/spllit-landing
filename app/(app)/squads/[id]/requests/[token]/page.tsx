'use client';

import { use, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { api } from '@/lib/api/client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Answering a join request from the link in an email.
 *
 * The link identifies the request; this page is where a person decides. That
 * separation is deliberate and is the whole security design:
 *
 *   - **Nothing happens on arrival.** Opening the page is a read. Outlook Safe
 *     Links, Gmail's proxy and corporate scanners fetch URLs found in mail
 *     before a human sees them, so a page that accepted on load would be
 *     accepted by a scanner minutes after sending.
 *   - **A session is required.** This route is inside the (app) group, so
 *     RequireAuth has already run; the API checks again, because a client-side
 *     guard is a courtesy and not a boundary. A forwarded email therefore hands
 *     its recipient a pointer to a request they cannot act on.
 *
 * Every failure looks the same — expired, already answered, someone else's
 * squad — because distinguishing them would make this page an oracle for which
 * squads and requests exist.
 */
interface TokenView {
  squad: { id: string; name: string; destination?: { label?: string } | null };
  memberId: string;
  requester: {
    id: string;
    name: string;
    username?: string | null;
    profilePhoto?: string | null;
    college?: string | null;
  } | null;
}

/**
 * Which button the email sent this person here to press.
 *
 * Carried in the URL fragment, and a fragment specifically: it never appears in
 * the request line or in `Referer`, so the leader's intent leaks neither to the
 * server nor to anything this page loads — and a mail scanner that fetches the
 * link communicates no choice at all. It decides emphasis and nothing else;
 * nothing is submitted until a person presses a button.
 *
 * `useSyncExternalStore` rather than reading `window` in an effect: the server
 * snapshot is `null`, so the first client render matches the server's and there
 * is no hydration mismatch to paper over — and no state written during an
 * effect, which React 19 rightly rejects.
 */
function useEmailIntent(): 'approve' | 'reject' | null {
  const hash = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    },
    () => window.location.hash,
    () => '',
  );

  const value = hash.replace('#', '').toLowerCase();
  if (value === 'approve') return 'approve';
  if (value === 'decline' || value === 'reject') return 'reject';
  return null;
}

export default function JoinRequestDecisionPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>;
}) {
  const { id, token } = use(params);
  const router = useRouter();
  const [done, setDone] = useState<'approve' | 'reject' | null>(null);

  const intent = useEmailIntent();

  const request = useQuery({
    queryKey: ['join-request-token', token],
    queryFn: () => api.get<TokenView>(`/squads/join-requests/${token}`),
    retry: false,
    // The token is single-use and the answer cannot change under us; refetching
    // would only risk showing a stale request as still open.
    staleTime: Infinity,
  });

  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject') =>
      api.post<{ decision: string }>(`/squads/join-requests/${token}`, { decision }),
    onSuccess: (_data, decision) => setDone(decision),
  });

  if (request.isPending) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (request.isError || !request.data) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<X className="h-5 w-5" />}
          title="This request is no longer open"
          description="It may have been answered already, withdrawn, or the link may have expired. Open the squad to see who is in it."
          action={<Button onClick={() => router.replace(`/squads/${id}`)}>Open the squad</Button>}
        />
      </div>
    );
  }

  const { squad, requester } = request.data;

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<Check className="h-5 w-5" />}
          title={done === 'approve' ? 'Added to the squad' : 'Request declined'}
          description={
            done === 'approve'
              ? `${requester?.name ?? 'They'} can now see the meeting point and the squad chat.`
              : `${requester?.name ?? 'They'} have been told, and can ask again later.`
          }
          action={<Button onClick={() => router.replace(`/squads/${squad.id}`)}>Open the squad</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
          Join request
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          for <span className="text-ink">{squad.name}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
        <Avatar src={requester?.profilePhoto} name={requester?.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">
            {requester?.name ?? 'Someone'}
          </p>
          {requester?.username ? (
            <p className="truncate text-[13px] text-ink-subtle">@{requester.username}</p>
          ) : null}
          {requester?.college ? (
            <p className="mt-0.5 truncate text-[13px] text-ink-muted">{requester.college}</p>
          ) : null}
        </div>
      </div>

      {decide.isError ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          That did not go through. The request may have been answered elsewhere.
        </p>
      ) : null}

      {/* Declining is the one that cannot be undone from here, so when the
          email sent them to decline it becomes the primary button and adding
          steps back. Order never changes — only emphasis — because a button
          that moves between renders is how people press the wrong one. */}
      <div className="flex gap-3">
        <Button
          variant={intent === 'reject' ? 'secondary' : 'primary'}
          className="flex-1"
          loading={decide.isPending && decide.variables === 'approve'}
          disabled={decide.isPending}
          onClick={() => decide.mutate('approve')}
        >
          Add to squad
        </Button>
        <Button
          variant={intent === 'reject' ? 'primary' : 'secondary'}
          className="flex-1"
          loading={decide.isPending && decide.variables === 'reject'}
          disabled={decide.isPending}
          onClick={() => decide.mutate('reject')}
        >
          Decline
        </Button>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-subtle">
        {intent
          ? 'Nothing has happened yet — press a button above to confirm. '
          : null}
        You are signed in, so this decision is recorded as yours. Forwarding the
        email does not let anyone else answer for you.
      </p>
    </div>
  );
}

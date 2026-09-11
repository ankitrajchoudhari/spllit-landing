'use client';

import { use, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { ridesService } from '@/lib/services/rides';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Answering a request for a seat, from the link in an email.
 *
 * The squad equivalent at /squads/[id]/requests/[token] is the sibling of this
 * page and the security argument is identical, so only the difference is worth
 * writing down here: that one carries a hashed single-use token, this one
 * carries a plain match id.
 *
 * That is not a weaker check. The id authorises nothing — the API re-reads the
 * ride, requires the caller to be its host, and requires the request to still be
 * pending. Guessing an id earns a stranger the same 404 as a wrong one. The
 * session authorises; the id only identifies.
 *
 * What still holds, and matters most:
 *
 *   - **Nothing happens on arrival.** Opening the page is a read. Outlook Safe
 *     Links, Gmail's proxy and corporate scanners fetch URLs found in mail
 *     before a human sees them, so a page that accepted on load would be
 *     accepted by a scanner minutes after sending.
 *   - **Every failure looks the same.** Not your ride, already answered, ride
 *     deleted — one message, because distinguishing them would make this page a
 *     way to probe which rides and requests exist.
 */

/**
 * Which button the email sent this person here to press.
 *
 * A fragment, so it never reaches the server and never appears in `Referer`. It
 * decides emphasis and nothing else. `useSyncExternalStore` with an empty
 * server snapshot keeps the first client render matching the server's.
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

export default function RideRequestDecisionPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = use(params);
  const router = useRouter();
  const [done, setDone] = useState<'approve' | 'reject' | null>(null);

  const intent = useEmailIntent();

  const request = useQuery({
    queryKey: ['ride-request', id, matchId],
    queryFn: () => ridesService.request(id, matchId),
    retry: false,
    // The answer cannot change under us once given, and refetching would only
    // risk showing an answered request as still open.
    staleTime: Infinity,
  });

  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => ridesService.decide(id, matchId, decision),
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
          description="It may have been answered already, withdrawn, or the ride may have moved on. Open the ride to see who is coming."
          action={<Button onClick={() => router.replace(`/rides/${id}`)}>Open the ride</Button>}
        />
      </div>
    );
  }

  const { ride, requester, seatsLeft } = request.data;
  const full = seatsLeft <= 0;

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<Check className="h-5 w-5" />}
          title={done === 'approve' ? 'They have a seat' : 'Request declined'}
          description={
            done === 'approve'
              ? `${requester?.name ?? 'They'} can see the pickup point and message you now.`
              : `${requester?.name ?? 'They'} have been told, and can ask again later.`
          }
          action={<Button onClick={() => router.replace(`/rides/${ride.id}`)}>Open the ride</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
          Seat request
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          for <span className="text-ink">{ride.origin} to {ride.destination}</span>
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

      {/* Surfaced before they press, not after. The server refuses an approval
          that would oversubscribe the ride, and finding that out from an error
          banner reads as a bug rather than a full car. */}
      {full ? (
        <p className="rounded-lg bg-warning-muted px-3.5 py-3 text-[13px] text-ink">
          Every seat is taken. Declining is the only answer left unless somebody
          drops out.
        </p>
      ) : null}

      {decide.isError ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          That did not go through. The request may have been answered elsewhere.
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button
          variant={intent === 'reject' ? 'secondary' : 'primary'}
          className="flex-1"
          loading={decide.isPending && decide.variables === 'approve'}
          disabled={decide.isPending || full}
          onClick={() => decide.mutate('approve')}
        >
          Give them a seat
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
        {intent ? 'Nothing has happened yet — press a button above to confirm. ' : null}
        You are signed in, so this decision is recorded as yours. Forwarding the
        email does not let anyone else answer for you.
      </p>
    </div>
  );
}

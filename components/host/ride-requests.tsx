'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { ApiError } from '@/lib/api/client';
import { ridesService } from '@/lib/services/rides';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * People waiting on this host's answer.
 *
 * The in-app half of a decision that can also be taken from an email — the
 * email's buttons land on /rides/[id]/requests/[matchId], and both paths call
 * the same endpoint, which is what stops the two disagreeing about seats.
 *
 * Rendered only for the host, but that is presentation: the endpoint refuses
 * anyone else, because a client-side check is a courtesy and not a boundary.
 */
export function RideRequests({ rideId }: { rideId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** Which row is mid-flight, so only that row's buttons show a spinner. */
  const [pending, setPending] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['ride', rideId, 'requests'],
    queryFn: () => ridesService.requests(rideId),
  });

  const decide = useMutation({
    mutationFn: ({ matchId, decision }: { matchId: string; decision: 'approve' | 'reject' }) =>
      ridesService.decide(rideId, matchId, decision),
    onMutate: ({ matchId }) => {
      setPending(matchId);
      setError(null);
    },
    onSuccess: () => {
      // Both lists move: admitting somebody fills a seat, which the ride header
      // and the passenger row both read.
      void queryClient.invalidateQueries({ queryKey: ['ride', rideId, 'requests'] });
      void queryClient.invalidateQueries({ queryKey: ['ride', rideId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not record that decision.'),
    onSettled: () => setPending(null),
  });

  if (isPending) return <Skeleton className="h-20 w-full rounded-lg" />;

  if (isError) {
    return (
      <p className="text-[13px] text-ink-muted">
        Could not load who has asked. Reopen the ride to try again.
      </p>
    );
  }

  if (data.requests.length === 0) {
    return (
      <EmptyState
        title="Nobody waiting"
        description="When somebody asks for a seat, they appear here and we email you."
      />
    );
  }

  const full = data.seatsLeft <= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Said once, above the list, rather than as an error after a press. The
          server refuses an approval that would oversubscribe the ride. */}
      {full ? (
        <p className="rounded-lg bg-warning-muted px-3.5 py-2.5 text-[13px] text-ink">
          Every seat is taken. You can still decline, or wait for somebody to drop out.
        </p>
      ) : (
        <p className="text-[12px] text-ink-subtle">
          {data.seatsLeft} seat{data.seatsLeft === 1 ? '' : 's'} left.
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {data.requests.map((request) => {
          const busy = pending === request.id && decide.isPending;
          return (
            <li
              key={request.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface-sunken p-3"
            >
              <Avatar
                src={request.requester?.profilePhoto}
                name={request.requester?.name}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">
                  {request.requester?.name ?? 'Someone'}
                </p>
                {request.requester?.college ? (
                  <p className="truncate text-[12px] text-ink-muted">{request.requester.college}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="icon"
                  aria-label={`Give ${request.requester?.name ?? 'them'} a seat`}
                  loading={busy && decide.variables?.decision === 'approve'}
                  disabled={busy || full}
                  onClick={() => decide.mutate({ matchId: request.id, decision: 'approve' })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label={`Decline ${request.requester?.name ?? 'them'}`}
                  loading={busy && decide.variables?.decision === 'reject'}
                  disabled={busy}
                  onClick={() => decide.mutate({ matchId: request.id, decision: 'reject' })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

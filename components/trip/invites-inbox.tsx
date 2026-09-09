'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { tripsService } from '@/lib/services/trips';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { HostDossierCard } from '@/components/trip/host-dossier-card';
import type { RideInvite } from '@/types';

/**
 * Invitations from hosts, and the trips already accepted.
 *
 * A pending invite shows the host's public summary only; the vehicle, the
 * registration and the phone number appear after acceptance, because that is
 * when the server starts sending them.
 */
export function InvitesInbox() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['trips', 'invites'],
    queryFn: () => tripsService.invites(),
  });

  const respond = useMutation({
    // Both branches are awaited and the result discarded — the refetch below
    // is what updates the screen, so the two differing return types do not
    // need to be reconciled into one.
    mutationFn: async ({ id, action }: { id: string; action: 'accept' | 'decline' }) => {
      if (action === 'accept') await tripsService.accept(id);
      else await tripsService.decline(id);
    },
    onSuccess: () => {
      setError(null);
      // Accepting takes a seat and opens a chat thread, so the ride lists and
      // the thread list are both stale, not just this one.
      void queryClient.invalidateQueries({ queryKey: ['trips', 'invites'] });
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      void queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not answer the invite.'),
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
      </div>
    );
  }

  const invites = data ?? [];
  const pending = invites.filter((invite) => invite.status === 'pending');
  const accepted = invites.filter((invite) => invite.status === 'accepted');

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-[14px] font-semibold text-ink">
          Invites{pending.length > 0 ? ` (${pending.length})` : ''}
        </h2>

        {pending.length === 0 ? (
          <EmptyState
            title="No invites yet"
            description="Publish where you're going and hosts driving that way can offer you a seat."
          />
        ) : (
          <ul className="space-y-2">
            {pending.map((invite) => (
              <PendingInvite
                key={invite.id}
                invite={invite}
                busy={respond.isPending && respond.variables?.id === invite.id}
                onRespond={(action) => respond.mutate({ id: invite.id, action })}
              />
            ))}
          </ul>
        )}
      </section>

      {accepted.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-ink">Your trips</h2>
          <ul className="space-y-3">
            {accepted.map((invite) => (
              <li key={invite.id}>
                <p className="mb-2 text-[13px] text-ink-muted">
                  {invite.ride.origin} → {invite.ride.destination} ·{' '}
                  {new Date(invite.ride.departureTime).toLocaleString(undefined, {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                {invite.dossier ? (
                  <HostDossierCard dossier={invite.dossier} threadId={invite.threadId} />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PendingInvite({
  invite,
  busy,
  onRespond,
}: {
  invite: RideInvite;
  busy: boolean;
  onRespond: (action: 'accept' | 'decline') => void;
}) {
  const departs = new Date(invite.ride.departureTime);

  return (
    <li
      className={cn(
        'rounded-2xl border border-line bg-surface p-4',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={invite.host?.profilePhoto} name={invite.host?.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">
            {invite.host?.name ?? 'A host'} invited you
          </p>
          <p className="truncate text-[13px] text-ink-muted">
            {invite.ride.origin} → {invite.ride.destination}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-subtle">
            <Clock className="h-3 w-3" />
            {departs.toLocaleString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' · '}
            {Math.max(invite.ride.seats - invite.ride.seatsTaken, 0)} seats left
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onRespond('decline')}>
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
        <Button size="sm" className="flex-1" onClick={() => onRespond('accept')}>
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
      </div>

      <p className="mt-2 text-center text-[11.5px] text-ink-subtle">
        You&apos;ll see their vehicle and number once you accept.
      </p>
    </li>
  );
}

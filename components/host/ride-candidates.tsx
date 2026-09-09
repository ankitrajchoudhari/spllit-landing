'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Send } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { tripsService } from '@/lib/services/trips';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Riders whose published trip fits this ride, with an invite button.
 *
 * Runs the same corridor rule as the rider-side search — one
 * `fitToCorridor` in the backend, called from both directions — so a rider who
 * sees this host in their results is a rider this host sees here.
 */

function walk(metres: number): string {
  return metres < 950 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}

export function RideCandidates({ rideId }: { rideId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['ride', rideId, 'candidates'],
    queryFn: () => tripsService.candidates(rideId),
  });

  const invite = useMutation({
    mutationFn: (requestId: string) => tripsService.invite(rideId, requestId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['ride', rideId, 'candidates'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not send the invite.'),
  });

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[84px] w-full rounded-2xl" />
        <Skeleton className="h-[84px] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        tone="error"
        title="Could not load riders"
        description="Only the host of this trip can see who fits it."
      />
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Nobody on your route yet"
          description={`No rider has published a trip that fits within ${walk(
            data?.corridorMetres ?? 1500,
          )} of your route in this window.`}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((candidate) => {
            const invited = candidate.inviteStatus !== null;
            const busy = invite.isPending && invite.variables === candidate.request.id;

            return (
              <li
                key={candidate.request.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5',
                  busy && 'pointer-events-none opacity-60',
                )}
              >
                <Avatar
                  src={candidate.user.profilePhoto}
                  name={candidate.user.name}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">
                    {candidate.user.name}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    {candidate.request.originLabel} → {candidate.request.destLabel}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-subtle">
                    <Clock className="h-3 w-3" />
                    {new Date(candidate.request.departAt).toLocaleString(undefined, {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {/* The detour is the host's real cost of picking them up,
                        so it leads rather than hiding behind the name. */}
                    {walk(candidate.detourMetres)} off your route
                    {candidate.request.seats > 1 ? ` · ${candidate.request.seats} seats` : ''}
                  </p>
                </div>

                {candidate.inviteStatus === 'accepted' ? (
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-brand">
                    <Check className="h-3.5 w-3.5" />
                    Aboard
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={invited ? 'outline' : 'primary'}
                    disabled={invited}
                    onClick={() => invite.mutate(candidate.request.id)}
                  >
                    {invited ? (
                      'Invited'
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Invite
                      </>
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Says so when the corridor came from a chord rather than real roads —
          the detour figures are optimistic in that case. */}
      {items.length > 0 && data && !data.routed ? (
        <p className="text-[12px] text-ink-subtle">
          Distances are approximate — road routing was unavailable.
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BatteryLow,
  Check,
  Crown,
  MoreHorizontal,
  Shield,
  UserMinus,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { useClickOutside } from '@/lib/hooks/use-click-outside';
import { squadMembersService } from '@/lib/services/squads';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type {
  SquadCapabilities,
  SquadProgressEntry,
  SquadRole,
  UserSummary,
} from '@/types';

/**
 * Who is where, and how long until they arrive.
 *
 * This is the leader's answer to "do we wait or do we go", so the ETA and the
 * arrival state lead. Everything else — battery, role, controls — is secondary
 * and sits behind it.
 */

function formatEta(entry: SquadProgressEntry): string {
  if (entry.status === 'arrived') return 'Arrived';
  if (entry.etaSeconds === null) {
    return entry.distanceMetres === null ? 'Not sharing' : formatDistance(entry.distanceMetres);
  }
  const minutes = Math.round(entry.etaSeconds / 60);
  return minutes < 1 ? 'Under a minute' : `${minutes} min`;
}

function formatDistance(metres: number): string {
  return metres < 950 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}

const ROLE_BADGE: Partial<Record<SquadRole, { label: string; Icon: typeof Crown }>> = {
  leader: { label: 'Leader', Icon: Crown },
  'co-leader': { label: 'Co-leader', Icon: Shield },
};

export function SquadMembersBoard({
  squadId,
  can,
  viewerId,
}: {
  squadId: string;
  can: SquadCapabilities;
  viewerId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  /**
   * The menu had exactly one way to close: a mutation succeeding. So a failed
   * action left it open on top of its own error, and tapping anywhere else —
   * the obvious way to dismiss a popover — did nothing at all.
   *
   * Outside-click and Escape are added here rather than by adopting a popover
   * library: the existing hook already does the first, and the second is three
   * lines. Closing on success stays; closing on *failure* is handled by moving
   * the reset to onSettled.
   *
   * The ref spans the trigger *and* the menu, matching AccountMenu. Covering
   * only the menu makes the trigger "outside" it, so pressing it to close ran
   * both handlers in turn: mousedown closed the menu, React flushed that before
   * the browser dispatched click, and click — now reading `menuOpen` as false —
   * opened it straight back up. The button could open the menu but never close
   * it. Attached only to the open row: one ref shared by every row in the map
   * would otherwise end up pointing at whichever rendered last.
   */
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setOpenMenu(null));

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu]);
  /** Held as the whole user so the dialog can name them, not just an id. */
  const [pendingRemoval, setPendingRemoval] = useState<UserSummary | null>(null);

  const progress = useQuery({
    queryKey: ['squad', squadId, 'progress'],
    queryFn: () => squadMembersService.progress(squadId),
    /**
     * Each poll costs one walking-Directions call per member who is moving, so
     * this is deliberately slower than the map's own position stream — and it
     * stops entirely once the server has refused.
     *
     * A fixed interval kept re-asking every 20s after the squad was cancelled,
     * because cancelling makes every member `left` and the endpoint then
     * answers 403 "You are not in this squad". That is the correct answer; the
     * bug was continuing to ask, which filled the console with the same
     * forbidden request forever. Polling is not how you discover you have been
     * removed from something.
     */
    refetchInterval: (query) => (query.state.error ? false : 20_000),
  });

  const requests = useQuery({
    queryKey: ['squad', squadId, 'requests'],
    queryFn: () => squadMembersService.requests(squadId),
    enabled: can.admitMembers,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['squad', squadId] });
  };

  const decide = useMutation({
    mutationFn: ({ memberId, decision }: { memberId: string; decision: 'approve' | 'reject' }) =>
      squadMembersService.decide(squadId, memberId, decision),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not answer the request.'),
  });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: SquadRole }) =>
      squadMembersService.setRole(squadId, userId, role),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not change the role.'),
    // Closed either way — a failed action must not leave the menu
    // hanging over the error it just produced.
    onSettled: () => setOpenMenu(null),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => squadMembersService.remove(squadId, userId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not remove them.'),
    // Closed either way — a failed action must not leave the menu
    // hanging over the error it just produced.
    onSettled: () => setOpenMenu(null),
  });

  if (progress.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  const items = progress.data?.items ?? [];
  const pending = requests.data ?? [];

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {can.admitMembers && pending.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">
            Requests to join ({pending.length})
          </h3>
          <ul className="space-y-2">
            {pending.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
              >
                <Avatar src={request.user.profilePhoto} name={request.user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">
                    {request.user.name}
                  </span>
                  {request.user.college ? (
                    <span className="block truncate text-[12px] text-ink-muted">
                      {request.user.college}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide.mutate({ memberId: request.id, decision: 'reject' })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => decide.mutate({ memberId: request.id, decision: 'approve' })}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-ink">
          Members ({items.length})
        </h3>

        {items.length === 0 ? (
          <EmptyState title="Nobody here yet" description="Share the join code to add people." />
        ) : (
          <ul className="space-y-2">
            {items.map((entry) => {
              const badge = ROLE_BADGE[entry.role];
              const isSelf = entry.user.id === viewerId;
              const menuOpen = openMenu === entry.user.id;

              return (
                <li
                  key={entry.user.id}
                  className={cn(
                    'relative flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3',
                    entry.status === 'arrived' ? 'border-brand/40' : 'border-line',
                  )}
                >
                  <Avatar
                    src={entry.user.profilePhoto}
                    name={entry.user.name}
                    size="sm"
                    online={entry.status === 'travelling'}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-medium text-ink">
                        {entry.user.name}
                        {isSelf ? ' (you)' : ''}
                      </span>
                      {badge ? (
                        <badge.Icon className="h-3.5 w-3.5 shrink-0 text-warning" />
                      ) : null}
                      {entry.role === 'guest' ? <Badge>Guest</Badge> : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                      {entry.distanceMetres !== null && entry.status !== 'arrived' ? (
                        <>{formatDistance(entry.distanceMetres)} away</>
                      ) : entry.status === 'arrived' ? (
                        <>At the meeting point</>
                      ) : (
                        <>Location not shared</>
                      )}
                      {/* Battery only when it is low enough to explain a member
                          who has stopped updating. */}
                      {entry.battery !== null && entry.battery <= 20 ? (
                        <span className="inline-flex items-center gap-0.5 text-danger">
                          <BatteryLow className="h-3 w-3" />
                          {entry.battery}%
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span
                    className={cn(
                      'shrink-0 text-[12.5px] font-medium tabular-nums',
                      entry.status === 'arrived' ? 'text-brand' : 'text-ink',
                    )}
                  >
                    {formatEta(entry)}
                  </span>

                  {/*
                    `contents` generates no box, so the button stays a flex item
                    of the row and the menu still resolves its `absolute` against
                    the row — the grouping is for the outside-click check only
                    and changes nothing about the layout.
                  */}
                  <div ref={menuOpen ? menuRef : null} className="contents">
                    {can.manageMembers && !isSelf && entry.role !== 'leader' ? (
                      <button
                        type="button"
                        aria-label={`Manage ${entry.user.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setOpenMenu(menuOpen ? null : entry.user.id)}
                        className="shrink-0 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    ) : null}

                    {menuOpen ? (
                      <div
                        role="menu"
                        className="absolute right-2 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface shadow-float"
                      >
                        {can.assignRoles ? (
                          <>
                            <MenuItem
                              label={
                                entry.role === 'co-leader' ? 'Make member' : 'Make co-leader'
                              }
                              onClick={() =>
                                setRole.mutate({
                                  userId: entry.user.id,
                                  role: entry.role === 'co-leader' ? 'member' : 'co-leader',
                                })
                              }
                            />
                            <MenuItem
                              label="Hand over leadership"
                              onClick={() =>
                                setRole.mutate({ userId: entry.user.id, role: 'leader' })
                              }
                            />
                          </>
                        ) : null}
                        <MenuItem
                          label="Remove from squad"
                          tone="danger"
                          Icon={UserMinus}
                          onClick={() => setPendingRemoval(entry.user)}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Removal ejects someone who may already be walking to the meeting
          point, so it is named and confirmed rather than fired from a menu. */}
      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          remove.mutate(pendingRemoval.id, { onSuccess: () => setPendingRemoval(null) });
        }}
        eyebrow="Remove member"
        title={pendingRemoval?.name ?? ''}
        description="They lose the squad chat, the meeting point and everyone's live location. They can ask to join again."
        confirmLabel="Remove"
        confirmTone="danger"
        cancelLabel="Keep them"
        loading={remove.isPending}
        error={
          remove.isError
            ? remove.error instanceof Error
              ? remove.error.message
              : "Couldn't remove them."
            : null
        }
      />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone,
  Icon,
}: {
  label: string;
  onClick: () => void;
  tone?: 'danger';
  Icon?: typeof UserMinus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] transition-colors',
        tone === 'danger'
          ? 'text-danger hover:bg-danger-muted'
          : 'text-ink hover:bg-surface-sunken',
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

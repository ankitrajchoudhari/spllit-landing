'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldOff, ShieldCheck } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import type { AdminRole, Permission } from '@/lib/permissions';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

/**
 * Tuning one admin: what they may do, and whether they are signed in.
 *
 * ## The toggle is "may they", not "is it granted"
 *
 * Each switch shows the *effective* answer, and the override needed to reach it
 * is derived on change against the role's own list. Turning off something the
 * role gives writes a revoke; turning on something it does not gives a grant;
 * turning either back writes nothing at all rather than an override that says
 * "same as the role, but explicitly".
 *
 * The alternative — exposing two lists for the operator to keep consistent — is
 * asking somebody to hold the resolution rule in their head while making a
 * security decision. The rule is `effectivePermissions` in the backend and it
 * is not obvious enough for that.
 *
 * ## Nothing here is the boundary
 *
 * Every switch is a request the server re-checks: the rank ladder, the refusal
 * to edit yourself, and the rule that you cannot grant what you do not hold.
 * Disabled controls are an explanation, not a gate.
 */

interface AdminRow {
  id: string;
  name: string;
  email: string;
  consoleRole: AdminRole;
  effective: Permission[];
  adminGrants: Permission[];
  adminRevokes: Permission[];
  sessionsRevokedAt: string | null;
}

export function AdminControls({
  admin,
  rolePermissions,
  allPermissions,
  actorPermissions,
  isSelf,
  onDone,
}: {
  admin: AdminRow;
  /** What this admin's role gives, before overrides. */
  rolePermissions: Permission[];
  allPermissions: Permission[];
  /** What the signed-in operator holds — they cannot grant beyond it. */
  actorPermissions: Permission[];
  isSelf: boolean;
  onDone: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [effective, setEffective] = useState<Set<Permission>>(
    () => new Set(admin.effective),
  );
  const [reason, setReason] = useState('');

  const roleSet = useMemo(() => new Set(rolePermissions), [rolePermissions]);
  const actorSet = useMemo(() => new Set(actorPermissions), [actorPermissions]);

  /** Overrides derived from the switches, exactly as the server will store them. */
  const { grants, revokes } = useMemo(() => {
    const grants: Permission[] = [];
    const revokes: Permission[] = [];
    for (const permission of allPermissions) {
      const on = effective.has(permission);
      const fromRole = roleSet.has(permission);
      if (on && !fromRole) grants.push(permission);
      if (!on && fromRole) revokes.push(permission);
    }
    return { grants, revokes };
  }, [effective, allPermissions, roleSet]);

  const dirty =
    grants.join(',') !== [...admin.adminGrants].sort().join(',') ||
    revokes.join(',') !== [...admin.adminRevokes].sort().join(',');

  const save = useMutation({
    mutationFn: () =>
      api(`/users/${admin.id}/permissions`, {
        method: 'PATCH',
        body: { grants, revokes, reason },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(`Updated what ${admin.name} may do.`);
      setReason('');
      onDone();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not save that.'),
  });

  const sessions = useMutation({
    mutationFn: (next: 'revoke' | 'restore') =>
      api(`/users/${admin.id}/sessions/revoke`, {
        method: next === 'revoke' ? 'POST' : 'DELETE',
        body: { reason },
      }),
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(
        next === 'revoke'
          ? `${admin.name} has been signed out everywhere.`
          : `${admin.name} can sign in again.`,
      );
      setReason('');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not change that.'),
  });

  const revoked = Boolean(admin.sessionsRevokedAt);
  const reasonReady = reason.trim().length >= 4;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">{admin.name}</h3>
          <p className="text-xs text-ink-muted">{admin.email}</p>
        </div>
        <Badge tone={revoked ? 'bad' : 'good'}>
          {revoked ? 'Signed out' : 'Active'}
        </Badge>
      </div>

      {isSelf ? (
        /**
         * Said once, at the top, rather than as an error after they try. An
         * admin who can widen their own permissions is an admin with every
         * permission one request later, so the server refuses this outright —
         * it is not a rank check that a super admin passes.
         */
        <p className="rounded-lg bg-warning-muted px-3.5 py-2.5 text-xs text-ink">
          You cannot change your own permissions or end your own session. Ask another
          super admin.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-muted">
          What they may do · {admin.consoleRole.replace('_', ' ')}
        </span>

        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {allPermissions.map((permission) => {
            const on = effective.has(permission);
            const fromRole = roleSet.has(permission);
            // You cannot hand out what you do not hold — the server refuses it,
            // so the switch says so instead of failing on save.
            const beyondActor = !actorSet.has(permission);
            const locked = isSelf || (beyondActor && !on);

            return (
              <li key={permission} className="flex items-center gap-3 px-3 py-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={(event) => {
                      const next = new Set(effective);
                      if (event.target.checked) next.add(permission);
                      else next.delete(permission);
                      setEffective(next);
                    }}
                    className="h-4 w-4 shrink-0 accent-brand disabled:opacity-40"
                  />
                  <span className="truncate font-mono text-xs text-ink">{permission}</span>
                </label>

                {/* Where the current answer comes from. Without this, an
                    operator cannot tell a deliberate exception from the role
                    simply being what it is — which is the difference between
                    "leave it alone" and "somebody decided this". */}
                {on && !fromRole ? <Badge tone="info">added</Badge> : null}
                {!on && fromRole ? <Badge tone="warn">removed</Badge> : null}
                {beyondActor && !on ? (
                  <span className="text-[10px] text-ink-subtle">beyond you</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-muted">
          Reason <span className="text-ink-subtle">(recorded in the audit log)</span>
        </span>
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this changing?"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={!dirty || !reasonReady || isSelf || save.isPending}
          onClick={() => save.mutate()}
          title={
            !dirty
              ? 'Nothing has changed'
              : !reasonReady
                ? 'A reason is required'
                : undefined
          }
        >
          {save.isPending ? 'Saving…' : 'Save permissions'}
        </Button>

        {revoked ? (
          <Button
            variant="secondary"
            disabled={!reasonReady || sessions.isPending}
            onClick={() => sessions.mutate('restore')}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {sessions.isPending ? 'Restoring…' : 'Let them sign in again'}
          </Button>
        ) : (
          <Button
            variant="danger"
            disabled={!reasonReady || isSelf || sessions.isPending}
            onClick={() => sessions.mutate('revoke')}
          >
            <ShieldOff className="h-4 w-4" aria-hidden />
            {sessions.isPending ? 'Ending…' : 'End all their sessions'}
          </Button>
        )}

        <Button variant="ghost" className="ml-auto" onClick={onDone}>
          Close
        </Button>
      </div>

      {/* Precise on purpose. An operator expecting the person's open tab to
          spring back to life would otherwise report "restore" as broken. */}
      <p className="text-[11px] leading-relaxed text-ink-subtle">
        Ending sessions signs them out of every device immediately. Restoring does not
        bring the old session back — nothing can — it lets them sign in again.
      </p>
    </Card>
  );
}

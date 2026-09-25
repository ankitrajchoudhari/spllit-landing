'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, UserPlus } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { ADMIN_ROLES, ROLE_LABELS, type AdminRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Button, Card, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

interface Created {
  admin: { id: string; name: string; email: string };
  password: string;
}

/**
 * Creates a console admin with a generated password.
 *
 * The password is shown once, here, and nowhere else — the server does not keep
 * it and the audit log never records it. Closing the card without copying it
 * means creating the admin again, so the card stays until it is dismissed.
 */
export function AddAdmin({ actorRole, onClose }: { actorRole: AdminRole; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ADMIN_ROLES runs highest first; only roles strictly below the actor can be
  // granted, and the server enforces the same rule.
  const grantable = ADMIN_ROLES.slice(ADMIN_ROLES.indexOf(actorRole) + 1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole | ''>(grantable.includes('moderator') ? 'moderator' : grantable[0] ?? '');
  const [reason, setReason] = useState('');
  const [created, setCreated] = useState<Created | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<Created>('/admins', {
        method: 'POST',
        body: { name, email, adminRole: role, reason },
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
      setCreated(data);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not create that admin.'),
  });

  if (grantable.length === 0) return null;

  if (created) {
    return (
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-ink">{created.admin.name} can now sign in</span>
          <span className="text-sm text-ink-muted">
            Send them these details privately. The password is shown only this once.
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-subtle">Sign in at</dt>
          <dd className="font-mono text-ink">admin.spllit.app</dd>
          <dt className="text-ink-subtle">Email</dt>
          <dd className="font-mono text-ink">{created.admin.email}</dd>
          <dt className="text-ink-subtle">Password</dt>
          <dd className="font-mono text-ink">{created.password}</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  `Spllit admin console: https://admin.spllit.app\nEmail: ${created.admin.email}\nPassword: ${created.password}`,
                )
                .then(
                  () => toast.success('Copied.'),
                  () => toast.error('Could not copy. Select the text instead.'),
                );
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy details
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  const ready =
    name.trim().length >= 2 && email.includes('@') && role !== '' && reason.trim().length >= 4;

  return (
    <Card className="flex flex-col gap-4">
      <span className="font-semibold text-ink">Add an admin</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Email (used to sign in)</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@spllit.app"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className={cn(
              'h-9 w-full rounded-md border border-line bg-surface-sunken px-3 text-sm text-ink',
              'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
            )}
          >
            {grantable.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">
            Reason <span className="text-ink-subtle">(recorded in the audit log)</span>
          </span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do they need access?"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate()}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          {create.isPending ? 'Creating…' : 'Create admin'}
        </Button>
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-subtle">
        A password is generated for them. The email must not already have a Spllit account.
      </p>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatRelative } from '@/lib/utils';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui/primitives';
import { EmptyState, ErrorState, PermissionState, SkeletonRows } from '@/components/ui/states';

interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  updatedAt: string;
}

export default function FlagsPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const editable = can('flags.edit');

  const [pending, setPending] = useState<FeatureFlag | null>(null);
  const [reason, setReason] = useState('');

  const flags = useQuery({
    queryKey: ['flags'],
    queryFn: () => api<{ rows: FeatureFlag[] }>('/flags'),
  });

  const toggle = useMutation({
    mutationFn: (input: { key: string; enabled: boolean; reason: string }) =>
      api<FeatureFlag>(`/flags/${input.key}`, {
        method: 'PATCH',
        body: { enabled: input.enabled, reason: input.reason },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flags'] });
      setPending(null);
      setReason('');
    },
  });

  if (flags.isError) {
    const error = flags.error;
    if (error instanceof ApiError && error.isForbidden) {
      return <PermissionState permission="settings.view" />;
    }
    return <ErrorState title="Could not load feature flags" description={error.message} />;
  }

  const rows = flags.data?.rows ?? [];

  return (
    <>
      <PageHeader
        title="Feature flags"
        description="Turn features on and off without a deploy. Every change is recorded in the audit log."
      />

      {flags.isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No feature flags defined"
          description="Flags are created in the database. None exist yet, so nothing is being gated at runtime."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((flag) => (
            <Card key={flag.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{flag.label}</span>
                  <Badge tone={flag.enabled ? 'good' : 'neutral'}>
                    {flag.enabled ? 'On' : 'Off'}
                  </Badge>
                  {flag.enabled && flag.rolloutPercentage < 100 ? (
                    <Badge tone="warn">{flag.rolloutPercentage}% rollout</Badge>
                  ) : null}
                </div>
                <code className="font-mono text-xs text-ink-subtle">{flag.key}</code>
                {flag.description ? (
                  <p className="text-sm text-ink-muted">{flag.description}</p>
                ) : null}
                <span className="text-xs text-ink-subtle">
                  Updated {formatRelative(flag.updatedAt)}
                </span>
              </div>

              <Button
                variant={flag.enabled ? 'danger' : 'primary'}
                disabled={!editable}
                title={editable ? undefined : 'Your role cannot change feature flags.'}
                onClick={() => {
                  setPending(flag);
                  setReason('');
                }}
              >
                Turn {flag.enabled ? 'off' : 'on'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/**
       * Confirmation is required, not offered.
       *
       * A flag toggle changes what every user of Spllit sees, immediately and
       * without a deploy to review. That is precisely the kind of action that
       * should cost one more deliberate step than a click.
       */}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <Card className="flex w-full max-w-md flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-ink">
                Turn {pending.enabled ? 'off' : 'on'} “{pending.label}”?
              </h2>
              <p className="text-sm text-ink-muted">
                This takes effect for users immediately. It will be recorded against your account.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-muted">Reason (optional)</span>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this changing?"
              />
            </label>

            {toggle.isError ? (
              <p className="text-sm text-danger" role="alert">
                {toggle.error instanceof ApiError ? toggle.error.message : 'Could not save.'}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPending(null);
                  toggle.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={toggle.isPending}
                onClick={() =>
                  toggle.mutate({ key: pending.key, enabled: !pending.enabled, reason })
                }
              >
                {toggle.isPending ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

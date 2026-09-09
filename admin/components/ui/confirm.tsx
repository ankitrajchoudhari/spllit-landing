'use client';

import { useState, type ReactNode } from 'react';

import { Button, Card, Input } from '@/components/ui/primitives';

/**
 * Confirmation for anything that changes production data.
 *
 * The reason field is required by default rather than optional, because it is
 * what the audit log stores — and a log full of "suspended, no reason given"
 * answers none of the questions it exists to answer. The backend enforces the
 * same minimum, so removing this dialog does not remove the requirement.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  requireReason = true,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const tooShort = requireReason && reason.trim().length < 4;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <Card
        className="flex w-full max-w-md flex-col gap-4"
        // Without this, clicking inside the dialog bubbles to the backdrop and
        // closes it — losing whatever reason had been typed.
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <div className="text-sm text-ink-muted">{description}</div>
        </div>

        {requireReason ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">
              Reason <span className="text-ink-subtle">(recorded in the audit log)</span>
            </span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this happening?"
              autoFocus
            />
          </label>
        ) : null}

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={pending || tooShort}
            title={tooShort ? 'Enter a reason first.' : undefined}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

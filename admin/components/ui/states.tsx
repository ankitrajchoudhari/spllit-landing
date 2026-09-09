'use client';

import { AlertTriangle, Inbox, Loader2, Lock, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The states every console page has to handle.
 *
 * Collected in one file because the brief's rule — no page silently fails —
 * only holds if the states are as easy to reach for as the happy path. A
 * loading skeleton that has to be hand-written per page gets skipped.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative overflow-hidden rounded bg-surface-sunken', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-14 text-center">
      <Inbox className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-muted px-6 py-12 text-center"
      role="alert"
    >
      <AlertTriangle className="h-7 w-7 text-danger" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="max-w-md text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function OfflineState({ action }: { action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-12 text-center">
      <WifiOff className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Could not reach the Spllit API</p>
        <p className="max-w-md text-sm text-ink-muted">
          The console is running but the backend did not answer. Nothing has been changed.
        </p>
      </div>
      {action}
    </div>
  );
}

/**
 * Shown where a surface exists but this role may not use it.
 *
 * Names the permission rather than saying "access denied". An admin who knows
 * they are missing `moderation.act` can ask for exactly that; one told only
 * that they are not allowed has to guess.
 */
export function PermissionState({ permission }: { permission?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-12 text-center">
      <Lock className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Your role cannot open this</p>
        <p className="max-w-md text-sm text-ink-muted">
          {permission ? (
            <>
              It needs the <code className="font-mono text-xs text-ink">{permission}</code>{' '}
              permission. Ask a Super Admin to grant it.
            </>
          ) : (
            'Ask a Super Admin if you need access.'
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * A feature the brief asks for that Spllit has no data behind.
 *
 * The point of rendering this instead of a zero: a zero is a measurement, and
 * showing "0 reports" when no reporting feature exists is a false one. This
 * says which thing is missing and why.
 */
export function NotImplementedState({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line-strong bg-surface-sunken px-5 py-6">
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-warning-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning">
          Not available
        </span>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <p className="text-sm text-ink-muted">{reason}</p>
    </div>
  );
}

'use client';

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover',
  secondary: 'bg-surface-raised text-ink border border-line hover:border-line-strong',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink',
  danger: 'bg-danger-muted text-danger border border-danger/30 hover:border-danger/60',
};

export function Button({ variant = 'secondary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-snap',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-subtle focus:border-brand focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

type BadgeTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  good: 'bg-brand-muted text-brand border-brand/30',
  warn: 'bg-warning-muted text-warning border-warning/30',
  bad: 'bg-danger-muted text-danger border-danger/30',
  info: 'bg-accent-muted text-accent border-accent/30',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-5', className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * A single dashboard number.
 *
 * The label sits above the value rather than below it. A column of these is
 * scanned for the one thing the reader is looking for, and that scan runs on
 * the labels — putting the value first makes them read every number to find
 * the right row.
 */
export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const accent =
    tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-ink';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </span>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <span className={cn('tabular text-2xl font-bold tracking-tight', accent)}>{value}</span>
      {sub ? <span className="text-xs text-ink-muted">{sub}</span> : null}
    </div>
  );
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'accent' | 'warning' | 'danger' | 'live';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  brand: 'bg-brand-muted text-brand border-transparent',
  accent: 'bg-accent-muted text-accent border-transparent',
  warning: 'bg-warning-muted text-warning border-transparent',
  danger: 'bg-danger-muted text-danger border-transparent',
  live: 'bg-brand-muted text-brand border-transparent',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] font-medium uppercase tracking-[0.04em]',
        TONES[tone],
        className,
      )}
    >
      {tone === 'live' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand opacity-75 animate-pulse-ring" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

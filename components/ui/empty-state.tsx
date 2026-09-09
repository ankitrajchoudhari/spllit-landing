import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The single empty/error state in the app. Every list uses it so a sparse
 * dev database still renders something considered rather than a blank div.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'empty',
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'empty' | 'error';
  className?: string;
}) {
  return (
    // Deliberately restrained: an empty feed shows several of these at once,
    // and full-height dashed boxes made a new account look broken rather than
    // new. Compact rows read as "nothing here yet", not as errors.
    <div
      className={cn(
        'flex items-center gap-3.5 rounded-lg border border-dashed border-line px-4 py-4',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            tone === 'error' ? 'bg-danger-muted text-danger' : 'bg-surface-sunken text-ink-subtle',
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

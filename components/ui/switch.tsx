'use client';

import { cn } from '@/lib/utils';

/**
 * A labelled on/off control.
 *
 * A real `<button role="switch">` rather than a styled checkbox: the state is
 * applied immediately, there is no form to submit, and `aria-checked` is what
 * a screen reader announces as "on"/"off" rather than "checked".
 *
 * The whole row is the control. A 44px-wide track next to a two-line label is a
 * small target for a thumb, and the label is the part people aim at anyway.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-4 rounded-lg px-1 py-3 text-left transition-colors duration-snap',
        'hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>

      {/* aria-hidden: the button above already carries the state, and a nested
          element announcing it again reads as two controls. */}
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-[26px] w-[46px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-snap',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'block h-5 w-5 rounded-full bg-surface shadow-soft transition-transform duration-snap',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}

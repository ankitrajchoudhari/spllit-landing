'use client';

import { Input } from '@/components/ui/primitives';
import { RecipientPicker, type Recipient } from '@/components/recipient-picker';

/**
 * Choosing who a send is aimed at.
 *
 * Shared by the in-app broadcast composer and the email campaign composer,
 * because the two used to define their own audiences and drifted: the broadcast
 * list was corrected and the campaign one was not, so "everyone" meant two
 * different populations depending on which screen you were on. The backend
 * mirror of this lives in `services/audience.ts` and is now equally shared.
 *
 * Purely presentational — it owns no state. The composer holds the values,
 * because both composers need to invalidate a counted audience the moment any
 * of them changes, and a control that hid its own state would have to be asked.
 */

export const AUDIENCES = [
  { value: 'all', label: 'Everyone onboarded' },
  { value: 'active', label: 'Active (seen in 30 days)' },
  { value: 'inactive', label: 'Lapsed (not seen in 30 days)' },
  { value: 'onboarding', label: 'Still onboarding' },
  { value: 'college', label: 'One college' },
  { value: 'users', label: 'Specific people' },
] as const;

/** Matches MAX_NAMED_RECIPIENTS in the backend. The server truncates anyway. */
export const MAX_RECIPIENTS = 200;

export interface AudienceValue {
  audience: string;
  college: string;
  recipients: Recipient[];
}

/** True when the choice is complete enough to count or send. */
export function audienceReady(value: AudienceValue): boolean {
  if (value.audience === 'college') return value.college.trim().length > 0;
  if (value.audience === 'users') return value.recipients.length > 0;
  return true;
}

export function AudiencePicker({
  value,
  onChange,
  /** Called whenever anything changes, so a counted audience can be dropped. */
  onInvalidate,
  disabled,
}: {
  value: AudienceValue;
  onChange: (next: AudienceValue) => void;
  onInvalidate?: () => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<AudienceValue>) => {
    onChange({ ...value, ...patch });
    onInvalidate?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-muted">Audience</span>
        <select
          value={value.audience}
          disabled={disabled}
          onChange={(event) => update({ audience: event.target.value })}
          className="w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50"
        >
          {AUDIENCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {value.audience === 'users' ? (
        <RecipientPicker
          selected={value.recipients}
          onChange={(recipients) => update({ recipients })}
          max={MAX_RECIPIENTS}
        />
      ) : null}

      {value.audience === 'college' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">College</span>
          <Input
            value={value.college}
            disabled={disabled}
            onChange={(event) => update({ college: event.target.value })}
            placeholder="Exact college name as stored on the account"
          />
        </label>
      ) : null}
    </div>
  );
}

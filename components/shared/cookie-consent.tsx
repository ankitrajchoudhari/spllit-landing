'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { saveConsent, useConsent } from '@/lib/consent';

/**
 * Consent banner.
 *
 * Reject is given the same weight as Accept — a "reject" hidden behind a
 * settings link is not a free choice, and regulators have said so repeatedly.
 * Nothing here blocks the page: the app is usable while the banner is up,
 * because the only storage it needs to function is the strictly necessary kind
 * that consent does not gate.
 */
export function CookieConsent() {
  const consent = useConsent();
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [preferences, setPreferences] = useState(true);

  // undefined = server render, null = not yet answered.
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl sm:inset-x-6 sm:bottom-6"
    >
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-float">
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
            <Cookie className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">Cookies and storage</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              We store what&apos;s needed to keep you signed in. Anything beyond that —
              remembering your preferences, or measuring how the app is used — is
              your call. We don&apos;t use advertising or cross-site tracking cookies.{' '}
              <Link href="/legal/privacy" className="font-medium text-ink underline underline-offset-2">
                Privacy
              </Link>
            </p>
          </div>
        </div>

        {expanded ? (
          <div className="mt-4 space-y-1 border-t border-line px-5 pt-4">
            <Row
              label="Strictly necessary"
              body="Your sign-in session. The app cannot work without it."
              checked
              disabled
            />
            <Row
              label="Preferences"
              body="Dismissed banners, your invite link, remembered filters."
              checked={preferences}
              onChange={setPreferences}
            />
            <Row
              label="Analytics"
              body="Anonymous usage measurement. Not switched on yet."
              checked={analytics}
              onChange={setAnalytics}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <Button
            size="sm"
            onClick={() => saveConsent({ preferences: true, analytics: true })}
          >
            Accept all
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => saveConsent({ preferences: false, analytics: false })}
          >
            Reject non-essential
          </Button>

          {expanded ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => saveConsent({ preferences, analytics })}
            >
              Save choices
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="-my-2 ml-auto px-1 py-2 text-[12.5px] font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Customise
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  body,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md px-1 py-2',
        disabled && 'cursor-default opacity-70',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="block text-[12px] leading-relaxed text-ink-muted">{body}</span>
      </span>
    </label>
  );
}

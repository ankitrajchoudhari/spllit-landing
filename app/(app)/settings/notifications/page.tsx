'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { notificationsService } from '@/lib/services/notifications';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Which emails Spllit is allowed to send you.
 *
 * The switches are driven by the server's `optional` list rather than a
 * hardcoded one here, so this screen can only ever offer choices the backend
 * will actually honour. A category the server considers transactional — the
 * answer to something you asked for — never appears, because an app that lets
 * you mute it just leaves you wondering what happened.
 *
 * This route is what the "Manage notifications" link in every email points at.
 */

/** Copy for the categories the server may offer. Keyed by its category id. */
const COPY: Record<string, { label: string; description: string }> = {
  'join-request': {
    label: 'Someone asks to join your squad',
    description:
      'Emailed to you as the leader, so you can answer without opening the app. At most one per squad every half hour.',
  },
  welcome: {
    label: 'Welcome message',
    description: 'Sent once, when an account is first created.',
  },
};

export default function NotificationSettingsPage() {
  const qc = useQueryClient();

  const prefs = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsService.preferences(),
  });

  const save = useMutation({
    mutationFn: notificationsService.savePreferences,
    /**
     * Applied optimistically. A switch that waits for a round trip before it
     * moves reads as broken, and the only failure here is a dropped request —
     * which the rollback puts right.
     */
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['notification-preferences'] });
      const previous = qc.getQueryData(['notification-preferences']);
      qc.setQueryData(['notification-preferences'], (old: unknown) =>
        old ? { ...(old as object), ...input } : old,
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      qc.setQueryData(['notification-preferences'], context?.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const data = prefs.data;
  const off = data?.emailOff ?? [];

  const setCategory = (category: string, enabled: boolean) => {
    const next = enabled ? off.filter((key) => key !== category) : [...new Set([...off, category])];
    save.mutate({ emailOff: next });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          aria-label="Back to profile"
          className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
            Email notifications
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            What Spllit may email you about. Everything still appears in the app.
          </p>
        </div>
      </div>

      {prefs.isPending ? (
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : prefs.isError ? (
        <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
          Could not load your preferences. Reload the page to try again.
        </p>
      ) : (
        <>
          <div className="divide-y divide-line rounded-lg border border-line bg-surface px-3">
            {(data?.optional ?? []).map((category) => {
              const copy = COPY[category];
              return (
                <Switch
                  key={category}
                  checked={!off.includes(category)}
                  onChange={(next) => setCategory(category, next)}
                  disabled={save.isPending}
                  label={copy?.label ?? category}
                  description={copy?.description}
                />
              );
            })}

            <Switch
              checked={data?.quietHours ?? true}
              onChange={(next) => save.mutate({ quietHours: next })}
              disabled={save.isPending}
              label="Quiet hours"
              description="Hold non-urgent email between 10pm and 7am. An answer to something you asked for still comes straight through."
            />
          </div>

          {save.isError ? (
            <p role="alert" className="rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] text-danger">
              That did not save. Your previous setting has been put back.
            </p>
          ) : null}

          {/* Stated rather than offered as a switch: these are the answers to
              things the person asked for, and a control that cannot be turned
              off is worse than no control. */}
          <p className="px-1 text-[12.5px] leading-relaxed text-ink-subtle">
            You will always be emailed when a request of yours is accepted, and about
            anything affecting your account. Spllit never sends marketing email.
          </p>
        </>
      )}
    </div>
  );
}

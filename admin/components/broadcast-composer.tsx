'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AudiencePicker, audienceReady, type AudienceValue } from '@/components/audience-picker';
import { Send } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCount } from '@/lib/utils';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

/**
 * Sending a notification to real people.
 *
 * The flow is deliberately two steps. A broadcast cannot be recalled once it is
 * on someone's phone or in their inbox, so the send button stays disabled until
 * the audience has been *sized* — "notify everyone" should be a decision made
 * against a number, not a guess. The confirmation then repeats that number back.
 *
 * Audiences come from components/audience-picker, shared with the campaign
 * composer. They were separate and drifted: the broadcast list was corrected
 * and the campaign one was not, so "everyone" meant two different populations
 * depending on which screen you were on.
 */



interface SendResult {
  sent: number;
  failed: number;
  /** Null when email was not requested. Reported apart from push on purpose:
      a notification row is written for everybody, while email is refused for
      anyone unverified, suppressed or opted out. */
  email: { sent: number; skipped: number; failed: number } | null;
}

interface Preview {
  audience: string;
  total: number;
  capped: boolean;
  cap: number;
  willReach: number;
}

export function BroadcastComposer() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [target, setTarget] = useState<AudienceValue>({
    audience: 'all',
    college: '',
    recipients: [],
  });
  const { audience, college, recipients } = target;

  /**
   * Channels. Push is what this screen has always done and stays on by
   * default; email is opt-in per send, because it cannot be recalled and it
   * spends sending reputation.
   */
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);

  const sizeUp = useMutation({
    mutationFn: () =>
      api<Preview>('/broadcast/preview', { method: 'POST', body: { audience, college, userIds: recipients.map((person) => person.id) } }),
    onSuccess: setPreview,
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not size the audience.'),
  });

  const send = useMutation({
    mutationFn: (reason: string) =>
      api<SendResult>('/broadcast', {
        method: 'POST',
        body: {
          audience,
          college,
          title,
          body,
          href,
          reason,
          userIds: recipients.map((person) => person.id),
          channels: { push, email },
        },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setConfirming(false);
      setTitle('');
      setBody('');
      setHref('');
      setPreview(null);
      const parts: string[] = [];
      if (push) {
        parts.push(
          result.failed > 0
            ? `${formatCount(result.sent)} notified, ${formatCount(result.failed)} failed`
            : `${formatCount(result.sent)} notified`,
        );
      }
      if (result.email) {
        parts.push(
          result.email.skipped > 0
            ? `${formatCount(result.email.sent)} emailed, ${formatCount(result.email.skipped)} skipped`
            : `${formatCount(result.email.sent)} emailed`,
        );
      }
      toast.success(parts.join(' · '));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'The broadcast did not send.'),
  });

  if (!can('notifications.send')) return null;

  const ready =
    title.trim().length >= 3 &&
    body.trim().length >= 3 &&
    preview !== null &&
    (push || email);

  // Any change to who or what is being sent invalidates the count that was
  // measured — otherwise the confirmation would quote a number for a different
  // message than the one about to go out.
  function invalidate() {
    setPreview(null);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-bold text-ink">Send a notification</h2>
        <p className="text-sm text-ink-muted">
          Reaches people on their phones, by email, or both. It cannot be undone.
        </p>
      </div>

      <AudiencePicker
        value={target}
        onChange={setTarget}
        onInvalidate={invalidate}
        disabled={send.isPending}
      />

      {/* Channels.
          Two checkboxes rather than a segmented control, because they are not
          alternatives — the common case for anything important is both. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-ink-muted">Send as</legend>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={push}
            onChange={(event) => { setPush(event.target.checked); invalidate(); }}
            className="h-4 w-4 accent-brand"
          />
          In-app notification
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={email}
            onChange={(event) => { setEmail(event.target.checked); invalidate(); }}
            className="h-4 w-4 accent-brand"
          />
          Email
        </label>
        {email ? (
          /**
           * Said before the send, not as a 503 afterwards. Email here goes out
           * on the campaign domain so one complaint cannot damage delivery of
           * sign-in and squad mail — the server refuses it outright when that
           * is unconfigured, and a disabled button with no reason costs
           * somebody an afternoon.
           */
          <p className="text-xs text-ink-subtle">
            Email goes to everyone in the audience who has a verified address and has
            not opted out of announcements. It needs a separate sending domain
            (<code className="font-mono">CAMPAIGN_EMAIL_FROM</code>) and cannot be recalled.
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Title</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short and specific"
            maxLength={80}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder="What do they need to know?"
            className="w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">
            Link <span className="text-ink-subtle">(optional)</span>
          </span>
          <Input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="/events/abc123"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          // Sizing an incomplete audience is a request that can only answer
          // zero — a named list with nobody on it, or a college branch with no
          // college typed.
          disabled={sizeUp.isPending || !audienceReady(target)}
          onClick={() => sizeUp.mutate()}
        >
          {sizeUp.isPending ? 'Counting…' : 'Check audience'}
        </Button>

        {preview ? (
          <span className="flex items-center gap-2 text-sm text-ink-muted">
            <Badge tone={preview.willReach > 0 ? 'info' : 'neutral'}>
              {formatCount(preview.willReach)} people
            </Badge>
            {preview.capped ? (
              <span className="text-xs text-warning">
                capped from {formatCount(preview.total)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-ink-subtle">
            Check the audience before sending.
          </span>
        )}

        <Button
          variant="primary"
          className="ml-auto"
          disabled={!ready}
          title={ready ? undefined : 'Write a title and message, then check the audience.'}
          onClick={() => setConfirming(true)}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </div>

      {confirming && preview ? (
        <ConfirmDialog
          title={`Send to ${formatCount(preview.willReach)} people?`}
          description={
            <>
              <strong className="block text-ink">{title}</strong>
              <span className="block pt-1">{body}</span>
              <span className="block pt-2 text-ink-subtle">
                This cannot be undone or recalled.
              </span>
            </>
          }
          confirmLabel="Send now"
          destructive
          pending={send.isPending}
          error={send.error instanceof ApiError ? send.error.message : null}
          onCancel={() => {
            setConfirming(false);
            send.reset();
          }}
          onConfirm={(reason) => send.mutate(reason)}
        />
      ) : null}
    </Card>
  );
}

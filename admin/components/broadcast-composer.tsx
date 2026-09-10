'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
 * on someone's phone, so the send button stays disabled until the audience has
 * been *sized* — "notify everyone" should be a decision made against a number,
 * not a guess. The confirmation then repeats that number back.
 */

const AUDIENCES = [
  { value: 'all', label: 'Everyone onboarded' },
  { value: 'active', label: 'Active (seen in 30 days)' },
  { value: 'inactive', label: 'Lapsed (not seen in 30 days)' },
  { value: 'onboarding', label: 'Still onboarding' },
  { value: 'college', label: 'One college' },
] as const;

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

  const [audience, setAudience] = useState<string>('all');
  const [college, setCollege] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);

  const sizeUp = useMutation({
    mutationFn: () =>
      api<Preview>('/broadcast/preview', { method: 'POST', body: { audience, college } }),
    onSuccess: setPreview,
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not size the audience.'),
  });

  const send = useMutation({
    mutationFn: (reason: string) =>
      api<{ sent: number; failed: number }>('/broadcast', {
        method: 'POST',
        body: { audience, college, title, body, href, reason },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setConfirming(false);
      setTitle('');
      setBody('');
      setHref('');
      setPreview(null);
      toast.success(
        result.failed > 0
          ? `Sent to ${formatCount(result.sent)}. ${formatCount(result.failed)} failed.`
          : `Sent to ${formatCount(result.sent)} people.`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'The broadcast did not send.'),
  });

  if (!can('notifications.send')) return null;

  const ready = title.trim().length >= 3 && body.trim().length >= 3 && preview !== null;

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
          This reaches people on their phones and cannot be undone.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Audience</span>
          <select
            value={audience}
            onChange={(event) => {
              setAudience(event.target.value);
              invalidate();
            }}
            className="w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            {AUDIENCES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {audience === 'college' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">College</span>
            <Input
              value={college}
              onChange={(event) => {
                setCollege(event.target.value);
                invalidate();
              }}
              placeholder="Exact college name as stored on the account"
            />
          </label>
        ) : null}

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
          disabled={sizeUp.isPending || (audience === 'college' && !college.trim())}
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

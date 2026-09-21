'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { squadMembersService } from '@/lib/services/squads';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';

/** Uppercase, separators stripped — matches the server's normalisation. */
function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/**
 * The squad's code, with copy.
 *
 * Shown to members only — the server withholds `joinCode` from everyone else,
 * because a code visible on a public squad page is not a code.
 */
export function SquadJoinCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and blocked outright in some embedded
      // browsers. The code is on screen either way, so this is not worth an
      // error state — it just does not confirm.
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-line bg-surface-sunken px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Join code
        </p>
        <p className="font-mono text-[20px] font-semibold tracking-[0.22em] text-ink">{code}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy join code"
        className="shrink-0 rounded-lg border border-line bg-surface p-2.5 text-ink-muted transition-colors hover:text-ink"
      >
        {copied ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Join a squad by typing the code somebody read out. */
export function JoinByCodeForm({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const join = useMutation({
    mutationFn: () => squadMembersService.joinByCode(code),
    onSuccess: (result) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['squads'] });
      // A private squad puts you in a queue rather than in the squad, so say
      // so instead of navigating to a page that would 403.
      if (result.status === 'pending') {
        setPending(true);
        setCode('');
      } else {
        router.push(`/squads/${result.squadId}`);
      }
    },
    onError: (err) => {
      setPending(false);
      setError(err instanceof ApiError ? err.message : 'Could not join with that code.');
    },
  });

  return (
    <form
      className={cn('space-y-3', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 6) join.mutate();
      }}
    >
      <Field
        label="Join with a code"
        htmlFor="squad-code"
        hint="Six characters, from whoever set up the group ride."
        error={error}
      >
        <Input
          id="squad-code"
          value={code}
          onChange={(event) => {
            setCode(normaliseCode(event.target.value));
            setError(null);
            setPending(false);
          }}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono tracking-[0.2em]"
        />
      </Field>

      {pending ? (
        <p className="rounded-lg bg-brand-muted px-3.5 py-3 text-[13px] text-brand">
          Request sent. The leader will let you in.
        </p>
      ) : null}

      <Button type="submit" className="w-full" loading={join.isPending} disabled={code.length !== 6}>
        Join group ride
      </Button>
    </form>
  );
}

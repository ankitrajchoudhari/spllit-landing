'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, LogIn, Mail } from 'lucide-react';

import { isConfigured, zohoEnabled } from '@/lib/config';
import { signInWithGoogle, signInWithPassword, signInWithZoho } from '@/lib/firebase';
import { Button, Input } from '@/components/ui/primitives';

/**
 * Console sign-in.
 *
 * Both methods go through the same Firebase project as spllit.app, so this
 * screen creates no new credential of any kind. Signing in here proves
 * identity; whether that identity may enter is decided by the backend
 * immediately afterwards.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * One message for every failure mode.
   *
   * Distinguishing "no such account" from "wrong password" turns this form
   * into a way of discovering which email addresses are admins, which is worth
   * more to an attacker than the marginal helpfulness is to an admin who
   * mistyped.
   */
  const GENERIC_FAILURE = 'That email and password did not match an account.';

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
    } catch {
      setError(GENERIC_FAILURE);
    } finally {
      setBusy(false);
    }
  }

  /**
   * One popup handler for both providers.
   *
   * A closed popup is the person changing their mind, not a failure worth
   * showing them an error about — so those two codes are swallowed while
   * everything else surfaces.
   */
  async function withPopup(run: () => Promise<void>, label: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (caught) {
      const code = (caught as { code?: string })?.code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(`${label} sign-in did not complete. Please try again.`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-danger/30 bg-danger-muted p-6"
          role="alert"
        >
          <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
          <h1 className="text-base font-bold text-ink">The console is not configured</h1>
          <p className="text-sm text-ink-muted">
            <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code> and the Firebase keys are
            inlined at build time, so this cannot be fixed by reloading. Set them in the Cloudflare
            build environment and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-subtle">
            Spllit
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Admin console</h1>
          <p className="text-sm text-ink-muted">
            Sign in with the Spllit account that holds your admin role.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => void withPopup(signInWithGoogle, 'Google')}
            disabled={busy}
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Continue with Google
          </Button>

          {/*
            Rendered only when Zoho is actually configured as an OIDC provider
            in Firebase. A button that cannot work is worse than no button — it
            looks like the supported path and fails every time it is pressed.
          */}
          {zohoEnabled ? (
            <Button
              variant="secondary"
              onClick={() => void withPopup(signInWithZoho, 'Zoho')}
              disabled={busy}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Continue with Zoho
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onPasswordSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">Email</span>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ankit@spllit.app"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-xs text-ink-subtle">
          A <span className="text-ink-muted">@spllit.app</span> address works here with a password —
          Zoho hosts the mailbox, so reset mail lands in your inbox. Admin access is granted per
          account by a Super Admin, and every action taken here is recorded in the audit log.
        </p>
      </div>
    </div>
  );
}

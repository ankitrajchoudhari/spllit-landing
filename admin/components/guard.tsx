'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import { Shell } from '@/components/shell';
import { SignIn } from '@/components/sign-in';
import { Button } from '@/components/ui/primitives';
import { ErrorState, Spinner } from '@/components/ui/states';

/**
 * Decides what the console renders before any page does.
 *
 * Worth being explicit about what this is and is not: it chooses a screen, not
 * a permission. Every route behind it is independently gated on the server, so
 * defeating this component in a browser console gets an attacker a rendered
 * layout and a series of 404s from the API.
 */
export function Guard({ children }: { children: ReactNode }) {
  const { status, error, retry, signOut } = useAuth();

  if (status === 'loading' || status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label={status === 'loading' ? 'Restoring your session' : 'Checking your access'} />
      </div>
    );
  }

  if (status === 'signed-out') {
    return <SignIn />;
  }

  if (status === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ErrorState
            title="This account is not an admin"
            description="You are signed in to Spllit, but this account has no console role. If that is wrong, ask a Super Admin to grant you one."
            action={
              <Button variant="secondary" onClick={() => void signOut()}>
                Sign in as someone else
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ErrorState
            title="Could not verify your access"
            description={error ?? 'The console could not reach the Spllit API.'}
            action={
              <div className="flex gap-2">
                <Button variant="primary" onClick={retry}>
                  Try again
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}

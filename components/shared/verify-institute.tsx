'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { signInWithPopup, signOut } from 'firebase/auth';
import { BadgeCheck, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { usersService } from '@/lib/services/users';
import { ApiError } from '@/lib/api/client';
import { getInstituteVerifierAuth, instituteGoogleProvider } from '@/lib/firebase';
import { firebaseErrorMessage } from '@/lib/auth/firebase-errors';
import { findInstituteByName, INSTITUTES_BY_ID } from '@/content/institutes';

/**
 * Campus verification.
 *
 * The address is proved by signing in with the institute's Google account, not
 * by typing it: a text field would let anyone claim someone@iitm.ac.in. The
 * popup runs on an isolated Firebase instance so the user's existing session is
 * untouched, and the resulting ID token is verified server-side — the client
 * never decides whether verification succeeded.
 *
 * Renders nothing once verified.
 */
export function VerifyInstituteBanner({ className }: { className?: string }) {
  const { profile, setProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const institute =
    (profile?.instituteId ? INSTITUTES_BY_ID.get(profile.instituteId) : null) ??
    findInstituteByName(profile?.college);

  /**
   * Every accepted domain, not just the first. The banner used to name
   * `domains[0]` alone, which told a student on one of the other accepted
   * addresses that theirs was the wrong one — while the server would have
   * accepted it perfectly well.
   */
  const domains = institute?.domains ?? [];
  const verifiable = domains.length > 0;

  const verify = useMutation({
    mutationFn: async () => {
      if (!verifiable) throw new Error('This institute has no verifiable domain.');

      const auth = getInstituteVerifierAuth();
      if (!auth) throw new Error('Verification is not configured for this environment.');

      const result = await signInWithPopup(auth, instituteGoogleProvider(domains));
      const idToken = await result.user.getIdToken();

      try {
        return await usersService.verifyInstituteWithGoogle(idToken);
      } finally {
        // The throwaway session has served its purpose; don't leave it around.
        await signOut(auth).catch(() => {});
      }
    },
    onSuccess: (user) => {
      setError(null);
      setProfile(user);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : firebaseErrorMessage(err, 'Could not verify that account.'),
      );
    },
  });

  if (!profile || profile.instituteVerified) return null;

  return (
    <div className={cn('rounded-lg border border-warning/30 bg-warning/[0.06] p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <ShieldAlert className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">
            Verify your {institute?.name ?? 'institute'} account
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            {verifiable ? (
              <>
                Creating or joining rides and squads is limited to verified
                students. Sign in with your {institute?.name ?? 'institute'} Google
                account — we never ask you to type your email address, Google
                confirms it.
              </>
            ) : (
              <>
                {profile.college || 'Your institute'} has no verifiable email domain yet,
                so rides and squads stay locked. Everything else works.
              </>
            )}
          </p>

          {/* The accepted addresses, spelled out. Someone whose address is on
              the list but was not the canonical one had no way to tell whether
              it would work, and the old copy implied it would not. */}
          {verifiable ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <li
                  key={d}
                  className="rounded-md bg-surface-sunken px-2 py-0.5 text-[11.5px] font-medium text-ink-muted"
                >
                  name@{d}
                </li>
              ))}
            </ul>
          ) : null}

          {verifiable ? (
            <Button
              size="sm"
              className="mt-3"
              loading={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify with Google
            </Button>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Compact "verified" chip for the profile header. */
export function VerifiedChip({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-medium text-brand">
      <BadgeCheck className="h-3 w-3" />
      Verified student
    </span>
  );
}

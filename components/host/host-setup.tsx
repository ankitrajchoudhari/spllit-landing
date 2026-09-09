'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ShieldCheck } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { getInstituteVerifierAuth } from '@/lib/firebase';
import { firebaseErrorMessage } from '@/lib/auth/firebase-errors';
import { hostService } from '@/lib/services/host';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import {
  PhoneInput,
  toE164,
  isPlausiblePhone,
  DEFAULT_COUNTRY,
} from '@/components/shared/phone-input';
import { VehicleForm } from '@/components/host/vehicle-form';
import { VehicleList } from '@/components/host/vehicle-list';

/**
 * Host onboarding: verify a number, then register a vehicle.
 *
 * Both are real gates. The number is read out of a Firebase Phone OTP token
 * server-side rather than from the form, because a typed number proves nothing
 * and this is what a passenger is given if a ride goes wrong. `status` only
 * becomes `active` once the server sees a verified phone *and* a verified
 * vehicle — this component reflects that decision, it never makes it.
 */

type Step = 'phone' | 'code' | 'vehicle' | 'done';

/**
 * A throwaway Firebase instance, not the signed-in one.
 *
 * Firebase permits a single account per provider per user, so a rider who
 * signed in with Google cannot also link a phone credential to that session —
 * attempting it either fails or, worse, replaces their sign-in method. The
 * isolated instance yields a token the server verifies and discards, leaving
 * the primary session untouched. Same reason the institute verifier exists.
 */
function verifierAuth() {
  const auth = getInstituteVerifierAuth();
  if (!auth) throw new Error('Phone verification is not configured for this environment.');
  return auth;
}

export function HostSetup() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: host, isPending } = useQuery({
    queryKey: ['host', 'me'],
    queryFn: () => hostService.me(),
  });

  const [step, setStep] = useState<Step | null>(null);
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  /**
   * Derived, so a refresh mid-setup resumes at the right place instead of
   * restarting. An explicit `step` only overrides it once the user has moved.
   */
  const resumeStep: Step = !host?.profile.phoneVerified
    ? 'phone'
    : host.profile.status === 'active'
      ? 'done'
      : 'vehicle';
  const current = step ?? resumeStep;

  /** Single-use by design — Firebase consumes the token on first send. */
  const freshRecaptcha = useCallback(() => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = new RecaptchaVerifier(verifierAuth(), 'host-recaptcha', {
      size: 'invisible',
    });
    return recaptchaRef.current;
  }, []);

  const saveProfile = useMutation({
    mutationFn: (input: { idToken?: string; about?: string }) => hostService.save(input),
    onSuccess: (account) => {
      queryClient.setQueryData(['host', 'me'], account);
      setStep(account.profile.status === 'active' ? 'done' : 'vehicle');
    },
  });

  const sendCode = async () => {
    if (!isPlausiblePhone(countryCode, phone)) {
      setError('That does not look like a complete number for the selected country.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      confirmationRef.current = await signInWithPhoneNumber(
        verifierAuth(),
        toE164(countryCode, phone),
        freshRecaptcha(),
      );
      setCode('');
      setStep('code');
    } catch (err) {
      setError(firebaseErrorMessage(err, 'Could not send the code.'));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!confirmationRef.current) throw new Error('That code expired. Send a new one.');
      const credential = await confirmationRef.current.confirm(code.trim());
      const idToken = await credential.user.getIdToken();

      await saveProfile.mutateAsync({ idToken, about: about.trim() || undefined });

      // The throwaway session has done its job. Leaving it signed in would keep
      // a second credential alive in memory for no reason.
      await verifierAuth().signOut();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : firebaseErrorMessage(err, 'That code did not match.'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-muted">
          <ShieldCheck className="h-[18px] w-[18px] text-brand" />
        </span>
        <div>
          <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Become a host
          </h1>
          <p className="text-[13px] text-ink-muted">
            Two checks, then you can offer seats.
          </p>
        </div>
      </div>

      <ol className="mt-6 flex gap-1.5">
        {(['phone', 'vehicle', 'done'] as const).map((key, index) => {
          const order: Step[] = ['phone', 'code', 'vehicle', 'done'];
          const reached = order.indexOf(current) >= order.indexOf(key === 'phone' ? 'phone' : key);
          return (
            <li
              key={key}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-snap',
                reached ? 'bg-brand' : 'bg-line',
              )}
              aria-label={`Step ${index + 1}`}
            />
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.2 }}
          className="mt-7"
        >
          {current === 'phone' ? (
            <>
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Your driving number
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                Riders get this number once they are on your trip. It can be
                different from the one on your rider profile.
              </p>

              <div className="mt-5 space-y-4">
                <Field label="Phone number">
                  <PhoneInput
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                    value={phone}
                    onChange={setPhone}
                    invalid={Boolean(error)}
                    autoFocus
                  />
                </Field>

                <Field label="About you" hint="Optional. Shown to riders before they join.">
                  <Input
                    placeholder="Final year, drive to Tambaram most evenings"
                    value={about}
                    maxLength={400}
                    onChange={(event) => setAbout(event.target.value)}
                  />
                </Field>
              </div>

              <Button
                size="lg"
                className="mt-6 w-full"
                loading={busy}
                disabled={!isPlausiblePhone(countryCode, phone)}
                onClick={() => void sendCode()}
              >
                Send code
              </Button>
            </>
          ) : null}

          {current === 'code' ? (
            <>
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Enter the code
              </h2>
              <p className="mt-1.5 text-[13.5px] text-ink-muted">
                Sent to <span className="text-ink">{toE164(countryCode, phone)}</span>.
              </p>

              <div className="mt-5">
                <Field label="6-digit code">
                  <Input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="······"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    invalid={Boolean(error)}
                    className="text-center tracking-[0.5em]"
                  />
                </Field>
              </div>

              <Button
                size="lg"
                className="mt-6 w-full"
                loading={busy || saveProfile.isPending}
                onClick={() => void verifyCode()}
              >
                Verify
              </Button>
              <button
                onClick={() => void sendCode()}
                disabled={busy}
                className="mt-3 w-full text-[13px] text-ink-muted hover:text-ink disabled:opacity-50"
              >
                Resend code
              </button>
            </>
          ) : null}

          {current === 'vehicle' ? (
            <>
              <h2 className="font-display text-[17px] font-semibold text-ink">
                Add your vehicle
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                Riders see the make, model and registration before they get in.
                You can offer seats once it is verified.
              </p>

              {host?.vehicles.length ? (
                <div className="mt-5">
                  <VehicleList vehicles={host.vehicles} />
                </div>
              ) : null}

              <div className="mt-5">
                <VehicleForm
                  onAdded={(account) => {
                    queryClient.setQueryData(['host', 'me'], account);
                  }}
                />
              </div>
            </>
          ) : null}

          {current === 'done' ? (
            <div className="rounded-2xl border border-line bg-surface p-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-muted">
                <Check className="h-5 w-5 text-brand" />
              </span>
              <h2 className="mt-4 font-display text-[17px] font-semibold text-ink">
                You&apos;re a host
              </h2>
              <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-ink-muted">
                Your number and vehicle are verified. Post a trip and riders
                going your way will find it.
              </p>
              <Button className="mt-5" onClick={() => router.push('/host')}>
                Open host dashboard
              </Button>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-danger-muted px-3.5 py-3 text-[13px] leading-relaxed text-danger"
        >
          {error}
        </p>
      ) : null}

      {/* Invisible reCAPTCHA host for Firebase phone auth. */}
      <div id="host-recaptcha" className="absolute" />
    </div>
  );
}

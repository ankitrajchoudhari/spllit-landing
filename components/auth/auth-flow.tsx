'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Phone } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import {
  PhoneInput,
  toE164,
  isPlausiblePhone,
  DEFAULT_COUNTRY,
} from '@/components/shared/phone-input';
import { InstitutePicker, InstituteMark } from '@/components/shared/institute-picker';
import { findInstituteByName, emailMatchesInstitute, type Institute } from '@/content/institutes';
import { getFirebaseAuth } from '@/lib/firebase';
import { firebaseErrorMessage } from '@/lib/auth/firebase-errors';
import { useAuth } from '@/lib/auth/auth-provider';
import { usersService, type UsernameRejection } from '@/lib/services/users';
import { readReferral } from '@/lib/auth/referral';
import { ApiError } from '@/lib/api/client';

/**
 * One linear onboarding flow. All steps live in this component so browser
 * back/forward and a mid-flow refresh never lose already-entered state.
 *
 * Returning users never see any of it: as soon as auth reports a completed
 * profile we redirect straight to /home.
 */

type Step = 'method' | 'phone' | 'otp' | 'name' | 'username' | 'institute' | 'photo';

/**
 * The two onboarding paths.
 *
 * Phone sign-in *is* the phone step — the number is the credential, so it has
 * to come first. Google sign-in already establishes identity, so asking for a
 * phone number before the user has even picked a username is a step that earns
 * nothing. It stays optional and can be added later from the profile.
 */
const PHONE_FLOW_STEPS: Step[] = ['phone', 'otp', 'name', 'username', 'institute', 'photo'];
const GOOGLE_FLOW_STEPS: Step[] = ['name', 'username', 'institute', 'photo'];

/** Matches the server's rule exactly, so the form never promises a save the API will refuse. */
const USERNAME_MAX = 20;
const USERNAME_MIN = 3;

/**
 * `idle` covers both "nothing typed yet" and "the check could not run". The
 * form stays passable in the second case — the server validates on save and
 * now returns alternatives if it refuses, so a flaky check must not be a wall.
 */
type UsernameState = 'idle' | 'checking' | 'free' | UsernameRejection;

/**
 * A server answer tagged with the exact value it was an answer *for*.
 *
 * Holding the value alongside the verdict is what makes the display state
 * derivable: anything the server has not answered for yet is by definition
 * still being checked, and a verdict for a value the user has since edited
 * away from simply stops matching. No effect has to reset it.
 */
interface UsernameVerdict {
  value: string;
  /** null when the handle is free; 'unknown' when the check could not run. */
  reason: UsernameRejection | 'unknown' | null;
  suggestions: string[];
}

const USERNAME_MESSAGE: Record<UsernameRejection, string> = {
  taken: 'That username is taken.',
  reserved: 'That username is reserved.',
  invalid: `Use ${USERNAME_MIN}–${USERNAME_MAX} letters, numbers or underscores.`,
};

/** Strips anything the server would reject, so the field shows what will be saved. */
function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
}

/**
 * Only same-origin paths may be honoured. `next` reaches this component from
 * the query string, and an absolute URL there would turn the sign-in page into
 * an open redirect straight after the user has authenticated.
 */
function safeDestination(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/home';
  return next;
}

function StepProgress({ step, steps }: { step: Step; steps: Step[] }) {
  const index = steps.indexOf(step);
  if (index < 0) return null;

  return (
    <div className="mb-8 flex gap-1.5">
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-snap',
            i <= index ? 'bg-brand' : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}

export function AuthFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, firebaseUser, profile, signInWithGoogle, setProfile } = useAuth();

  const [pickedStep, setPickedStep] = useState<Step | null>(
    params.get('method') === 'phone' ? 'phone' : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collected across steps — never reset on step change.
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  // null means "untouched" so a prefilled value can still be cleared — holding
  // '' here made the field snap back to the Google photo on every keystroke.
  const [photoInput, setPhotoInput] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<UsernameVerdict | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Where to land once the profile is complete. RequireAuth parks the page the
  // user actually wanted here; without it every sign-in dumped them on /home.
  const destination = safeDestination(params.get('next'));

  // Returning user with a finished profile — skip everything.
  useEffect(() => {
    if (status === 'authenticated') router.replace(destination);
  }, [status, router, destination]);

  /**
   * Which path this user is on. Firebase reports a phoneNumber only when the
   * phone provider was used, so a Google account never sees the phone steps.
   */
  // Intent counts as well as outcome: while the user is still on the phone or
  // OTP screen Firebase has no phoneNumber yet, and without this the progress
  // bar would vanish for exactly those two steps.
  const usedPhoneAuth =
    Boolean(firebaseUser?.phoneNumber) || pickedStep === 'phone' || pickedStep === 'otp';
  const steps = usedPhoneAuth ? PHONE_FLOW_STEPS : GOOGLE_FLOW_STEPS;

  /**
   * Where a partially-onboarded user resumes. Derived from the profile so we
   * never flash the wrong screen before an effect corrects it. Phone is never
   * a gate here — it is optional for Google users and already satisfied for
   * phone users by the time they reach onboarding.
   */
  const resumeStep: Step =
    status === 'onboarding'
      ? !profile?.name || profile.name === profile.email?.split('@')[0]
        ? 'name'
        : !profile.username
          ? 'username'
          : !profile.college
            ? 'institute'
            : 'photo'
      : 'method';

  const step = pickedStep ?? resumeStep;

  /**
   * Google gives a display name for most accounts but not all, and legacy
   * records carry whatever was stored years ago — often the email local-part.
   * That value is treated as "unset" so the user is asked properly rather than
   * being greeted by a username-looking string.
   */
  const suggestedName =
    profile?.name && profile.name !== profile.email?.split('@')[0]
      ? profile.name
      : (firebaseUser?.displayName ?? '');

  const name = nameInput ?? suggestedName;
  const username = usernameInput ?? profile?.username ?? '';
  const chosenInstitute = institute ?? findInstituteByName(profile?.college);
  const photoUrl = photoInput ?? profile?.profilePhoto ?? firebaseUser?.photoURL ?? '';

  /**
   * Everything the username field shows, derived from the value in the box and
   * whatever the server has last said about that exact value. Nothing here is
   * stored, so a stale reply arriving out of order cannot win: it is a verdict
   * for a value that is no longer in the field, and is ignored on sight.
   */
  const answered = verdict?.value === username ? verdict : null;
  const usernameState: UsernameState =
    username.length === 0
      ? 'idle'
      : username.length < USERNAME_MIN
        ? 'invalid'
        : !answered
          ? 'checking'
          : answered.reason === null
            ? 'free'
            : answered.reason === 'unknown'
              ? 'idle'
              : answered.reason;
  const suggestions = answered?.suggestions ?? [];

  /**
   * A fresh verifier per send.
   *
   * A RecaptchaVerifier is single-use: Firebase consumes its token on the
   * first signInWithPhoneNumber and every later call with the same instance
   * fails. Reusing a cached one is what made "Resend code" never work.
   */
  const freshRecaptcha = useCallback(() => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Sign-in is not configured for this environment.');
    recaptchaRef.current?.clear();
    // Invisible reCAPTCHA is required by Firebase phone auth.
    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    return recaptchaRef.current;
  }, []);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await signInWithGoogle();
      // The browser is leaving for Google. Anything after this races the
      // unload, and the session is picked up by the auth listener on return.
      if (outcome === 'redirect') return;

      const user = await usersService.bootstrap(readReferral());
      setProfile(user);
      if (user.onboarded) router.replace(destination);
      // Straight to the profile steps: Google already proved who they are.
      else setPickedStep('name');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : firebaseErrorMessage(err, 'Could not sign in with Google.'),
      );
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const handleSendOtp = async () => {
    if (!isPlausiblePhone(countryCode, phone)) {
      setError('That does not look like a complete phone number for the selected country.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Sign-in is not configured for this environment.');
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        toE164(countryCode, phone),
        freshRecaptcha(),
      );
      setPickedStep('otp');
    } catch (err) {
      // Surface the actual Firebase code — most phone-auth failures are
      // project configuration, not a bad number, and look identical otherwise.
      setError(firebaseErrorMessage(err, 'Could not send the code.'));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!confirmationRef.current) {
        throw new Error('That code expired. Send a new one.');
      }
      await confirmationRef.current.confirm(otp.trim());
      const user = await usersService.bootstrap(readReferral());
      setProfile(user);
      if (user.onboarded) router.replace(destination);
      else setPickedStep('name');
    } catch (err) {
      setError(firebaseErrorMessage(err, 'That code did not match.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Debounced availability check, run from an effect rather than from onChange.
   *
   * Driving it off the value means a username restored from a half-finished
   * profile is verified the moment the step opens, not only if the user
   * happens to retype it — that gap let people press Continue on a handle
   * nobody had checked and hit a 409 four steps later.
   */
  useEffect(() => {
    if (step !== 'username') return;
    // Locally rejectable values never reach the network — the derived state
    // above already shows the right thing for them.
    if (username.length < USERNAME_MIN) return;
    if (verdict?.value === username) return;

    const timer = setTimeout(() => {
      void usersService
        .checkUsername(username, name)
        .then((result) =>
          setVerdict({
            value: username,
            reason: result.available ? null : (result.reason ?? 'taken'),
            suggestions: result.available ? [] : result.suggestions,
          }),
        )
        // Unknown, not unavailable: Continue stays enabled and the server has
        // the final say on save.
        .catch(() => setVerdict({ value: username, reason: 'unknown', suggestions: [] }));
    }, 350);

    return () => clearTimeout(timer);
  }, [step, username, name, verdict]);

  const handleFinish = async (skipPhoto: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const user = await usersService.completeOnboarding({
        name: name.trim(),
        phone: phone ? toE164(countryCode, phone) : (profile?.phone ?? ''),
        username: normalizeUsername(username),
        college: chosenInstitute?.name ?? '',
        instituteId: chosenInstitute?.id,
        profilePhoto: skipPhoto ? undefined : photoUrl.trim() || undefined,
      });
      // completeOnboarding returns the saved profile, so this is the profile —
      // no follow-up read needed, and a failed one must not undo the save.
      setProfile(user);
      router.replace(destination);
    } catch (err) {
      /**
       * The handle was free when it was checked and is not free now. Rather
       * than dead-ending on the last step, go back to the username step with
       * the alternatives the server just worked out.
       */
      if (err instanceof ApiError && err.code === 'username-taken') {
        setVerdict({
          value: username,
          reason: 'taken',
          suggestions: err.stringList('suggestions'),
        });
        setPickedStep('username');
        setError(`${err.message}. Pick another one below.`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
      }
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    const order: Step[] = ['method', ...steps];
    const index = order.indexOf(step);
    if (index > 0) setPickedStep(order[index - 1] as Step);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    );
  }

  // Whether the signed-in email already proves membership of the picked
  // institute. Shown here so the requirement is never a surprise later.
  const emailVerified =
    chosenInstitute && profile?.email
      ? emailMatchesInstitute(profile.email, chosenInstitute)
      : false;

  return (
    // overflow-x-clip: Firebase injects the reCAPTCHA badge as an absolutely
    // positioned 256px element, which pushes the document wider than a phone
    // viewport and puts a horizontal scrollbar on the whole sign-in flow.
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10">
        <div className="flex items-center gap-3">
          {step !== 'method' ? (
            <button
              onClick={back}
              aria-label="Back"
              className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link
              href="/"
              aria-label="Back to home"
              className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <Image
            src="/logo-icon.png"
            alt="Spllit"
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded-md"
          />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <StepProgress step={step} steps={steps} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {step === 'method' ? (
                <>
                  <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">
                    Welcome to Spllit
                  </h1>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                    Sign in once. After that you go straight to the map.
                  </p>
                  <div className="mt-8 space-y-3">
                    <Button size="lg" className="w-full" loading={busy} onClick={handleGoogle}>
                      Continue with Google
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full"
                      onClick={() => setPickedStep('phone')}
                    >
                      <Phone className="h-4 w-4" />
                      Continue with phone
                    </Button>
                  </div>
                  <p className="mt-8 text-[12.5px] leading-relaxed text-ink-subtle">
                    {/*
                      /legal/… , not /terms and /privacy. Those were 404s, on the
                      one screen where the link has to work: consent to a
                      document nobody can open is not consent, and this is the
                      last thing a user sees before creating an account.
                    */}
                    By continuing you agree to our{' '}
                    <Link href="/legal/terms" className="text-ink-muted underline underline-offset-2">
                      Terms
                    </Link>
                    ,{' '}
                    <Link
                      href="/legal/privacy"
                      className="text-ink-muted underline underline-offset-2"
                    >
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/legal/refunds"
                      className="text-ink-muted underline underline-offset-2"
                    >
                      Refunds Policy
                    </Link>
                    .
                  </p>
                </>
              ) : null}

              {step === 'phone' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    What&apos;s your number?
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    We use it to verify you and to let ride hosts reach you.
                  </p>
                  <div className="mt-7">
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
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    loading={busy}
                    disabled={!isPlausiblePhone(countryCode, phone)}
                    onClick={handleSendOtp}
                  >
                    Send code
                  </Button>
                </>
              ) : null}

              {step === 'otp' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    Enter the code
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    Sent to <span className="text-ink">{toE164(countryCode, phone)}</span>.
                  </p>
                  <div className="mt-7">
                    <Field label="6-digit code">
                      <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="······"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        invalid={Boolean(error)}
                        className="text-center tracking-[0.5em]"
                      />
                    </Field>
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    loading={busy}
                    onClick={handleVerifyOtp}
                  >
                    Verify
                  </Button>
                  <button
                    onClick={handleSendOtp}
                    className="mt-4 w-full text-[13px] text-ink-muted hover:text-ink"
                  >
                    Resend code
                  </button>
                </>
              ) : null}

              {step === 'name' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    What should we call you?
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    This is the name ride hosts and squad members see.
                  </p>
                  <div className="mt-7">
                    <Field label="Full name">
                      <Input
                        autoFocus
                        autoComplete="name"
                        placeholder="Meera Krishnan"
                        value={name}
                        onChange={(e) => setNameInput(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    disabled={name.trim().length < 2}
                    onClick={() => setPickedStep('username')}
                  >
                    Continue
                  </Button>
                </>
              ) : null}

              {step === 'username' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    Pick a username
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    This is how people find and mention you.
                  </p>
                  <div className="mt-7">
                    <Field
                      label="Username"
                      hint={`Letters, numbers and underscores. ${USERNAME_MIN}–${USERNAME_MAX} characters.`}
                      error={
                        usernameState === 'taken' ||
                        usernameState === 'reserved' ||
                        (usernameState === 'invalid' && username.length > 0)
                          ? USERNAME_MESSAGE[usernameState]
                          : null
                      }
                    >
                      <Input
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={USERNAME_MAX}
                        placeholder="meera"
                        value={username}
                        // Normalised on the way in, so the field always shows
                        // exactly what gets saved rather than silently
                        // lower-casing and truncating it at the end.
                        onChange={(e) => setUsernameInput(normalizeUsername(e.target.value))}
                        invalid={usernameState === 'taken' || usernameState === 'reserved'}
                        suffix={
                          usernameState === 'free' ? (
                            <Check className="h-4 w-4 text-brand" />
                          ) : usernameState === 'checking' ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-ink-subtle" />
                          ) : null
                        }
                      />
                    </Field>
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-[12.5px] text-ink-muted">
                        These are free right now:
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setUsernameInput(suggestion);
                              setError(null);
                            }}
                            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors duration-snap hover:border-brand hover:bg-brand-muted hover:text-brand"
                          >
                            @{suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    // 'idle' passes deliberately: it also means the check could
                    // not run, and a flaky network must not block onboarding.
                    disabled={
                      username.length < USERNAME_MIN ||
                      usernameState === 'checking' ||
                      usernameState === 'taken' ||
                      usernameState === 'reserved' ||
                      usernameState === 'invalid'
                    }
                    onClick={() => setPickedStep('institute')}
                  >
                    Continue
                  </Button>
                </>
              ) : null}

              {step === 'institute' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    Where do you study?
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    Your campus decides which rides, squads and events you see first.
                  </p>
                  <div className="mt-7">
                    <Field label="Institute">
                      <InstitutePicker value={chosenInstitute} onChange={setInstitute} />
                    </Field>
                  </div>

                  {chosenInstitute && chosenInstitute.domains.length > 0 ? (
                    <div
                      className={cn(
                        'mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-3',
                        emailVerified ? 'bg-brand-muted' : 'bg-warning/10',
                      )}
                    >
                      <InstituteMark institute={chosenInstitute} size="sm" />
                      <p
                        className={cn(
                          'text-[12.5px] leading-relaxed',
                          emailVerified ? 'text-brand' : 'text-ink-muted',
                        )}
                      >
                        {emailVerified ? (
                          /* The address they actually hold, not the institute's
                             canonical one — naming domains[0] told a student on
                             study.iitm.ac.in they had been verified with an
                             address that is not theirs. */
                          <>Verified with your {profile?.email ?? 'campus'} address.</>
                        ) : (
                          <>
                            To create or join rides you&apos;ll need to add your{' '}
                            <span className="font-medium text-ink">
                              {chosenInstitute.name}
                            </span>{' '}
                            email
                            {chosenInstitute.domains.length === 1
                              ? ` (@${chosenInstitute.domains[0]})`
                              : ` — any of @${chosenInstitute.domains.join(', @')}`}
                            . You can finish signing up now and verify from your profile.
                          </>
                        )}
                      </p>
                    </div>
                  ) : null}

                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    disabled={!chosenInstitute}
                    onClick={() => setPickedStep('photo')}
                  >
                    Continue
                  </Button>
                </>
              ) : null}

              {step === 'photo' ? (
                <>
                  <h1 className="font-display text-2xl font-semibold tracking-[-0.025em] text-ink">
                    Add a photo
                  </h1>
                  <p className="mt-2 text-[14px] text-ink-muted">
                    Optional, but people are far more likely to share a ride with a face
                    they can see.
                  </p>
                  <div className="mt-7">
                    <Field
                      label="Photo URL"
                      hint={
                        firebaseUser?.photoURL
                          ? 'Prefilled from your Google account.'
                          : 'Paste a link, or skip and add one later.'
                      }
                    >
                      <Input
                        type="url"
                        inputMode="url"
                        placeholder="https://…"
                        value={photoUrl}
                        onChange={(e) => setPhotoInput(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    size="lg"
                    className="mt-6 w-full"
                    loading={busy}
                    onClick={() => void handleFinish(false)}
                  >
                    Finish
                  </Button>
                  <button
                    onClick={() => void handleFinish(true)}
                    disabled={busy}
                    className="mt-4 w-full text-[13px] text-ink-muted hover:text-ink disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-danger/10 px-3.5 py-3 text-[13px] leading-relaxed text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* Invisible reCAPTCHA host for Firebase phone auth. Kept out of flow so
          the injected badge can never affect layout width. */}
      <div id="recaptcha-container" className="pointer-events-none absolute" />
    </div>
  );
}

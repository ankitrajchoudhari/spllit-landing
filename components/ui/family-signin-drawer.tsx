'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowLeft, KeyRound, Phone, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-provider';
import { usersService } from '@/lib/services/users';
import { readReferral } from '@/lib/auth/referral';
import { ApiError } from '@/lib/api/client';
import { firebaseErrorMessage } from '@/lib/auth/firebase-errors';
import {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerTitle,
  DrawerDescription,
  DrawerContent,
} from '@/components/ui/family-signin-drawer-utils/drawer';
import {
  AnimatedTabs,
  AnimatedTabsList,
  AnimatedTabsTrigger,
  AnimatedTabsContent,
  useMeasure,
} from '@/components/ui/family-signin-drawer-utils/tabs';

/**
 * Sign-in, on the landing page.
 *
 * ── Why this is not the pasted markup ──────────────────────────────────────
 * The upstream component offers Email + Password and Passkey. Spllit supports
 * neither: identity is Google Sign-In and Phone OTP through Firebase, and
 * there is no password column in the schema to check one against. Shipping
 * that form verbatim would be a login box that cannot log anyone in, which is
 * worse than no drawer at all.
 *
 * The structure, motion and step transition are kept exactly; only the two
 * methods behind the tabs are the ones this app actually has.
 *
 * Phone deliberately hands off to /auth rather than running inline. That flow
 * needs an invisible reCAPTCHA host plus send/verify/resend state, all of
 * which already exist and are exercised at /auth — a second copy inside a
 * drawer is where the two would drift apart.
 */

/** Google's mark. Inlined because it must keep its own brand colours. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.28v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function SignInDrawer({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { signInWithGoogle, setProfile } = useAuth();

  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<'default' | 'signing-in'>('default');
  const [error, setError] = React.useState<string | null>(null);
  const [ref, bounds] = useMeasure<HTMLDivElement>();

  const handleBack = () => {
    setStep('default');
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    // Reset after the close animation, not during it — resetting immediately
    // makes the panel visibly snap back to step one on the way out.
    if (!next) setTimeout(() => handleBack(), 300);
    setOpen(next);
  };

  const handleGoogle = async () => {
    setStep('signing-in');
    setError(null);
    try {
      const outcome = await signInWithGoogle();
      // The browser is navigating to Google; nothing after this runs.
      if (outcome === 'redirect') return;

      const user = await usersService.bootstrap(readReferral());
      setProfile(user);
      // A finished profile goes straight in. An unfinished one continues at
      // /auth, which owns the onboarding steps.
      router.push(user.onboarded ? '/home' : '/auth');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : firebaseErrorMessage(err, 'Could not sign in with Google.'),
      );
      setStep('default');
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>

      <DrawerContent>
        <DrawerClose className="absolute right-5 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-ink transition-transform active:scale-75">
          <X className="h-[18px] w-[18px] opacity-75" />
        </DrawerClose>

        <div className="flex items-center justify-between px-6 py-5 text-center text-xl font-semibold tracking-tight">
          {step === 'signing-in' ? (
            <button
              onClick={handleBack}
              type="button"
              className="absolute left-5 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-ink transition-transform active:scale-75"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
          ) : null}
          <span className="flex-1 select-none text-center font-display text-ink">
            {step === 'default' ? 'Sign in' : 'Signing in'}
          </span>
          {step === 'signing-in' ? <div className="w-8" /> : null}
        </div>

        <DrawerTitle className="sr-only">Sign in to Spllit</DrawerTitle>
        <DrawerDescription className="sr-only">
          Continue with Google, or use your phone number.
        </DrawerDescription>

        <motion.div
          animate={{ height: bounds.height > 0 ? bounds.height : 300 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="overflow-hidden will-change-transform"
        >
          <div ref={ref} className="px-6 pb-7">
            <AnimatePresence mode="popLayout" initial={false}>
              {step === 'default' ? (
                <motion.div
                  key="default"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                >
                  <AnimatedTabs defaultValue="google">
                    <AnimatedTabsList>
                      <AnimatedTabsTrigger value="google">
                        <GoogleMark className="mr-1.5 h-4 w-4" />
                        Google
                      </AnimatedTabsTrigger>
                      <AnimatedTabsTrigger value="phone">
                        <Phone className="mr-1.5 h-4 w-4" />
                        Phone
                      </AnimatedTabsTrigger>
                    </AnimatedTabsList>

                    <AnimatedTabsContent value="google" className="pb-2 pt-6">
                      <div className="space-y-4">
                        <p className="text-[13.5px] leading-relaxed text-ink-muted">
                          Use your campus Google account and your institute is
                          verified automatically — no extra step later.
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleGoogle()}
                          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-ink px-3 text-base font-medium text-canvas transition-all active:scale-95"
                        >
                          <GoogleMark className="h-[18px] w-[18px]" />
                          Continue with Google
                        </button>
                      </div>
                    </AnimatedTabsContent>

                    <AnimatedTabsContent value="phone" className="pb-2 pt-6">
                      <div className="space-y-4">
                        <div className="flex h-16 items-center justify-center">
                          <div className="rounded-xl bg-surface-sunken p-3">
                            <Phone className="h-8 w-8 text-ink" />
                          </div>
                        </div>
                        <p className="text-center text-[13.5px] leading-relaxed text-ink-muted">
                          We&apos;ll text you a six-digit code.
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push('/auth?method=phone')}
                          className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-ink px-3 text-base font-medium text-canvas transition-all active:scale-95"
                        >
                          Continue with phone
                        </button>
                      </div>
                    </AnimatedTabsContent>
                  </AnimatedTabs>

                  {error ? (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl bg-danger-muted px-3.5 py-3 text-[13px] leading-relaxed text-danger"
                    >
                      {error}
                    </p>
                  ) : (
                    <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-subtle">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      New here? The same button signs you up.
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="signing-in"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-center py-8">
                    <div className="relative flex items-center justify-center overflow-hidden rounded-[22px] p-0.5">
                      <motion.div
                        className={cn(
                          'absolute left-[-50%] top-[-50%] h-[200%] w-[200%]',
                          'bg-[conic-gradient(from_0deg,transparent_0%,var(--brand)_10%,var(--brand)_25%,transparent_35%)]',
                        )}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.25, repeat: Infinity, ease: 'linear' }}
                      />
                      <div className="relative z-[1] flex items-center justify-center rounded-[20px] p-1">
                        <div className="flex items-center justify-center rounded-2xl bg-surface p-1">
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-sunken">
                            <KeyRound className="h-8 w-8 text-ink" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-[13.5px] text-ink-muted">
                    Waiting for Google…
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}

export default SignInDrawer;

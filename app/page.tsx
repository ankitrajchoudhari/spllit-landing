import Link from 'next/link';

import { LandingNav } from '@/components/landing/landing-nav';
import { Hero } from '@/components/landing/hero';
import { LiveBackdrop } from '@/components/landing/live-backdrop';
import { Features } from '@/components/landing/features';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import PhoneMockupBasic from '@/components/ui/phone-mockups-1';

/**
 * Landing page. Does not use AppShell — it has its own nav and a full-bleed
 * live map behind the hero.
 *
 * Layering: map (z-0) → white fade (z-1) → nav and hero (z-2). The fade spans
 * the whole viewport-height block rather than sitting inside the hero, so it
 * covers the nav too and both read cleanly over the map.
 */
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <section className="relative flex min-h-svh w-full flex-col overflow-hidden">
        <LiveBackdrop />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[687px]"
          style={{
            background:
              'linear-gradient(180deg, var(--canvas) 0%, color-mix(in srgb, var(--canvas) 55%, transparent) 58%, transparent 100%)',
          }}
        />

        <div className="relative z-[2] flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-[1360px]">
            <LandingNav />
          </div>
          <Hero />
        </div>
      </section>

      <main>
        <Features />

        {/* App showcase. Two columns from lg so the phones and the copy share
            the fold; stacked below that, with the copy first — a phone
            carousel above the sentence explaining it reads as decoration. */}
        <section className="border-t border-line bg-surface-sunken">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
            <div className="text-center lg:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                In your pocket
              </p>
              <h2 className="mt-4 font-sans text-[clamp(1.6rem,4vw,2.5rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
                Your campus, live on one map.
              </h2>
              <p className="mx-auto mt-4 max-w-md font-sans text-[16px] leading-relaxed text-ink-muted lg:mx-0">
                Rides, group rides and events from people who go where you go —
                verified by campus email, updated as they move.
              </p>
            </div>

            <div className="min-w-0">
              <PhoneMockupBasic />
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-12 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <h2 className="mx-auto max-w-2xl font-sans text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
              Everyone near you is already going somewhere.
            </h2>
            <p className="mx-auto mt-4 max-w-md font-sans text-[17px] leading-relaxed text-ink-muted">
              Join with your campus email and see the map light up.
            </p>
            <Link
              href="/auth"
              className="mt-9 inline-block rounded-full bg-ink px-7 py-4 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
            >
              Get started — it&apos;s free
            </Link>
          </div>
        </section>
      </main>

      <ParallaxFooter />
    </div>
  );
}

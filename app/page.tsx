import Image from 'next/image';
import Link from 'next/link';

import { LandingNav } from '@/components/landing/landing-nav';
import { Hero } from '@/components/landing/hero';
import { LiveBackdrop } from '@/components/landing/live-backdrop';
import { WhySpllit } from '@/components/landing/why-spllit';
import { Features } from '@/components/landing/features';
import { Backers } from '@/components/landing/backers';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { WhereWeAre } from '@/components/landing/where-we-are';
import { blurProps } from '@/lib/image-blur';

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
        {/* Straight out of the map fade: the case for the product, before the
            tour of it. */}
        <WhySpllit />

        <Features />

        {/* Where the product actually is. Replaces a generic "in your pocket"
            phone shot: this one says something only Spllit can say. */}
        <WhereWeAre />

        <Backers />

        {/* Closing call to action.

            The map texture is a callback to the live map the page opened on —
            the copy says "see the map light up", so the page ends on a ghost of
            the thing it started with. Multiply blend means only the streets and
            parks darken the canvas; it never lightens the section, which is what
            a plain opacity layer over near-white artwork would have done. */}
        <section className="relative overflow-hidden border-t border-line">
          <div aria-hidden className="pointer-events-none absolute inset-0 dark:hidden">
            <Image
              src="/product/map-texture.jpg"
              alt=""
              fill
              sizes="100vw"
              {...blurProps('/product/map-texture.jpg')}
              className="object-cover opacity-80 mix-blend-multiply"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, var(--canvas) 0%, transparent 28%, transparent 72%, var(--canvas) 100%)',
              }}
            />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 sm:gap-10 sm:px-6 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:px-8 lg:py-24">
            {/* Picture first on a phone so the section opens on a face rather
                than on another heading; alongside the copy from lg. */}
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <h2 className="mx-auto max-w-2xl font-sans text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-tight tracking-[-0.04em] text-ink lg:mx-0">
                Everyone near you is already going somewhere.
              </h2>
              <p className="mx-auto mt-4 max-w-md font-sans text-[17px] leading-relaxed text-ink-muted lg:mx-0">
                Join with your campus email and see the map light up.
              </p>
              <Link
                href="/auth"
                className="mt-8 inline-block rounded-full bg-ink px-7 py-4 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95 sm:mt-9"
              >
                Get started — it&apos;s free
              </Link>
            </div>

            <div className="order-1 lg:order-2">
              <Image
                src="/editorial/more-friends-lower-cost.png"
                alt="Three friends waving, above a speech bubble reading: more friends, lower cost"
                width={720}
                height={806}
                sizes="(min-width: 1024px) 420px, 62vw"
                {...blurProps('/editorial/more-friends-lower-cost.png')}
                className="mx-auto h-auto w-[62%] max-w-[420px] lg:w-full"
                /* The artwork is cropped through the hoodie, so an unmasked
                   edge reads as a photo with its bottom sliced off rather
                   than a cut-out. Dissolving the last stretch hides the cut. */
                style={{
                  maskImage: 'linear-gradient(to bottom, #000 84%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, #000 84%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </section>
      </main>

      <ParallaxFooter />
    </div>
  );
}

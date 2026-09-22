import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { NoOpenRoles, RoleBoard } from '@/components/careers/role-board';
import { blurProps } from '@/lib/image-blur';
import { careersService } from '@/lib/services/careers';
import { CAREERS_SUPPORT_EMAIL, roleStatus } from '@/content/careers';
import { SITE } from '@/content/site';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Spllit is early — two cities in testing and most of the product still unwritten. Open roles, and what it is actually like to join now.',
  alternates: { canonical: '/careers' },
  openGraph: {
    title: `Careers · ${SITE.name}`,
    description:
      'Two cities in testing, a small team, and most of the product still unwritten. See what is open.',
    url: `${SITE.url}/careers`,
  },
};

/**
 * Roles change without a deploy, so this page must not be baked at build time.
 *
 * Thirty seconds, not a day. A day was chosen to keep the backend quiet, but it
 * meant closing or removing a role in the console could take until tomorrow to
 * leave the site — which is exactly the thing somebody reaches for the console
 * to do quickly. The cost of the shorter window is bounded and small: with
 * incremental regeneration the backend is asked at most twice a minute no
 * matter how much traffic the page gets, because visitors are served the cached
 * copy while it refreshes behind them.
 */
export const revalidate = 30;

export default async function CareersPage() {
  const content = await careersService.content();

  /**
   * Drafts never leave the console, and neither does an open role with no apply
   * link — the button would point nowhere. The backend refuses to save that
   * combination, so this is a belt on top of the braces for anything stored
   * before that rule existed.
   */
  const roles = content.roles.filter(
    (role) => !role.draft && (roleStatus(role) === 'closed' || role.applyUrl.trim().length > 0),
  );
  const openCount = roles.filter((role) => roleStatus(role) !== 'closed').length;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        {/* Hero. The picture sits beside the sentence rather than above it, so
            the first screen on a phone is the headline and not an illustration
            somebody has to scroll past. */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-8 lg:py-20">
            <div>
              {/* Set large and low-contrast rather than small and brand-green.
                  At 11px it was a label; at this size and weight it reads as a
                  masthead for the page, and the faded ink keeps it underneath
                  the headline instead of competing with it. The step numbers
                  below use the same treatment so the two read as one family. */}
              <p className="text-[15px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[17px]">
                {content.eyebrow}
              </p>
              <h1 className="mt-4 font-sans text-[clamp(2.1rem,5.6vw,3.8rem)] font-medium leading-[1] tracking-[-0.045em] text-ink">
                {content.headline}
              </h1>
              <p className="mt-5 max-w-xl font-sans text-[16.5px] leading-relaxed text-ink-muted">
                {content.standfirst}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <a
                  href="#open-roles"
                  className="inline-flex min-h-[48px] items-center rounded-full bg-ink px-6 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
                >
                  {openCount > 0
                    ? `See ${openCount} open ${openCount === 1 ? 'role' : 'roles'}`
                    : 'See roles'}
                </a>
                <a
                  href={`mailto:${CAREERS_SUPPORT_EMAIL}`}
                  className="inline-flex min-h-[48px] items-center text-[14.5px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
                >
                  {CAREERS_SUPPORT_EMAIL}
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
              <Image
                src="/careers/writing-hand.png"
                alt="A hand writing notes on a pad beside a lightbulb"
                width={441}
                height={333}
                sizes="(min-width: 1024px) 480px, 80vw"
                priority
                {...blurProps('/careers/writing-hand.png')}
                className="h-auto w-full"
              />
              {/* The bulb tucked under the corner, so the two pictures read as
                  one arrangement rather than two stock images in a row. */}
              <Image
                src="/careers/idea-bulb.png"
                alt=""
                width={219}
                height={332}
                sizes="140px"
                {...blurProps('/careers/idea-bulb.png')}
                className="absolute -bottom-5 left-[2%] h-auto w-[26%] max-w-[128px] -rotate-6 drop-shadow-[0_12px_26px_rgba(16,24,20,0.16)]"
              />
            </div>
          </div>
        </section>

        {/* Why join this early */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div className="order-2 lg:order-1">
                <Image
                  src="/careers/desk-notes.png"
                  alt="An open notebook covered in pens, sticky notes and coffee"
                  width={356}
                  height={326}
                  sizes="(min-width: 1024px) 400px, 70vw"
                  {...blurProps('/careers/desk-notes.png')}
                  className="mx-auto h-auto w-[72%] max-w-[400px] lg:w-full"
                />
              </div>

              <div className="order-1 lg:order-2">
                <h2 className="font-sans text-[clamp(1.6rem,4vw,2.4rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
                  What joining now actually means.
                </h2>
                <ul className="mt-8 space-y-7">
                  {content.pitch.map((item, index) => (
                    <li key={item.title} className="flex gap-4 sm:gap-5">
                      <span
                        aria-hidden
                        className="mt-[-2px] w-[1.6em] shrink-0 font-display text-[26px] font-semibold tabular-nums leading-none tracking-[0.02em] text-ink-subtle sm:text-[30px]"
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-[16.5px] font-semibold tracking-[-0.01em] text-ink">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-ink-muted">
                          {item.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Open roles */}
        <section id="open-roles" className="scroll-mt-4 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <h2 className="font-sans text-[clamp(1.6rem,4vw,2.4rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
              Open roles
            </h2>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-muted">
              Every role below is one we are hiring for now. Closed roles stay
              listed so you know where an application went.
            </p>

            <div className="mt-8 sm:mt-10">
              {roles.length > 0 ? (
                <RoleBoard roles={roles} emptyState={content.emptyState} />
              ) : (
                <NoOpenRoles title={content.emptyState.title} body={content.emptyState.body} />
              )}
            </div>
          </div>
        </section>

        {/* Nothing fits */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
            <h2 className="mx-auto max-w-2xl font-sans text-[clamp(1.5rem,3.6vw,2.2rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
              Nothing here fits, but you still want in?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-ink-muted">
              Tell us what you would build and why it should be us. We read
              everything, and we have made roles for people before.
            </p>
            <a
              href={`mailto:${CAREERS_SUPPORT_EMAIL}?subject=${encodeURIComponent('Working at Spllit')}`}
              className="mt-7 inline-flex min-h-[48px] items-center rounded-full bg-ink px-7 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
            >
              {CAREERS_SUPPORT_EMAIL}
            </a>
            <p className="mt-5 text-[13px] text-ink-subtle">
              Or go back to{' '}
              <Link
                href="/"
                className="font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                the map
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <ParallaxFooter />
    </div>
  );
}

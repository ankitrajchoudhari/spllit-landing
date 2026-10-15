import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { RouteTimeline } from '@/components/about/route-timeline';
import { TeamCard } from '@/components/about/team-card';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { ALUMNI, COMPANY, MILESTONES, TEAM } from '@/content/about';
import { SITE, SOCIALS } from '@/content/site';
import { blurProps } from '@/lib/image-blur';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'About Spllit — the people and the route so far',
  description:
    'Why Spllit exists, who is building it, and every stop from an idea at IIT Madras to live testing in Chennai and Jaipur.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Spllit — the people and the route so far',
    description:
      'Students travelling the same way rarely find each other. Who is building the fix, and how far it has come.',
    url: `${SITE.url}/about`,
  },
};

/** Section eyebrow, in the masthead treatment the careers page uses. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[14px]">
      {children}
    </p>
  );
}

const NOT = [
  'We are not a transport provider. We do not employ drivers, own vehicles or operate journeys.',
  'We do not vet drivers, inspect vehicles, verify licences or check insurance. We verify that an account holds a working institute email — nothing more.',
  'We do not process payments or take a commission. Money moves directly between the people travelling.',
  'We are not open to the general public. Without a verified campus address you cannot create or join anything.',
];

export default function AboutPage() {
  // Only the fields that hold a value; an empty one is unknown, not pending.
  const record: { label: string; value: string; verify?: string }[] = [
    { label: 'Registered name', value: COMPANY.legalName },
    {
      label: 'Udyam (MSME) number',
      value: COMPANY.udyam,
      // The government's own register (its Verify Udyam page needs a session and
      // bounces a cold link to the home page, so link the home page).
      verify: 'https://udyamregistration.gov.in/',
    },
    { label: 'Founded', value: COMPANY.founded },
    { label: 'Based in', value: COMPANY.registeredCity },
    { label: 'Incubated by', value: COMPANY.incubator },
    { label: 'Grievance officer', value: COMPANY.grievanceOfficer },
  ].filter((row) => row.value);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        {/* Hero. A sentence and the facts underneath it — no illustration. The
            page is the one a reviewer opens to check the company is real, so
            the first screen answers who, where and since when. */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-20">
            <Eyebrow>About Spllit</Eyebrow>
            <h1 className="mt-5 max-w-[17ch] font-sans text-[clamp(2.3rem,6.4vw,4.6rem)] font-medium leading-[0.98] tracking-[-0.05em] text-ink">
              Nobody should pay for a whole cab on a road they are sharing.
            </h1>
            <p className="mt-6 max-w-[58ch] text-[16.5px] leading-relaxed text-ink-muted sm:text-[17.5px]">
              Spllit is a campus travel network for Indian students. It finds the people already
              going your way, agrees where to meet, and settles the share before anyone sets off.
            </p>

            <dl className="mt-10 grid grid-cols-2 border-t border-line sm:mt-14 sm:grid-cols-4">
              {[
                { term: 'Founded', detail: COMPANY.founded },
                { term: 'Based in', detail: 'Chennai' },
                { term: 'Live in', detail: 'Chennai · Jaipur' },
                { term: 'Incubated at', detail: 'VELS' },
              ].map(({ term, detail }, index) => (
                <div
                  key={term}
                  className={cn(
                    'border-line py-5 pr-4',
                    index % 2 === 1 && 'border-l pl-4 sm:pl-6',
                    index >= 2 && 'border-t sm:border-t-0',
                    index === 2 && 'sm:border-l sm:pl-6',
                  )}
                >
                  <dt className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-subtle">
                    {term}
                  </dt>
                  <dd className="mt-1.5 font-sans text-[18px] font-medium tracking-[-0.02em] text-ink sm:text-[20px]">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Why. Prose beside a picture, because this is the one part of the
            page that is an argument rather than a record. */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <Eyebrow>Why it exists</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(1.8rem,4.2vw,2.8rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                The ride was never the hard part. Finding each other was.
              </h2>
              <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-ink-muted">
                <p>
                  Every morning, students leave the same campus for the same places — the same exam
                  centre, the same airport terminal, the same station — in separate autos, each
                  paying full fare. Not because they want to, but because finding each other is
                  harder than paying the extra ₹300.
                </p>
                <p>
                  Spllit is the coordination layer for that. We are not a taxi company and we do not
                  own a single vehicle. We built the part that was actually broken: knowing who is
                  going your way, agreeing where to meet, and knowing the share before you leave.
                </p>
              </div>
            </div>
            <Image
              src="/editorial/auto-full-of-friends.png"
              alt="An auto-rickshaw packed with friends heading the same way"
              width={1040}
              height={904}
              sizes="(min-width: 1024px) 420px, 70vw"
              {...blurProps('/editorial/auto-full-of-friends.png')}
              className="mx-auto h-auto w-[72%] max-w-[420px] lg:w-full"
            />
          </div>
        </section>

        {/* The route so far. Heading pinned beside the line on wide screens so
            the reader always knows what they are scrolling through. */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 sm:py-18 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8 lg:py-24">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Eyebrow>The route so far</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(1.8rem,4.2vw,2.8rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                Every stop, and where it was announced.
              </h2>
              <p className="mt-5 max-w-[42ch] text-[15.5px] leading-relaxed text-ink-muted">
                Solid is done. Dashed is next. Each linked stop opens the post or page where it was
                made public, so none of it has to be taken on trust.
              </p>
            </div>
            <RouteTimeline stops={MILESTONES} />
          </div>
        </section>

        {/* The product, live. Real screens from the app, and a way in. */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
              <div>
                <Eyebrow>The product</Eyebrow>
                <h2 className="mt-4 font-sans text-[clamp(1.8rem,4.2vw,2.8rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                  Live, and in use on two campuses.
                </h2>
                <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed text-ink-muted">
                  These are screens from the app as it runs today: picking a group size and how to
                  travel, the safety checks before a group ride goes up, and the group chat once it
                  fills. Anyone with a working institute email can sign in and use it.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Link
                    href="/auth"
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
                  >
                    Open the app
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/legal/safety"
                    className="inline-flex min-h-[48px] items-center text-[14.5px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
                  >
                    How we keep it safe
                  </Link>
                </div>
              </div>

              {/* One screen at a time on a phone, where three side by side
                  would be too small to read; all three in a row from sm. */}
              <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:items-end sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
                <PhoneFrame
                  src="/product/squad-size.jpg"
                  alt="Choosing a group of four people and whether to travel by cab, auto or bike"
                  sizes="(min-width: 640px) 200px, 62vw"
                  className="w-[62%] shrink-0 snap-center sm:w-1/3 sm:max-w-[200px] sm:shrink sm:translate-y-4"
                />
                <PhoneFrame
                  src="/product/squad-ready.jpg"
                  alt="The last step before creating a group ride: destination, group size and the safety checks"
                  width={732}
                  height={1571}
                  sizes="(min-width: 640px) 200px, 62vw"
                  className="w-[62%] shrink-0 snap-center sm:w-1/3 sm:max-w-[200px] sm:shrink sm:-translate-y-3"
                />
                <PhoneFrame
                  src="/product/squad-chat.png"
                  alt="The chat inside a group ride once people have joined"
                  width={300}
                  height={633}
                  sizes="(min-width: 640px) 200px, 62vw"
                  className="w-[62%] shrink-0 snap-center sm:w-1/3 sm:max-w-[200px] sm:shrink sm:translate-y-4"
                />
              </div>
            </div>
          </div>
        </section>

        {/* The people. */}
        <section id="team" className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <Eyebrow>The team</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(1.8rem,4.2vw,2.8rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                Who is building it.
              </h2>
              {/* Only claimed once it is true of every card below. */}
              {TEAM.every((member) => member.links.length > 0) && (
                <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
                  A small team, and every name here links to a profile you can check.
                </p>
              )}
            </div>
            <ul
              className={cn(
                'mt-10 grid gap-4 sm:mt-12 sm:gap-5',
                TEAM.length > 1 && 'sm:grid-cols-2 lg:grid-cols-3',
                TEAM.length === 1 && 'max-w-xl',
              )}
            >
              {TEAM.map((member) => (
                <li key={member.name}>
                  <TeamCard member={member} />
                </li>
              ))}
            </ul>

            {ALUMNI.length > 0 && (
              <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-line pt-6">
                <p className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-subtle">
                  Previously
                </p>
                {ALUMNI.map((person) => (
                  <p key={person.name} className="text-[15px] text-ink-muted">
                    {person.links[0] ? (
                      <a
                        href={person.links[0].href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4"
                      >
                        {person.name}
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-ink-subtle" />
                      </a>
                    ) : (
                      <span className="font-medium text-ink">{person.name}</span>
                    )}
                    , {person.role.toLowerCase()}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* The company on paper, and what it deliberately is not. Side by side
            because both are the same kind of thing: what you can hold us to. */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-6 sm:py-18 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <Eyebrow>The company</Eyebrow>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {record.map(({ label, value, verify }) => (
                  <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                    <dt className="text-[13.5px] text-ink-subtle">{label}</dt>
                    <dd className="text-[15px] font-medium text-ink">
                      <span className={verify && 'font-mono text-[14px] tracking-[0.02em]'}>
                        {value}
                      </span>
                      {verify && (
                        <a
                          href={verify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 inline-flex items-center gap-1 text-[13.5px] font-normal text-ink-muted underline underline-offset-4 hover:text-ink"
                        >
                          Verify
                          <ArrowUpRight aria-hidden className="h-3 w-3" />
                        </a>
                      )}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                  <dt className="text-[13.5px] text-ink-subtle">Contact</dt>
                  <dd className="text-[15px] font-medium text-ink">
                    <a href={`mailto:${SITE.email}`} className="underline underline-offset-4">
                      {SITE.email}
                    </a>
                  </dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                  <dt className="text-[13.5px] text-ink-subtle">Elsewhere</dt>
                  <dd className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium text-ink">
                    {SOCIALS.map(({ label, href }) => (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className="inline-flex items-center gap-1 underline underline-offset-4"
                      >
                        {label}
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-ink-subtle" />
                      </a>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <Eyebrow>What it is not</Eyebrow>
              <p className="mt-6 text-[15.5px] leading-relaxed text-ink-muted">
                Being straight about the limits is part of being safe to use.
              </p>
              <ul className="mt-5 space-y-4">
                {NOT.map((line) => (
                  <li key={line} className="flex gap-3.5">
                    <span aria-hidden className="mt-[10px] h-px w-3 shrink-0 bg-ink-subtle" />
                    <span className="text-[15px] leading-relaxed text-ink-muted">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-5 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
            <h2 className="mx-auto max-w-2xl font-sans text-[clamp(1.75rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.04em] text-ink">
              Everyone near you is already going somewhere.
            </h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link
                href="/auth"
                className="inline-flex min-h-[48px] items-center rounded-full bg-ink px-7 text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
              >
                Join with your campus email
              </Link>
              <Link
                href="/careers"
                className="inline-flex min-h-[48px] items-center text-[14.5px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
              >
                Work with us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <ParallaxFooter />
    </div>
  );
}

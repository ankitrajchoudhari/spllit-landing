import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BadgeCheck, Mail } from 'lucide-react';

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

/**
 * The illustrations each arrive on a flat ground of their own. Panels are
 * filled with exactly that colour, so a picture has no visible edge and reads
 * as printed onto the section rather than placed on it.
 */
const GROUND = {
  signal: '#d5d5d5',
  fees: '#228cca',
  people: '#f2f2f2',
} as const;

/** Section eyebrow, in the masthead treatment the careers page uses. */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[12.5px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[13.5px]',
        className,
      )}
    >
      {children}
    </p>
  );
}

const NOT = [
  {
    title: 'Not a transport provider',
    body: 'We do not employ drivers, own vehicles or operate journeys.',
  },
  {
    title: 'Not a background check',
    body: 'We verify that an account holds a working institute email. We do not vet drivers, inspect vehicles, or check licences or insurance.',
  },
  {
    title: 'Not in the money',
    body: 'We do not process payments or take a commission. Money moves directly between the people travelling.',
  },
  {
    title: 'Not open to everyone',
    body: 'Without a verified campus address you cannot create or join anything. A smaller pool, on purpose.',
  },
];

export default function AboutPage() {
  const [founder, ...crew] = TEAM;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-[1360px]">
        <LandingNav />
      </div>

      <main>
        {/* ─── Hero ───────────────────────────────────────────────────── */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:px-8 lg:pb-24 lg:pt-16">
            <div>
              <Eyebrow>About Spllit</Eyebrow>
              <h1 className="mt-5 font-sans text-[clamp(2.5rem,6.6vw,5rem)] font-medium leading-[0.96] tracking-[-0.055em] text-ink">
                Nobody should pay for a whole cab on a road they are{' '}
                <span className="text-brand">sharing.</span>
              </h1>
              <p className="mt-6 max-w-[50ch] text-[16.5px] leading-relaxed text-ink-muted sm:text-[18px]">
                Spllit is a campus travel network for Indian students. It finds the people already
                going your way, agrees where to meet, and settles the share before anyone sets off.
              </p>
            </div>

            {/* The signal: the moment everyone is stopped at the same light,
                going the same way, in separate cars. */}
            <div
              className="relative overflow-hidden rounded-[32px]"
              style={{ background: GROUND.signal }}
            >
              <Image
                src="/about/signal.jpg"
                alt="A traffic light against a plain grey sky, showing red"
                width={736}
                height={902}
                priority
                sizes="(min-width: 1024px) 440px, 100vw"
                {...blurProps('/about/signal.jpg')}
                className="h-[300px] w-full object-cover object-[50%_80%] sm:h-[380px] lg:h-[520px] lg:object-[50%_70%]"
              />
            </div>
          </div>

          {/* The facts, as a ruled strip across the full width. */}
          <div className="border-y border-line">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 px-5 sm:px-6 lg:grid-cols-4 lg:px-8">
              {[
                { term: 'Operating since', detail: COMPANY.operatingSince },
                { term: 'Based in', detail: 'Chennai' },
                { term: 'Live in', detail: 'Chennai · Jaipur' },
                { term: 'Registered', detail: 'MSME · Udyam' },
              ].map(({ term, detail }, index) => (
                <div
                  key={term}
                  className={cn(
                    'py-6 sm:py-7',
                    index % 2 === 1 && 'border-l border-line pl-5 sm:pl-7',
                    index >= 2 && 'border-t border-line lg:border-t-0',
                    index === 2 && 'lg:border-l lg:pl-7',
                  )}
                >
                  <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                    {term}
                  </dt>
                  <dd className="mt-2 font-sans text-[19px] font-medium tracking-[-0.025em] text-ink sm:text-[23px]">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ─── Why: a full-bleed blue band, the illustration printed on it ─ */}
        <section style={{ background: GROUND.fees }} className="text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-14 sm:px-6 sm:py-18 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:px-8 lg:py-20">
            <Image
              src="/about/fees.jpg"
              alt="A man reading a long receipt unspooling from a red car built like a calculator, its display reading FEES"
              width={735}
              height={736}
              sizes="(min-width: 1024px) 500px, 90vw"
              {...blurProps('/about/fees.jpg')}
              className="order-2 mx-auto h-auto w-full max-w-[460px] lg:order-1"
            />
            <div className="order-1 lg:order-2">
              <Eyebrow className="text-white/75">Why it exists</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em]">
                The ride was never the hard part. Finding each other was.
              </h2>
              <div className="mt-6 space-y-4 text-[16.5px] leading-relaxed text-white/85">
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
          </div>
        </section>

        {/* ─── The route so far ─────────────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8 lg:py-28">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Eyebrow>The route so far</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink">
                Looking back, to see where we are going.
              </h2>
              <p className="mt-5 max-w-[40ch] text-[15.5px] leading-relaxed text-ink-muted">
                Solid is done, dashed is next. Each linked stop opens the post or page where it was
                made public.
              </p>
              <Image
                src="/about/mirror.jpg"
                alt="A driver adjusting the rear-view mirror, a passenger reflected in it holding up a toy car"
                width={560}
                height={560}
                sizes="(min-width: 1024px) 380px, 90vw"
                {...blurProps('/about/mirror.jpg')}
                className="mt-9 h-56 w-full rounded-[28px] object-cover object-[50%_40%] sm:h-72 lg:h-auto lg:max-w-[380px]"
              />
            </div>
            <RouteTimeline stops={MILESTONES} />
          </div>
        </section>

        {/* ─── The team ─────────────────────────────────────────────────── */}
        <section id="team" className="border-b border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
              <div>
                <Eyebrow>The team</Eyebrow>
                <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink">
                  Who is building it.
                </h2>
                <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-muted">
                  A small team, all facing the same direction.
                  {/* Only claimed once it is true of every card below. */}
                  {TEAM.every((member) => member.links.length > 0) &&
                    ' Every profile below links out, so each of us can be checked rather than taken on trust.'}
                </p>
              </div>
              {/* The heads illustration cropped to exactly its top two bands
                  (470 of its 1200px) — enough to say "people, all facing one
                  way" without slicing through the third head. */}
              <div
                className="relative aspect-[675/470] overflow-hidden rounded-[28px]"
                style={{ background: GROUND.people }}
              >
                <Image
                  src="/about/people.jpg"
                  alt="Five people in profile on stacked green bands, all facing the same way"
                  fill
                  sizes="(min-width: 1024px) 420px, 100vw"
                  {...blurProps('/about/people.jpg')}
                  className="object-cover object-top"
                />
              </div>
            </div>

            <div className="mt-10 grid gap-5 sm:mt-14 sm:grid-cols-2">
              {founder && (
                <div className="sm:col-span-2">
                  <TeamCard member={founder} featured />
                </div>
              )}
              {crew.map((member) => (
                <TeamCard key={member.name} member={member} />
              ))}
            </div>

            {ALUMNI.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-full border border-line bg-surface px-5 py-3 sm:w-fit">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                  Previously
                </span>
                {ALUMNI.map((person) => (
                  <span key={person.name} className="text-[14.5px] text-ink-muted">
                    {person.links[0] ? (
                      <a
                        href={person.links[0].href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                      >
                        {person.name}
                        <ArrowUpRight aria-hidden className="h-3.5 w-3.5 text-ink-subtle" />
                      </a>
                    ) : (
                      <span className="font-medium text-ink">{person.name}</span>
                    )}{' '}
                    · {person.role}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── The product, live: a dark band so the screen is the light ─── */}
        <section className="overflow-hidden bg-[#0f1512] text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <Eyebrow className="text-white/55">The product</Eyebrow>
              <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em]">
                Live, and in use on two campuses.
              </h2>
              <p className="mt-5 max-w-[48ch] text-[16.5px] leading-relaxed text-white/75">
                Not a waitlist. Anyone with a working institute email can sign in today, post a
                ride, form a group ride and talk to the people in it.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  'Rides with spare seats',
                  'Group rides to one place',
                  'One live map with every ETA',
                  'The share agreed upfront',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-[15px] text-white/90"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth"
                className="mt-9 inline-flex min-h-[50px] items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-[#0f1512] transition-all duration-snap hover:opacity-90 active:scale-95"
              >
                Open the app
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative mx-auto w-full max-w-[280px]">
              {/* A soft brand glow behind the device, so it lifts off the band. */}
              <div
                aria-hidden
                className="absolute inset-x-[-30%] top-[15%] h-[70%] rounded-full opacity-40 blur-3xl"
                style={{ background: 'var(--brand)' }}
              />
              <PhoneFrame
                src="/product/squad-chat.png"
                alt="The chat inside a group ride once people have joined"
                width={300}
                height={633}
                sizes="280px"
                className="relative"
              />
            </div>
          </div>
        </section>

        {/* ─── The company on record ──────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <Eyebrow>On record</Eyebrow>
            <h2 className="mt-4 max-w-[20ch] font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink">
              A registered business, and the people to reach.
            </h2>

            <div className="mt-10 grid gap-5 sm:mt-14 lg:grid-cols-[1.35fr_0.65fr]">
              {/* The registration, laid out like a pass: who, then a tear
                  line, then the number and the dates. */}
              <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface shadow-raised">
                <div className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                      Registered enterprise
                    </p>
                    <p className="mt-2 font-display text-[40px] font-semibold leading-none tracking-[-0.04em] text-ink sm:text-[48px]">
                      {COMPANY.name}
                    </p>
                    <p className="mt-3 text-[14.5px] text-ink-muted">
                      {COMPANY.classification} · {COMPANY.sector}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-muted px-3.5 py-1.5 text-[12.5px] font-semibold text-brand">
                    <BadgeCheck aria-hidden className="h-4 w-4" />
                    MSME registered
                  </span>
                </div>

                {/* Tear line, with the notches cut out of both edges. */}
                <div aria-hidden className="relative h-px">
                  <span className="absolute inset-x-8 top-0 border-t-2 border-dashed border-line" />
                  <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-line bg-canvas" />
                  <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-line bg-canvas" />
                </div>

                <div className="p-6 sm:p-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                    Udyam registration number
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                    <p className="break-all font-mono text-[clamp(1.25rem,3.6vw,1.9rem)] font-medium tracking-[0.04em] text-ink">
                      {COMPANY.udyam}
                    </p>
                    <a
                      href={COMPANY.register}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13.5px] font-medium text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
                    >
                      Check it on udyamregistration.gov.in
                      <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-4">
                    {[
                      { term: 'Operating since', detail: COMPANY.operatingSince },
                      { term: 'Udyam since', detail: COMPANY.udyamSince },
                      { term: 'Based in', detail: COMPANY.city },
                      { term: 'Incubated by', detail: COMPANY.incubator },
                    ].map(({ term, detail }) => (
                      <div key={term}>
                        <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
                          {term}
                        </dt>
                        <dd className="mt-1.5 text-[15px] font-medium leading-snug text-ink">
                          {detail}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Who to reach. */}
              <div className="flex flex-col rounded-[28px] border border-line bg-surface p-6 shadow-soft sm:p-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                  Reach us
                </p>
                <a
                  href={`mailto:${SITE.email}`}
                  className="mt-4 inline-flex items-center gap-2.5 break-all text-[17px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  <Mail aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" />
                  {SITE.email}
                </a>
                <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
                  Grievance officer
                </p>
                <p className="mt-2 text-[16px] font-medium text-ink">{COMPANY.grievanceOfficer}</p>

                <ul className="mt-auto space-y-1 pt-8">
                  {SOCIALS.map(({ label, href, handle }) => (
                    <li key={href}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between border-t border-line py-3.5 text-[15px] text-ink"
                      >
                        <span>
                          <span className="font-medium">{label}</span>
                          <span className="ml-2 text-ink-subtle">{handle}</span>
                        </span>
                        <ArrowUpRight
                          aria-hidden
                          className="h-4 w-4 text-ink-subtle transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── What it is not ─────────────────────────────────────────── */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <div>
                <Eyebrow>What it is not</Eyebrow>
                <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink">
                  The limits, said plainly.
                </h2>
                <p className="mt-5 max-w-[36ch] text-[15.5px] leading-relaxed text-ink-muted">
                  Being straight about what Spllit does not do is part of being safe to use.
                </p>
              </div>
              <ol className="grid gap-x-10 sm:grid-cols-2">
                {NOT.map(({ title, body }, index) => (
                  <li key={title} className="border-t border-line-strong py-6">
                    <span className="font-mono text-[12px] text-ink-subtle">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-3 font-sans text-[19px] font-medium tracking-[-0.02em] text-ink">
                      {title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ─── Close ──────────────────────────────────────────────────── */}
        <section>
          <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
            <h2 className="mx-auto max-w-[18ch] font-sans text-[clamp(2.1rem,5vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.05em] text-ink">
              Everyone near you is already going somewhere.
            </h2>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link
                href="/auth"
                className="inline-flex min-h-[52px] items-center rounded-full bg-ink px-8 text-[15px] font-medium uppercase tracking-[0.04em] text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
              >
                Join with your campus email
              </Link>
              <Link
                href="/careers"
                className="inline-flex min-h-[48px] items-center gap-1 text-[15px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
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

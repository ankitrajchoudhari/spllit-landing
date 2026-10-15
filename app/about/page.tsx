import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Mail } from 'lucide-react';

import { LandingNav } from '@/components/landing/landing-nav';
import { ParallaxFooter } from '@/components/landing/parallax-footer';
import { BRAND_LOGOS } from '@/components/about/brand-icons';
import { Limits } from '@/components/about/limits';
import { RouteTimeline } from '@/components/about/route-timeline';
import { TeamCard } from '@/components/about/team-card';
import { PhoneFrame } from '@/components/ui/phone-frame';
import { ALUMNI, COMPANY, CONTACTS, LIMITS, MILESTONES, TEAM } from '@/content/about';
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

/** Brushed-silver ink for type on the black pass. */
const SILVER: React.CSSProperties = {
  backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #d9d9d9 45%, #8f8f8f 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/**
 * The Udyam registration, set as a black pass with silver type.
 *
 * Monochrome on purpose: it is the one object on the page that is a document
 * rather than a story, and a document should look issued, not illustrated.
 * Fine concentric rules behind it stand in for the guilloché on printed
 * certificates; the seal's ring text is set on a path the same way the Spllit
 * Trip ticket sets its own. The notches are cut in the section's colour, which
 * is the page canvas.
 */
function RegistrationPass() {
  const ring = 'SPLLIT · MSME · UDYAM REGISTERED · ';
  const microprint = `SPLLIT · ${COMPANY.udyam} · ${COMPANY.classification.toUpperCase()} · CHENNAI · `;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-[#0b0b0c] text-white shadow-float ring-1 ring-black/5 dark:ring-white/10">
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute -right-28 -top-28 h-[440px] w-[440px] opacity-[0.09]"
      >
        {Array.from({ length: 22 }, (_, i) => (
          <circle
            key={i}
            cx="200"
            cy="200"
            r={18 + i * 8.5}
            fill="none"
            stroke="#fff"
            strokeWidth="0.7"
          />
        ))}
      </svg>

      <div className="relative flex items-start justify-between gap-6 p-6 sm:p-9">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
            Registered enterprise
          </p>
          <p
            className="mt-3 font-display text-[48px] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-[64px]"
            style={SILVER}
          >
            {COMPANY.name}
          </p>
          <p className="mt-4 text-[14px] text-white/55">
            {COMPANY.classification} <span className="text-white/25">/</span> {COMPANY.sector}
          </p>
        </div>

        {/* The seal. */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden
          className="h-[84px] w-[84px] shrink-0 sm:h-[104px] sm:w-[104px]"
        >
          <defs>
            <path id="udyam-seal-ring" d="M50 50 m-37 0 a37 37 0 1 1 74 0 a37 37 0 1 1 -74 0" />
          </defs>
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
          />
          <circle
            cx="50"
            cy="50"
            r="27"
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
          />
          <text
            fill="rgba(255,255,255,0.7)"
            fontSize="7.4"
            letterSpacing="1.9"
            fontFamily="var(--font-mono), monospace"
          >
            <textPath href="#udyam-seal-ring" textLength="228" lengthAdjust="spacing">
              {ring + ring}
            </textPath>
          </text>
          <path
            d="M40 50.5l6.5 6.5L61 42.5"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Tear line, notched out of both edges. */}
      <div aria-hidden className="relative h-px">
        <span className="absolute inset-x-8 top-0 border-t border-dashed border-white/20" />
        <span className="absolute -left-3.5 -top-3.5 h-7 w-7 rounded-full bg-canvas" />
        <span className="absolute -right-3.5 -top-3.5 h-7 w-7 rounded-full bg-canvas" />
      </div>

      <div className="relative p-6 sm:p-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/45">
          Udyam registration number
        </p>
        <p
          className="mt-3 break-all font-mono text-[clamp(1.35rem,4.2vw,2.4rem)] font-medium leading-tight tracking-[0.06em]"
          style={SILVER}
        >
          {COMPANY.udyam}
        </p>
        <a
          href={COMPANY.register}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-white/60 underline decoration-white/25 underline-offset-4 transition-colors duration-snap hover:text-white hover:decoration-white"
        >
          Check it on udyamregistration.gov.in
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </a>

        <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-7 sm:grid-cols-4">
          {[
            { term: 'Operating since', detail: COMPANY.operatingSince },
            { term: 'Udyam since', detail: COMPANY.udyamSince },
            { term: 'Based in', detail: COMPANY.city },
            { term: 'Incubated by', detail: COMPANY.incubator },
          ].map(({ term, detail }) => (
            <div key={term}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {term}
              </dt>
              <dd className="mt-2 text-[15px] font-medium leading-snug text-white/90">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Microprint along the foot, as on anything printed to be checked. */}
      <div
        aria-hidden
        className="relative overflow-hidden whitespace-nowrap border-t border-white/10 py-2.5 font-mono text-[9px] tracking-[0.32em] text-white/25"
      >
        {microprint.repeat(4)}
      </div>
    </div>
  );
}

/** Who to write to, the grievance officer, and the official profiles. */
function ReachUs() {
  return (
    <div className="flex flex-col rounded-[28px] border border-line bg-surface p-6 shadow-soft sm:p-8">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-subtle">
        Reach us
      </p>

      <ul className="mt-2">
        {CONTACTS.map(({ label, detail, email }) => (
          <li key={email} className="border-b border-line py-4">
            <p className="text-[13px] font-medium text-ink">{label}</p>
            <p className="text-[12.5px] text-ink-subtle">{detail}</p>
            <a
              href={`mailto:${email}`}
              className="mt-2 inline-flex items-center gap-2 break-all text-[16px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              <Mail aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" />
              {email}
            </a>
          </li>
        ))}
        <li className="py-4">
          <p className="text-[13px] font-medium text-ink">Grievance officer</p>
          <p className="text-[12.5px] text-ink-subtle">Complaints under the IT Rules, 2021</p>
          <p className="mt-2 text-[16px] font-medium text-ink">{COMPANY.grievanceOfficer}</p>
        </li>
      </ul>

      <div className="mt-auto grid gap-2.5 pt-4">
        {SOCIALS.map(({ label, href, handle }) => {
          const Logo = BRAND_LOGOS[label];
          return (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3 transition-colors duration-snap hover:border-line-strong hover:bg-surface-sunken"
            >
              <Logo className="h-8 w-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-medium text-ink">{label}</span>
                <span className="block truncate text-[12.5px] text-ink-subtle">{handle}</span>
              </span>
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 text-ink-subtle transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}

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
              <div className="mt-14 sm:mt-16">
                <div className="flex items-center gap-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
                    Alumni
                  </p>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </div>
                <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
                  People who helped build Spllit and have since moved on.
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {ALUMNI.map((person) => (
                    <TeamCard key={person.name} member={person} alumni />
                  ))}
                </div>
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

            <div className="mt-10 grid gap-5 sm:mt-14 lg:grid-cols-[1.4fr_0.6fr]">
              <RegistrationPass />
              <ReachUs />
            </div>
          </div>
        </section>

        {/* ─── What it is not ─────────────────────────────────────────── */}
        <section className="border-b border-line bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
            <div className="grid items-end gap-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <Eyebrow>What it is not</Eyebrow>
                <h2 className="mt-4 font-sans text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink">
                  The limits, said plainly.
                </h2>
              </div>
              <p className="max-w-[44ch] text-[16px] leading-relaxed text-ink-muted lg:justify-self-end">
                Being straight about what Spllit does not do is part of being safe to use. Here is
                what people assume, crossed out, and what is true instead.
              </p>
            </div>
            <div className="mt-10 sm:mt-14">
              <Limits items={LIMITS} />
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

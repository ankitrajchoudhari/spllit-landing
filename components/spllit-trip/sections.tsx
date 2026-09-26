import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { SITE } from '@/content/site';
import { DestinationPreview } from '@/components/spllit-trip/destination-preview';
import { Rail } from '@/components/spllit-trip/rail';
import { ReelToTrip } from '@/components/spllit-trip/reel-to-trip';
import { Barcode, Button, Print, Stamp, Ticket } from '@/components/spllit-trip/ticket';

/**
 * Spllit Trip — the case for the product, as a travel scrapbook.
 *
 * Paper, taped photos, handwriting, and a ticket wherever there is a fare.
 * Tickets are reserved for prices so they keep meaning something.
 *
 * Spllit Trip is in early access, so every priced ticket carries "Sample" in
 * its fine print. The rest of the site shows real counters or nothing; this
 * page must not look live.
 */

const PARTNER_MAIL = `mailto:${SITE.email}?subject=${encodeURIComponent('Spllit Trip — partnering')}`;

/* ─── Type ──────────────────────────────────────────────────────────────── */

/**
 * Stickers, cut out with a white die-cut edge (public/trip/stickers). Each is
 * slapped next to a section's number at its own angle, and peels up a little
 * on hover. Decorative only — hidden from screen readers.
 */
const STICKERS = {
  van: {
    src: '/trip/stickers/van.png',
    w: 459,
    h: 322,
    size: 'w-[104px] sm:w-[132px] lg:w-[164px]',
    tilt: '-rotate-6',
  },
  campfire: {
    src: '/trip/stickers/campfire.png',
    w: 392,
    h: 520,
    size: 'w-[70px] sm:w-[86px] lg:w-[104px]',
    tilt: 'rotate-[7deg]',
  },
  luggage: {
    src: '/trip/stickers/luggage.png',
    w: 261,
    h: 520,
    size: 'w-[58px] sm:w-[70px] lg:w-[84px]',
    tilt: 'rotate-[9deg]',
  },
  coconut: {
    src: '/trip/stickers/coconut.png',
    w: 393,
    h: 437,
    size: 'w-[76px] sm:w-[92px] lg:w-[112px]',
    tilt: '-rotate-[10deg]',
  },
  suitcase: {
    src: '/trip/stickers/suitcase.png',
    w: 520,
    h: 425,
    size: 'w-[96px] sm:w-[118px] lg:w-[144px]',
    tilt: 'rotate-[6deg]',
  },
  orangeCase: {
    src: '/trip/stickers/orange-case.png',
    w: 331,
    h: 520,
    size: 'w-[66px] sm:w-[80px] lg:w-[96px]',
    tilt: '-rotate-[7deg]',
  },
} as const;

type StickerName = keyof typeof STICKERS;

function Sticker({ name }: { name: StickerName }) {
  const s = STICKERS[name];
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -bottom-3 right-0 block origin-bottom-left transition-transform duration-sheet ease-out',
        'hover:rotate-0 hover:-translate-y-1 hover:scale-[1.06] motion-reduce:transition-none',
        '[filter:drop-shadow(0_1px_1px_rgba(30,28,24,0.14))_drop-shadow(0_10px_16px_rgba(30,28,24,0.2))]',
        s.size,
        s.tilt,
      )}
    >
      <Image
        src={s.src}
        alt=""
        width={s.w}
        height={s.h}
        sizes="170px"
        className="h-auto w-full select-none"
      />
    </span>
  );
}

/**
 * Section opener: a big, faded running number with the section's name beside
 * it — the way a travel journal numbers its chapters — and, where there is
 * one, a sticker slapped on the far end of the line. The label keeps clear of
 * the sticker by padding, so it wraps rather than running underneath.
 */
function SectionHead({
  n,
  label,
  light,
  sticker,
}: {
  n: string;
  label: string;
  light?: boolean;
  sticker?: StickerName;
}) {
  return (
    <div className="relative flex items-end gap-4 sm:gap-5">
      <span
        aria-hidden
        className={cn(
          'font-serif text-[clamp(4.5rem,9vw,7.5rem)] leading-[0.72] tracking-[-0.03em]',
          light ? 'text-white/15' : 'text-trip-rule',
        )}
      >
        {n}
      </span>
      <p
        className={cn(
          'pb-0.5 text-[17px] font-medium tracking-[-0.01em] sm:text-[19px]',
          light ? 'text-white/70' : 'text-ink-muted',
          sticker && 'pr-[112px] sm:pr-[140px] lg:pr-[176px]',
        )}
      >
        {label}
      </p>
      {sticker ? <Sticker name={sticker} /> : null}
    </div>
  );
}

const H2 =
  'mt-7 text-balance font-serif text-[clamp(2.5rem,5.6vw,4.4rem)] font-normal leading-[0.98] tracking-[-0.015em]';

const LEAD = 'mt-6 max-w-xl text-[16.5px] leading-[1.65] text-ink-muted sm:text-[17.5px]';

const WRAP = 'mx-auto max-w-6xl px-5 sm:px-6 lg:px-8';

/** Soft paper lift for photos and notes. */
const PAPER_SHADOW = 'shadow-[0_1px_2px_rgba(30,28,24,0.08),0_14px_28px_-12px_rgba(30,28,24,0.28)]';

/* ─── Small pieces ──────────────────────────────────────────────────────── */

/**
 * A strip of washi tape. Translucent, faintly striped, with torn ends — the
 * clip-path bites the short edges so it never reads as a rectangle.
 */
function Tape({ className, tone = 'saffron' }: { className?: string; tone?: 'saffron' | 'grey' }) {
  return (
    <span
      aria-hidden
      className={cn('absolute z-10 h-[26px] w-[96px]', className)}
      style={{
        background: `repeating-linear-gradient(90deg, transparent 0 7px, rgba(255,255,255,0.16) 7px 8px), color-mix(in srgb, ${
          tone === 'saffron' ? 'var(--trip)' : 'var(--trip-navy)'
        } ${tone === 'saffron' ? '36%' : '16%'}, transparent)`,
        clipPath:
          'polygon(0 12%, 3% 0, 7% 8%, 93% 4%, 97% 0, 100% 14%, 98% 50%, 100% 88%, 96% 100%, 92% 94%, 6% 98%, 2% 100%, 0 86%, 2% 50%)',
      }}
    />
  );
}

function Seats({
  filled,
  total,
  shape = 'h-2.5 w-2.5 rounded-full',
}: {
  filled: number;
  total: number;
  shape?: string;
}) {
  return (
    <span className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn(shape, i < filled ? 'bg-ink-subtle' : 'border-[1.5px] border-trip')} />
      ))}
    </span>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Print>{label}</Print>
      <p className="mt-1 font-mono text-[13.5px] font-medium uppercase tracking-[0.04em]">{value}</p>
    </div>
  );
}

/** A fare, set for a stub: label, the amount, what it is per. */
function Fare({
  label,
  amount,
  per,
  className,
}: {
  label: string;
  amount: string;
  per: string;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center px-2 text-center', className)}>
      <Print>{label}</Print>
      <p className="mt-1.5 font-serif text-[30px] leading-none tracking-[-0.01em]">{amount}</p>
      <Print className="mt-1.5">{per}</Print>
    </div>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */

function GroupPass() {
  return (
    <Ticket
      stubSize={112}
      bodyClassName="p-5 sm:p-6"
      stub={
        <div className="flex h-full flex-col items-center justify-between py-5">
          <Fare label="Fare" amount="₹8,499" per="per person" className="h-auto" />
          <Barcode value="SPLLIT-MAS-GOI-1510" vertical className="h-16 w-7 opacity-80" />
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <Print className="text-trip opacity-100">Group pass</Print>
        <Print>Sample</Print>
      </div>

      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <p className="font-serif text-[46px] leading-[0.85] sm:text-[58px]">MAS</p>
          <Print className="mt-2 block">Chennai</Print>
        </div>
        <div aria-hidden className="mb-7 flex flex-1 items-center gap-1 px-1 text-trip">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-px flex-1 border-t-[1.5px] border-dashed border-current" />
          <span className="-mt-px text-[13px] leading-none">✈</span>
          <span className="h-px flex-1 border-t-[1.5px] border-dashed border-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </div>
        <div className="text-right">
          <p className="font-serif text-[46px] leading-[0.85] sm:text-[58px]">GOI</p>
          <Print className="mt-2 block">Goa</Print>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-dashed border-trip-rule pt-4">
        <Field label="Date" value="15 Oct" />
        <Field label="Days" value="4" />
        <Field label="Group" value="7 of 8" />
      </div>
    </Ticket>
  );
}

export function TripHero() {
  return (
    <section className="relative">
      <div
        className={cn(
          WRAP,
          'grid grid-cols-1 items-center gap-14 pb-20 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-28 lg:pt-14',
        )}
      >
        <div>
          <h1 className="text-balance font-serif text-[clamp(3.2rem,9.4vw,6.6rem)] font-normal leading-[0.9] tracking-[-0.025em] text-ink">
            You pick the place. We find the <em className="text-trip">people.</em>
          </h1>

          <p className="mt-7 max-w-[33rem] text-[17px] leading-[1.65] text-ink-muted sm:text-[18.5px]">
            Tell Spllit where you want to go. It finds the people already going, forms the group, fills the
            villa and splits the bill — so the trip exists before anyone has booked a thing.
          </p>

          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
            <Button href="/auth">Get early access</Button>
            <a
              href="#how"
              className="text-[15px] font-medium text-ink underline decoration-trip-rule decoration-2 underline-offset-[6px] transition-colors duration-snap hover:decoration-trip"
            >
              How it works
            </a>
          </div>
        </div>

        {/* The riders, then the pass beneath them — stacked, never overlapping,
            so the whole drawing is always visible. */}
        <div className="mx-auto w-full max-w-[460px]">
          <div className="relative mx-auto w-[62%] max-w-[270px]">
            <Image
              src="/trip/cycling-couple.png"
              alt="Hand-drawn illustration of a couple riding a bicycle together"
              width={325}
              height={358}
              preload
              sizes="(min-width: 1024px) 270px, 62vw"
              className="h-auto w-full"
            />
            <Stamp
              id="hero-stamp"
              ring="✦ SPLLIT TRIP ✦ GROUP MATCHED ✦ EARLY ACCESS "
              big="7"
              small="TRAVELLERS"
              className="absolute -left-[30%] top-[2%] w-[42%] max-w-[124px] -rotate-12 opacity-90"
            />
          </div>
          <div className="mt-8 -rotate-[1deg]">
            <GroupPass />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Destinations band ─────────────────────────────────────────────────── */

const PLACES = [
  'Goa',
  'Manali',
  'Pondicherry',
  'Coorg',
  'Kochi',
  'Hampi',
  'Rishikesh',
  'Gokarna',
  'Udaipur',
  'Varanasi',
  'Ooty',
  'Leh',
];

/**
 * A slow ribbon of places between the hero and the cities — the page
 * breathing out. The list is printed twice and slid by half its width, so
 * the loop has no seam. Holds still for reduced motion, and on hover.
 */
export function TripPlaces() {
  const row = (hidden?: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center">
      {PLACES.map((place) => (
        <li key={place} className="flex items-center">
          <span className="px-7 font-serif text-[30px] italic text-ink sm:text-[36px]">{place}</span>
          <span aria-hidden className="text-[14px] text-trip">
            ✦
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label="Places people are planning"
      className="overflow-hidden border-t border-trip-rule py-6"
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
        {row()}
        {row(true)}
      </div>
    </section>
  );
}

/* ─── Cities ────────────────────────────────────────────────────────────── */

const CITIES = [
  {
    city: 'Chennai',
    line: 'marina at dawn, filter coffee after',
    src: '/trip/chennai.jpg',
    w: 736,
    h: 1308,
    alt: 'Collage poster of Chennai: Ripon Building, the lighthouse and a Namma Chennai title',
  },
  {
    city: 'Kochi',
    line: 'ferries, fishing nets & a café every hour',
    src: '/trip/kochi.jpg',
    w: 735,
    h: 1105,
    alt: 'Illustrated travel poster of Kochi with Chinese fishing nets, ferries and an autorickshaw',
  },
  {
    city: 'Kolkata',
    line: 'trams, clay-cup chai, one more rosogolla',
    src: '/trip/kolkata.jpg',
    w: 736,
    h: 1308,
    alt: 'Kolkata collage: Victoria Memorial, a yellow Ambassador taxi, a tram and rosogolla',
  },
  {
    city: 'Jaipur',
    line: 'pink walls, hill forts, the junction',
    src: '/trip/jaipur.jpg',
    w: 735,
    h: 874,
    alt: 'Poster of the Jaipur Junction sign above a man in a red turban and the pink city',
  },
];

/** Hand-placed, not random: each photo sits a little differently on the page. */
const PLACEMENT = [
  { tilt: '-rotate-[2.2deg]', drop: 'mt-2', tape: '-rotate-[5deg]', tone: 'saffron' as const },
  { tilt: 'rotate-[1.6deg]', drop: 'mt-10', tape: 'rotate-[3deg]', tone: 'grey' as const },
  { tilt: '-rotate-[1deg]', drop: 'mt-0', tape: 'rotate-[6deg]', tone: 'saffron' as const },
  { tilt: 'rotate-[2.4deg]', drop: 'mt-8', tape: '-rotate-[4deg]', tone: 'grey' as const },
];

export function TripCities() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-28">
      <div className={cn(WRAP, 'grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end')}>
        <div>
          <SectionHead n="02" label="Where people are heading" sticker="van" />
          <h2 className={cn(H2, 'text-ink')}>Somewhere on this list is your next group.</h2>
        </div>
        <p className="max-w-md text-[16px] leading-[1.65] text-ink-muted lg:justify-self-end">
          Pick a city and Spllit shows you who else picked it — the dates they&apos;re free, what they want to
          spend, and the trips already filling up.
        </p>
      </div>

      {/* A scrapbook page: photos taped in, a line written under each. Every
          poster keeps its own shape, because cropping them to one ratio cut
          off titles and the artists' signatures. */}
      <Rail
        frameClassName="mt-12 sm:mt-14 [--h:300px] sm:[--h:370px] lg:[--h:400px]"
        className={cn(
          'no-scrollbar flex snap-x snap-mandatory items-start gap-9 overflow-x-auto pb-8 pt-7 sm:gap-11',
          'scroll-px-5 px-5 sm:scroll-px-6 sm:px-6',
          'lg:scroll-px-[max(2rem,calc(50%_-_34rem))] lg:px-[max(2rem,calc(50%_-_34rem))]',
        )}
      >
        {CITIES.map((c, i) => {
          const at = PLACEMENT[i % PLACEMENT.length]!;
          return (
            <figure key={c.city} className={cn('group shrink-0 snap-start', at.drop)}>
              <div
                className={cn(
                  'relative bg-trip-card p-2.5 pb-4 transition-transform duration-sheet group-hover:rotate-0 motion-reduce:transition-none',
                  PAPER_SHADOW,
                  at.tilt,
                )}
              >
                <Tape tone={at.tone} className={cn('-top-3 left-1/2 -translate-x-1/2', at.tape)} />
                <div
                  className="relative h-[var(--h)] overflow-hidden bg-surface-sunken"
                  style={{ width: `calc(var(--h) * ${c.w / c.h})` }}
                >
                  <Image
                    src={c.src}
                    alt={c.alt}
                    fill
                    sizes="(min-width: 1024px) 340px, (min-width: 640px) 290px, 240px"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2.5 px-1 font-hand text-[30px] leading-none text-ink">{c.city}</p>
              </div>
              <figcaption
                className="mt-3 px-1 font-hand text-[20px] leading-tight text-ink-muted"
                style={{ width: `calc(var(--h) * ${c.w / c.h} + 20px)` }}
              >
                {c.line}
              </figcaption>
            </figure>
          );
        })}

        {/* A note on lined paper, taped in at the end of the page. */}
        <Link href="/auth" className="group relative mt-6 w-[250px] shrink-0 snap-start sm:w-[270px]">
          <div
            className={cn('relative rotate-[1.5deg] bg-trip-card px-6 pb-6 pt-8', PAPER_SHADOW)}
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent 0 31px, var(--trip-rule) 31px 32px)',
              backgroundPosition: '0 28px',
            }}
          >
            <Tape className="-top-3 left-1/2 -translate-x-1/2 -rotate-[3deg]" />
            <p className="font-hand text-[34px] leading-[32px] text-ink">Your city isn&apos;t here?</p>
            <p className="mt-[32px] font-hand text-[22px] leading-[32px] text-ink-muted">
              Say where you want to go. When enough people say the same place, it becomes a trip.
            </p>
            <p className="mt-[32px] font-hand text-[25px] leading-[32px] text-trip">
              tell us where{' '}
              <span className="inline-block transition-transform duration-snap group-hover:translate-x-1">
                →
              </span>
            </p>
          </div>
        </Link>
      </Rail>
    </section>
  );
}

/* ─── How it works ──────────────────────────────────────────────────────── */

const STOPS = [
  { title: 'Say where', line: 'Place, dates, budget.' },
  { title: 'Meet who fits', line: 'Same plan, same budget.' },
  { title: 'Form the group', line: 'Join one, or start one.' },
  { title: 'Build the trip', line: 'Travel, stay, things to do.' },
  { title: 'Split it', line: 'Every rupee, shared fairly.' },
  { title: 'Pass it on', line: 'Your trip starts the next.' },
];

/**
 * The route the stops sit on, in a 600 × 80 box stretched to the row's width.
 * Stop i sits at the left edge of column i (x = i × 100, plus the pin's
 * radius), alternating high and low so the line winds like a road.
 */
const PIN_Y = (i: number) => (i % 2 === 0 ? 18 : 62);
const ROUTE = STOPS.map((_, i) => ({ x: i * 100 + 4.5, y: PIN_Y(i) })).reduce((d, p, i, all) => {
  if (i === 0) return `M ${p.x} ${p.y}`;
  const prev = all[i - 1]!;
  return `${d} C ${prev.x + 50} ${prev.y}, ${p.x - 50} ${p.y}, ${p.x} ${p.y}`;
}, '');

export function TripHowItWorks() {
  return (
    <section id="how" className="scroll-mt-6 border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div className={WRAP}>
        <SectionHead n="03" label="How it works" sticker="campfire" />
        <h2 className={cn(H2, 'max-w-3xl text-ink')}>From one idea to a full group.</h2>

        <div className="relative mt-14 lg:mt-20">
          <svg
            aria-hidden
            viewBox="0 0 600 80"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 hidden h-[80px] w-full lg:block"
          >
            <path
              d={ROUTE}
              fill="none"
              stroke="var(--trip)"
              strokeWidth="1.5"
              strokeDasharray="5 7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="grid grid-cols-1 lg:grid-cols-6">
            {STOPS.map((stop, i) => (
              <li
                key={stop.title}
                className="relative grid grid-cols-[76px_1fr] items-baseline border-t border-trip-rule py-6 lg:block lg:border-t-0 lg:py-0 lg:pr-6 lg:pt-[104px]"
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 hidden h-4 w-4 rounded-full border-2 lg:block',
                    i === STOPS.length - 1 ? 'border-trip bg-trip' : 'border-trip-navy bg-trip-paper',
                  )}
                  style={{ top: PIN_Y(i) - 8 }}
                />
                <span
                  aria-hidden
                  className="font-serif text-[52px] leading-[0.8] text-trip-rule lg:text-[60px]"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="lg:mt-3">
                  <p className="font-serif text-[27px] leading-[1.05] text-ink">{stop.title}</p>
                  <p className="mt-1.5 text-[14.5px] text-ink-muted">{stop.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ─── One destination, one screen ───────────────────────────────────────── */

export function TripOneScreen() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div className={cn(WRAP, 'grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20')}>
        <div>
          <SectionHead n="04" label="One screen" />
          <h2 className={cn(H2, 'text-ink')}>Open a place. See the whole trip.</h2>
          <p className={LEAD}>
            Not a list of hotels. The people going when you are, the trips filling up, the villas with beds to
            spare — with every fare already split.
          </p>

          <dl className="mt-10 grid max-w-md grid-cols-1 border-t border-trip-rule">
            {[
              ['Who', 'is going on your dates'],
              ['What', 'is filling up, and how fast'],
              ['₹', 'it costs once it’s shared'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[72px_1fr] gap-4 border-b border-trip-rule py-3.5">
                <dt className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-trip">
                  {k}
                </dt>
                <dd className="text-[15px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <DestinationPreview />
      </div>
    </section>
  );
}

/* ─── Empty seats ───────────────────────────────────────────────────────── */

/**
 * Forty seats laid out as a coach — two, an aisle, two — sold front to back,
 * so the empty ones sit together at the rear the way they actually do.
 */
function Coach({ filled, total }: { filled: number; total: number }) {
  const rows = total / 4;
  return (
    <div className="inline-flex flex-col gap-1">
      {[0, 1, 2, 3].map((lane) => (
        <div key={lane} className={cn('flex gap-1', lane === 2 && 'mt-2')}>
          {Array.from({ length: rows }, (_, row) => (
            <span
              key={row}
              className={cn(
                'h-3.5 w-3.5 rounded-[3px]',
                row * 4 + lane < filled ? 'bg-white/35' : 'border-[1.5px] border-trip',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Dots({ filled, total, shape }: { filled: number; total: number; shape: string }) {
  return (
    <span className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn(shape, i < filled ? 'bg-white/35' : 'border-[1.5px] border-trip')} />
      ))}
    </span>
  );
}

const GAPS = [
  {
    kind: 'Bus',
    route: 'Chennai → Pondicherry',
    open: '13',
    unit: 'seats open',
    map: <Coach filled={27} total={40} />,
  },
  {
    kind: 'Villa',
    route: 'Coorg · sleeps 8',
    open: '3',
    unit: 'beds open',
    map: <Dots filled={5} total={8} shape="h-3.5 w-5 rounded-full" />,
  },
  {
    kind: 'Group',
    route: 'Manali · December',
    open: '2',
    unit: 'people short',
    map: <Dots filled={4} total={6} shape="h-3.5 w-3.5 rounded-full" />,
  },
];

export function TripEmptySeats() {
  return (
    <section className="bg-trip-navy py-20 text-white sm:py-24 lg:py-32">
      <div className={WRAP}>
        <SectionHead n="05" label="The empty-seat problem" light sticker="luggage" />
        <h2 className={cn(H2, 'max-w-3xl')}>
          Every trip leaves something empty. <em className="text-trip">We fill it.</em>
        </h2>
        <p className="mt-6 max-w-xl text-[16.5px] leading-[1.65] text-white/65 sm:text-[17.5px]">
          Unsold seats, spare beds, a group two people short. On Spllit every gap is shown to the people
          already heading that way.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[22px] bg-white/10 md:grid-cols-3 lg:mt-16">
          {GAPS.map((gap) => (
            <div key={gap.kind} className="flex flex-col bg-trip-navy p-7">
              <Print className="opacity-50">{gap.kind}</Print>
              <p className="mt-2 text-[15px] text-white/80">{gap.route}</p>
              <div className="mt-6 md:min-h-[72px]">{gap.map}</div>
              <p className="mt-8 flex items-baseline gap-3">
                <span className="font-serif text-[64px] leading-[0.8] text-trip">{gap.open}</span>
                <span className="text-[14.5px] text-white/60">{gap.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stays ─────────────────────────────────────────────────────────────── */

export function TripStays() {
  return (
    <section className="py-20 sm:py-24 lg:py-32">
      <div
        className={cn(WRAP, 'grid grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20')}
      >
        <div className="order-2 lg:order-1">
          <div className="mx-auto max-w-[500px]">
            <div className="grid grid-cols-2 gap-5">
              <div className={cn('relative -rotate-2 bg-trip-card p-2 pb-3', PAPER_SHADOW)}>
                <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-[4deg]" />
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src="/trip/courtyard.jpg"
                    alt="Whitewashed courtyard with arches, terracotta floor and potted plants"
                    fill
                    sizes="(min-width: 1024px) 250px, 44vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 px-1 font-hand text-[22px] leading-none text-ink">the courtyard</p>
              </div>
              <div className={cn('relative mt-10 rotate-2 bg-trip-card p-2 pb-3', PAPER_SHADOW)}>
                <Tape tone="grey" className="-top-3 left-1/2 -translate-x-1/2 -rotate-[5deg]" />
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src="/trip/bungalow.jpg"
                    alt="Two-storey white bungalow with a red-tiled veranda, a lawn and a dog on the stone path"
                    fill
                    sizes="(min-width: 1024px) 250px, 44vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 px-1 font-hand text-[22px] leading-none text-ink">and the veranda</p>
              </div>
            </div>

            <Ticket
              stubSize={104}
              className="mx-auto mt-10 max-w-[420px]"
              bodyClassName="p-4 sm:p-5"
              stub={<Fare label="You pay" amount="₹3,000" per="a night" />}
            >
              <div className="flex items-baseline justify-between gap-2">
                <Print className="text-trip opacity-100">Villa pass</Print>
                <Print>Sample</Print>
              </div>
              <p className="mt-2 font-serif text-[24px] leading-tight sm:text-[26px]">Assagao, Goa</p>
              <p className="mt-1 font-mono text-[12px] text-ink-muted">₹24,000 a night ÷ 8</p>
              <div className="mt-3 flex items-center gap-2.5">
                <Seats filled={6} total={8} />
                <Print>2 beds left</Print>
              </div>
            </Ticket>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHead n="06" label="Stay together" sticker="coconut" />
          <h2 className={cn(H2, 'text-ink')}>Stay somewhere you couldn&apos;t alone.</h2>
          <p className={LEAD}>
            A ₹24,000-a-night villa is out of reach for one. Split eight ways it&apos;s ₹3,000 each — and the
            courtyard, the veranda and the long dinners come with it.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Explore ───────────────────────────────────────────────────────────── */

export function TripExplore() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div className={WRAP}>
        <div className="max-w-3xl">
          <SectionHead n="07" label="Explore" />
          <h2 className={cn(H2, 'text-ink')}>See it. Save it. Go with people.</h2>
          <p className={LEAD}>
            Short videos from people who&apos;ve been. Tap a place and it lands in your trip — next to the
            people who saved it too.
          </p>
        </div>

        <div className="mt-14 lg:mt-16">
          <ReelToTrip />
        </div>
      </div>
    </section>
  );
}

/* ─── Plan in a sentence ────────────────────────────────────────────────── */

const QUOTE = [
  ['Travellers like you', '7'],
  ['Ways to get there', '2'],
  ['Villas that fit the group', '3'],
  ['Things to do', '5'],
  ['Cafés worth the detour', '8'],
];

export function TripSentence() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div className={cn(WRAP, 'grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20')}>
        <div>
          <SectionHead n="08" label="Plan in a sentence" sticker="suitcase" />
          <h2 className={cn(H2, 'text-ink')}>One sentence in. A whole trip out.</h2>

          <blockquote className="mt-10 border-l-2 border-trip pl-5 sm:pl-7">
            <p className="font-serif text-[clamp(1.45rem,2.6vw,1.9rem)] italic leading-[1.3] text-ink">
              “I&apos;ve got ₹10,000 and four days in October. I&apos;m in Chennai. Beaches, nightlife — and I
              don&apos;t want to go alone.”
            </p>
          </blockquote>
        </div>

        {/* The answer, printed as a quote slip with a tear-off. */}
        <Ticket
          vertical
          stubSize={96}
          className="mx-auto w-full max-w-[400px] rotate-[1deg]"
          bodyClassName="px-6 pb-6 pt-7"
          stub={
            <div className="flex h-full items-center justify-between gap-4 px-6">
              <Barcode value="QUOTE-GOA-4D-8700" className="h-10 w-[46%] opacity-80" />
              <Link
                href="/auth"
                className="rounded-full bg-trip px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity duration-snap hover:opacity-90"
              >
                Join this group
              </Link>
            </div>
          }
        >
          <div className="flex items-baseline justify-between">
            <Print className="text-trip opacity-100">Trip quote</Print>
            <Print>Sample</Print>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="font-serif text-[42px] leading-none">Goa</p>
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted">
              15–18 Oct · 4 days
            </p>
          </div>

          <dl className="mt-6 space-y-2.5 font-mono text-[13px]">
            {QUOTE.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <dt className="text-ink-muted">{k}</dt>
                <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-trip-rule" />
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex items-end justify-between border-t-2 border-ink pt-4">
            <Print className="opacity-80">Per person, approx.</Print>
            <p className="font-serif text-[40px] leading-none">₹8,700</p>
          </div>
        </Ticket>
      </div>
    </section>
  );
}

/* ─── Hosts & operators ─────────────────────────────────────────────────── */

export function TripOperators() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div
        className={cn(WRAP, 'grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20')}
      >
        <div>
          <SectionHead n="09" label="For hosts & operators" sticker="orangeCase" />
          <h2 className={cn(H2, 'text-ink')}>Run trips, stays or buses? Get groups, not clicks.</h2>
          <p className={LEAD}>
            Travel is sold backwards: build a package, advertise, hope. On Spllit people say where they want
            to go first — so you see the demand before you plan the trip.
          </p>
          <Button href={PARTNER_MAIL} tone="saffron" className="mt-9">
            Partner with Spllit Trip
          </Button>
        </div>

        {/* A demand pool, set as a departures board. */}
        <div className="mx-auto w-full max-w-[460px] rounded-[22px] bg-trip-navy p-6 text-white shadow-float sm:p-7">
          <div className="flex items-baseline justify-between">
            <Print className="text-trip opacity-100">Demand pool</Print>
            <Print>Sample</Print>
          </div>
          <p className="mt-4 font-serif text-[46px] leading-[0.9]">
            MAS <span className="text-trip">→</span> GOI
          </p>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/15 pt-5">
            <Field label="Date" value="15 Oct" />
            <Field label="Travellers" value="17" />
            <Field label="Budget each" value="₹6–10k" />
            <Field label="Needs" value="Bus · Stay" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── The Spllit family ─────────────────────────────────────────────────── */

const FAMILY: { name: string; line: string; here?: boolean; soon?: boolean }[] = [
  { name: 'Ride', line: 'Share the cab.' },
  { name: 'Group Rides', line: 'Travel as a group.' },
  { name: 'Trip', line: 'Share the journey.', here: true },
  { name: 'Events', line: 'Go together.' },
  { name: 'Split', line: 'Costs, settled.' },
  { name: 'Rent', line: 'Borrow, don’t buy.' },
  { name: 'Stay', line: 'Share the roof.', soon: true },
  { name: 'Community', line: 'Same plans, same people.' },
];

export function TripFamily() {
  return (
    <section className="border-t border-trip-rule py-20 sm:py-24 lg:py-32">
      <div className={WRAP}>
        <SectionHead n="10" label="One Spllit" />
        <h2 className={cn(H2, 'max-w-3xl text-ink')}>Share anything that makes sense to share.</h2>

        <div className="mt-12 grid grid-cols-2 border-l border-t border-trip-rule lg:mt-16 lg:grid-cols-4">
          {FAMILY.map((item) => (
            <div
              key={item.name}
              className={cn(
                'flex min-h-[130px] flex-col border-b border-r border-trip-rule p-5 sm:min-h-[150px] sm:p-6',
                item.here && 'bg-trip text-white',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-serif text-[28px] leading-none sm:text-[32px]">{item.name}</p>
                {item.soon ? <Print>Soon</Print> : null}
              </div>
              <p className={cn('mt-auto pt-4 text-[14px]', item.here ? 'text-white/85' : 'text-ink-muted')}>
                {item.here ? 'You’re here — ' : ''}
                {item.line}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Close ─────────────────────────────────────────────────────────────── */

export function TripClose() {
  return (
    <section className="bg-trip-navy text-white">
      <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-6 sm:py-28 lg:py-36">
        <h2 className="mx-auto text-balance font-serif text-[clamp(2.5rem,6vw,4.9rem)] font-normal leading-[1] tracking-[-0.015em]">
          What happens when a thousand people say where they want to go —{' '}
          <em className="text-trip">before anyone books?</em>
        </h2>
        <p className="mx-auto mt-7 max-w-lg text-[17px] leading-[1.65] text-white/65 sm:text-[18px]">
          The trip exists before the booking does. Be one of the first to say where.
        </p>
        <div className="mt-11 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
          <Button href="/auth" tone="saffron">
            Get early access
          </Button>
          <a
            href={PARTNER_MAIL}
            className="text-[15px] font-medium text-white/80 underline decoration-white/25 decoration-2 underline-offset-[6px] transition-colors duration-snap hover:text-white hover:decoration-trip"
          >
            I run trips or stays
          </a>
        </div>
      </div>
    </section>
  );
}

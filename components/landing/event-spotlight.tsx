'use client';

import { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  countdown,
  formatWhen,
  mapsHref,
  pickEvent,
  plainSummary,
  registrationOpen,
  ribbonFor,
  type FeaturedEvent,
} from '@/lib/featured-event';
import { BOARD, EventShop, PAPER } from '@/components/landing/event-shop';

/**
 * The featured event: what it is, where, when, a live countdown and the way
 * in — beside its poster in a shopfront, laid out as a scrapbook page on black:
 * paper, tape and a torn ticket with a QR code, rather than glow and gloss.
 *
 * Which event, and in what state, is decided from the visitor's own clock
 * every second, not from the moment the page was cached:
 *  - before it starts: counting down, registration open;
 *  - while it runs: "happening now", time left, registration closed;
 *  - once it ends: the next event takes its place, and with none left the
 *    section falls back to the general events row it replaced.
 *
 * The first render uses the server's clock (`renderedAt`) so server and client
 * produce the same HTML; the real clock takes over once mounted.
 */
function subscribeClock(onTick: () => void) {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
}

/** Whole seconds, so the snapshot is stable between calls within one second. */
function readClock() {
  return Math.floor(Date.now() / 1000) * 1000;
}

function subscribeNever() {
  return () => {};
}

export function EventSpotlight({
  events,
  renderedAt,
  fallback,
  variant = 'band',
}: {
  events: FeaturedEvent[];
  renderedAt: number;
  fallback: React.ReactNode;
  /**
   * band: full-width, the home page's Events section (and the target of the
   * nav's Events link). card: a rounded panel for the app's Events screen,
   * which sits in a narrower column.
   */
  variant?: 'band' | 'card';
}) {
  const card = variant === 'card';
  // The clock, as an external store: a tick a second in the browser, the
  // server's timestamp while hydrating, so both render the same HTML.
  const now = useSyncExternalStore(subscribeClock, readClock, () => renderedAt);
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const picked = pickEvent(events, now);
  if (!picked) return <>{fallback}</>;

  const { event, phase } = picked;
  const live = phase === 'live';
  const ended = phase === 'ended';
  const canRegister = registrationOpen(event, phase);
  const target = Date.parse(live ? event.endsAt : event.startsAt);
  const left = countdown(target, now);

  return (
    <section
      id={card ? undefined : 'events'}
      aria-labelledby="featured-event-title"
      className={cn('relative overflow-hidden', card && 'rounded-[28px]')}
      style={{ background: BOARD, color: PAPER }}
    >
      {/* Paper grain, so the board reads as black card stock rather than a
          screen colour. Static noise, not light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }}
      />

      {/*
        Three blocks, ordered for a phone first: the name, then the shop with
        its poster and ticket, then where / when / the way in. On a wide screen
        the shop takes its own column and spans both text blocks.
      */}
      <div
        className={cn(
          'relative mx-auto grid',
          card
            ? 'gap-8 px-5 py-8 sm:px-8 sm:py-10 md:grid-cols-[1.1fr_0.9fr] md:grid-rows-[auto_1fr] md:gap-x-10 md:gap-y-6'
            : 'max-w-6xl gap-9 px-5 py-14 sm:gap-11 sm:px-6 sm:py-18 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-7 lg:px-8 lg:py-24',
        )}
      >
        {/* 1 — what it is called. */}
        <div
          className={
            card
              ? 'md:col-start-1 md:row-start-1 md:self-end'
              : 'lg:col-start-1 lg:row-start-1 lg:self-end'
          }
        >
          {/* The label, on a strip of tape. */}
          <span
            className="inline-flex -rotate-2 items-center gap-2 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0e0e0d]"
            style={{
              background: 'rgba(214, 196, 150, 0.92)',
              clipPath: 'polygon(2% 10%, 98% 0%, 100% 50%, 97% 100%, 1% 92%, 0% 45%)',
            }}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', live ? 'animate-pulse' : '')}
              style={{ background: live ? '#dc2626' : '#0e0e0d' }}
            />
            {ended ? 'Event over' : live ? 'Happening now' : 'Next event'}
          </span>
          <h2
            id="featured-event-title"
            className={cn(
              // Size before leading: cn() runs tailwind-merge, which drops a
              // leading-* that comes before a text-* size.
              card ? 'text-[clamp(1.7rem,6.5vw,2.4rem)]' : 'text-[clamp(2rem,8vw,3.6rem)]',
              'mt-4 font-sans font-semibold leading-[1.02] tracking-[-0.045em]',
            )}
          >
            {event.title}
          </h2>
        </div>

        {/* 2 — the shop, the poster and the ticket. Narrower on a phone, and
            off-centre to leave the ticket room on the right. */}
        <div
          className={cn(
            'self-center pb-2',
            card
              ? 'md:col-start-2 md:row-span-2 md:row-start-1'
              : 'lg:col-start-2 lg:row-span-2 lg:row-start-1',
          )}
        >
          <EventShop
            poster={event.poster}
            alt={event.posterAlt}
            title={event.title}
            registerUrl={event.registerUrl}
            showQr={canRegister}
            ribbon={ribbonFor(event, phase)}
            className={cn(
              'max-w-[min(62vw,260px)] -translate-x-[15%] sm:max-w-[290px] sm:-translate-x-[14%] lg:-translate-x-[16%]',
              card ? 'md:max-w-[260px]' : 'lg:max-w-[330px]',
            )}
          />
        </div>

        {/* 3 — what, where, when, and the way in. */}
        <div
          className={cn(
            'min-w-0',
            card ? 'md:col-start-1 md:row-start-2' : 'lg:col-start-1 lg:row-start-2',
          )}
        >
          <p className="line-clamp-5 max-w-[56ch] text-[15.5px] leading-relaxed text-[#bdb8ac] sm:line-clamp-4 sm:text-[16px]">
            {plainSummary(event.summary)}
          </p>

          <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
            <div className="flex items-center gap-3 py-3.5">
              <dt className="sr-only">Where</dt>
              <MapPin aria-hidden className="h-5 w-5 shrink-0 text-[#4ade80]" />
              <dd className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-medium">{event.venue}</p>
                {event.area && <p className="truncate text-[13px] text-[#8f8a7f]">{event.area}</p>}
              </dd>
              <a
                href={mapsHref(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-2 text-[13px] font-medium transition-colors duration-snap hover:bg-white/10"
              >
                <MapPin
                  aria-hidden
                  className="h-3.5 w-3.5 text-[#4ade80] transition-transform duration-sheet group-hover:-translate-y-0.5"
                />
                Map
                <span className="sr-only">: open {event.venue} in Google Maps (new tab)</span>
              </a>
            </div>
            <div className="flex items-center gap-3 py-3.5">
              <dt className="sr-only">When</dt>
              <CalendarDays aria-hidden className="h-5 w-5 shrink-0 text-[#4ade80]" />
              <dd className="min-w-0 text-[15px] font-medium leading-snug">{formatWhen(event)}</dd>
            </div>
          </dl>

          {ended ? (
            // Over: no clock to count, just a line in the same hand.
            <p className="mt-6 font-hand text-[22px] font-semibold leading-snug text-[#bdb8ac]">
              that&apos;s a wrap — thanks for coming. the next one shows up right here.
            </p>
          ) : (
            <>
              <p className="mt-6 font-hand text-[20px] font-semibold leading-none text-[#bdb8ac]">
                {live ? 'ends in…' : 'starts in…'}
              </p>
              {/* Four paper tiles that share whatever width there is, so the
                  row fits a 320px phone and never pushes the page sideways. */}
              <div
                className="mt-3 grid max-w-[360px] grid-cols-4 gap-2 sm:gap-3"
                role="timer"
                aria-live="off"
              >
                <Unit value={left.days} label="Days" ready={mounted} tilt={-2} />
                <Unit value={left.hours} label="Hrs" ready={mounted} tilt={1.5} />
                <Unit value={left.minutes} label="Min" ready={mounted} tilt={-1} />
                <Unit value={left.seconds} label="Sec" ready={mounted} tilt={2} />
              </div>
            </>
          )}

          {/* The way in. A green sticker with a hard paper shadow; full width
              on a phone, where it is the thumb's target. */}
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            {!canRegister ? (
              <span className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/25 px-7 text-[15px] font-medium text-[#8f8a7f]">
                {ended
                  ? 'Registration closed'
                  : live
                    ? 'Registration closed — it’s on now'
                    : 'Registration closed'}
              </span>
            ) : (
              <a
                href={event.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#22c55e] px-8 text-[15.5px] font-bold text-[#0e0e0d] transition-all duration-snap hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                style={{ boxShadow: `4px 4px 0 0 ${PAPER}` }}
              >
                Register now
                <ArrowUpRight
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </a>
            )}
            {canRegister && (
              <p className="text-center text-[12.5px] text-[#8f8a7f] sm:text-left">
                Google Form · opens in a new tab
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Fine fractal noise as an image, for the board's paper grain. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

/**
 * One countdown tile: a square of paper stuck on slightly crooked. The digits
 * roll on change. Before mount it shows dashes, so a page served from cache
 * never flashes a stale number.
 */
function Unit({
  value,
  label,
  ready,
  tilt,
}: {
  value: number;
  label: string;
  ready: boolean;
  tilt: number;
}) {
  const text = ready ? String(value).padStart(2, '0') : '--';
  return (
    <div
      className="flex min-w-0 flex-col items-center rounded-[6px] py-2.5 sm:py-3"
      style={{
        background: PAPER,
        color: BOARD,
        transform: `rotate(${tilt}deg)`,
        boxShadow: '3px 3px 0 0 rgba(0,0,0,0.5)',
      }}
    >
      <span className="relative h-[30px] overflow-hidden sm:h-[36px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="block font-sans text-[24px] font-bold leading-[30px] tabular-nums tracking-[-0.03em] sm:text-[30px] sm:leading-[36px]"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="mt-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] opacity-60 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

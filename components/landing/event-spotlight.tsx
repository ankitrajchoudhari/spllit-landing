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
  type FeaturedEvent,
} from '@/lib/featured-event';
import { EventShop } from '@/components/landing/event-shop';

/**
 * The featured event, on a dark green band: what it is, where, when, a live
 * countdown and the way in — beside its poster in a shopfront.
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
}: {
  events: FeaturedEvent[];
  renderedAt: number;
  fallback: React.ReactNode;
}) {
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
  const canRegister = registrationOpen(event, phase);
  const target = Date.parse(live ? event.endsAt : event.startsAt);
  const left = countdown(target, now);

  return (
    <section
      id="events"
      className="relative overflow-hidden bg-[#071a0e] text-white"
      aria-labelledby="featured-event-title"
    >
      {/* Light falling from behind the shop, so the band is not flat black. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 70% at 78% 45%, rgba(43,211,95,0.22) 0%, transparent 70%), radial-gradient(40% 50% at 10% 10%, rgba(143,227,168,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <p className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#8fe3a8]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#2bd35f]" />
              <span className="relative h-2 w-2 rounded-full bg-[#2bd35f]" />
            </span>
            {live ? 'Happening now' : 'Next event'}
          </p>

          <h2
            id="featured-event-title"
            className="mt-4 font-sans text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.045em]"
          >
            {event.title}
          </h2>
          <p className="mt-5 line-clamp-4 max-w-[52ch] text-[16px] leading-relaxed text-white/75">
            {plainSummary(event.summary)}
          </p>

          {/* Where. */}
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-start gap-2.5">
              <MapPin aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#8fe3a8]" />
              <div>
                <p className="text-[16px] font-medium leading-tight">{event.venue}</p>
                {event.area && <p className="mt-0.5 text-[13.5px] text-white/55">{event.area}</p>}
              </div>
            </div>
            <a
              href={mapsHref(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-white transition-colors duration-snap hover:bg-white/[0.14]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2bd35f] text-[#062b13]">
                <MapPin
                  aria-hidden
                  className="h-3.5 w-3.5 transition-transform duration-sheet group-hover:-translate-y-0.5"
                />
              </span>
              View on map
              <span className="sr-only">(opens Google Maps in a new tab)</span>
            </a>
          </div>

          {/* When. */}
          <div className="mt-7">
            <p className="flex items-center gap-2.5 text-[15px] text-white/85">
              <CalendarDays aria-hidden className="h-[18px] w-[18px] text-[#8fe3a8]" />
              {formatWhen(event)}
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
              {live ? 'Ends in' : 'Starts in'}
            </p>
            <div className="mt-2.5 flex gap-2 sm:gap-3" role="timer" aria-live="off">
              <Unit value={left.days} label="Days" ready={mounted} />
              <Unit value={left.hours} label="Hours" ready={mounted} />
              <Unit value={left.minutes} label="Min" ready={mounted} />
              <Unit value={left.seconds} label="Sec" ready={mounted} />
            </div>
          </div>

          {/* The way in, a Google Form. Whether it is open is set in the
              console: closing at the start, staying open while it runs, or
              closed outright. */}
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            {!canRegister ? (
              <span className="inline-flex min-h-[52px] items-center rounded-full border border-white/15 px-7 text-[15px] font-medium text-white/60">
                {live ? 'Registration closed — it’s on now' : 'Registration closed'}
              </span>
            ) : (
              <a
                href={event.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#2bd35f] px-8 text-[15px] font-semibold text-[#062b13] shadow-[0_10px_30px_-8px_rgba(43,211,95,0.7)] transition-all duration-snap hover:bg-[#46e076] active:scale-95"
              >
                Register
                <ArrowUpRight
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </a>
            )}
            {canRegister && (
              <p className="text-[13px] text-white/50">Opens a Google Form in a new tab.</p>
            )}
          </div>
        </div>

        <EventShop poster={event.poster} alt={event.posterAlt} title={event.title} />
      </div>
    </section>
  );
}

/**
 * One box of the countdown. The digits roll on change. Before mount it shows
 * dashes, so a page served from cache never flashes a stale number.
 */
function Unit({ value, label, ready }: { value: number; label: string; ready: boolean }) {
  const text = ready ? String(value).padStart(2, '0') : '--';
  return (
    <div className="flex w-[68px] flex-col items-center rounded-[14px] border border-white/10 bg-white/[0.06] py-3 backdrop-blur-sm sm:w-[78px]">
      <span className="relative h-[34px] overflow-hidden sm:h-[38px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'block font-sans text-[28px] font-semibold leading-[34px] tabular-nums tracking-[-0.02em] sm:text-[32px] sm:leading-[38px]',
            )}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/50">
        {label}
      </span>
    </div>
  );
}

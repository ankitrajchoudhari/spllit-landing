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
 * The featured event: what it is, where, when, a live countdown and the way
 * in — beside its poster in a shopfront. Lit like the rest of the site, on
 * its own surfaces and hairlines, so it reads as part of the page.
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
  const canRegister = registrationOpen(event, phase);
  const target = Date.parse(live ? event.endsAt : event.startsAt);
  const left = countdown(target, now);

  return (
    <section
      id={card ? undefined : 'events'}
      aria-labelledby="featured-event-title"
      className={cn(
        'relative overflow-hidden',
        card
          ? 'rounded-[28px] border border-line bg-surface shadow-soft'
          : 'border-y border-line bg-surface-sunken',
      )}
    >
      {/*
        Three blocks, ordered for a phone first: the name, then the shop with
        its poster, then where / when / the way in. On a wide screen the shop
        moves to its own column and spans both text blocks, so the name and the
        details read as one column beside it.
      */}
      <div
        className={cn(
          'relative mx-auto grid',
          card
            ? 'gap-7 px-5 py-7 sm:px-8 sm:py-9 md:grid-cols-[1.1fr_0.9fr] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-6'
            : 'max-w-6xl gap-8 px-5 py-12 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-7 lg:px-8 lg:py-24',
        )}
      >
        {/* 1 — what it is called. */}
        <div
          className={cn(
            card
              ? 'md:col-start-1 md:row-start-1 md:self-end'
              : 'lg:col-start-1 lg:row-start-1 lg:self-end',
          )}
        >
          <p className="flex items-center gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-brand sm:text-[12px]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
              <span className="relative h-2 w-2 rounded-full bg-brand" />
            </span>
            {live ? 'Happening now' : 'Next event'}
          </p>
          <h2
            id="featured-event-title"
            className={cn(
              // Size before leading: cn() merges with tailwind-merge, which drops
              // a leading-* that comes before a text-* size.
              card ? 'text-[clamp(1.6rem,6vw,2.3rem)]' : 'text-[clamp(1.85rem,7.5vw,3.5rem)]',
              'mt-3 font-sans font-medium leading-[1.04] tracking-[-0.045em] text-ink sm:mt-4',
            )}
          >
            {event.title}
          </h2>
        </div>

        {/* 2 — the shop and its poster. Capped on a phone so the poster is a
            picture on the way to the details, not a wall to scroll past. */}
        <div
          className={cn(
            'self-center',
            card
              ? 'md:col-start-2 md:row-span-2 md:row-start-1'
              : 'lg:col-start-2 lg:row-span-2 lg:row-start-1',
          )}
        >
          <EventShop
            poster={event.poster}
            alt={event.posterAlt}
            title={event.title}
            className={cn(
              'max-w-[min(74vw,290px)] sm:max-w-[320px]',
              card ? 'md:max-w-[300px]' : 'lg:max-w-[380px]',
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
          <p className="line-clamp-5 max-w-[56ch] text-[15.5px] leading-relaxed text-ink-muted sm:line-clamp-4 sm:text-[16px]">
            {plainSummary(event.summary)}
          </p>

          {/* Where and when, as two ruled rows: easy to scan on a phone. */}
          <dl className="mt-6 divide-y divide-line border-y border-line">
            <div className="flex items-center gap-3 py-3.5">
              <dt className="sr-only">Where</dt>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                <MapPin aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <dd className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-medium text-ink">{event.venue}</p>
                {event.area && <p className="truncate text-[13px] text-ink-subtle">{event.area}</p>}
              </dd>
              <a
                href={mapsHref(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink transition-colors duration-snap hover:bg-surface-raised"
              >
                <MapPin
                  aria-hidden
                  className="h-3.5 w-3.5 text-brand transition-transform duration-sheet group-hover:-translate-y-0.5"
                />
                Map
                <span className="sr-only">: open {event.venue} in Google Maps (new tab)</span>
              </a>
            </div>
            <div className="flex items-center gap-3 py-3.5">
              <dt className="sr-only">When</dt>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
                <CalendarDays aria-hidden className="h-[18px] w-[18px]" />
              </span>
              <dd className="min-w-0 text-[15px] font-medium leading-snug text-ink">
                {formatWhen(event)}
              </dd>
            </div>
          </dl>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-subtle">
            {live ? 'Ends in' : 'Starts in'}
          </p>
          {/* Four equal columns that share whatever width there is, so the
              row fits a 320px phone and never pushes the page sideways. */}
          <div
            className="mt-2.5 grid max-w-[380px] grid-cols-4 gap-2 sm:gap-2.5"
            role="timer"
            aria-live="off"
          >
            <Unit value={left.days} label="Days" ready={mounted} />
            <Unit value={left.hours} label="Hrs" ready={mounted} />
            <Unit value={left.minutes} label="Min" ready={mounted} />
            <Unit value={left.seconds} label="Sec" ready={mounted} />
          </div>

          {/* The way in, a Google Form. Whether it is open is set in the
              console. Full width on a phone, where it is the thumb's target. */}
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
            {!canRegister ? (
              <span className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line-strong px-7 text-[15px] font-medium text-ink-muted">
                {live ? 'Registration closed — it’s on now' : 'Registration closed'}
              </span>
            ) : (
              <a
                href={event.registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-ink px-8 text-[15px] font-semibold text-canvas transition-all duration-snap hover:opacity-85 active:scale-[0.98]"
              >
                Register
                <ArrowUpRight
                  aria-hidden
                  className="h-4 w-4 transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </a>
            )}
            {canRegister && (
              <p className="text-center text-[12.5px] text-ink-subtle sm:text-left">
                Opens a Google Form in a new tab.
              </p>
            )}
          </div>
        </div>
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
    <div className="flex min-w-0 flex-col items-center rounded-[14px] border border-line bg-surface py-2.5 sm:py-3">
      <span className="relative h-[30px] overflow-hidden sm:h-[36px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={text}
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="block font-sans text-[24px] font-semibold leading-[30px] tabular-nums tracking-[-0.02em] text-ink sm:text-[30px] sm:leading-[36px]"
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-subtle sm:text-[10.5px]">
        {label}
      </span>
    </div>
  );
}

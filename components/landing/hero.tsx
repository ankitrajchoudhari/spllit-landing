'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import { publicService } from '@/lib/services/public';

/** Real counters only — renders nothing rather than inventing numbers. */
function SocialProof() {
  const { data } = useQuery({
    queryKey: ['public', 'stats'],
    queryFn: () => publicService.stats(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (!data) return null;

  const parts: string[] = [];
  if (data.activeRides > 0) parts.push(`${data.activeRides} rides live`);
  if (data.activeSquads > 0) parts.push(`${data.activeSquads} group rides moving`);
  if (data.colleges > 0) parts.push(`${data.colleges} campuses`);
  if (parts.length === 0) return null;

  return (
    <p className="mt-6 font-sans text-[12px] uppercase sm:mt-8 sm:text-[13px] tracking-[0.08em] text-ink-subtle">
      {parts.join(' · ')}
    </p>
  );
}

/**
 * A small ticket stub stuck under the prompt card, pointing at Spllit Trip.
 *
 * Sized as a sticker, not a banner: the ride prompt stays the one thing to do
 * on this screen, and this is the side door for someone planning something
 * bigger than a cab. Same ticket cut as the /trip page (.ticket-shape), so
 * the two read as one family. Centred under the card; lifts on hover.
 */
function TripStub() {
  return (
    <motion.div variants={fade} transition={{ duration: 0.5 }} className="mt-5 flex w-full justify-center sm:mt-6">
      <Link
        href="/trip"
        className={cn(
          'group inline-block transition-transform duration-sheet ease-out',
          'hover:-translate-y-0.5 motion-reduce:transition-none',
          '[filter:drop-shadow(0_1px_1px_rgba(30,28,24,0.12))_drop-shadow(0_10px_18px_rgba(30,28,24,0.18))]',
        )}
      >
        <span
          style={{ '--stub': '112px', '--radius': '12px', '--hole': '7px' } as React.CSSProperties}
          className="ticket-shape flex items-stretch bg-trip-card text-left"
        >
          <span className="flex items-center gap-3 py-2.5 pl-4 pr-4 sm:pl-5 sm:pr-5">
            <span aria-hidden className="text-[17px] leading-none text-trip">
              ✈
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold leading-tight text-ink">Planning a trip?</span>
              <span className="block text-[12px] leading-tight text-ink-muted">Coming soon</span>
            </span>
          </span>
          <span className="relative flex w-[112px] shrink-0 items-center justify-center gap-1.5 bg-trip text-white">
            <span
              aria-hidden
              className="absolute bottom-[11px] left-0 top-[11px] border-l-2 border-dashed border-white/50"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Spllit Trip</span>
            <span aria-hidden className="text-[13px] transition-transform duration-snap group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </span>
      </Link>
    </motion.div>
  );
}

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

/**
 * Hero.
 *
 * The prompt card is a real control, not set dressing: whatever is typed is
 * carried into the app as the destination, so the first thing a visitor does
 * survives sign-in instead of being thrown away.
 */
export function Hero() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const next = destination.trim();
    router.push(next ? `/auth?next=${encodeURIComponent(`/rides/new?to=${next}`)}` : '/auth');
  };

  return (
    <section className="relative flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col">
        <div className="flex flex-col items-center px-5 pb-12 pt-6 text-center sm:px-6 sm:pb-16 lg:pb-24 lg:pt-14">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
            className="flex flex-col items-center"
          >
            <motion.h1
              variants={fade}
              transition={{ duration: 0.5 }}
              className="mb-3.5 max-w-[820px] font-sans text-[clamp(32px,6vw,68px)] font-medium leading-[1.05] tracking-[-0.04em] text-ink"
            >
              Where are you headed?
            </motion.h1>

            <motion.p
              variants={fade}
              transition={{ duration: 0.5 }}
              className="mb-7 max-w-[500px] font-sans text-[17px] font-medium leading-relaxed text-ink-muted sm:mb-9 sm:text-xl"
            >
              Tell us where you&apos;re going and when. We&apos;ll find someone on your
              campus already heading there — and split the fare.
            </motion.p>

            <motion.div variants={fade} transition={{ duration: 0.5 }} className="w-full">
              {/* Liquid-glass prompt card */}
              <div
                className={cn(
                  'liquid-glass liquid-glass--on-map relative mx-auto w-full max-w-[701px] overflow-hidden rounded-[32px] sm:rounded-[44px]',
                  'min-h-[150px] text-left sm:min-h-[188px] lg:min-h-[208px]',
                )}
                onClick={() => inputRef.current?.focus()}
              >
                <textarea
                  ref={inputRef}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={2}
                  aria-label="Where are you going?"
                  placeholder="I'm heading to Chennai airport on Friday evening and want to split a cab…"
                  className={cn(
                    'w-full resize-none bg-transparent px-6 pt-7 sm:px-7 sm:pt-8',
                    'font-sans text-[17px] font-medium leading-relaxed sm:text-xl',
                    // Near-ink placeholder. The default subtle grey landed at
                    // roughly the luminance of the map tiles behind the glass,
                    // so the prompt read as disabled rather than as the first
                    // thing to do. Still under full ink so typed text is
                    // distinguishable from the hint.
                    'outline-none placeholder:text-[color-mix(in_srgb,var(--ink)_82%,transparent)]',
                  )}
                  // Flat ink. This was mixed 55% with the brand green, which on
                  // a light map washed out to almost exactly the background.
                  style={{ color: 'var(--ink)' }}
                />

                <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-2 sm:px-[21px] sm:pb-[21px]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 px-3 py-2 backdrop-blur-[14px]">
                    <MapPin className="h-[15px] w-[15px] shrink-0 text-ink" />
                    <span className="font-sans text-[12.5px] font-medium text-ink">
                      Near you
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submit();
                    }}
                    className={cn(
                      'flex h-14 w-[156px] items-center justify-center rounded-[44px] bg-black',
                      'font-sans text-base font-medium uppercase tracking-[0.02em] text-[#fafafa]',
                      'shadow-[0_0_2px_0_rgba(0,0,0,0.05)] transition-all duration-snap',
                      'hover:bg-[#333] active:scale-95',
                    )}
                  >
                    Find a ride
                  </button>
                </div>
              </div>
            </motion.div>

            <TripStub />

            <SocialProof />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

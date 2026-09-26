'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { BedDouble, Check, MapPin, Pause, Play, Plus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, PhoneFrame, Print } from '@/components/spllit-trip/ticket';

type Kind = 'Food' | 'Place' | 'Stay';

interface Reel {
  id: string;
  city: string;
  region: string;
  video: string;
  poster: string;
  label: string;
  caption: string;
  /** What "Add to trip" drops into the list. */
  adds: string;
  saved: { kind: Kind; name: string }[];
  alsoSaved: string;
  /**
   * Seconds to cut at, when the clip runs on past the part we want. The
   * Mumbai clip closes on a store's end-card at 9.13s; moving on to the next
   * reel just before it keeps it to the city walk.
   */
  loopEnd?: number;
}

const REELS: Reel[] = [
  {
    id: 'mathura',
    city: 'Mathura',
    region: 'Mathura, Uttar Pradesh',
    video: '/trip/streets-of-mathura.mp4',
    poster: '/trip/streets-of-mathura.jpg',
    label: 'Short video walking through the old streets of Mathura',
    caption: 'Get lost in these lanes before 9 am. Thank me later.',
    adds: 'The old lanes of Mathura',
    saved: [
      { kind: 'Food', name: 'Kachori at Holi Gate, 8 am' },
      { kind: 'Place', name: 'Vishram Ghat at aarti' },
      { kind: 'Stay', name: 'Haveli rooms for a group of 6' },
      { kind: 'Place', name: 'Vrindavan, 30 minutes out' },
      { kind: 'Food', name: 'Lassi, the shop with no board' },
    ],
    alsoSaved: 'saved the same lanes this month.',
  },
  {
    id: 'mumbai',
    city: 'Mumbai',
    region: 'South Mumbai, Maharashtra',
    video: '/trip/mumbai-csmt.mp4',
    poster: '/trip/mumbai-csmt.jpg',
    label: 'Short video of South Mumbai landmarks, from the Gateway of India to CSMT',
    caption: 'Gateway to CSMT on foot. The best free walk in the city.',
    adds: 'Heritage walk, Gateway to CSMT',
    saved: [
      { kind: 'Place', name: 'Gateway of India at sunrise' },
      { kind: 'Food', name: 'Bun maska at an Irani café' },
      { kind: 'Place', name: 'Asiatic Society steps' },
      { kind: 'Stay', name: 'Colaba flat for a group of 5' },
      { kind: 'Place', name: 'Marine Drive after dark' },
    ],
    alsoSaved: 'saved the same walk this month.',
    loopEnd: 8.8,
  },
];

/**
 * Short travel videos that turn into a trip.
 *
 * Muted, looping and autoplaying — the reel is the product being shown, so it
 * has to be moving when somebody reaches it. It pauses while off screen (a
 * loop under the fold spends battery and data for nothing) and the pause
 * button is always there.
 *
 * It deliberately does NOT hold still for prefers-reduced-motion. Windows sets
 * that whenever "Animation effects" is off, which is common, and honouring it
 * left the section as a still photo on exactly those machines. A muted clip
 * with a visible pause control is the WCAG 2.2.2 requirement, and it has one.
 *
 * The reels play one after the other, like stories, with a progress bar per
 * reel at the top of the screen — so nobody has to discover the toggle to
 * find out there is a second video. The toggle above the phone jumps straight
 * to either.
 *
 * "Add to trip" is live on purpose: pressing it and watching the place land in
 * the list is the whole idea of the feature in one tap, and explains it better
 * than a paragraph could.
 */
export function ReelToTrip() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);

  const show = (index: number) => {
    setActive(index);
    setProgress(0);
    setPlaying(false);
  };
  const next = () => show((active + 1) % REELS.length);

  const reel = REELS[active] ?? REELS[0]!;
  const isAdded = Boolean(added[reel.id]);

  // Re-run for each reel: switching remounts the <video>, so the observer has
  // to be pointed at the new element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !userPaused) {
          // Autoplay can still be refused (Low Power Mode on iOS). The poster
          // and play button are already showing, so there is nothing to do.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [userPaused, active]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  // Advance at the end of a reel — or at its cut point, for a clip that runs
  // on past the part we want.
  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const end = reel.loopEnd ?? video.duration;
    if (!end || !Number.isFinite(end)) return;
    if (video.currentTime >= end) {
      next();
      return;
    }
    setProgress(video.currentTime / end);
  };

  const saved = isAdded ? [{ kind: 'Place' as Kind, name: reel.adds }, ...reel.saved] : reel.saved;

  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-16">
      {/* Phone */}
      <div className="mx-auto w-full max-w-[300px] md:max-w-none">
        {/* A real toggle, with a thumbnail of each reel, so it is obvious at a
            glance that there is more than one video. */}
        <div
          role="tablist"
          aria-label="Travel videos"
          className="mx-auto mb-6 grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full bg-trip-card p-1.5 shadow-[0_1px_2px_rgba(30,28,24,0.08),0_8px_20px_-10px_rgba(30,28,24,0.25)] ring-1 ring-trip-rule"
        >
          {REELS.map((r, i) => {
            const on = i === active;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => show(i)}
                className="relative flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-left"
              >
                {on ? (
                  <motion.span
                    layoutId="reel-toggle"
                    className="absolute inset-0 rounded-full bg-trip-navy"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 transition-[box-shadow] duration-snap',
                    on ? 'ring-trip' : 'ring-transparent',
                  )}
                >
                  <Image src={r.poster} alt="" fill sizes="36px" className="object-cover" />
                </span>
                <span className="relative min-w-0">
                  <span
                    className={cn(
                      'block text-[14px] font-semibold leading-tight transition-colors duration-snap',
                      on ? 'text-white' : 'text-ink',
                    )}
                  >
                    {r.city}
                  </span>
                  <span
                    className={cn(
                      'block whitespace-nowrap font-mono text-[10px] tracking-[0.12em] transition-colors duration-snap',
                      on ? 'text-white/60' : 'text-ink-subtle',
                    )}
                  >
                    {i + 1} / {REELS.length}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <PhoneFrame className="mx-auto max-w-[320px]">
          <div className="relative h-full w-full bg-trip-navy">
            <video
              key={reel.id}
              ref={videoRef}
              src={reel.video}
              poster={reel.poster}
              muted
              autoPlay
              playsInline
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={onTimeUpdate}
              onEnded={next}
              aria-label={reel.label}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Legibility for the overlay, top and bottom only. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 52%, rgba(0,0,0,0.72) 100%)',
              }}
            />

            {/* Story bars, one per reel, just under the Dynamic Island. */}
            <div aria-hidden className="absolute inset-x-[7%] top-[7.5%] flex gap-1.5">
              {REELS.map((r, i) => (
                <span key={r.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full rounded-full bg-white transition-[width] duration-300 ease-linear"
                    style={{ width: i < active ? '100%' : i === active ? `${progress * 100}%` : '0%' }}
                  />
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause video' : 'Play video'}
              className="absolute right-[6%] top-[10.5%] grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
            </button>

            <div className="absolute inset-x-0 bottom-0 px-4 pb-6 text-white">
              <p className="flex items-center gap-1.5 text-[12px] font-medium opacity-90">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> {reel.region}
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">{reel.caption}</p>

              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdded((prev) => ({ ...prev, [reel.id]: !prev[reel.id] }))}
                  aria-pressed={isAdded}
                  className={cn(
                    'col-span-2 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-semibold transition-colors duration-snap',
                    isAdded ? 'bg-white text-black' : 'bg-trip text-white',
                  )}
                >
                  {isAdded ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden />
                  )}
                  {isAdded ? 'Added to your trip' : 'Add to trip'}
                </button>
                <span className="flex items-center justify-center gap-1.5 rounded-full bg-white/15 py-2 text-[12px] font-medium backdrop-blur-md">
                  <Users className="h-3.5 w-3.5" aria-hidden /> Who&apos;s going
                </span>
                <span className="flex items-center justify-center gap-1.5 rounded-full bg-white/15 py-2 text-[12px] font-medium backdrop-blur-md">
                  <BedDouble className="h-3.5 w-3.5" aria-hidden /> Stays nearby
                </span>
              </div>
            </div>
          </div>
        </PhoneFrame>
        <p className="mt-3 text-center text-[12.5px] text-ink-subtle md:hidden">
          Tap <span className="font-medium text-ink-muted">Add to trip</span> to try it
        </p>
      </div>

      {/* The trip it builds, printed as an itinerary. */}
      <div className="min-w-0">
        <div className="rounded-[20px] bg-trip-card px-6 pb-6 pt-7 shadow-[0_1px_2px_rgba(30,28,24,0.08),0_18px_36px_-16px_rgba(30,28,24,0.28)] sm:px-8">
          <div className="flex items-baseline justify-between">
            <Print className="text-trip opacity-100">Itinerary</Print>
            <Print className="tabular-nums">{saved.length} saved</Print>
          </div>
          <p className="mt-3 font-serif text-[40px] leading-none text-ink sm:text-[46px]">
            Your {reel.city} trip
          </p>

          <ol className="mt-6">
            <AnimatePresence initial={false} mode="popLayout">
              {saved.map((item, i) => (
                <motion.li
                  key={`${reel.id}-${item.name}`}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-baseline gap-3 py-2.5">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-ink-subtle">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 text-[15px] leading-snug text-ink">{item.name}</span>
                    <span
                      aria-hidden
                      className="mb-1 min-w-3 flex-1 self-end border-b border-dotted border-trip-rule"
                    />
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em]',
                        item.kind === 'Food' ? 'text-trip' : 'text-ink-subtle',
                      )}
                    >
                      {item.kind}
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>

          <div className="mt-5 flex flex-col gap-4 border-t border-dashed border-trip-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] leading-snug text-ink-muted">
              <span className="font-semibold text-ink">5 people</span> {reel.alsoSaved}
            </p>
            <Button href="/auth" tone="saffron" className="shrink-0">
              Build my trip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

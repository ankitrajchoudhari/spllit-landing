'use client';

import Image from 'next/image';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';
import { PhoneFrame } from '@/components/ui/phone-frame';

const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/**
 * Feature rows. The "visual" for each is built from the same primitives the
 * product uses, so what you see here is the real component vocabulary rather
 * than an illustration of it.
 */
function FeatureRow({
  id,
  eyebrow,
  title,
  body,
  visual,
  flip,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <motion.div
      id={id}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ staggerChildren: 0.1 }}
      className={cn(
        'grid items-center gap-7 py-10 sm:gap-9 sm:py-12 lg:grid-cols-2 lg:gap-20 lg:py-14',
        flip && 'lg:[&>*:first-child]:order-2',
      )}
    >
      <motion.div variants={reveal} transition={{ duration: 0.5 }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
          {eyebrow}
        </p>
        <h3 className="mt-3 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-tight tracking-[-0.025em] text-ink">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-muted">{body}</p>
      </motion.div>

      <motion.div variants={reveal} transition={{ duration: 0.5, delay: 0.1 }}>
        {visual}
      </motion.div>
    </motion.div>
  );
}

/**
 * Ride Together — one auto, five people, nobody covering for everyone.
 *
 * Just the drawing. It carried a small fare card hung off the bottom corner for
 * a while; the card said the same thing the paragraph beside it already says,
 * and a UI panel pasted onto an illustration reads as a sticker rather than as
 * part of either one.
 */
function RideVisual() {
  return (
    <Image
      src="/editorial/auto-full-of-friends.png"
      alt="Five friends riding together in one auto-rickshaw"
      width={1040}
      height={905}
      sizes="(min-width: 1024px) 520px, 90vw"
      {...blurProps('/editorial/auto-full-of-friends.png')}
      className="mx-auto h-auto w-full max-w-[520px]"
    />
  );
}

/**
 * Group Rides — the two screens that actually make one, in order. Real
 * screenshots rather than a drawn approximation, because this is the step
 * people are deciding whether to trust.
 */
function SquadVisual() {
  return (
    <div
      className={cn(
        // A rail on a phone. Two phones shoulder to shoulder inside a 350px
        // column are 157px wide each and nothing on either screen can be read,
        // which makes them decoration. One at a time, at 62% of the viewport,
        // they are legible and the swipe is something to do.
        'no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1',
        'sm:mx-0 sm:items-end sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none',
      )}
    >
      <PhoneFrame
        src="/product/squad-size.jpg"
        alt="Choosing a squad of four people and whether to travel by cab, auto or bike"
        className="w-[62%] shrink-0 snap-center sm:w-[45%] sm:max-w-[228px] sm:shrink sm:translate-y-6"
      />
      <PhoneFrame
        src="/product/squad-ready.jpg"
        alt="The last step before creating a squad: destination, squad size and the safety checks"
        className="w-[62%] shrink-0 snap-center sm:w-[45%] sm:max-w-[228px] sm:shrink sm:-translate-y-2"
      />
    </div>
  );
}

/**
 * Events & Communities.
 *
 * The crowd stands behind the listing rather than beside it, so the card reads
 * as the thing that gathered them. The card itself is unchanged product UI —
 * the photograph is the mood, not the evidence.
 */
function EventVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <Image
        src="/editorial/crowd.png"
        alt="A crowd of people gathered together outdoors"
        width={316}
        height={128}
        sizes="(min-width: 640px) 340px, 70vw"
        {...blurProps('/editorial/crowd.png')}
        className="mx-auto h-auto w-[76%] max-w-[316px]"
      />

      <div className="relative -mt-5 rounded-2xl border border-line bg-surface p-5 shadow-float sm:-mt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-base font-semibold text-ink">Open Mic · Quad</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Tonight, 8:00 PM · Open to all campuses
            </p>
          </div>
          <div className="shrink-0 rounded-md bg-warning-muted px-2.5 py-1.5 text-center">
            <p className="font-display text-base font-bold leading-none text-warning">3h</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-warning">to go</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
          <div className="flex -space-x-2">
            {['A', 'R', 'K', 'M'].map((letter) => (
              <span
                key={letter}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-ink-muted ring-2 ring-surface"
              >
                {letter}
              </span>
            ))}
          </div>
          <span className="text-[13px] text-ink-muted">64 going</span>
        </div>
      </div>
    </div>
  );
}

const SOON = [
  {
    title: 'Rentals',
    body: 'Borrow a bike, a camera, a projector — from people on your campus.',
    src: '/soon/rent-due.png',
    alt: 'A torn rent notice stamped RENT DUE, over a photograph of an apartment block',
    width: 447,
    height: 470,
    // Heights are per picture, not shared: a dense collage, a flat drawing and
    // a cluster of number plates carry very different weight at the same size.
    img: 'h-[134px] sm:h-[152px]',
    sizes: '170px',
  },
  {
    title: 'Bill Splitting',
    body: 'One running balance per person across every ride, rental and dinner.',
    src: '/soon/card-in-hand.png',
    alt: 'A hand holding out a payment card',
    width: 187,
    height: 113,
    img: 'h-[92px] sm:h-[102px]',
    sizes: '160px',
  },
  {
    title: 'Trips',
    body: 'Weekend runs and long hauls, planned in one place. Post the route, fill the seats, split the fuel.',
    src: '/soon/road-trip.png',
    alt: 'Number plates and road signs arranged to read ROAD TRIP',
    width: 260,
    height: 102,
    img: 'h-[68px] sm:h-[78px]',
    sizes: '190px',
  },
];

export function Features() {
  return (
    <div className="mx-auto max-w-6xl px-5 lg:px-8">
      <FeatureRow
        id="rides"
        eyebrow="Ride Together"
        title="The cab you're already taking, shared."
        body="Post where you're going or find someone already headed there. Watch them approach on the map, split the fare automatically, and never negotiate in a group chat again."
        visual={<RideVisual />}
      />

      <FeatureRow
        id="squads"
        eyebrow="Group Rides"
        title="Everyone converging on one point."
        body="A group ride is a group with a place and a time. Set the meeting point once and every member sees where the others are and how long they'll be — live, without asking."
        visual={<SquadVisual />}
        flip
      />

      <FeatureRow
        id="events"
        eyebrow="Events & Communities"
        title="What's happening, actually near you."
        body="Events plot on the same map as everything else, with live attendance. Communities follow who you are — your campus while you are studying, your industry once you are working — and any ride can be limited to women only."
        visual={<EventVisual />}
      />

      {/* Coming soon — deliberately quieter than the shipped features. */}
      <section id="soon" className="border-t border-line py-12 sm:py-16 lg:py-20">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
            Next on the map
          </h3>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
            Coming soon
          </span>
        </div>

        {/* A picture each, on a recessed shelf, instead of a grey line icon.
            These stay quieter than the shipped features — dashed edge, muted
            type, a "soon" tag — because none of them has shipped, but they are
            no longer three identical boxes with a glyph in the corner. */}
        <div
          className={cn(
            // Stacked, three teasers for things that have not shipped cost a
            // thousand pixels of scrolling. On a rail they cost one swipe.
            'no-scrollbar -mx-5 mt-7 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1',
            'sm:mx-0 sm:mt-8 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none',
          )}
        >
          {SOON.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className={cn(
                'w-[74%] shrink-0 snap-start overflow-hidden rounded-xl border border-dashed',
                'border-line bg-surface-sunken sm:w-auto sm:shrink',
              )}
            >
              <div className="relative flex h-[164px] items-center justify-center px-5 sm:h-[184px]">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  sizes={item.sizes}
                  {...blurProps(item.src)}
                  className={cn('w-auto', item.img)}
                />
                <span className="absolute right-3 top-3 rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  Soon
                </span>
              </div>

              <div className="border-t border-dashed border-line p-5">
                <p className="text-sm font-semibold text-ink-muted">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle">
                  {item.body}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}

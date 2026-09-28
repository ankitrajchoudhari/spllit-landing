'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight, Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Where this goes.
 *
 * Three stages of the same idea, not three products: people already travelling
 * the same way, splitting what it costs. The page shows what is shipped and
 * what is coming, but nothing on it said what any of that adds up to — and the
 * question a visitor has after "two cities in testing" is whether that is the
 * whole plan.
 *
 * The three cards are deliberately not identical. A shipped thing, a thing
 * being built and a direction are different kinds of claim, so they are drawn
 * differently: solid and lifted, solid with a brand edge, dashed and quiet. The
 * dashed treatment is borrowed from the "Next on the map" teasers further up,
 * where it already means not shipped yet — a second visual vocabulary for the
 * same idea would just be two things to learn.
 *
 * Marking the last one as anything firmer would be a promise, and the honest
 * version persuades better than a roadmap of certainties nobody believes.
 */

type Status = 'validated' | 'building' | 'intent';

const STAGES: {
  status: Status;
  stage: string;
  title: string;
  body: string;
  proof: string;
  href?: string;
}[] = [
  {
    status: 'validated',
    stage: 'Validated',
    title: 'Campus pooling',
    body: 'Students splitting cabs and forming group rides between hostels, airports and exam centres.',
    proof: 'Running in Chennai and Jaipur',
  },
  {
    status: 'building',
    stage: 'Building next',
    title: 'Spllit Trip',
    body: 'You pick the place. Spllit finds the people going, forms the group, fills the villa and splits the cost — before anyone books.',
    proof: 'In build now',
    href: '/trip',
  },
  {
    status: 'intent',
    stage: 'Long term',
    title: 'A shared travel ecosystem',
    body: 'One place for anything worth not doing alone, and not paying for alone — the ride, the stay, the plan and the split.',
    proof: 'Where this is heading',
  },
];

const reveal = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

/** Filled, ringed, hollow — readable at a glance and in greyscale. */
function Marker({ status }: { status: Status }) {
  if (status === 'validated') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg">
        <Check className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  if (status === 'building') {
    return (
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-brand">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        {/* A slow pulse, only on the stage being worked on. One moving thing
            on a static row reads as progress; three would read as decoration. */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-brand"
          initial={{ opacity: 0.55, scale: 1 }}
          animate={{ opacity: 0, scale: 1.75 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line-strong">
      <span className="h-2 w-2 rounded-full bg-line-strong" />
    </span>
  );
}

export function Trajectory() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
        <motion.div
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[15px]">
            Where this goes
          </p>
          <h2 className="mt-4 font-sans text-[clamp(1.9rem,4.6vw,3rem)] font-medium leading-[1.04] tracking-[-0.04em] text-ink">
            One idea, three stages.
          </h2>
          <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-muted">
            People already going the same way, splitting what it costs. The campus is where that is
            proved; it is not where it stops.
          </p>
        </motion.div>

        <ol className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
          {STAGES.map((item, index) => {
            const intent = item.status === 'intent';
            return (
              <motion.li
                key={item.title}
                variants={reveal}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: index * 0.09 }}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-2xl p-6 sm:p-7',
                  intent
                    ? 'border border-dashed border-line bg-surface-sunken'
                    : 'border bg-surface shadow-soft',
                  // The stage being built gets the brand edge. Nothing else on
                  // the row is allowed it, so it reads as "this one" rather
                  // than as a house style applied three times. A border rather
                  // than a ring with an opacity modifier: those compile to
                  // nothing on these tokens and fall back to a blue default.
                  item.status === 'building' && 'border-brand',
                  item.status === 'validated' && 'border-line',
                )}
              >
                {/* The step number, set large and faded — the same treatment the
                    careers page gives its steps, so the site has one way of
                    numbering things rather than two. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-5 top-4 font-display text-[44px] font-semibold leading-none tracking-[0.02em] text-ink-subtle opacity-25 sm:text-[52px]"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="flex items-center gap-3">
                  <Marker status={item.status} />
                  <span
                    className={cn(
                      'text-[11.5px] font-semibold uppercase tracking-[0.14em]',
                      intent ? 'text-ink-subtle' : 'text-brand',
                    )}
                  >
                    {item.stage}
                  </span>
                </div>

                <h3 className="mt-5 font-sans text-[21px] font-medium leading-[1.2] tracking-[-0.025em] text-ink sm:text-[23px]">
                  {item.href ? (
                    <Link href={item.href} className="inline-flex items-center gap-1.5">
                      {item.title}
                      <ArrowUpRight
                        className="h-4 w-4 text-ink-subtle transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  ) : (
                    item.title
                  )}
                </h3>

                <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-muted">{item.body}</p>

                {/* The claim, pinned to the bottom so the three line up however
                    long the paragraphs above them run. */}
                <p
                  className={cn(
                    'mt-auto pt-6 text-[12.5px] font-medium',
                    intent ? 'text-ink-subtle' : 'text-brand',
                  )}
                >
                  {item.proof}
                </p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

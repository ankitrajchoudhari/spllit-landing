'use client';

import Link from 'next/link';
import { MotionConfig, motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Milestone, MilestoneStatus } from '@/content/about';

/**
 * The company's history drawn as a route: one line, a stop per milestone.
 *
 * A ride product's story told as a list of dated cards looks like every other
 * startup's About page. Drawn as stops on a line it reads as a journey with a
 * current position — which is the honest shape of it: most of the stops are
 * behind, one is where we are, and the last is dashed because it is not
 * reached yet. The dashed treatment is the same one the landing page uses for
 * "not shipped yet", so the two pages share one vocabulary.
 *
 * Each leg draws itself as it scrolls into view, so the line follows the
 * reader down the route.
 */
export function RouteTimeline({ stops }: { stops: Milestone[] }) {
  // reducedMotion="user" rather than branching on useReducedMotion(): that
  // hook is null on the server, so a branch renders different markup on each
  // side and hydration fails. This way both render the same and Motion drops
  // the movement on the client for anyone who asked for less.
  return (
    <MotionConfig reducedMotion="user">
      <ol>
        {stops.map((stop, index) => {
          const next = stops[index + 1];
          return (
            <motion.li
              key={`${stop.when}-${stop.title}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'relative grid grid-cols-[28px_1fr] gap-x-5 sm:gap-x-7',
                next && 'pb-9 sm:pb-11',
              )}
            >
              {/* The leg to the next stop. Each stop draws its own, from under
                its marker to the bottom of its row, so the line meets the next
                marker however long either paragraph runs. A leg into a stop
                not yet reached is dashed and never animates. */}
              {next &&
                (next.status === 'next' ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[13px] top-8 border-l-2 border-dashed border-line-strong"
                  />
                ) : (
                  <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-0.5 bg-line">
                    <motion.span
                      className="absolute inset-0 origin-top bg-brand"
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{
                        duration: 0.7,
                        delay: 0.15,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </span>
                ))}

              <Stop status={stop.status} />

              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className={cn(
                      'font-mono text-[12px] font-medium uppercase tracking-[0.12em]',
                      stop.status === 'next' ? 'text-ink-subtle' : 'text-ink-muted',
                    )}
                  >
                    {stop.when}
                  </span>
                  {stop.status === 'now' && (
                    <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-fg">
                      You are here
                    </span>
                  )}
                </div>

                <h3
                  className={cn(
                    'mt-2 font-sans text-[19px] font-medium leading-snug tracking-[-0.02em] sm:text-[21px]',
                    stop.status === 'next' ? 'text-ink-muted' : 'text-ink',
                  )}
                >
                  {stop.href ? (
                    <Link
                      href={stop.href}
                      className="group decoration-line-strong underline-offset-4 hover:underline"
                    >
                      {stop.title}
                      <ArrowUpRight
                        aria-hidden
                        className="ml-1 inline h-4 w-4 -translate-y-px text-ink-subtle transition-transform duration-snap group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </Link>
                  ) : (
                    stop.title
                  )}
                </h3>
                <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-ink-muted">
                  {stop.body}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </MotionConfig>
  );
}

/** Filled for passed, ringed and pulsing for current, hollow and dashed ahead. */
function Stop({ status }: { status: MilestoneStatus }) {
  if (status === 'done') {
    return (
      <span className="relative z-[1] mt-1 flex h-7 w-7 items-center justify-center">
        <span className="h-3.5 w-3.5 rounded-full border-[3px] border-canvas bg-brand ring-2 ring-brand" />
      </span>
    );
  }
  if (status === 'now') {
    return (
      <span className="relative z-[1] mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-canvas">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
        <span className="relative h-7 w-7 rounded-full border-[7px] border-brand bg-canvas" />
      </span>
    );
  }
  return (
    <span className="relative z-[1] mt-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-canvas" />
  );
}

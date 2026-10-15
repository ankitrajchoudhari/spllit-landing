'use client';

import { Check } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';

import type { LIMITS } from '@/content/about';

/**
 * What Spllit is not, said by crossing it out.
 *
 * Each card sets the assumption large and strikes through it with a drawn,
 * slightly uneven line — a correction made by hand rather than a CSS
 * line-through — then states what is true underneath. The strike draws as the
 * card arrives; reduced motion shows it already drawn.
 */
export function Limits({ items }: { items: typeof LIMITS }) {
  return (
    <MotionConfig reducedMotion="user">
      <ol className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {items.map((item, index) => (
          <motion.li
            key={item.not}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: (index % 2) * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="group relative flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface p-6 shadow-soft sm:p-7"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute right-5 top-4 font-mono text-[12px] text-ink-subtle"
            >
              {String(index + 1).padStart(2, '0')}
            </span>

            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-subtle">
              Spllit is not
            </p>
            <p className="relative mt-3 w-fit pr-1">
              <span className="font-sans text-[clamp(1.5rem,3.2vw,2rem)] font-medium leading-[1.1] tracking-[-0.035em] text-ink-subtle">
                {item.not}
              </span>
              {/* The strike: a single hand-drawn stroke across the phrase. */}
              <svg
                aria-hidden
                viewBox="0 0 200 20"
                preserveAspectRatio="none"
                className="absolute inset-x-[-4px] top-1/2 h-[0.5em] w-[calc(100%+8px)] -translate-y-1/2 overflow-visible"
              >
                <motion.path
                  d="M2 12 C 40 7, 80 13, 120 8 S 180 10, 198 6"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.6, delay: 0.25 + (index % 2) * 0.08, ease: 'easeOut' }}
                />
              </svg>
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{item.body}</p>

            <div className="mt-auto pt-6">
              <div className="flex items-start gap-3 border-t border-line pt-5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <p className="text-[15px] font-medium leading-snug text-ink">
                  <span className="sr-only">Instead: </span>
                  {item.instead}
                </p>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </MotionConfig>
  );
}

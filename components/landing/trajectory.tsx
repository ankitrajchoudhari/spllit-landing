import Link from 'next/link';

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
 * Stated as a sequence with one stage claimed as done, one as in progress and
 * one as intent. Marking the third as anything firmer would be a promise, and
 * the honest version is more persuasive than a roadmap of certainties nobody
 * believes.
 */

type Status = 'validated' | 'building' | 'intent';

const STAGES: {
  status: Status;
  stage: string;
  title: string;
  body: string;
  href?: string;
}[] = [
  {
    status: 'validated',
    stage: 'Validated',
    title: 'Campus pooling',
    body: 'Students splitting cabs and forming group rides on campuses in Chennai and Jaipur. Running, in testing, with real people in real cars.',
  },
  {
    status: 'building',
    stage: 'Building next',
    title: 'Spllit Trip',
    body: 'You pick the place; Spllit finds the people going, forms the group, fills the villa and splits the cost — before anyone books.',
    href: '/trip',
  },
  {
    status: 'intent',
    stage: 'Long term',
    title: 'A shared travel ecosystem',
    body: 'One place for anything worth not doing alone, and not paying for alone — the ride, the stay, the plan and the split.',
  },
];

/**
 * Filled, half, hollow. The marker carries the status on its own, so the
 * meaning survives being read at a glance or in greyscale rather than resting
 * on a colour somebody has to decode.
 */
function Marker({ status }: { status: Status }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative z-[1] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
        status === 'intent' ? 'bg-canvas ring-2 ring-line-strong' : 'bg-brand',
      )}
    >
      {status === 'building' ? (
        // A ring around the filled dot: further along than a plain marker,
        // short of the solid one that says finished.
        <span className="absolute -inset-1 rounded-full ring-2 ring-brand/40" />
      ) : null}
    </span>
  );
}

export function Trajectory() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-ink-subtle sm:text-[15px]">
          Where this goes
        </p>
        <h2 className="mt-4 max-w-[18ch] font-sans text-[clamp(1.9rem,4.6vw,3rem)] font-medium leading-[1.04] tracking-[-0.04em] text-ink">
          One idea, three stages.
        </h2>
        <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-muted">
          People already going the same way, splitting what it costs. The campus is where that is
          proved; it is not where it stops.
        </p>

        <ol className="relative mt-10 grid gap-8 sm:mt-12 sm:grid-cols-3 sm:gap-6 lg:gap-10">
          {/* The through line, behind the markers. Horizontal once the stages
              sit side by side; on a phone they stack and the line would run
              through the text, so it is left off. */}
          <span
            aria-hidden
            className="absolute left-0 right-0 top-[7px] hidden h-px bg-line sm:block"
          />

          {STAGES.map((item) => (
            <li key={item.title} className="relative">
              <div className="flex items-center gap-3">
                <Marker status={item.status} />
                <span
                  className={cn(
                    'bg-canvas pr-3 text-[11.5px] font-semibold uppercase tracking-[0.14em]',
                    item.status === 'intent' ? 'text-ink-subtle' : 'text-brand',
                  )}
                >
                  {item.stage}
                </span>
              </div>

              <h3 className="mt-4 font-sans text-[21px] font-medium tracking-[-0.025em] text-ink sm:text-[23px]">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="underline-offset-[6px] transition-colors duration-snap hover:underline"
                  >
                    {item.title}
                  </Link>
                ) : (
                  item.title
                )}
              </h3>

              <p className="mt-2.5 max-w-[38ch] text-[14.5px] leading-relaxed text-ink-muted">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

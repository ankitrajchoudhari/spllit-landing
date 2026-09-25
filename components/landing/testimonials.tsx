import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * ⚠️ PLACEHOLDER COPY. These are written examples, not real quotes from real
 * students. Replace every entry with an attributed quote you actually have
 * permission to use before launch — invented testimonials on a live marketing
 * page are a straightforward misrepresentation.
 *
 * The avatars are deliberately illustrated rather than photographic, for the
 * same reason: a stock headshot next to an invented quote reads as a real
 * person who said a thing they never said. They are generated from the name as
 * a seed by scripts/generate-avatars.mjs and served as static SVGs, so nothing
 * is fetched from a third party at render time.
 */
const TESTIMONIALS = [
  {
    quote:
      'Four of us were booking separate cabs to the airport in the same hour. Now we just split one.',
    name: 'Meera K.',
    detail: 'IIT Madras',
    avatar: '/avatars/meera-k.svg',
  },
  {
    quote:
      'The map is the part that clicked for me. You can see who is actually heading your way instead of guessing in a group chat.',
    name: 'Arjun R.',
    detail: 'VIT Chennai',
    avatar: '/avatars/arjun-r.svg',
  },
  {
    quote:
      'Campus email verification means it is never a stranger. That is the only reason I use it at night.',
    name: 'Divya S.',
    detail: 'Anna University',
    avatar: '/avatars/divya-s.svg',
  },
];

export function Testimonials({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <p className="px-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle lg:px-8">
        From campus
      </p>

      {/* A rail on a phone, a grid from md. Three stacked cards were six hundred
          pixels of scrolling for three sentences. */}
      <ul
        className={cn(
          'no-scrollbar mt-6 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1 sm:mt-8',
          'md:mx-auto md:max-w-6xl md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-6 md:pb-0 md:snap-none lg:px-8',
        )}
      >
        {TESTIMONIALS.map((entry) => (
          <li
            key={entry.name}
            className={cn(
              'relative flex w-[84%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl',
              'border border-line bg-surface p-5 shadow-soft sm:w-[62%] sm:p-6 md:w-auto md:shrink',
            )}
          >
            {/* Watermark, set in the dead space to the right of the name so it
                is texture behind the card rather than a second thing to read.
                It sat at the top corner first and the card clipped it into a
                grey wedge that read as a rendering fault. */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-1 right-4 select-none font-display text-[76px] leading-[0.62] text-line-strong"
            >
              &rdquo;
            </span>

            <p className="relative flex-1 text-[14.5px] leading-relaxed text-ink sm:text-[15px]">
              {entry.quote}
            </p>

            <div className="relative mt-6 flex items-center gap-3 border-t border-line pt-4">
              <Image
                src={entry.avatar}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="h-11 w-11 shrink-0 rounded-full ring-1 ring-line"
              />
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-ink">
                  {entry.name}
                </span>
                <span className="block truncate text-[12.5px] text-ink-muted">
                  {entry.detail}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

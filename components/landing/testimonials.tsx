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

/** Copies in the track. Two halves of two sets each: the loop shifts by half
 * the track, and one set of three cards is narrower than a wide screen, so a
 * half needs two sets or the end of the row shows before it wraps. */
const COPIES = 4;

/**
 * One continuous row, drifting left. Hovering or focusing a card stops it so a
 * quote can be read to the end.
 *
 * It keeps moving under reduced motion, at half speed, by decision: Windows
 * reports reduced motion whenever "Animation effects" is off, which is common
 * on office and laptop installs, and a row that silently stood still there was
 * read as broken. A slow linear drift with pause-on-hover is the gentlest form
 * of motion there is; no parallax, no scaling, nothing flashing. The
 * override lives in globals.css as .marquee-keep.
 */
export function Testimonials({ className }: { className?: string }) {
  const track = Array.from({ length: COPIES }, () => TESTIMONIALS).flat();

  return (
    <div className={cn('w-full', className)}>
      <p className="px-5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle lg:px-8">
        From campus
      </p>

      <div
        className="group no-scrollbar relative mt-6 overflow-hidden sm:mt-8"
        style={{
          // Cards dissolve at both edges rather than being cut by the viewport.
          maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        }}
      >
        {/* Spacing is each card's own right margin, not a gap on the track:
            the loop shifts by exactly half the track, and with a gap the two
            halves differ by one gap, so the row would jump on every repeat. */}
        <ul
          className="flex w-max animate-marquee py-2 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] marquee-keep [animation-duration:55s]"
        >
          {track.map((entry, index) => {
            // Only the first set is read out; the rest exist to fill the loop.
            const copy = index >= TESTIMONIALS.length;
            return (
              <li
                key={`${entry.name}-${index}`}
                aria-hidden={copy || undefined}
                className="relative mr-4 flex w-[290px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-soft sm:mr-5 sm:w-[360px] sm:p-6"
              >
                {/* Watermark, set in the dead space to the right of the name so
                    it is texture behind the card rather than a second thing to
                    read. */}
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
            );
          })}
        </ul>
      </div>
    </div>
  );
}

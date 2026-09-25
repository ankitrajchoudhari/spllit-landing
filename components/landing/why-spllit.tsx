import Image from 'next/image';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';

/**
 * The first thing below the map: why this exists at all.
 *
 * Deliberately a server component with no scroll reveal. It sits immediately
 * under a full-viewport hero, so it is the first thing anyone scrolls to — and
 * anything that waits for hydration before it becomes visible reads as an empty
 * page at exactly the moment someone is deciding whether to keep scrolling.
 * It paints with the HTML.
 *
 * The three images are the argument, not decoration, and they run in order:
 * the question that goes unasked, the arithmetic nobody does, and the money
 * back in your hand. They are cut-outs on bare canvas rather than pictures in
 * boxes — a card around each one would turn a composed row into a template.
 */

const BEATS = [
  {
    n: '01',
    src: '/editorial/is-this-a-date.png',
    alt: 'A chat message reading "So, is this a date?" between two people sitting at separate cafe tables',
    width: 554,
    height: 117,
    // A 4.7:1 strip. Sized by width, not height — matching its height to the
    // portraits beside it would shrink the message until nobody could read it,
    // and the message is the whole point of the picture.
    img: 'h-auto w-full',
    sizes: '(min-width: 1024px) 425px, 92vw',
    title: 'The question nobody asks',
    body: 'You both reach for the card. One of you gets there first. It never comes up again.',
  },
  {
    n: '02',
    src: '/editorial/dollar-question.png',
    alt: 'A banknote folded into the shape of a question mark, with a coin as the dot',
    width: 322,
    height: 550,
    img: 'h-[152px] w-auto sm:h-[196px] lg:h-[248px]',
    sizes: '(min-width: 1024px) 150px, 132px',
    title: 'The maths nobody does',
    body: '₹840 for the cab. Four people. One of them got out at the second stop. So — call it even?',
  },
  {
    n: '03',
    src: '/editorial/coins-in-hand.png',
    alt: 'An open hand holding a jar filled with gold coins',
    width: 378,
    height: 454,
    img: 'h-[138px] w-auto sm:h-[178px] lg:h-[224px]',
    sizes: '(min-width: 1024px) 190px, 170px',
    title: 'Your share, worked out for you',
    body: 'Spllit splits the fare the moment the ride ends, and does the asking. You just get your money back.',
  },
];

export function WhySpllit() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        {/* Headline left, standfirst set down and to the right against it.
            Centring both would have made this the fourth centred block on the
            page and flattened the one place the page should sound like it has
            a point of view. */}
        <div className="grid gap-y-5 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
              Why we built this
            </p>
            <h2 className="mt-4 font-sans text-[clamp(1.9rem,4.4vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              Somebody always ends up paying for everyone.
            </h2>
          </div>

          <p className="text-[16px] leading-relaxed text-ink-muted lg:col-span-4 lg:col-start-9 lg:self-end lg:pb-2">
            It was never really about the money. It&apos;s about being the one who has to
            bring it up.
          </p>
        </div>

        {/* Columns are sized to the pictures rather than split into equal
            thirds, and every cut-out stands on the same baseline, so the row
            reads as one composed still life instead of three tiles. */}
        {/* A swipeable rail on a phone, a grid from lg.

            Stacked, these three beats were nine hundred pixels of nothing but
            downward scrolling. Side by side on a rail they are one gesture, and
            the card width is deliberately under a full screen so the edge of the
            next one shows and the swipe advertises itself. */}
        <div
          className={cn(
            'no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-1',
            'sm:-mx-6 sm:mt-12 sm:gap-6 sm:px-6 sm:scroll-px-6',
            'lg:mx-0 lg:mt-12 lg:grid lg:snap-none lg:gap-x-10 lg:overflow-x-visible lg:px-0 lg:pb-0',
            'lg:grid-cols-[1.25fr_0.85fr_0.9fr]',
          )}
        >
          {BEATS.map((beat) => (
            <article
              key={beat.n}
              className="flex w-[82%] shrink-0 snap-start flex-col sm:w-[56%] lg:w-auto lg:shrink"
            >
              {/* Centred, not sat on the rule. The strip is a fifth of the height of
                  the cut-outs beside it, so a shared baseline left a hole above it;
                  centring turns the same space into framing. The fixed height
                  applies only side by side — stacked it would be a hole again. */}
              <div className="flex h-[168px] items-center sm:h-[210px] lg:h-[248px]">
                <Image
                  src={beat.src}
                  alt={beat.alt}
                  width={beat.width}
                  height={beat.height}
                  sizes={beat.sizes}
                  loading="eager"
                  {...blurProps(beat.src)}
                  className={beat.img}
                />
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[11px] font-semibold tabular-nums tracking-[0.2em] text-ink-subtle">
                  {beat.n}
                </p>
                <h3 className="mt-3 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                  {beat.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[14.5px] leading-relaxed text-ink-muted">
                  {beat.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

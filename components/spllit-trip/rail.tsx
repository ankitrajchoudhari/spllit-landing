'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A horizontal row that a mouse can move too.
 *
 * Phones swipe it. A desktop visitor with a mouse wheel has no sideways
 * gesture, so there are two arrows: one where the row begins, one where it
 * ends, both centred on the pictures. Each fades out when there is nowhere
 * left to go that way.
 *
 * `className` styles the scrolling row; `frameClassName` the box around it,
 * which is where `--h` (the picture height) should be set so the arrows can
 * centre on it.
 */
export function Rail({
  children,
  className,
  frameClassName,
}: {
  children: React.ReactNode;
  className?: string;
  frameClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: reduced ? 'auto' : 'smooth' });
  };

  const arrow = cn(
    'absolute top-[calc(var(--h)/2+3rem)] z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full lg:grid',
    'bg-trip-card text-ink shadow-raised ring-1 ring-trip-rule transition-opacity duration-sheet hover:bg-trip hover:text-white',
  );

  return (
    <div className={cn('relative', frameClassName)}>
      <div ref={ref} onScroll={measure} className={className}>
        {children}
      </div>

      {/* Left arrow where the first picture begins; right arrow where the
          pictures run off the screen. */}
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous"
        tabIndex={atStart ? -1 : 0}
        className={cn(
          arrow,
          'left-[max(2rem,calc(50%_-_34rem))] -translate-x-1/2',
          atStart && 'pointer-events-none opacity-0',
        )}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="Next"
        tabIndex={atEnd ? -1 : 0}
        className={cn(arrow, 'right-8', atEnd && 'pointer-events-none opacity-0')}
      >
        <ArrowRight className="h-4 w-4" />
      </button>

      <p className="mt-4 px-5 font-hand text-[19px] text-ink-subtle sm:px-6 lg:hidden">swipe for more →</p>
    </div>
  );
}

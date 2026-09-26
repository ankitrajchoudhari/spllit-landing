import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Travel paper for the Spllit Trip page.
 *
 * Tickets are kept for one job: showing a price. A fare belongs on a stub;
 * everything else on the page is plain paper, so the ticket still means
 * something when it appears. The shape is a CSS mask (see .ticket-shape in
 * app/globals.css) — rounded, with a notch only where the stub tears off.
 */

type Tone = 'card' | 'saffron' | 'navy';

const TONE: Record<Tone, string> = {
  card: 'bg-trip-card text-ink',
  saffron: 'bg-trip text-white',
  navy: 'bg-trip-navy text-white',
};

const PERF: Record<Tone, string> = {
  card: 'border-trip-rule',
  saffron: 'border-white/45',
  navy: 'border-white/25',
};

/** Two stacked drop-shadows: a contact line and a soft lift. A mask clips box-shadow. */
const LIFT =
  '[filter:drop-shadow(0_1px_1px_rgba(30,28,24,0.08))_drop-shadow(0_14px_22px_rgba(30,28,24,0.12))]';

export function Ticket({
  children,
  stub,
  stubSize = 104,
  vertical = false,
  radius = 16,
  hole = 10,
  tone = 'card',
  lift = true,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  stub: ReactNode;
  /** Width of the stub, or its height when `vertical`. */
  stubSize?: number;
  vertical?: boolean;
  radius?: number;
  hole?: number;
  tone?: Tone;
  lift?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const style = {
    '--stub': `${stubSize}px`,
    '--radius': `${radius}px`,
    '--hole': `${hole}px`,
  } as CSSProperties;

  return (
    <div className={cn('relative', lift && LIFT, className)}>
      <div
        style={style}
        className={cn(vertical ? 'ticket-shape-v flex-col' : 'ticket-shape', 'flex h-full', TONE[tone])}
      >
        <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
        <div className="relative shrink-0" style={vertical ? { height: stubSize } : { width: stubSize }}>
          {/* The perforation, stopping short of the notches. */}
          <span
            aria-hidden
            className={cn(
              'absolute border-dashed',
              vertical
                ? 'left-[calc(var(--hole)+6px)] right-[calc(var(--hole)+6px)] top-0 border-t-2'
                : 'bottom-[calc(var(--hole)+6px)] left-0 top-[calc(var(--hole)+6px)] border-l-2',
              PERF[tone],
            )}
          />
          {stub}
        </div>
      </div>
    </div>
  );
}

/** Small uppercase ticket print: field labels, codes, fine print. */
export function Print({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] opacity-60', className)}
    >
      {children}
    </span>
  );
}

/**
 * A barcode that is the same every render for the same value, so it never
 * shifts between server and client. It encodes nothing — it is a picture of
 * a barcode, and is hidden from screen readers accordingly.
 */
export function Barcode({
  value,
  vertical = false,
  className,
}: {
  value: string;
  vertical?: boolean;
  className?: string;
}) {
  const bars: { at: number; w: number }[] = [];
  let at = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i) * 7 + i * 13;
    const run = [(c % 3) + 1, ((c >> 1) % 2) + 1, ((c >> 3) % 3) + 1, ((c >> 2) % 2) + 1];
    run.forEach((w, j) => {
      if (j % 2 === 0) bars.push({ at, w });
      at += w;
    });
  }

  return (
    <svg
      aria-hidden
      viewBox={vertical ? `0 0 10 ${at}` : `0 0 ${at} 10`}
      preserveAspectRatio="none"
      className={cn('fill-current', className)}
    >
      {bars.map((bar, i) =>
        vertical ? (
          <rect key={i} x={0} y={bar.at} width={10} height={bar.w} />
        ) : (
          <rect key={i} x={bar.at} y={0} width={bar.w} height={10} />
        ),
      )}
    </svg>
  );
}

/**
 * A rubber stamp: ring text, a big centre mark, and ink that is not quite
 * even — a whisper of displacement keeps it from looking like a vector icon.
 * `id` must be unique on the page; it names the SVG path and filter.
 */
export function Stamp({
  id,
  ring,
  big,
  small,
  className,
}: {
  id: string;
  ring: string;
  big: string;
  small: string;
  className?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 140 140" className={cn('text-trip', className)}>
      <defs>
        <path id={`${id}-ring`} d="M70,70 m-51,0 a51,51 0 1,1 102,0 a51,51 0 1,1 -102,0" />
        <filter id={`${id}-ink`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-ink)`}>
        <circle cx="70" cy="70" r="66" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="70" cy="70" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="70" cy="70" r="39" fill="none" stroke="currentColor" strokeWidth="1" />
        <text fill="currentColor" fontSize="10.5" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          <textPath href={`#${id}-ring`} textLength="316" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
        <text
          x="70"
          y="78"
          textAnchor="middle"
          fill="currentColor"
          fontSize="36"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {big}
        </text>
        <text
          x="70"
          y="95"
          textAnchor="middle"
          fill="currentColor"
          fontSize="8"
          letterSpacing="1.6"
          style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
        >
          {small}
        </text>
      </g>
    </svg>
  );
}

/** The page's button. `href` may be a route or a mailto. */
export function Button({
  href,
  children,
  tone = 'navy',
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: 'navy' | 'saffron';
  className?: string;
}) {
  const cls = cn(
    'group inline-flex items-center justify-center gap-3 rounded-full py-4 pl-7 pr-6 text-[15px] font-medium tracking-[-0.01em]',
    'transition-all duration-snap hover:-translate-y-0.5 active:translate-y-0',
    tone === 'navy' ? 'bg-trip-navy text-white' : 'bg-trip text-white',
    className,
  );
  const inner = (
    <>
      {children}
      <span aria-hidden className="transition-transform duration-snap group-hover:translate-x-0.5">
        →
      </span>
    </>
  );
  return href.startsWith('mailto:') ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/**
 * A real phone: the iPhone frame artwork laid over the screen content.
 *
 * The screen box is measured off the artwork (356 × 701, screen at 30,30 →
 * 325,670 with ~40px corners) and set in percentages so it scales with the
 * frame. It bleeds a pixel under the bezel on every side so no paper shows
 * through at the seam. The Dynamic Island is part of the artwork, so content
 * should leave ~7% clear at the top.
 */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[356/701] w-full [filter:drop-shadow(0_24px_40px_rgba(30,28,24,0.22))]',
        className,
      )}
    >
      <div
        className="absolute overflow-hidden bg-trip-paper"
        style={{ left: '8.15%', top: '4.1%', width: '83.7%', height: '91.8%', borderRadius: '14% / 6.5%' }}
      >
        {children}
      </div>
      <Image
        src="/trip/iphone-frame.png"
        alt=""
        aria-hidden
        fill
        sizes="(min-width: 1024px) 360px, 80vw"
        className="pointer-events-none select-none"
      />
    </div>
  );
}

import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EventQr } from '@/components/landing/event-qr';

/**
 * The featured event as a scrapbook page on black: a cut-paper shopfront with
 * the poster in its window, taped down, and a torn ticket stub pinned beside
 * it carrying a QR code for the registration form.
 *
 * Everything is flat paper on a dark board — no glow, no gradients posing as
 * light. What gives it depth is what a real scrapbook has: tape, a slight
 * tilt, a hard paper shadow, a torn edge.
 *
 * The poster is portrait (2:3), the shape event posters are made in, and is
 * shown whole: a poster with its date cut off is worse than one with a margin.
 */

export const PAPER = '#f2eee4';
export const BOARD = '#0e0e0d';
const GREEN = '#16a34a';

const STRIPES = 8;
const W = 240;
const TOP_INSET = 18;
const DROP = 44;
const SCALLOP = W / STRIPES / 2;

function Awning({ className }: { className?: string }) {
  const topW = (W - TOP_INSET * 2) / STRIPES;
  const bottomW = W / STRIPES;
  return (
    <svg viewBox={`0 0 ${W} ${DROP + SCALLOP + 2}`} aria-hidden className={className}>
      {Array.from({ length: STRIPES }, (_, i) => {
        const fill = i % 2 === 0 ? GREEN : PAPER;
        const x0 = TOP_INSET + topW * i;
        const x1 = TOP_INSET + topW * (i + 1);
        const b0 = bottomW * i;
        const b1 = bottomW * (i + 1);
        return (
          <g key={i}>
            <polygon points={`${x0},0 ${x1},0 ${b1},${DROP} ${b0},${DROP}`} fill={fill} />
            <path d={`M${b0} ${DROP} A${SCALLOP} ${SCALLOP} 0 0 0 ${b1} ${DROP} Z`} fill={fill} />
          </g>
        );
      })}
      <rect x={TOP_INSET - 3} y="0" width={W - TOP_INSET * 2 + 6} height="4" rx="2" fill={PAPER} />
    </svg>
  );
}

/** A strip of masking tape. */
export function Tape({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute z-[3] block h-[18px] w-[62px] sm:h-5 sm:w-[72px]', className)}
      style={{
        background: 'rgba(214, 196, 150, 0.82)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        // Torn ends: a strip of tape is never cut square.
        clipPath:
          'polygon(3% 8%, 97% 0%, 100% 30%, 96% 55%, 100% 82%, 97% 100%, 2% 94%, 0% 66%, 4% 44%, 0% 18%)',
      }}
    />
  );
}

const RIBBON = {
  open: { label: 'Open', bg: '#16a34a', fg: '#ffffff' },
  live: { label: 'Live', bg: '#f59e0b', fg: '#0e0e0d' },
  closed: { label: 'Closed', bg: '#dc2626', fg: '#ffffff' },
} as const;

/**
 * A band of tape-like ribbon across the poster's top-left corner — the
 * corner the ticket never covers. Folded ends are suggested by the darker
 * tail triangles; the band itself is flat, like everything else here.
 */
function Ribbon({ kind }: { kind: keyof typeof RIBBON }) {
  const { label, bg, fg } = RIBBON[kind];
  return (
    <span
      aria-label={`Registration ${kind === 'open' ? 'open' : kind === 'live' ? 'closed, event live' : 'closed'}`}
      role="img"
      className="pointer-events-none absolute left-0 top-0 z-[2] block h-[92px] w-[92px] overflow-hidden sm:h-[108px] sm:w-[108px]"
    >
      <span
        className="absolute left-[-34px] top-[20px] block w-[150px] -rotate-45 py-1 text-center font-mono text-[11px] font-bold uppercase tracking-[0.26em] sm:left-[-38px] sm:top-[24px] sm:w-[170px] sm:py-1.5 sm:text-[12px]"
        style={{
          background: bg,
          color: fg,
          boxShadow: '0 2px 0 rgba(0,0,0,0.25)',
          // A faint stitch line on both edges, the way ribbon is finished.
          backgroundImage:
            'linear-gradient(transparent 2px, rgba(255,255,255,0.35) 2px, rgba(255,255,255,0.35) 3px, transparent 3px, transparent calc(100% - 3px), rgba(255,255,255,0.35) calc(100% - 3px), rgba(255,255,255,0.35) calc(100% - 2px), transparent calc(100% - 2px))',
        }}
      >
        {label}
      </span>
    </span>
  );
}

/** Zig-zag top and bottom, like a stub torn from a roll of tickets. */
const STUB_EDGE = (() => {
  const teeth = 9;
  const top = Array.from(
    { length: teeth * 2 + 1 },
    (_, i) => `${(i / (teeth * 2)) * 100}% ${i % 2 ? 4 : 0}%`,
  );
  const bottom = Array.from(
    { length: teeth * 2 + 1 },
    (_, i) => `${100 - (i / (teeth * 2)) * 100}% ${i % 2 ? 96 : 100}%`,
  );
  return `polygon(${[...top, ...bottom].join(', ')})`;
})();

export function EventShop({
  poster,
  alt,
  title,
  registerUrl,
  showQr,
  ribbon,
  className,
}: {
  poster: string;
  alt: string;
  title: string;
  registerUrl: string;
  /** Only while registration is open: a code to a closed form is a dead end. */
  showQr: boolean;
  /** The band across the poster's corner. */
  ribbon: 'open' | 'live' | 'closed';
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-full', className)}>
      <Awning className="relative z-[2] block w-full" />

      {/* The window: a sheet of paper under the awning, the poster taped in. */}
      <div
        className="relative z-[1] mx-auto -mt-[11%] w-[86%] rounded-b-[18px] rounded-t-[6px] p-2.5 pt-[13%] sm:p-3 sm:pt-[13%]"
        style={{ background: PAPER, boxShadow: '6px 6px 0 0 rgba(242,238,228,0.14)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[6px]"
          style={{ background: 'linear-gradient(180deg, rgba(14,14,13,0.16), transparent)' }}
        />
        <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[#e6e1d4]">
          <Ribbon kind={ribbon} />
          {poster ? (
            <Image
              src={poster}
              alt={alt || `Poster for ${title}`}
              fill
              sizes="(min-width: 1024px) 330px, (min-width: 640px) 300px, 72vw"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full flex-col justify-end p-5" style={{ background: GREEN }}>
              <p className="font-sans text-[clamp(1.4rem,6vw,2rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                {title}
              </p>
            </div>
          )}
        </div>
        <Tape className="-bottom-2 -left-4 -rotate-[24deg]" />
        <Tape className="-bottom-2 -right-4 rotate-[22deg]" />
      </div>

      {/* The kerb, and the road line in front of the shop. */}
      <div aria-hidden className="relative mx-auto w-[104%] -translate-x-[2%]">
        <div className="mt-2 h-[7px] rounded-[2px]" style={{ background: PAPER }} />
        <div
          className="mx-auto mt-3 h-[3px] w-[86%]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(242,238,228,0.35) 0 18px, transparent 18px 32px)',
          }}
        />
      </div>

      {/* The ticket stub with the QR, pinned over the shop's corner. Tapping
          it opens the form too, because on a phone nobody can scan their own
          screen. */}
      {showQr && (
        <a
          href={registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group absolute -right-[33%] bottom-[5%] z-[4] block w-[86px] rotate-[6deg] transition-transform duration-sheet hover:rotate-[2deg] hover:scale-[1.04] sm:-right-[34%] sm:bottom-[12%] sm:w-[120px] lg:-right-[36%] lg:w-[132px]"
        >
          <Tape className="-top-2.5 left-1/2 -translate-x-1/2 -rotate-[4deg]" />
          <span
            className="block px-2 pb-2.5 pt-3.5 text-center sm:px-3 sm:pb-3 sm:pt-4"
            style={{
              background: PAPER,
              clipPath: STUB_EDGE,
              filter: 'drop-shadow(4px 5px 0 rgba(0,0,0,0.45))',
            }}
          >
            <span className="block font-mono text-[8.5px] uppercase tracking-[0.22em] text-[#0e0e0d]/60 sm:text-[9px]">
              Admit one
            </span>
            <EventQr value={registerUrl} className="mx-auto mt-1.5 block w-full" />
            <span className="mt-1.5 flex items-center justify-center gap-1 font-hand text-[15px] font-semibold leading-[0.95] text-[#0e0e0d] sm:text-[19px]">
              <span className="sm:hidden">tap to register</span>
              <span className="hidden sm:inline">scan to register</span>
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 sm:hidden" />
            </span>
          </span>
          <span className="sr-only">Register (opens a Google Form in a new tab)</span>
        </a>
      )}
    </div>
  );
}

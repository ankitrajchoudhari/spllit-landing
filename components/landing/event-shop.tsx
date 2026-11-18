import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A shopfront for the featured event: a striped awning over a white window,
 * with the event's poster displayed in the window.
 *
 * Drawn rather than an image so the poster can sit inside it at any size and
 * the awning stays crisp on every screen. The awning is a trapezoid of eight
 * stripes — narrower at the top, as if seen from just below — ending in a
 * scalloped edge, one scallop per stripe.
 *
 * The poster is portrait (2:3), the shape event posters are made in. It is
 * shown whole, not cropped: a poster with its date cut off is worse than one
 * with a margin.
 */

const STRIPES = 8;
const W = 240; // viewBox width
const TOP_INSET = 18; // how much narrower the awning is at the top, per side
const DROP = 44; // height of the striped part
const SCALLOP = W / STRIPES / 2;

function Awning({ className }: { className?: string }) {
  const topW = (W - TOP_INSET * 2) / STRIPES;
  const bottomW = W / STRIPES;
  return (
    <svg viewBox={`0 0 ${W} ${DROP + SCALLOP + 2}`} aria-hidden className={className}>
      <defs>
        {/* A soft shade across the bottom, so the awning reads as cloth
            catching light rather than as a flat sticker. */}
        <linearGradient id="awning-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      {Array.from({ length: STRIPES }, (_, i) => {
        const fill = i % 2 === 0 ? '#1fb34f' : '#8fe3a8';
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
      <polygon
        points={`${TOP_INSET},0 ${W - TOP_INSET},0 ${W},${DROP} 0,${DROP}`}
        fill="url(#awning-shade)"
      />
      {/* The rail the awning hangs from. */}
      <rect
        x={TOP_INSET - 2}
        y="0"
        width={W - TOP_INSET * 2 + 4}
        height="3"
        rx="1.5"
        fill="#0d6b2c"
      />
    </svg>
  );
}

export function EventShop({
  poster,
  alt,
  title,
  className,
}: {
  poster: string;
  alt: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[380px]', className)}>
      {/* The glow the shop stands in. */}
      <div
        aria-hidden
        className="absolute inset-x-[6%] bottom-[2%] top-[14%] rounded-[32px] bg-[#2bd35f] opacity-35 blur-[48px]"
      />

      <Awning className="relative z-[2] block w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)]" />

      {/* The window. Tucked a few pixels up under the awning so the scallops
          overhang it, the way an awning does. */}
      <div className="relative z-[1] mx-auto -mt-[11%] w-[86%] rounded-b-[26px] rounded-t-[10px] bg-[#f6f7f4] p-3 pt-[14%] shadow-[0_24px_60px_-18px_rgba(0,0,0,0.6)] sm:p-3.5 sm:pt-[14%]">
        {/* The awning's shadow falling across the top of the window. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[10px]"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.12), transparent)' }}
        />
        <div className="relative aspect-[2/3] overflow-hidden rounded-[18px] bg-[#e9ece6] ring-1 ring-black/5">
          {poster ? (
            <Image
              src={poster}
              alt={alt || `Poster for ${title}`}
              fill
              sizes="(min-width: 1024px) 330px, 80vw"
              className="object-contain"
            />
          ) : (
            // No poster yet: the title set as one, so the window is never empty.
            <div className="flex h-full flex-col justify-end bg-[radial-gradient(120%_80%_at_20%_0%,#8fe3a8_0%,#1fb34f_45%,#0b5e30_100%)] p-6">
              <p className="font-sans text-[clamp(1.6rem,6vw,2.2rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                {title}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

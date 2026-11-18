import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A shopfront for the featured event: a striped awning over a white window
 * with the event's poster in it, standing on a strip of pavement.
 *
 * Drawn rather than an image so the poster can sit inside it at any size and
 * the awning stays crisp on every screen. The awning is a trapezoid of eight
 * stripes — narrower at the top, as if seen from just below — ending in a
 * scalloped edge, one scallop per stripe.
 *
 * It is lit like the rest of the site: flat colour and a real contact shadow,
 * no glow. The kerb and the dashed road line put the shop on a street, which
 * is where a ride app's events happen.
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
      {Array.from({ length: STRIPES }, (_, i) => {
        const fill = i % 2 === 0 ? '#16a34a' : '#f4f6f2';
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
      {/* One crisp outline round the whole awning, the way a drawing is inked,
          instead of shading it to look rendered. */}
      <path
        d={[
          `M${TOP_INSET} 0 L${W - TOP_INSET} 0 L${W} ${DROP}`,
          ...Array.from(
            { length: STRIPES },
            (_, i) => `A${SCALLOP} ${SCALLOP} 0 0 1 ${W - bottomW * (i + 1)} ${DROP}`,
          ),
          'Z',
        ].join(' ')}
        fill="none"
        stroke="#0f3d22"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* The rail the awning hangs from. */}
      <rect
        x={TOP_INSET - 3}
        y="0"
        width={W - TOP_INSET * 2 + 6}
        height="3.5"
        rx="1.75"
        fill="#0f3d22"
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
    <div className={cn('relative mx-auto w-full', className)}>
      <Awning className="relative z-[2] block w-full" />

      {/* The window, tucked up under the awning so the scallops overhang it. */}
      <div className="relative z-[1] mx-auto -mt-[11%] w-[86%] rounded-b-[22px] rounded-t-[8px] border-[1.5px] border-[#0f3d22] bg-[#fbfcfa] p-2.5 pt-[13%] sm:p-3 sm:pt-[13%]">
        {/* The awning's shadow across the top of the glass. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[8px]"
          style={{ background: 'linear-gradient(180deg, rgba(15,61,34,0.10), transparent)' }}
        />
        <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] bg-[#eef1ec]">
          {poster ? (
            <Image
              src={poster}
              alt={alt || `Poster for ${title}`}
              fill
              sizes="(min-width: 1024px) 330px, (min-width: 640px) 300px, 72vw"
              className="object-contain"
            />
          ) : (
            // No poster yet: the title set as one, so the window is never empty.
            <div className="flex h-full flex-col justify-end bg-[#16a34a] p-5">
              <p className="font-sans text-[clamp(1.4rem,6vw,2rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                {title}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* The street: a kerb the shop stands on, its contact shadow, and the
          dashed centre line of the road in front of it. */}
      <div aria-hidden className="relative mx-auto mt-0 w-[104%] -translate-x-[2%]">
        <div className="mx-auto h-3 w-[92%] rounded-full bg-[rgba(15,61,34,0.18)] blur-[6px]" />
        <div className="-mt-2 h-[9px] rounded-[3px] border-[1.5px] border-[#0f3d22] bg-[#dfe3dc]" />
        <div
          className="mx-auto mt-3 h-[3px] w-[86%]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--line-strong) 0 18px, transparent 18px 32px)',
          }}
        />
      </div>
    </div>
  );
}

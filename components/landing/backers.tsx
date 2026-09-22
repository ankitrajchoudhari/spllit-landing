import Image from 'next/image';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';

/**
 * Who stands behind Spllit — incubator, programmes and technology partners.
 *
 * The logos sit inside a raised panel rather than on a full-bleed white band.
 * A white section was both the brightest thing on the page and a hard edge
 * against the canvas above it; a panel keeps the white where the logos need it
 * — behind the artwork — while the section itself stays on canvas and the page
 * reads continuously through it.
 *
 * ASSET NOTE: the two Sarvam files named `-dark` and `-light` are named after
 * the *ink*, not the theme they belong to. `-dark` is the near-black artwork
 * and therefore the one the light canvas gets; `-light` is the near-white
 * artwork for the dark canvas. Both are rendered and swapped with `dark:`
 * utilities rather than read from a theme hook, so the right one is in the
 * first paint and there is no flash of the wrong mark.
 *
 * SIZING: heights are set per logo, not shared, because these marks carry very
 * different amounts of internal padding — MSME is a compact square that needs
 * real height to carry any weight, the NVIDIA badge is a wide box that already
 * has presence, and the Sarvam lockup is a wordmark that gets wide long before
 * it gets tall. Matching their heights makes them look mismatched; these values
 * are tuned so they read as equals, and so the partner row fits on one line at
 * every width where the two columns sit side by side.
 */

/**
 * Dark-mode backing for logos that only exist as dark artwork on transparency.
 *
 * MSME (near-black lettering, gold emblem) and VELS (navy type, green leaves)
 * vanish once the panel itself goes dark, and a filter-based inversion would
 * take their gold and green with it. A white plate is how both marks are meant
 * to be reproduced on a dark ground, so they keep their own colours. Geometry
 * is identical in both themes — only the fill appears — so nothing shifts when
 * the theme changes.
 *
 * The NVIDIA badge is deliberately not plated: it ships with its own white
 * field and black keyline, and already reads on either panel.
 */
function Plate({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-lg px-3 py-2 dark:bg-white', className)}>
      {children}
    </span>
  );
}

/**
 * Label pinned to the top of the row, logos centred in whatever height is left.
 * Centring each column as a whole instead left the two labels sitting at
 * different heights whenever one column ran taller than the other.
 */
function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <p className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-7 flex flex-1 flex-wrap items-center justify-center gap-x-7 gap-y-7 lg:mt-9 lg:gap-x-10 xl:gap-x-14">
        {children}
      </div>
    </div>
  );
}

export function Backers() {
  return (
    <section id="backers" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <h2 className="text-center font-display text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em] text-ink">
          Backed By The Best
        </h2>
        <span
          aria-hidden
          className="mx-auto mt-5 block h-[3px] w-16 rounded-full bg-gradient-to-r from-accent to-brand"
        />

        <div className="mt-9 rounded-2xl border border-line bg-surface p-7 shadow-raised sm:mt-12 lg:p-10 xl:p-12">
          {/* The two groups form one centred cluster. Letting the partner
              column take the leftover width instead pushed the whole thing off
              centre and left a dead half-panel to the right of it. */}
          <div className="flex flex-col lg:flex-row lg:justify-center">
            <Group label="Incubated by" className="lg:shrink-0 lg:pr-10 xl:pr-16">
              <Plate>
                <Image
                  src="/backers/vels-innovation-council.png"
                  alt="VELS Innovation Council"
                  width={718}
                  height={347}
                  sizes="(min-width: 1280px) 220px, (min-width: 1024px) 190px, 160px"
                  {...blurProps('/backers/vels-innovation-council.png')}
                  className="h-[72px] w-auto lg:h-[88px] xl:h-[104px]"
                />
              </Plate>
            </Group>

            <Group
              label="Partners"
              className={cn(
                'mt-9 border-t border-line pt-9',
                'lg:mt-0 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:pl-16',
              )}
            >
              <Plate>
                <Image
                  src="/backers/msme.png"
                  alt="MSME"
                  width={109}
                  height={108}
                  sizes="112px"
                  {...blurProps('/backers/msme.png')}
                  className="h-[68px] w-auto lg:h-24 xl:h-[104px]"
                />
              </Plate>

              <Image
                src="/backers/nvidia-inception.png"
                alt="NVIDIA Inception Program"
                width={501}
                height={217}
                sizes="(min-width: 1280px) 170px, (min-width: 1024px) 135px, 110px"
                {...blurProps('/backers/nvidia-inception.png')}
                className="h-11 w-auto lg:h-14 xl:h-[72px]"
              />

              {/* Mark and wordmark set as a lockup; both halves swap together. */}
              <span className="inline-flex items-center gap-2 lg:gap-2.5 xl:gap-3">
                <Image
                  src="/backers/sarvam-logomark-dark.svg"
                  alt=""
                  width={253}
                  height={250}
                  unoptimized
                  className="h-8 w-auto lg:h-9 xl:h-11 dark:hidden"
                />
                <Image
                  src="/backers/sarvam-logomark-light.svg"
                  alt=""
                  width={253}
                  height={250}
                  unoptimized
                  className="hidden h-8 w-auto lg:h-9 xl:h-11 dark:block"
                />
                <Image
                  src="/backers/sarvam-wordmark-dark.svg"
                  alt="Sarvam AI"
                  width={631}
                  height={100}
                  unoptimized
                  className="h-[18px] w-auto lg:h-5 xl:h-6 dark:hidden"
                />
                <Image
                  src="/backers/sarvam-wordmark-light.svg"
                  alt="Sarvam AI"
                  width={632}
                  height={100}
                  unoptimized
                  className="hidden h-[18px] w-auto lg:h-5 xl:h-6 dark:block"
                />
              </span>
            </Group>
          </div>
        </div>
      </div>
    </section>
  );
}

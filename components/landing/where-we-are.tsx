'use client';

import Image from 'next/image';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';

/**
 * Where Spllit actually runs today.
 *
 * The two stamps are not decoration: Chennai and Jaipur are the only cities the
 * product is being tested in, so the map is a status board rather than a
 * picture of India. Each stamp lands next to its own city and a leader runs
 * back to a pin on the spot — the stamp is the label, the pin is the claim.
 *
 * The stamps arrive on scroll rather than on load. A visitor scrolling into
 * this section sees an empty map for a beat and then two cities appearing on
 * it, which is the whole point: this is a map that is still filling up.
 */

const CITIES = [
  {
    name: 'Jaipur',
    src: '/editorial/stamp-jaipur.png',
    alt: 'A travel stamp for Jaipur, the Pink City, showing the Hawa Mahal',
    width: 373,
    height: 533,
    /**
     * Read off the illustration, not off an atlas. This is a drawn sticker with
     * its own proportions, so the coordinates come from plotting candidate dots
     * on the artwork and keeping the ones that landed on the right city —
     * Jaipur in eastern Rajasthan, Chennai on the Coromandel coast. They belong
     * to this map file and have to be re-derived if it is ever swapped.
     */
    pin: { left: '26%', top: '31%' },
    stamp: 'left-[-4%] top-[-3%] w-[28%] max-w-[122px] sm:max-w-[140px] lg:left-[-8%]',
    leader: { left: '20%', width: '6%', top: '31%' },
    tilt: -4,
    delay: 0,
  },
  {
    name: 'Chennai',
    src: '/editorial/stamp-chennai.png',
    alt: 'A postage stamp for Chennai showing the Marina Beach seafront',
    width: 343,
    height: 429,
    pin: { left: '37%', top: '76%' },
    // Out over the Bay of Bengal: the one corner of this map with nothing on it.
    stamp: 'right-[1%] bottom-[2%] w-[32%] max-w-[136px] sm:max-w-[154px]',
    leader: { left: '37%', width: '28%', top: '76%' },
    tilt: 3,
    delay: 0.16,
  },
];

function Pin({ left, top, delay }: { left: string; top: string; delay: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.3, delay: delay + 0.1 }}
      style={{ left, top }}
      className="absolute z-[3] block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-canvas"
    >
      {/* The same ring the live map markers use, so a city here reads as the
          same kind of object as a ride there. */}
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
    </motion.span>
  );
}

export function WhereWeAre() {
  return (
    <section className="border-t border-line bg-surface-sunken">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:py-24">
        <div className="text-center lg:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            Where we are now
          </p>

          {/* Set big on purpose. This is the only number on the page that is a
              fact about the company rather than a feature, and at ordinary
              subhead size it read like just another section title. */}
          <h2 className="mt-5 font-sans text-[clamp(2.4rem,6.2vw,4.4rem)] font-medium leading-[0.95] tracking-[-0.05em] text-ink">
            Two cities in,
            <br />
            <span className="text-ink-muted">and counting.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-md font-sans text-[16px] leading-relaxed text-ink-muted lg:mx-0">
            Spllit is in testing in Chennai and Jaipur. Real rides, real groups, on
            the same live map — with the next city already in the queue.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            {CITIES.map((city) => (
              <li
                key={city.name}
                className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5 shadow-soft"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                </span>
                <span className="font-display text-[15px] font-semibold text-ink">
                  {city.name}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  In testing
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The stamps park in the empty corners of the sticker rather than on
            top of it — covering the country in order to label two cities on it
            would be a strange way round. */}
        <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[400px] lg:max-w-[460px]">
          <Image
            src="/editorial/india-map.png"
            alt="An illustrated map of India"
            width={481}
            height={492}
            sizes="(min-width: 1024px) 460px, 85vw"
            {...blurProps('/editorial/india-map.png')}
            className="h-auto w-full"
          />

          {CITIES.map((city) => (
            <motion.span
              key={city.name + '-leader'}
              aria-hidden
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: city.delay + 0.22 }}
              style={{ left: city.leader.left, width: city.leader.width, top: city.leader.top }}
              className="absolute z-[1] block border-t border-dashed border-ink-muted"
            />
          ))}

          {CITIES.map((city) => (
            <Pin key={city.name} left={city.pin.left} top={city.pin.top} delay={city.delay} />
          ))}

          {CITIES.map((city) => (
            <motion.div
              key={city.name}
              initial={{ opacity: 0, scale: 0.7, y: 18, rotate: city.tilt - 6 }}
              whileInView={{ opacity: 1, scale: 1, y: 0, rotate: city.tilt }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15, delay: city.delay }}
              className={cn(
                'absolute z-[2] drop-shadow-[0_10px_28px_rgba(16,24,20,0.22)]',
                city.stamp,
              )}
            >
              <Image
                src={city.src}
                alt={city.alt}
                width={city.width}
                height={city.height}
                sizes="(min-width: 640px) 155px, 36vw"
                {...blurProps(city.src)}
                className="h-auto w-full rounded-[3px]"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

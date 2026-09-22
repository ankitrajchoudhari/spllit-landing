'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { Facebook, Instagram, Linkedin, Twitter, type LucideIcon } from 'lucide-react';

import { Testimonials } from '@/components/landing/testimonials';
import { blurProps } from '@/lib/image-blur';

/**
 * Landing footer.
 *
 * This replaces a full-viewport photograph of a road with a vehicle layer
 * parallaxing through it. That version spent a whole screen of scrolling to
 * deliver one picture, and the card sitting on the photo had to be nailed to
 * the light treatment — white panel, neutral-900 type — because ink-on-surface
 * tokens would have put white text on a white card. The footer was the one part
 * of the page that could never follow the theme.
 *
 * Now the artwork is a single cut-out driving along a dashed line over the same
 * faint street map the closing call to action uses, everything else is drawn
 * from tokens, and the whole thing works in both themes at a couple of hundred
 * pixels instead of a viewport.
 */

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/rides', label: 'Ride Together' },
      { href: '/squads', label: 'Group Rides' },
      { href: '/events', label: 'Events' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/careers', label: 'Careers' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/safety', label: 'Safety' },
    ],
  },
];

/**
 * Handles are placeholders — no Spllit social accounts exist in the codebase
 * yet. Point these at the real profiles before launch; a dead social link in
 * the footer is worse than none at all.
 */
const SOCIALS: { label: string; href: string; Icon: LucideIcon }[] = [
  { label: 'Facebook', href: 'https://facebook.com/spllit', Icon: Facebook },
  { label: 'Twitter', href: 'https://twitter.com/spllit', Icon: Twitter },
  { label: 'Instagram', href: 'https://instagram.com/spllit', Icon: Instagram },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/spllit', Icon: Linkedin },
];

export function ParallaxFooter() {
  const roadRef = useRef<HTMLDivElement>(null);

  /**
   * `end end` rather than `end start`: nothing scrolls past a footer, so a
   * range that only completes once the section leaves the top of the screen
   * would leave the car stranded mid-journey at the bottom of the page.
   */
  const { scrollYProgress } = useScroll({
    target: roadRef,
    offset: ['start end', 'end end'],
  });
  /**
   * The car is positioned by its TRAILING edge, not its leading one.
   *
   * A plain left percentage is a fraction of the container, and the car is a
   * fraction of the container too — a much larger one on a phone. 84% parked it
   * neatly on a desktop and drove it clean off the right-hand edge at 390px.
   * Offsetting the car by its own width means 100% always lands its right edge
   * on the container edge, whatever either of them measures.
   */
  /**
   * Shorter travel, and sprung.
   *
   * Mapping the whole scroll range onto almost the full width made the car
   * cross the footer in a flick — scroll speed became car speed, so it read as
   * darting rather than driving. It now covers a third of that distance, and
   * the spring lets it lag the scroll slightly and settle, which is what reads
   * as weight.
   */
  const carTarget = useTransform(scrollYProgress, [0, 1], ['62%', '100%']);
  const carLeft = useSpring(carTarget, { stiffness: 42, damping: 18, mass: 1.1 });

  return (
    <>
      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <Testimonials />
      </section>

      <footer className="relative overflow-hidden border-t border-line">
        {/* Same street map as the closing call to action, on multiply so only
            the roads and parks tint the canvas. Light mode only: multiplying a
            near-white photograph into a near-black canvas returns black. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 dark:hidden">
          <Image
            src="/product/map-texture.jpg"
            alt=""
            fill
            sizes="100vw"
            {...blurProps('/product/map-texture.jpg')}
            className="object-cover opacity-70 mix-blend-multiply"
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div ref={roadRef} className="pt-10 sm:pt-14">
            <div className="relative h-[54px] sm:h-[74px] lg:h-[86px]">
              <motion.div style={{ left: carLeft }} className="absolute bottom-0">
                <div className="relative w-[136px] -translate-x-full sm:w-[196px] lg:w-[240px]">
                  <Image
                    src="/editorial/red-car.png"
                    alt=""
                    width={320}
                    height={95}
                    sizes="(min-width: 1024px) 240px, (min-width: 640px) 196px, 136px"
                    {...blurProps('/editorial/red-car.png')}
                    className="h-auto w-full"
                  />

                  {/* Exhaust. Three puffs on the same loop at staggered delays
                      read as a continuous trail without needing a sprite, and
                      they leave from the car's back end — the tail fins are on
                      the left, so the smoke drifts left as it climbs. */}
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute bottom-[14%] left-[1%] block h-2.5 w-2.5 rounded-full bg-ink-subtle blur-[1.5px]"
                      animate={{
                        x: [0, -42],
                        y: [0, -16],
                        scale: [0.5, 2.7],
                        opacity: [0.45, 0],
                      }}
                      transition={{
                        duration: 2.1,
                        repeat: Infinity,
                        delay: i * 0.7,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* The road: a centre line, not a border. */}
            <div
              aria-hidden
              className="h-[2px] w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, var(--line-strong) 0 22px, transparent 22px 44px)',
              }}
            />
          </div>

          <div className="flex flex-col gap-10 py-10 sm:py-12 md:flex-row md:justify-between md:gap-8 lg:py-14">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <Image
                  src="/logo-icon.png"
                  alt=""
                  width={48}
                  height={48}
                  className="h-10 w-10 rounded-lg lg:h-11 lg:w-11"
                />
                <span className="font-display text-2xl font-bold tracking-tighter text-ink lg:text-3xl">
                  Spllit
                </span>
              </Link>
              <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-ink-muted">
                Campus rides, group rides and events on one live map — split down
                the middle before anyone gets out of the car.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-16">
              {COLUMNS.map((column) => (
                <div key={column.title}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                    {column.title}
                  </p>
                  {/* Padding on the link rather than gap between rows: these
                      were 17px tall, which is a fine click target and a poor
                      thumb target. The row pitch is unchanged — the space just
                      moved inside the tappable area. */}
                  <ul className="mt-4 space-y-0.5 sm:space-y-2">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="block py-3 text-sm font-medium text-ink-muted transition-colors duration-snap hover:text-brand sm:py-1"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-5 border-t border-line py-6 sm:flex-row">
            <p className="text-sm text-ink-subtle">
              © {new Date().getFullYear()} Spllit. All rights reserved.
            </p>
            <div className="flex gap-3">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted transition-all duration-snap hover:border-brand hover:bg-brand hover:text-brand-fg"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

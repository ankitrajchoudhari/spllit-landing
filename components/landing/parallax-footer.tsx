'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { Facebook, Instagram, Linkedin, Twitter, type LucideIcon } from 'lucide-react';

import { Testimonials } from '@/components/landing/testimonials';

/**
 * Landing footer with a two-speed scroll: the road photograph is pinned to the
 * section while the vehicle layer travels through it, so the page reads as
 * arriving somewhere rather than simply ending.
 *
 * The card is deliberately fixed to the light treatment — it always sits on a
 * photograph, so the usual ink/surface tokens (which invert in dark mode)
 * would put white text on a white card. Neutral scale utilities are used
 * inside the card for exactly that reason; brand colour still comes from the
 * `brand` token, which is the same green in both themes.
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
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ target: sectionRef });
  // The vehicle runs 200px against a section that scrolls a full viewport,
  // which is the whole parallax effect. Starting above zero means it is
  // already in shot when the section enters, rather than sliding up into it.
  const vehicleY = useTransform(scrollYProgress, [0, 1], [-50, 150]);

  return (
    <>
      {/* Run-up. The parallax below needs travel to be scrolled *through*, but
          half a viewport of nothing is dead weight — testimonials give the
          same scroll distance something to be. */}
      <section className="bg-surface py-12 sm:py-16 lg:py-20">
        <Testimonials />

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.45 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mt-10 text-center text-[11px] font-bold uppercase tracking-[0.5em] text-ink-subtle sm:mt-14 lg:mt-20"
        >
          View Below
        </motion.p>
      </section>

      <section
        ref={sectionRef}
        className="relative h-dvh overflow-hidden bg-[url('/footer/footer-road.webp')] bg-cover bg-center"
      >
        <div className="absolute top-0 w-full px-4 pt-12 sm:px-6 md:pt-24 lg:pt-12">
          <motion.footer
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="mx-auto max-w-7xl overflow-hidden rounded-xl bg-white/95 shadow-xl backdrop-blur-sm lg:rounded-2xl"
          >
            <div className="flex flex-col justify-between gap-10 p-6 sm:p-8 md:flex-row md:gap-8 lg:p-10">
              <Link href="/" className="flex items-center gap-3 self-start">
                <Image
                  src="/logo-icon.png"
                  alt=""
                  width={48}
                  height={48}
                  className="h-10 w-10 rounded-lg shadow-inner lg:h-12 lg:w-12"
                />
                <span className="font-display text-2xl font-bold tracking-tighter text-neutral-900 lg:text-3xl">
                  Spllit
                </span>
              </Link>

              <div className="flex flex-wrap gap-x-12 gap-y-8 sm:gap-x-16">
                {COLUMNS.map((column) => (
                  <div key={column.title}>
                    <p className="text-sm font-bold uppercase tracking-widest text-neutral-900">
                      {column.title}
                    </p>
                    <ul className="mt-4 space-y-2.5">
                      {column.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="text-sm font-medium text-neutral-500 transition-colors duration-300 hover:text-brand"
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

            <div className="flex flex-col items-center justify-between gap-5 border-t border-neutral-100 bg-white px-6 py-5 sm:flex-row sm:px-8 lg:px-10">
              <p className="text-sm font-medium text-neutral-500">
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
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-100 text-neutral-500 transition-all duration-300 hover:border-brand hover:bg-brand hover:text-brand-fg"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </motion.footer>
        </div>

        <motion.div
          aria-hidden
          style={{ y: vehicleY }}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-full"
        >
          {/* Scaled per breakpoint rather than sized: the artwork is a wide
              crop, so on narrow viewports object-contain would shrink it to a
              sliver across the bottom of the section. */}
          <Image
            src="/footer/footer-vehicle.webp"
            alt=""
            fill
            sizes="100vw"
            className="origin-bottom scale-[1.5] object-contain object-bottom sm:scale-110 md:scale-[2.0] lg:scale-105"
          />
        </motion.div>
      </section>
    </>
  );
}

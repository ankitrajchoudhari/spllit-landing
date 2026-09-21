'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { SignInDrawer } from '@/components/ui/family-signin-drawer';

const LINKS = [
  { href: '#rides', label: 'Rides' },
  { href: '#squads', label: 'Group Rides' },
  { href: '#events', label: 'Events' },
];

/**
 * Marketing nav: wordmark left, links optically centred, actions right.
 *
 * No background of its own — it sits on the hero's white-to-transparent fade,
 * which is what keeps it legible over the map without a solid bar cutting the
 * image in half.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative flex items-center justify-between px-6 pb-4 pt-5 lg:px-20 lg:pt-6">
      <Link href="/" className="select-none">
        <span className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[40px]">
          spllit
        </span>
      </Link>

      {/* Absolutely centred so the links stay put regardless of how wide the
          wordmark or the action group become. */}
      <div className="absolute left-1/2 hidden -translate-x-1/2 gap-8 md:flex">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="nav-control text-ink">
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-6 lg:gap-8">
        {/* Opens in place. Sign-in used to navigate away, which threw away
            whatever the visitor had typed into the hero prompt. */}
        <SignInDrawer>
          <button
            type="button"
            className="nav-control hidden font-semibold text-[#292929] md:block dark:text-ink"
          >
            Login
          </button>
        </SignInDrawer>

        <Link
          href="/auth"
          className={cn(
            'hidden rounded-full bg-ink px-5 py-3.5 font-sans text-[15px] font-medium uppercase',
            'tracking-[0.04em] text-canvas transition-all duration-snap',
            'hover:opacity-85 active:scale-95 md:block',
          )}
        >
          Sign up
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="rounded-md p-1.5 text-ink md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-6 top-full z-50 rounded-2xl border border-line bg-surface p-3 shadow-float md:hidden"
          >
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-3 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <SignInDrawer>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-1 block w-full rounded-full bg-ink px-5 py-3.5 text-center font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-canvas"
              >
                Sign up
              </button>
            </SignInDrawer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}

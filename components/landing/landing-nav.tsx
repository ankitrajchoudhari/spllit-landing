'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@/lib/utils';
import { SignInDrawer } from '@/components/ui/family-signin-drawer';

/**
 * Two sections of the home page, then real routes.
 *
 * The section links keep a real href, so they work with JavaScript off and
 * can be copied, opened in a new tab and shared. With JavaScript the click is
 * intercepted and the page scrolled instead, leaving the address bar on
 * spllit.app rather than spllit.app/#rides — a hash in the bar reads as a
 * one-page template, and that bar is what somebody copies to share the site.
 */
const SECTION_SCROLL = 'spllit.nav.section';

/**
 * Product first, then the company — in the order someone deciding whether to
 * use it would want them. `group` splits the desktop bar with a rule so the
 * two kinds of link read as two kinds.
 */
const LINKS: { href: string; label: string; section?: string; group: 'product' | 'company' }[] = [
  { href: '/#squads', label: 'Group Rides', section: 'squads', group: 'product' },
  { href: '/#events', label: 'Events', section: 'events', group: 'product' },
  { href: '/trip', label: 'Trip', group: 'product' },
  { href: '/about', label: 'About', group: 'company' },
  { href: '/blog', label: 'Blog & News', group: 'company' },
  { href: '/careers', label: 'Careers', group: 'company' },
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
  const router = useRouter();
  const pathname = usePathname();

  const scrollToSection = useCallback((section: string) => {
    const target = document.getElementById(section);
    if (!target) return;
    // Honour the system setting rather than animating over it. Somebody who
    // asked for less motion asked for a reason.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, []);

  /**
   * Finish a jump that began on another page, and tidy away a hash somebody
   * arrived with.
   *
   * Links to /#rides already exist in the wild and keep working; the hash is
   * then swapped out with replaceState, which changes the bar without adding a
   * history entry to press back through.
   */
  useEffect(() => {
    if (pathname !== '/') return;

    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(SECTION_SCROLL);
      if (pending) sessionStorage.removeItem(SECTION_SCROLL);
    } catch {
      // Private browsing can refuse sessionStorage. The jump is lost; the page
      // still opens, which is the part that matters.
      pending = null;
    }

    const hash = window.location.hash.replace('#', '');
    const section = pending ?? (hash || null);
    if (!section) return;

    if (hash) window.history.replaceState(null, '', window.location.pathname);
    // A frame later, so the section has been laid out and can be measured.
    requestAnimationFrame(() => scrollToSection(section));
  }, [pathname, scrollToSection]);

  const onSectionClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, section: string | undefined) => {
      // A real route, or a click the browser should own — a new tab, a saved
      // link, a middle click. Intercepting any of those would break it.
      if (!section) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      setOpen(false);

      if (pathname === '/') {
        scrollToSection(section);
        return;
      }

      try {
        sessionStorage.setItem(SECTION_SCROLL, section);
      } catch {
        // Without storage the home page simply opens at the top.
      }
      router.push('/');
    },
    [pathname, router, scrollToSection],
  );

  return (
    <nav className="relative flex items-center justify-between px-6 pb-4 pt-5 lg:px-20 lg:pt-6 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-8">
      <Link href="/" className="-my-1 select-none justify-self-start py-1">
        <span className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[40px]">
          spllit
        </span>
      </Link>

      {/* The middle column of a 1fr/auto/1fr grid: centred on the page, with
          equal room either side however wide the wordmark or the actions run.
          Absolute centring did the first but not the second, so the links sat
          a hand's width from Login and twice that from the wordmark. */}
      <div
        className="hidden items-center rounded-full border border-line p-1.5 shadow-soft backdrop-blur-md xl:flex"
        style={{ background: 'color-mix(in srgb, var(--surface) 72%, transparent)' }}
      >
        {LINKS.map((link, index) => {
          const active = !link.section && pathname.startsWith(link.href);
          const groupStart = index > 0 && LINKS[index - 1]?.group !== link.group;
          return (
            <Fragment key={link.href}>
              {groupStart && <span aria-hidden className="mx-1.5 h-5 w-px bg-line-strong" />}
              <a
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => onSectionClick(event, link.section)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-2 font-sans text-[14.5px] font-medium transition-colors duration-snap',
                  active
                    ? 'bg-ink text-canvas'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                {link.label}
              </a>
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 justify-self-end">
        {/* Opens in place. Sign-in used to navigate away, which threw away
            whatever the visitor had typed into the hero prompt. */}
        <SignInDrawer>
          <button
            type="button"
            className="hidden rounded-full px-5 py-3 font-sans text-[14.5px] font-semibold text-ink transition-colors duration-snap hover:bg-surface-sunken xl:block"
          >
            Log in
          </button>
        </SignInDrawer>

        <Link
          href="/auth"
          className={cn(
            'hidden rounded-full bg-ink px-6 py-3 font-sans text-[14.5px] font-semibold',
            'text-canvas transition-all duration-snap',
            'hover:opacity-85 active:scale-95 xl:block',
          )}
        >
          Sign up
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="-mr-1 rounded-md p-2.5 text-ink xl:hidden"
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
            className="absolute inset-x-6 top-full z-50 rounded-2xl border border-line bg-surface p-3 shadow-float xl:hidden"
          >
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  setOpen(false);
                  onSectionClick(event, link.section);
                }}
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

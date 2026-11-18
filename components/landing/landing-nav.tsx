'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  CalendarDays,
  Info,
  Menu,
  Newspaper,
  Plane,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
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
 * use it would want them. `group` splits the bar with a rule so the two kinds
 * of link read as two kinds. `icon` appears on the link while it is current.
 */
const LINKS: {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  group: 'product' | 'company';
}[] = [
  { href: '/#squads', label: 'Group Rides', icon: Users, section: 'squads', group: 'product' },
  { href: '/#events', label: 'Events', icon: CalendarDays, section: 'events', group: 'product' },
  { href: '/trip', label: 'Trip', icon: Plane, group: 'product' },
  { href: '/about', label: 'About', icon: Info, group: 'company' },
  { href: '/blog', label: 'Blog & News', icon: Newspaper, group: 'company' },
  { href: '/careers', label: 'Careers', icon: Briefcase, group: 'company' },
];

const SECTIONS = LINKS.flatMap((link) => (link.section ? [link.section] : []));

/** How long a click owns the highlight while the page scrolls to its section. */
const CLICK_LOCK_MS = 1200;

/**
 * Marketing nav: wordmark left, links centred, actions right.
 *
 * No background of its own — it sits on the hero's white-to-transparent fade,
 * which is what keeps it legible over the map without a solid bar cutting the
 * image in half.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  /** On the home page: the section the reader is in, or just clicked. */
  const [section, setSection] = useState<string | null>(null);
  const lockUntil = useRef(0);

  const scrollToSection = useCallback((target: string) => {
    const element = document.getElementById(target);
    if (!element) return;
    // Honour the system setting rather than animating over it. Somebody who
    // asked for less motion asked for a reason.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
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
    const target = pending ?? (hash || null);
    if (!target) return;

    if (hash) window.history.replaceState(null, '', window.location.pathname);
    lockUntil.current = Date.now() + CLICK_LOCK_MS;
    // A frame later, so the section has been laid out and can be measured.
    requestAnimationFrame(() => {
      setSection(SECTIONS.includes(target) ? target : null);
      scrollToSection(target);
    });
  }, [pathname, scrollToSection]);

  /**
   * Scroll spy for the home page's sections: the highlight follows the reader
   * from Group Rides to Events and back.
   *
   * A click takes the highlight at once and holds it while the smooth scroll
   * runs — otherwise Events, clicked from the top, would light up Group Rides
   * on the way past it.
   */
  useEffect(() => {
    if (pathname !== '/') return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (Date.now() < lockUntil.current) return;
        // Moves to a section when the reader reaches one, but is never cleared:
        // this nav is not fixed, so the only time anyone sees it is back at the
        // top — and what they should see there is where they last went.
        const current = SECTIONS.find((id) => visible.has(id));
        if (current) setSection(current);
      },
      // A band across the middle of the screen: a section counts once it
      // fills the reader's eyeline, not when its first pixel appears.
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const id of SECTIONS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [pathname]);

  const onSectionClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, target: string | undefined) => {
      // A real route, or a click the browser should own — a new tab, a saved
      // link, a middle click. Intercepting any of those would break it.
      if (!target) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

      event.preventDefault();
      setOpen(false);
      setSection(target);
      lockUntil.current = Date.now() + CLICK_LOCK_MS;

      if (pathname === '/') {
        scrollToSection(target);
        return;
      }

      try {
        sessionStorage.setItem(SECTION_SCROLL, target);
      } catch {
        // Without storage the home page simply opens at the top.
      }
      router.push('/');
    },
    [pathname, router, scrollToSection],
  );

  return (
    <nav className="relative flex items-center justify-between px-6 pb-4 pt-5 md:grid md:grid-cols-[auto_1fr_auto] md:gap-4 lg:px-20 lg:pt-6 xl:grid-cols-[1fr_auto_1fr] xl:gap-8">
      <Link href="/" className="-my-1 select-none justify-self-start py-1">
        <span className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[40px]">
          spllit
        </span>
      </Link>

      {/* Tablet and up. The current link wears a dark pill with its icon. The
          pill is one shared layout element, so choosing another link slides it
          across while the old link settles back to plain text.

          A 1fr/auto/1fr grid on desktop keeps the bar truly centred with equal
          room either side; on a tablet the sides cannot afford equal widths,
          so the bar takes the middle column and centres itself in it. */}
      <div
        className="hidden items-center justify-self-center rounded-full border border-line p-1.5 shadow-soft backdrop-blur-md md:flex"
        style={{ background: 'color-mix(in srgb, var(--surface) 72%, transparent)' }}
      >
        {LINKS.map((link, index) => {
          const active = link.section
            ? pathname === '/' && section === link.section
            : pathname.startsWith(link.href);
          const groupStart = index > 0 && LINKS[index - 1]?.group !== link.group;
          const Icon = link.icon;
          return (
            <Fragment key={link.href}>
              {groupStart && (
                <span aria-hidden className="mx-1 h-5 w-px bg-line-strong xl:mx-1.5" />
              )}
              <a
                href={link.href}
                aria-current={active ? (link.section ? 'location' : 'page') : undefined}
                onClick={(event) => onSectionClick(event, link.section)}
                className={cn(
                  'relative flex items-center whitespace-nowrap rounded-full px-3 py-2 font-sans text-[13.5px] font-medium transition-colors duration-snap xl:px-4 xl:text-[14.5px]',
                  active ? 'text-canvas' : 'text-ink-muted hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="landing-nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-ink shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      key="icon"
                      aria-hidden
                      initial={{ width: 0, opacity: 0, scale: 0.4, rotate: -30 }}
                      animate={{ width: 22, opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ width: 0, opacity: 0, scale: 0.4 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      className="relative flex shrink-0 items-center overflow-hidden"
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="relative">{link.label}</span>
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
            className="absolute inset-x-6 top-full z-50 rounded-2xl border border-line bg-surface p-3 shadow-float md:left-auto md:w-64 lg:right-20 xl:hidden"
          >
            {/* On a phone the menu carries the links; on a tablet they are in
                the bar, so the menu is only the way in. */}
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  setOpen(false);
                  onSectionClick(event, link.section);
                }}
                className="block rounded-lg px-3 py-3 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-ink-muted hover:bg-surface-sunken hover:text-ink md:hidden"
              >
                {link.label}
              </a>
            ))}
            <SignInDrawer>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="hidden w-full rounded-full px-5 py-3 text-center font-sans text-[15px] font-semibold text-ink hover:bg-surface-sunken md:block"
              >
                Log in
              </button>
            </SignInDrawer>
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

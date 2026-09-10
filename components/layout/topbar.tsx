'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { Bell } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-provider';
import { useUnreadCount } from '@/lib/hooks/queries';
import { SearchToolbar } from '@/components/layout/search-toolbar';
import { HostModeSwitch } from '@/components/host/mode-switch';
import { NotificationsPanel } from '@/components/notifications/notifications-panel';
import { AccountMenu } from '@/components/layout/account-menu';

/**
 * Header. Navigation lives in the dock, so this carries only identity
 * (the logo), search and notifications.
 */
export function TopBar() {
  const { profile } = useAuth();
  const { data: unread } = useUnreadCount(Boolean(profile));

  const [panelOpen, setPanelOpen] = useState(false);

  /**
   * The panel is portalled, so it no longer inherits the bell's position and
   * has to be told where to sit. Measured from the trigger rather than
   * hard-coded: the header height differs between breakpoints, and a fixed
   * offset would drift on any screen that is not the one it was tuned on.
   */
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState({ top: 72, right: 16 });
  const measure = useCallback(() => {
    const el = bellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({
      top: Math.round(r.bottom + 8),
      right: Math.round(Math.max(window.innerWidth - r.right, 8)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    measure();
    // Scroll matters as much as resize: the header is sticky, so the bell can
    // move under the panel while it is open.
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [panelOpen, measure]);

  const count = unread?.count ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas backdrop-blur-glass">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <Link href="/home" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt="Spllit"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md"
            priority
          />
          {/* The wordmark moved here from the sidebar; it is the only place the
              product still names itself inside the app. */}
          <span className="hidden font-display text-[15px] font-semibold tracking-[-0.02em] text-ink sm:block">
            Spllit
          </span>
        </Link>

        {/* Ride/Drive changes what the whole app is for, so it sits with the
            logo as a primary control rather than in the utility cluster on the
            right.
            
            Hidden below sm entirely: the header is five controls wide, which
            fits a 360px phone only just and overflows a 320px one. On a phone
            the switch lives in the account menu, where it has room for a label
            instead of being two unlabelled icons. */}
        <div className="ml-2 hidden sm:block">
          <HostModeSwitch />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SearchToolbar />

          {/* Anchor for the panel, so it drops from the bell rather than from
              the header edge. */}
          <div className="relative">
            <button
              ref={bellRef}
              onClick={() => setPanelOpen((value) => !value)}
              aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
              aria-expanded={panelOpen}
              className="relative rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <Bell className="h-[18px] w-[18px]" />
              {count > 0 ? (
                <span
                  className={cn(
                    'absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full',
                    'bg-brand px-1 text-[9px] font-bold text-brand-fg',
                  )}
                >
                  {count > 9 ? '9+' : count}
                </span>
              ) : null}
            </button>

            {/*
              Portalled to <body>, not nested under the header.

              The header is `sticky z-20`, and a positioned element with a
              z-index creates a stacking context — so the panel's own z-index
              was being resolved *inside* that context and could never rise
              above z-20 as a whole. Meanwhile the dock (fixed z-30) and the
              help widget (fixed z-40/50) sit at document level. On a phone the
              panel is tall enough to reach both, so it rendered underneath
              them: the overlap.

              A portal takes it out of the header's context entirely. z-[55]
              places it above the dock and the help widget while staying below
              modal backdrops (z-[60]), which must still cover it.
            */}
            {/* No `mounted` flag needed: `panelOpen` starts false, so the server
                renders nothing and there is no hydration mismatch to avoid. By
                the time it is true a click has happened, which only happens on
                the client — where `document` certainly exists. */}
            {panelOpen && typeof document !== 'undefined'
              ? createPortal(
                  <>
                    {/* Tapping away closes it. On a phone there is no hover
                        and no Escape key, so without this the only exit was
                        the small × inside the panel. */}
                    <div
                      className="fixed inset-0 z-[54]"
                      aria-hidden
                      onClick={() => setPanelOpen(false)}
                    />
                    <div
                      className="fixed z-[55]"
                      style={{
                        top: anchor.top,
                        right: anchor.right,
                        /**
                         * A hard left stop, not a computed width.
                         *
                         * The panel sizes itself with
                         * `min(380px, 100vw - 1.5rem)`, which should fit — and
                         * on a phone it still ran off the left edge, clipping
                         * the heading to "…ations". Chasing the arithmetic is
                         * the wrong move when the constraint can simply be
                         * stated: pinning the left inset as well as the right
                         * makes overflow impossible regardless of what the
                         * width resolves to, on any viewport.
                         */
                        left: 8,
                        // Never taller than the space actually below the bell,
                        // so the list scrolls internally instead of running off
                        // the bottom of the screen behind the dock.
                        maxHeight: `calc(100dvh - ${anchor.top}px - 5rem)`,
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <NotificationsPanel onClose={() => setPanelOpen(false)} />
                    </div>
                  </>,
                  document.body,
                )
              : null}
          </div>

          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

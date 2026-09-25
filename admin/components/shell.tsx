'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Newspaper,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Send,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import type { Permission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui/primitives';
import { CommandPalette } from '@/components/command-palette';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LiveIndicator } from '@/components/live-indicator';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Hidden when the signed-in role lacks this. Cosmetic — server still gates. */
  permission: Permission;
  /** Rendered but disabled, with the reason, when the feature does not exist. */
  unavailable?: string;
}

/**
 * Five destinations, not seventeen.
 *
 * The console grew a row per feature until the sidebar was a list you read
 * rather than a place you went. These five are what somebody actually opens it
 * to do: see how Spllit is doing, look a person up, check what has been made,
 * see what was sent, understand the numbers — and one drawer for the settings
 * nobody touches weekly.
 *
 * Everything that was a row is now a tab inside one of these. Nothing was
 * removed and every old URL still resolves, so links in audit rows and
 * bookmarks keep working.
 *
 * No group headings any more: five items do not need dividing into three
 * labelled sections, and the labels were costing more vertical space than the
 * rows they organised.
 */
const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard, permission: 'dashboard.view' },
  { href: '/users', label: 'People', icon: Users, permission: 'users.view' },
  { href: '/content', label: 'Content', icon: Layers, permission: 'content.view' },
  { href: '/messages', label: 'Messages', icon: Send, permission: 'content.view' },
  { href: '/insights', label: 'Insights', icon: BarChart3, permission: 'analytics.view' },
  { href: '/careers', label: 'Careers', icon: Briefcase, permission: 'settings.view' },
  { href: '/blog', label: 'Blog & News', icon: Newspaper, permission: 'settings.view' },
  { href: '/settings', label: 'Settings', icon: SlidersHorizontal, permission: 'settings.view' },
];

/**
 * Old routes that now live inside a section, so the sidebar still highlights
 * the right row when one is opened directly from a link or a bookmark.
 */
const SECTION_OF: Record<string, string> = {
  '/rides': '/content',
  '/squads': '/content',
  '/events': '/content',
  '/communities': '/content',
  '/notifications': '/messages',
  '/campaigns': '/messages',
  '/moderation': '/messages',
  '/analytics': '/insights',
  '/explore': '/insights',
  '/activity': '/insights',
  '/reports': '/insights',
  '/flags': '/settings',
  '/audit': '/settings',
  '/system': '/settings',
  '/admins': '/settings',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, signOut, can } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visible = NAV.filter((item) => can(item.permission));

  /**
   * Which row to light up.
   *
   * A section's own URL is matched by prefix, but the folded routes are not
   * under it — `/rides` lives in Content without being `/content/rides`, so a
   * prefix test alone would leave the sidebar with nothing highlighted for
   * every bookmark and audit-row link.
   */
  const section =
    Object.entries(SECTION_OF).find(([from]) => pathname.startsWith(from))?.[1] ?? null;

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          // Sunken, not level with the content. A sidebar the same colour as
          // the page it frames reads as one undifferentiated slab; recessing it
          // is what makes the content look like the thing in front.
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface-sunken transition-transform duration-snap lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-ink">Spllit</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-subtle">
              Console
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="text-ink-subtle lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          <div className="flex flex-col gap-0.5">
            {visible.map((item) => {
                // Home is exact; a section matches its own prefix or any route
                // folded into it.
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href) || section === item.href;
                const Icon = item.icon;

                if (item.unavailable) {
                  return (
                    <span
                      key={item.href}
                      title={item.unavailable}
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-subtle opacity-60"
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider">n/a</span>
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm',
                      'transition-colors duration-snap',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-sunken',
                      active
                        // A rail against the edge plus a quiet fill, rather than
                        // a saturated pill. Twenty pills stacked in a column is
                        // a lot of colour spent on something read once.
                        ? 'bg-surface font-semibold text-ink before:absolute before:inset-y-1 before:-left-3 before:w-0.5 before:rounded-full before:bg-brand before:content-[""]'
                        : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors duration-snap',
                        active ? 'text-brand' : 'text-ink-subtle group-hover:text-ink-muted',
                      )}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                );
            })}
          </div>
        </nav>

        <div className="flex flex-col gap-2 border-t border-line p-3">
          <div className="flex flex-col gap-1 px-2">
            <span className="truncate text-sm font-semibold text-ink" title={session?.name}>
              {session?.name ?? '—'}
            </span>
            <span className="truncate font-mono text-[10px] text-ink-subtle" title={session?.email}>
              {session?.email}
            </span>
            {session ? (
              <span className="pt-1">
                <Badge tone="info">{session.roleLabel}</Badge>
              </span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={() => void signOut()} className="justify-start">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="text-ink-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>

          <LiveIndicator />

          {/*
            A visible affordance for the palette. A keyboard shortcut nobody is
            told about is a feature only its author uses.
          */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
              );
            }}
            className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-subtle transition-colors duration-snap hover:border-line-strong hover:text-ink"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto flex max-w-6xl animate-fade-in flex-col gap-6">{children}</div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}

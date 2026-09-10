'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  Flag,
  Hash,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  UsersRound,
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

/** Section breaks in the sidebar, so ten items do not read as one long list. */
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },
  {
    label: 'Operations',
    items: [
      { href: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { href: '/rides', label: 'Rides', icon: Car, permission: 'content.view' },
      { href: '/squads', label: 'Squads', icon: UsersRound, permission: 'content.view' },
      { href: '/events', label: 'Events', icon: CalendarDays, permission: 'content.view' },
      { href: '/communities', label: 'Communities', icon: Hash, permission: 'content.view' },
      { href: '/notifications', label: 'Notifications', icon: Bell, permission: 'content.view' },
      { href: '/moderation', label: 'Moderation', icon: ShieldAlert, permission: 'moderation.view' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
      { href: '/flags', label: 'Feature flags', icon: Flag, permission: 'settings.view' },
      { href: '/settings', label: 'Settings', icon: SlidersHorizontal, permission: 'settings.view' },
      { href: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
      { href: '/system', label: 'System health', icon: Activity, permission: 'system.view' },
      { href: '/admins', label: 'Admins', icon: Settings, permission: 'admins.manage' },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, signOut, can } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Groups whose every item is hidden disappear along with their heading —
  // otherwise an Analyst sees a bare "Operations" label with nothing under it.
  const visible = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.permission)),
  })).filter((group) => group.items.length > 0);

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
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform duration-snap lg:static lg:translate-x-0',
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
          {visible.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-ink-subtle">
                {group.label}
              </p>

              {group.items.map((item) => {
                // Exact match for the dashboard, prefix match elsewhere, so a
                // detail page keeps its section highlighted in the sidebar.
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
                      'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-snap',
                      active
                        ? 'bg-brand-muted font-semibold text-brand'
                        : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
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

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Car,
  Globe,
  HelpCircle,
  LogOut,
  MessageSquare,
  Settings,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth/auth-provider';
import { useUnreadCount } from '@/lib/hooks/queries';
import { useClickOutside } from '@/lib/hooks/use-click-outside';
import { HostModeSwitch } from '@/components/host/mode-switch';

/**
 * Account menu, opened from the avatar.
 *
 * Grouped rather than one long list: destinations first, then settings, then
 * the host pitch, then sign out. The separators are what let someone find
 * "Log out" without reading the nine rows above it.
 */

interface Item {
  label: string;
  href: string;
  Icon: typeof UserRound;
  badge?: number;
}

function MenuLink({ item, onNavigate }: { item: Item; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] text-ink transition-colors hover:bg-surface-sunken"
    >
      <item.Icon className="h-[17px] w-[17px] shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-fg">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { data: unread } = useUnreadCount(Boolean(profile));

  useClickOutside(ref, () => setOpen(false));

  const close = () => setOpen(false);

  const primary: Item[] = [
    { label: 'Your group rides', href: '/squads', Icon: Users },
    { label: 'Your rides', href: '/rides', Icon: Car },
    { label: 'Messages', href: '/chat', Icon: MessageSquare },
    { label: 'Profile', href: '/profile', Icon: UserRound },
  ];

  const secondary: Item[] = [
    { label: 'Notifications', href: '/notifications', Icon: Bell, badge: unread?.count ?? 0 },
    { label: 'Account settings', href: '/profile', Icon: Settings },
    { label: 'Map & location', href: '/map', Icon: Globe },
    { label: 'Invite friends', href: '/invite', Icon: UserPlus },
    { label: 'Help centre', href: '/profile', Icon: HelpCircle },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5',
          'shadow-soft transition-all duration-snap hover:shadow-raised',
          open && 'shadow-raised',
        )}
      >
        <Avatar src={profile?.profilePhoto} name={profile?.name} size="xs" />
        <span className="flex flex-col gap-[3px]" aria-hidden="true">
          <span className="block h-[1.5px] w-3.5 rounded-full bg-ink-muted" />
          <span className="block h-[1.5px] w-3.5 rounded-full bg-ink-muted" />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          /* Width clamps to the viewport: a fixed 280px anchored to the right
             edge leaves 40px on a 320px phone and clips on anything narrower. */
          className="absolute right-0 top-full z-50 mt-2 w-[min(280px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-surface py-2 shadow-float"
        >
          <div className="px-1">
            {primary.map((item) => (
              <MenuLink key={item.label} item={item} onNavigate={close} />
            ))}
          </div>

          <div className="my-2 h-px bg-line" />

          <div className="px-1">
            {secondary.map((item) => (
              <MenuLink key={item.label} item={item} onNavigate={close} />
            ))}
          </div>

          {/* Mode switch, phone only — it is hidden from the header below sm to
              keep that row inside a 320px screen, so this is the way back to
              host mode on a phone. */}
          <div className="my-2 h-px bg-line sm:hidden" />
          <div className="px-4 pb-1 sm:hidden">
            <HostModeSwitch className="w-full" />
          </div>

          <div className="my-2 h-px bg-line" />

          {/* Host pitch. Given room to breathe because it is the one row here
              trying to persuade rather than navigate. */}
          <Link
            href="/host"
            onClick={close}
            className="mx-1 flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-sunken"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">Become a host</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                Drive your route anyway? Take someone with you and split the cost.
              </span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
              <Car className="h-4 w-4" />
            </span>
          </Link>

          <div className="my-2 h-px bg-line" />

          <div className="px-1">
            <button
              type="button"
              onClick={() => {
                close();
                void signOut().then(() => router.replace('/'));
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-surface-sunken"
            >
              <LogOut className="h-[17px] w-[17px] shrink-0 text-ink-muted" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

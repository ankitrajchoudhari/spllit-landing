'use client';

import { useRouter } from 'next/navigation';
import { Car, Users, CalendarDays, type LucideIcon } from 'lucide-react';

import { Sheet } from '@/components/ui/sheet';

const ACTIONS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    href: '/rides/new',
    label: 'Offer a ride',
    description: 'Share your cab, bike or auto and split the fare.',
    icon: Car,
  },
  {
    href: '/squads/new',
    label: 'Start a group ride',
    description: 'Gather people around a meeting point and move together.',
    icon: Users,
  },
  {
    href: '/events/new',
    label: 'Host an event',
    description: 'Put it on the map so people nearby can find it.',
    icon: CalendarDays,
  },
];

export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <Sheet open={open} onClose={onClose} title="Create" side="bottom">
      <div className="space-y-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.href}
              onClick={() => {
                onClose();
                router.push(action.href);
              }}
              className="flex w-full items-center gap-3.5 rounded-lg border border-line bg-surface p-4 text-left transition-colors duration-snap hover:border-line-strong active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-muted text-brand">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{action.label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

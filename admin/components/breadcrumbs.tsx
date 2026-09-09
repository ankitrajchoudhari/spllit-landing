'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/** Section labels, so a URL segment is not shown raw to a person. */
const LABELS: Record<string, string> = {
  users: 'Users',
  rides: 'Rides',
  squads: 'Squads',
  events: 'Events',
  communities: 'Communities',
  notifications: 'Notifications',
  moderation: 'Moderation',
  flags: 'Feature flags',
  audit: 'Audit log',
  system: 'System health',
  admins: 'Admins',
};

/**
 * Trail for the current route.
 *
 * Deliberately shallow: the console is two levels deep at most (a section and
 * a record), so this shows "Console / Users / <id>" and stops. The record
 * segment is a cuid, which is meaningless to read — it is truncated rather
 * than filling the bar with 25 characters of entropy.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm font-semibold text-ink">Dashboard</span>;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="shrink-0 text-ink-subtle transition-colors duration-snap hover:text-ink"
      >
        Console
      </Link>

      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const known = LABELS[segment];
        const label = known ?? (segment.length > 10 ? `${segment.slice(0, 8)}…` : segment);

        return (
          <span key={href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
            {isLast ? (
              <span className="truncate font-semibold text-ink" aria-current="page">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="shrink-0 text-ink-subtle transition-colors duration-snap hover:text-ink"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

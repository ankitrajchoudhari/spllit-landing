'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import {
  ChevronRight,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { SquadCard } from '@/components/shared/entity-cards';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { useMySquads, useSquads } from '@/lib/hooks/queries';
import { purposeLabel } from '@/lib/squad-purpose';
import { cn, formatCountdown } from '@/lib/utils';
import type { Squad } from '@/types';

const BANNER_KEY = 'spllit.squads.banner.dismissed';

/**
 * Banner dismissal, read straight from localStorage.
 *
 * useSyncExternalStore rather than an effect: localStorage does not exist while
 * prerendering, and the server snapshot below reports "dismissed" so the banner
 * is never in the HTML. It appears on the client only if it genuinely has not
 * been dismissed, which avoids both a hydration mismatch and a flash of a
 * banner the user already closed.
 */
const bannerListeners = new Set<() => void>();

function subscribeToBanner(onChange: () => void) {
  bannerListeners.add(onChange);
  // Keeps other tabs in sync.
  window.addEventListener('storage', onChange);
  return () => {
    bannerListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function bannerDismissed() {
  return window.localStorage.getItem(BANNER_KEY) === '1';
}

function useBannerDismissed() {
  return useSyncExternalStore(subscribeToBanner, bannerDismissed, () => true);
}

function placeHead(label: string | null | undefined): string | null {
  return label?.split(',')[0]?.trim() || null;
}

/**
 * Pill action, as used in the row under the headline. Renders as a link so the
 * whole pill is a hit target rather than a button wrapping one.
 */
function PillAction({
  href,
  icon,
  label,
  tone = 'muted',
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tone?: 'brand' | 'muted';
  disabled?: boolean;
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
    tone === 'brand'
      ? 'bg-brand text-brand-fg hover:bg-brand-hover'
      : 'bg-brand-muted text-ink hover:bg-surface-sunken',
    disabled && 'pointer-events-none opacity-40',
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {icon}
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {icon}
      {label}
    </Link>
  );
}

/** One squad row inside the primary card — avatar, name, meta, chevron. */
function SquadRow({ squad }: { squad: Squad }) {
  const destination = placeHead(squad.destination?.label) ?? squad.name;

  return (
    <Link
      href={`/squads/${squad.id}`}
      className="flex items-center gap-3 rounded-md py-2.5 transition-colors hover:bg-surface-sunken"
    >
      <Avatar src={squad.leader?.profilePhoto} name={destination} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{destination}</p>
        <p className="truncate text-[12.5px] text-ink-subtle">
          {squad.memberCount}
          {squad.memberLimit ? `/${squad.memberLimit}` : ''} · {purposeLabel(squad.type)}
        </p>
      </div>
      {squad.meetingAt ? (
        <span className="shrink-0 text-[12.5px] text-ink-muted">
          {formatCountdown(squad.meetingAt)}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
    </Link>
  );
}

export default function SquadsPage() {
  const { center } = useGeolocation();
  const mine = useMySquads();
  const nearby = useSquads({ near: center ?? undefined, limit: 30 }, Boolean(center));

  const bannerHidden = useBannerDismissed();

  const dismissBanner = () => {
    window.localStorage.setItem(BANNER_KEY, '1');
    bannerListeners.forEach((notify) => notify());
  };

  const squads = mine.data ?? [];
  /** The one the page leads with: soonest departure, else most recent. */
  const primary =
    [...squads].sort((a, b) => {
      if (a.meetingAt && b.meetingAt) return a.meetingAt.localeCompare(b.meetingAt);
      if (a.meetingAt) return -1;
      if (b.meetingAt) return 1;
      return 0;
    })[0] ?? null;

  const primaryDestination = primary
    ? (placeHead(primary.destination?.label) ?? primary.name)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      {mine.isPending ? (
        <SkeletonList count={2} />
      ) : primary ? (
        <>
          {/* Headline block — small label over a large value. */}
          <div>
            <p className="text-[13px] text-ink-muted">Your next meet</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate font-display text-[28px] font-semibold tracking-[-0.03em] text-ink">
                {primary.meetingAt ? formatCountdown(primary.meetingAt) : primaryDestination}
              </h1>
              {primary.meetingAt ? (
                <span className="truncate text-[15px] text-ink-muted">
                  to {primaryDestination}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PillAction
              href={`/squads/${primary.id}`}
              icon={<Navigation className="h-3.5 w-3.5" />}
              label="Navigate"
              tone="brand"
            />
            <PillAction
              href={`/squads/${primary.id}`}
              icon={<UserPlus className="h-3.5 w-3.5" />}
              label="Invite"
            />
            <PillAction
              href={`/squads/${primary.id}`}
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="Chat"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Green strip names the card. It used to read "0 squads" over an
                empty body, which announced a count instead of saying what the
                card was. */}
            <div className="overflow-hidden rounded-xl bg-surface shadow-raised">
              <div className="flex items-center justify-between bg-brand px-4 pb-6 pt-3">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-fg">
                  <Users className="h-3.5 w-3.5" />
                  Your group rides
                </span>
                <span className="text-[12.5px] font-semibold text-brand-fg">
                  {squads.length}
                </span>
              </div>

              <div className="-mt-4 rounded-t-xl bg-surface px-4 pb-4 pt-4">
                <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                  {primaryDestination}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {primary.memberCount}
                  {primary.memberLimit ? `/${primary.memberLimit}` : ''} members ·{' '}
                  {purposeLabel(primary.type)}
                </p>

                <div className="mt-3 divide-y divide-line border-t border-line">
                  {squads.map((squad) => (
                    <SquadRow key={squad.id} squad={squad} />
                  ))}
                </div>

                <Link href={`/squads/${primary.id}`} className="mt-3 inline-block">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink">
                    <MapPin className="h-3.5 w-3.5" />
                    Group Ride details
                  </span>
                </Link>
              </div>
            </div>

            {/* Not "start another" — one squad at a time is enforced by the
                API, so offering a second is a button that can only fail. Once
                you have a squad the useful action is watching it fill. */}
            <Link
              href={`/squads/${primary.id}`}
              className="flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-6 py-8 text-center shadow-soft transition-all duration-snap hover:-translate-y-px hover:shadow-raised"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg">
                <Users className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                See who&apos;s joined
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                Track members, approve requests and move the meeting point.
              </p>
            </Link>
          </div>
        </>
      ) : (
        /**
         * No squads yet.
         *
         * The dashboard above is deliberately not rendered in this state. It
         * was showing a green "0 squads" banner, three disabled action pills
         * and an unlabelled card — a layout built for content, displayed with
         * none, which read as broken rather than empty. One explained card is
         * both clearer and honest about where the user actually is.
         */
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <div className="border-b border-line bg-brand-muted px-6 py-5">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand">
              <Users className="h-3.5 w-3.5" />
              Group Rides
            </span>
            <h1 className="mt-2 font-display text-[24px] font-semibold tracking-[-0.03em] text-ink">
              Travel together, not alone
            </h1>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
              A group ride is a group heading to the same place at the same time — an
              exam centre, the airport, a match. Pick where you&apos;re going, drop a
              meeting point, and everyone&apos;s ETA shows up on one map.
            </p>
          </div>

          <ol className="divide-y divide-line">
            {[
              { step: 'Pick a destination', body: 'Where the group is actually headed.' },
              { step: 'Drop a meeting point', body: 'Where you regroup before setting off.' },
              { step: 'Share the code', body: 'People nearby can ask to join, you approve.' },
            ].map((item, index) => (
              <li key={item.step} className="flex items-start gap-3 px-6 py-3.5">
                <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-bold text-ink-muted">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">{item.step}</span>
                  <span className="block text-[12.5px] text-ink-muted">{item.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="px-6 py-5">
            <Link href="/squads/new">
              <Button size="lg" className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Start your first group ride
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Dismissible banner, pinned below the grid. */}
      {!bannerHidden ? (
        <div className="relative flex items-center gap-4 rounded-xl bg-surface-sunken py-4 pl-5 pr-12">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-ink">Group Rides now lead with where you&apos;re going.</p>
            <Link
              href="/squads/new"
              className="mt-0.5 inline-block text-[13px] font-semibold text-ink underline underline-offset-2"
            >
              Start one
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="absolute right-3 top-3 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-line hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Discovery keeps the existing card grid — this section is a list, not
          a dashboard, and the reference layout has no analogue for it. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
            Group Rides near you
          </h2>
          {/* Hidden while committed: the API rejects a second squad, so the
              button could only ever produce an error. */}
          {primary ? null : (
            <Link href="/squads/new">
              <Button size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </Link>
          )}
        </div>

        {!center || nearby.isPending ? (
          <SkeletonList count={3} />
        ) : (nearby.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No group rides nearby"
            description="Nothing forming around you right now. Start one and drop a meeting point."
            action={
              <Link href="/squads/new">
                <Button size="sm">Start a group ride</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {nearby.data?.items.map((squad) => <SquadCard key={squad.id} squad={squad} />)}
          </div>
        )}
      </section>
    </div>
  );
}

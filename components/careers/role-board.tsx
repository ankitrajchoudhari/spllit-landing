'use client';

import Image from 'next/image';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Check, Clock, MapPin, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';
import { FilterSelect } from '@/components/ui/filter-select';
import {
  getAppliedServerSnapshot,
  getAppliedSnapshot,
  markApplied,
  parseApplied,
  subscribeApplied,
} from '@/lib/applied-roles';
import {
  CAREERS_SUPPORT_EMAIL,
  facetsFor,
  roleStatus,
  type CareerRole,
  type RoleStatus,
} from '@/content/careers';

/**
 * The filterable list of roles.
 *
 * Client-side because the filtering is instant and the whole list is a handful
 * of records — fetching a filtered page from a server for six roles would add a
 * round trip to save nothing. The list itself is rendered on the server and
 * passed in, so the roles are in the HTML for anyone who never runs the JS.
 */

const ALL = 'All';

/**
 * Status colours carry the meaning, so they are the loud part of the card:
 * green for open, amber while it is running out, red once it is closed. The
 * red is deliberate — a closed role has to be unmistakable at a glance, because
 * the cost of missing it is somebody filling in a form for a job that is gone.
 */
const STATUS_STYLE: Record<RoleStatus, { label: string; className: string; dot: string }> = {
  open: {
    label: 'Open',
    className: 'bg-brand-muted text-brand',
    dot: 'bg-brand',
  },
  'closing-soon': {
    label: 'Closing soon',
    className: 'bg-warning-muted text-warning',
    dot: 'bg-warning',
  },
  closed: {
    label: 'Closed',
    className: 'bg-danger-muted text-danger',
    dot: 'bg-danger',
  },
};

function StatusPill({ status }: { status: RoleStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-semibold uppercase tracking-[0.08em]',
        style.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}

function RoleCard({ role, applied }: { role: CareerRole; applied: boolean }) {
  const status = roleStatus(role);
  const closed = status === 'closed';

  return (
    <li
      id={role.id}
      className={cn(
        'scroll-mt-24 overflow-hidden rounded-2xl border bg-surface shadow-soft transition-shadow duration-snap',
        closed ? 'border-line' : 'border-line hover:shadow-raised',
      )}
    >
      {/* A rule in the status colour along the top edge, so the state of a role
          is readable while scrolling past without reading the pill. */}
      <span
        aria-hidden
        className={cn('block h-1 w-full', closed ? 'bg-danger' : status === 'closing-soon' ? 'bg-warning' : 'bg-brand')}
      />

      <div className={cn('p-5 sm:p-6', closed && 'opacity-75')}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3
            className={cn(
              'font-display text-[18px] font-semibold tracking-[-0.01em] sm:text-[20px]',
              closed ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {role.title}
          </h3>
          <StatusPill status={status} />
        </div>

        <dl className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Team</dt>
            <Users className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
            <dd>{role.team}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Location</dt>
            <MapPin className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
            <dd>{role.location}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Commitment</dt>
            <Clock className="h-[15px] w-[15px] shrink-0 text-ink-subtle" aria-hidden />
            <dd>{role.type}</dd>
          </div>
        </dl>

        {role.summary ? (
          <p className="mt-4 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-muted">
            {role.summary}
          </p>
        ) : null}

        {role.responsibilities.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {role.responsibilities.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                <span
                  aria-hidden
                  className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-subtle"
                />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
          {closed ? (
            <span className="inline-flex min-h-[44px] items-center text-[13.5px] font-medium text-danger">
              Applications expired
            </span>
          ) : (
            <a
              href={role.applyUrl}
              {...(/^https?:/i.test(role.applyUrl)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              onClick={() => markApplied(role.id)}
              aria-label={applied ? `Open the application for ${role.title} again` : `Apply for ${role.title}`}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[14px] font-medium',
                'transition-all duration-snap active:scale-95',
                applied
                  ? 'border border-brand bg-brand-muted text-brand hover:bg-brand hover:text-brand-fg'
                  : 'bg-ink text-canvas hover:opacity-85',
              )}
            >
              {applied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Applied
                </>
              ) : (
                <>
                  Apply
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </a>
          )}

          {!closed && role.closesAt ? (
            <span className="text-[12.5px] text-ink-subtle">
              Closes{' '}
              {new Date(role.closesAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Shown when there is genuinely nothing to apply for. The illustration does the
 * work a paragraph of apology would otherwise have to — this is a small company
 * that is not hiring this week, not a broken page.
 */
export function NoOpenRoles({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-sunken px-5 py-10 text-center sm:px-8 sm:py-12">
      <Image
        src="/careers/coming-soon.png"
        alt=""
        width={352}
        height={536}
        sizes="(min-width: 640px) 260px, 62vw"
        {...blurProps('/careers/coming-soon.png')}
        className="mx-auto h-auto w-[62%] max-w-[260px]"
      />
      <h3 className="mt-6 font-display text-[19px] font-semibold tracking-[-0.01em] text-ink sm:text-[21px]">
        {title}
      </h3>
      <p className="mx-auto mt-2.5 max-w-md text-[14.5px] leading-relaxed text-ink-muted">{body}</p>
      <a
        href={`mailto:${CAREERS_SUPPORT_EMAIL}?subject=${encodeURIComponent('Working at Spllit')}`}
        className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-ink px-6 text-[14.5px] font-medium text-canvas transition-all duration-snap hover:opacity-85 active:scale-95"
      >
        Tell us what you would build
      </a>
    </div>
  );
}

export function RoleBoard({
  roles,
  emptyState,
}: {
  roles: CareerRole[];
  emptyState: { title: string; body: string };
}) {
  /**
   * Read through useSyncExternalStore rather than an effect: localStorage is an
   * external store, this is the API for one, and it renders the server's empty
   * state on the server instead of flashing the wrong button after hydration.
   */
  const appliedRaw = useSyncExternalStore(
    subscribeApplied,
    getAppliedSnapshot,
    getAppliedServerSnapshot,
  );
  const appliedIds = useMemo(() => new Set(parseApplied(appliedRaw)), [appliedRaw]);

  const [team, setTeam] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [showClosed, setShowClosed] = useState(false);

  const facets = useMemo(() => facetsFor(roles), [roles]);

  const { open, closed, visible } = useMemo(() => {
    const matches = roles.filter(
      (role) =>
        (team === ALL || role.team === team) &&
        (location === ALL || role.location === location) &&
        (type === ALL || role.type === type),
    );
    const openRoles = matches.filter((r) => roleStatus(r) !== 'closed');
    const closedRoles = matches.filter((r) => roleStatus(r) === 'closed');
    return {
      open: openRoles,
      closed: closedRoles,
      visible: showClosed ? [...openRoles, ...closedRoles] : openRoles,
    };
  }, [roles, team, location, type, showClosed]);

  const filtered = team !== ALL || location !== ALL || type !== ALL;

  /** Nothing open anywhere, filters or no filters — the real "we are not hiring" case. */
  const nothingOpenAtAll = roles.every((role) => roleStatus(role) === 'closed');

  if (nothingOpenAtAll) {
    return <NoOpenRoles title={emptyState.title} body={emptyState.body} />;
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        <FilterSelect label="Team" value={team} options={facets.teams} onChange={setTeam} />
        <FilterSelect
          label="Location"
          value={location}
          options={facets.locations}
          onChange={setLocation}
        />
        <FilterSelect label="Type" value={type} options={facets.types} onChange={setType} />
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[13px] text-ink-subtle" aria-live="polite">
          {open.length === 0
            ? 'No open roles match these filters.'
            : `${open.length} open ${open.length === 1 ? 'role' : 'roles'}`}
          {closed.length > 0 ? ` · ${closed.length} closed` : ''}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setTeam(ALL);
              setLocation(ALL);
              setType(ALL);
            }}
            className="min-h-[36px] text-[13px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {visible.map((role) => (
            <RoleCard key={role.id} role={role} applied={appliedIds.has(role.id)} />
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-sunken p-8 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">
            Nothing open matches that.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-muted">
            Clear the filters to see everything, or write to us at{' '}
            <a
              href={`mailto:${CAREERS_SUPPORT_EMAIL}`}
              className="font-medium text-ink underline underline-offset-2"
            >
              {CAREERS_SUPPORT_EMAIL}
            </a>{' '}
            and tell us what you would want to work on.
          </p>
        </div>
      )}

      {closed.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowClosed((v) => !v)}
          className="mt-5 min-h-[44px] text-[13.5px] font-medium text-ink-muted underline underline-offset-4 transition-colors duration-snap hover:text-ink"
        >
          {showClosed
            ? 'Hide closed roles'
            : `Show ${closed.length} closed ${closed.length === 1 ? 'role' : 'roles'}`}
        </button>
      ) : null}
    </div>
  );
}

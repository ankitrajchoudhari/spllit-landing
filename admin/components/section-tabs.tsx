'use client';

import { useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';
import type { Permission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/primitives';
import { PermissionState } from '@/components/ui/states';

/**
 * One section, several views.
 *
 * The console had grown to seventeen sidebar entries — a list you navigate
 * rather than a tool you use. Rides, Squads, Events and Communities are the
 * same question asked four times, and they belong behind one heading with tabs,
 * not four rows competing for the same glance.
 *
 * Tabs hold state rather than routing. Switching between Rides and Squads is a
 * change of view, not of place: routing would put each one in history, so Back
 * from a ride detail page would walk through every tab visited on the way
 * there instead of returning to the list.
 */

export interface SectionTab {
  key: string;
  label: string;
  /** Hidden when the signed-in role lacks it. The server still gates. */
  permission: Permission;
  render: () => ReactNode;
}

export function SectionTabs({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: SectionTab[];
}) {
  const { can } = useAuth();
  const visible = tabs.filter((tab) => can(tab.permission));

  // The first tab this role can actually see. Defaulting to `tabs[0]` would
  // open a Support user on a tab they are not allowed to load.
  const [active, setActive] = useState<string>(() => visible[0]?.key ?? '');

  if (visible.length === 0) {
    return <PermissionState permission={tabs[0]?.permission} />;
  }

  // Guards against a role change mid-session leaving `active` pointing at a tab
  // that is no longer visible — derived rather than corrected in an effect.
  const current = visible.find((tab) => tab.key === active) ?? visible[0]!;

  return (
    <>
      <PageHeader title={title} description={description} />

      {/*
        A single tab is not a choice, so the bar is not drawn. An Analyst seeing
        one lonely tab labelled the same as the page is chrome telling them
        nothing.
      */}
      {visible.length > 1 ? (
        <div
          role="tablist"
          aria-label={title}
          className="flex gap-1 overflow-x-auto border-b border-line pb-px"
        >
          {visible.map((tab) => {
            const selected = tab.key === current.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(tab.key)}
                className={cn(
                  'relative whitespace-nowrap px-3 py-2 text-sm transition-colors duration-snap',
                  selected
                    ? 'font-semibold text-ink'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {tab.label}
                {/*
                  The underline sits on the container's border rather than
                  beside it, so the active tab reads as connected to the panel
                  below instead of floating above a line.
                */}
                {selected ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div role="tabpanel">{current.render()}</div>
    </>
  );
}

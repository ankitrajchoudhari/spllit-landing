'use client';

import { Activity, Map, MessageCircle, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AnimatedBackground } from '@/components/core/animated-background';

export type SquadTab = 'members' | 'map' | 'chat' | 'activity';

const TABS: { value: SquadTab; label: string; Icon: typeof Users }[] = [
  { value: 'members', label: 'Members', Icon: Users },
  { value: 'map', label: 'Map', Icon: Map },
  { value: 'chat', label: 'Chat', Icon: MessageCircle },
  { value: 'activity', label: 'Activity', Icon: Activity },
];

/**
 * Squad tabs, on the sliding-pill background.
 *
 * Labels stay next to the icons rather than going icon-only: four tabs is few
 * enough that the words fit, and "Activity" has no glyph anyone reads reliably.
 */
export function SquadTabs({
  value,
  onChange,
  memberCount,
  chatUnread = 0,
}: {
  value: SquadTab;
  onChange: (next: SquadTab) => void;
  memberCount: number;
  /**
   * Unread messages in this squad's thread, from the server's own count.
   *
   * Passed in rather than fetched here so the tab strip stays presentational
   * and there is exactly one place that knows how unread is computed.
   */
  chatUnread?: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Squad sections"
      className="inline-flex w-full gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft"
    >
      <AnimatedBackground
        value={value}
        onValueChange={(next) => onChange(next as SquadTab)}
        className="rounded-lg bg-brand-muted"
        transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            data-id={tab.value}
            type="button"
            role="tab"
            aria-selected={value === tab.value}
            className={cn(
              // min-h-11 is the 44px touch target; px-2 at the narrowest so
              // four tabs plus their badges fit 320px without overflowing.
              'relative inline-flex min-h-11 flex-1 items-center justify-center gap-1.5',
              'rounded-lg px-2 py-2 sm:px-3',
              'text-[13px] font-medium transition-colors duration-100',
              'text-ink-muted data-[checked=true]:text-brand',
              // The moving background is the primary cue, but it is colour
              // alone — weight gives the active tab a second, non-colour one.
              'data-[checked=true]:font-semibold',
            )}
          >
            <tab.Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.value === 'members' ? (
              <span className="rounded-full bg-surface-sunken px-1.5 text-[11px] font-semibold text-ink-muted">
                {memberCount}
              </span>
            ) : null}
            {/*
              Chat opens as a dialog rather than a panel, so this badge is the
              only place an unread message is visible from the squad — without
              it a message that arrived while the dialog was shut showed
              nowhere at all. Count comes from the server, never from tallying
              socket events.
            */}
            {tab.value === 'chat' && chatUnread > 0 ? (
              <span
                aria-label={`${chatUnread} unread messages`}
                className="min-w-[18px] rounded-full bg-brand px-1.5 text-[11px] font-bold leading-[18px] text-brand-fg"
              >
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            ) : null}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

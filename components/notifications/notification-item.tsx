'use client';

import Link from 'next/link';
import {
  Bell,
  CalendarDays,
  Car,
  CheckCircle2,
  MapPin,
  MessageCircle,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { cn, formatRelative } from '@/lib/utils';
import type { AppNotification, NotificationType } from '@/types';

/**
 * Every notification type maps to an explicit renderer config — icon, tone and
 * default destination. There is no generic string fallback path in normal
 * operation (Section 5.10); unknown types only appear if the backend ships a
 * type the client hasn't been updated for yet.
 */
const RENDERERS: Record<
  NotificationType,
  { icon: LucideIcon; tone: 'brand' | 'accent' | 'warning' | 'danger' | 'neutral' }
> = {
  'squad.joined': { icon: Users, tone: 'accent' },
  // Needs a decision from the leader, so it reads as an action, not an FYI.
  'squad.join_requested': { icon: UserPlus, tone: 'brand' },
  'squad.meeting_point_updated': { icon: MapPin, tone: 'accent' },
  'ride.accepted': { icon: CheckCircle2, tone: 'brand' },
  'ride.arriving': { icon: Car, tone: 'brand' },
  'ride.started': { icon: Car, tone: 'brand' },
  'ride.completed': { icon: CheckCircle2, tone: 'neutral' },
  'ride.cancelled': { icon: XCircle, tone: 'danger' },
  'friend.nearby': { icon: MapPin, tone: 'accent' },
  'event.created': { icon: CalendarDays, tone: 'warning' },
  'event.reminder': { icon: CalendarDays, tone: 'warning' },
  'community.mention': { icon: MessageCircle, tone: 'neutral' },
  'chat.message': { icon: MessageCircle, tone: 'neutral' },
};

const TONE_CLASSES = {
  brand: 'bg-brand-muted text-brand',
  accent: 'bg-accent-muted text-accent',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  neutral: 'bg-surface-sunken text-ink-muted',
} as const;

export function NotificationItem({ notification }: { notification: AppNotification }) {
  const renderer = RENDERERS[notification.type];
  const Icon = renderer?.icon ?? Bell;
  const tone = renderer?.tone ?? 'neutral';
  const unread = !notification.readAt;

  const body = (
    <div
      className={cn(
        'flex gap-3 px-4 py-3.5 transition-colors',
        unread ? 'bg-brand-muted' : '',
        notification.href ? 'hover:bg-surface-sunken' : '',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-snug text-ink">
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">
          {notification.body}
        </p>
        <p className="mt-1 text-[11px] text-ink-subtle">
          {formatRelative(notification.createdAt)}
        </p>
      </div>
      {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" /> : null}
    </div>
  );

  return notification.href ? (
    <Link href={notification.href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

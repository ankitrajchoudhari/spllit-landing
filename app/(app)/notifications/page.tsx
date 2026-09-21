'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { NotificationItem } from '@/components/notifications/notification-item';
import { qk, useMarkAllRead, useNotifications } from '@/lib/hooks/queries';
import { onEvent } from '@/lib/live/socket';

export default function NotificationsPage() {
  const { data, isPending } = useNotifications();
  const markAll = useMarkAllRead();
  const qc = useQueryClient();

  // Live delivery for in-app notifications. FCM web push handles the case where
  // the tab is not focused; this covers the case where it is.
  useEffect(() => {
    const off = onEvent('notification:new', () => {
      void qc.invalidateQueries({ queryKey: qk.notifications });
      void qc.invalidateQueries({ queryKey: qk.unreadCount });
    });
    return off;
  }, [qc]);

  const notifications = data?.items ?? [];
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">
            Notifications
          </h1>
          <p className="mt-1 text-[14px] text-ink-muted">
            Rides, group rides, events and mentions.
          </p>
        </div>
        {hasUnread ? (
          <Button
            size="sm"
            variant="ghost"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        ) : null}
      </header>

      {isPending ? (
        <SkeletonList count={5} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="You're all caught up"
          description="Updates about your rides, group rides and events will land here."
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}

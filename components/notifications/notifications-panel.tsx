'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, X } from 'lucide-react';

import { cn, formatRelative } from '@/lib/utils';
import { notificationsService } from '@/lib/services/notifications';
import { useNotifications, useMarkAllRead, qk } from '@/lib/hooks/queries';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useClickOutside } from '@/lib/hooks/use-click-outside';
import type { AppNotification } from '@/types';

type Tab = 'all' | 'unread';

/**
 * Notifications, as a panel rather than a page.
 *
 * The row is the whole story: who did what, to which thing, and when. The
 * actor's avatar leads because "Jane" is what someone scans for — an icon for
 * the notification *type* tells them nothing they cannot infer from the text.
 */
function NotificationRow({
  notification,
  onDismiss,
  dismissing,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  dismissing: boolean;
}) {
  const unread = !notification.readAt;

  const inner = (
    <div className="flex gap-3 px-4 py-3">
      <Avatar
        src={notification.imageUrl}
        name={notification.title}
        size="sm"
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-[13px] leading-snug text-ink">{notification.title}</p>
        {notification.body ? (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">
            {notification.body}
          </p>
        ) : null}
        <p className="mt-1 text-[11.5px] text-ink-subtle">
          {formatRelative(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  return (
    <li
      className={cn(
        'group relative border-l-2 transition-colors',
        unread ? 'border-brand bg-brand-muted' : 'border-transparent',
        'hover:bg-surface-sunken',
      )}
    >
      {notification.href ? (
        <Link href={notification.href} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}

      {/* Dismiss sits on the row, revealed on hover, so a long list is not a
          wall of × buttons competing with the text. */}
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        disabled={dismissing}
        aria-label="Dismiss notification"
        className={cn(
          'absolute right-2 top-2.5 rounded-full p-1 text-ink-subtle transition-all',
          'opacity-0 hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
          'disabled:opacity-40',
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const { data, isPending } = useNotifications();
  const markAll = useMarkAllRead();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  /**
   * Dismissing marks read. There is no delete endpoint, and inventing one on
   * the client — hiding a row that the server still returns — would resurrect
   * it on the next fetch.
   */
  const dismiss = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
      void queryClient.invalidateQueries({ queryKey: qk.unreadCount });
    },
  });

  const all = data?.items ?? [];
  const unread = all.filter((item) => !item.readAt);
  const shown = tab === 'unread' ? unread : all;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="flex h-full max-h-[520px] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-float"
    >
      <div className="flex items-center gap-4 border-b border-line px-4 pt-3">
        {(['all', 'unread'] as const).map((value) => {
          const active = tab === value;
          const count = value === 'unread' ? unread.length : 0;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-selected={active}
              role="tab"
              className={cn(
                '-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-subtle hover:text-ink',
              )}
            >
              {value === 'all' ? 'Notifications' : 'Unread'}
              {count > 0 ? <span className="ml-1.5 text-ink-subtle">{count}</span> : null}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || unread.length === 0}
          title="Mark all as read"
          aria-label="Mark all as read"
          className="ml-auto mb-1.5 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
        >
          <CheckCheck className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
              <Bell className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[13px] font-medium text-ink">
              {tab === 'unread' ? "You're all caught up" : 'Nothing yet'}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {tab === 'unread'
                ? 'No unread notifications.'
                : 'Squad invites, ride updates and messages land here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onDismiss={(id) => dismiss.mutate(id)}
                dismissing={dismiss.isPending && dismiss.variables === notification.id}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          See all notifications
        </Link>
      </div>
    </div>
  );
}

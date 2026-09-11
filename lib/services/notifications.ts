import { api } from '@/lib/api/client';
import type { AppNotification, Paginated } from '@/types';

export const notificationsService = {
  list: (cursor?: string) =>
    api.get<Paginated<AppNotification>>('/notifications', {
      query: { cursor, limit: 30 },
    }),

  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => api.post<void>(`/notifications/${id}/read`),

  markAllRead: () => api.post<void>('/notifications/read-all'),

  /**
   * What this person wants to be emailed about.
   *
   * `optional` comes from the server rather than being hardcoded here, so the
   * screen can only ever offer switches the backend will actually honour.
   */
  preferences: () =>
    api.get<{
      emailOff: string[];
      quietHours: boolean;
      timezone: string | null;
      optional: string[];
    }>('/notifications/preferences'),

  savePreferences: (input: {
    emailOff?: string[];
    quietHours?: boolean;
    timezone?: string | null;
  }) =>
    api.patch<{ emailOff: string[]; quietHours: boolean; timezone: string | null }>(
      '/notifications/preferences',
      input,
    ),
};

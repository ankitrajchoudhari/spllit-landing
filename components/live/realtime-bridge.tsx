'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { onEvent } from '@/lib/live/socket';
import { qk } from '@/lib/hooks/queries';

/**
 * App-wide subscription to the live events that change what is on screen.
 *
 * The socket was already connected for every signed-in user, and the server was
 * already emitting — but only two places listened: the open chat thread, and
 * the notifications page. So a message arriving while you were anywhere else
 * updated nothing. No unread badge, no inbox row, no count. The only way to see
 * it was a full page refresh, which is exactly what it felt like.
 *
 * This listens once, at the top of the tree, and invalidates rather than
 * writing into the cache. Invalidating means the list and its badge are always
 * refetched from the same source at the same moment, so a count can never
 * disagree with the rows under it — and a payload that arrives out of order
 * cannot corrupt anything, because the payload is not what we store.
 *
 * Mounted inside QueryProvider and AuthProvider; it renders nothing.
 */
export function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const offs: Array<() => void> = [];

    /**
     * A new notification. The badge in the top bar and the account menu both
     * read `unreadCount`, and neither had any way to learn about this.
     */
    offs.push(
      onEvent('notification:new', () => {
        void queryClient.invalidateQueries({ queryKey: qk.notifications });
        void queryClient.invalidateQueries({ queryKey: qk.unreadCount });
        /**
         * A notification is the tail of a state change, not an isolated
         * message: "you're in", "not admitted", "the squad was cancelled" all
         * describe squad state the screen behind the bell is still showing
         * stale. Refetching the squad queries here is what makes the page catch
         * up without a reload, for the many cases where the affected user is
         * not in the room the originating event was broadcast to.
         *
         * Invalidation, not a patch — the payload carries only an id, and the
         * server stays the source of truth.
         */
        void queryClient.invalidateQueries({ queryKey: ['squads'] });
        void queryClient.invalidateQueries({ queryKey: qk.mySquads });
      }),
    );

    /**
     * A chat message. The open thread handles its own live append — that path
     * is unchanged and still the fast one. This is for every *other* surface:
     * the thread list, its unread markers, and the badge.
     *
     * Scoped by thread id so an open conversation is not refetched underneath
     * the message it just rendered.
     */
    offs.push(
      onEvent('chat:message', (message) => {
        void queryClient.invalidateQueries({ queryKey: qk.threads });
        void queryClient.invalidateQueries({ queryKey: qk.unreadCount });
        const threadId = (message as { threadId?: string })?.threadId;
        if (threadId) {
          void queryClient.invalidateQueries({ queryKey: qk.thread(threadId) });
        }
      }),
    );

    /**
     * A ride changed state — including being cancelled.
     *
     * The server already excludes cancelled rides from every discovery query,
     * so this is purely about *when* the client finds out. Without it a
     * cancelled ride sat in a stale list until the cache expired, which reads
     * as the cancellation not having worked.
     */
    offs.push(
      onEvent('ride:status', (payload) => {
        void queryClient.invalidateQueries({ queryKey: ['rides'] });
        void queryClient.invalidateQueries({ queryKey: ['planner-rides'] });
        void queryClient.invalidateQueries({ queryKey: ['planner-availability'] });
        const rideId = (payload as { rideId?: string })?.rideId;
        if (rideId) void queryClient.invalidateQueries({ queryKey: qk.ride(rideId) });
      }),
    );

    /**
     * A squad ended, or was published into discovery.
     *
     * Broadcast rather than room-scoped, because the audience is people who are
     * *not* in the squad — someone browsing has no membership and so no room.
     * Invalidating the discovery queries is the whole job: the server already
     * refuses to return cancelled or hidden squads, so a refetch is guaranteed
     * to drop it.
     */
    offs.push(
      onEvent('squad:status', (payload) => {
        void queryClient.invalidateQueries({ queryKey: ['squads'] });
        void queryClient.invalidateQueries({ queryKey: ['planner-squads'] });
        void queryClient.invalidateQueries({ queryKey: ['planner-squad-counts'] });
        const squadId = (payload as { squadId?: string })?.squadId;
        if (squadId) void queryClient.invalidateQueries({ queryKey: qk.squad(squadId) });
      }),
    );

    /** Roster changes move a squad in and out of "full", so counts move too. */
    offs.push(
      onEvent('squad:members-changed', () => {
        void queryClient.invalidateQueries({ queryKey: ['planner-squads'] });
        void queryClient.invalidateQueries({ queryKey: ['planner-squad-counts'] });
        void queryClient.invalidateQueries({ queryKey: qk.mySquads });
      }),
    );

    return () => {
      for (const off of offs) off();
    };
  }, [queryClient]);

  return null;
}

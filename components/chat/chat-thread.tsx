'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageCircle, SendHorizontal } from 'lucide-react';

import { cn, formatRelative } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { chatService } from '@/lib/services/chat';
import { LocationBubble, readLocation } from '@/components/chat/location-bubble';
import { qk } from '@/lib/hooks/queries';
import { useAuth } from '@/lib/auth/auth-provider';
import { connectSocket, getSocket, joinRoom, onEvent, rooms } from '@/lib/live/socket';
import type { ChatContextType, ChatMessage, Paginated } from '@/types';

/**
 * The one chat surface. Squad chat, ride chat, community channels and DMs all
 * render this component and differ only by `contextType` — there is no second
 * implementation anywhere in the app (Section 5.9).
 */
export function ChatThreadView({
  contextType,
  contextId,
  className,
}: {
  contextType: ChatContextType;
  contextId: string;
  className?: string;
}) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Resolve (or create) the thread for this context before loading history.
  const {
    data: thread,
    isPending: threadPending,
    isError: threadFailed,
    error: threadError,
    refetch: retryThread,
  } = useQuery({
    queryKey: ['chat', 'resolve', contextType, contextId],
    queryFn: () => chatService.resolveThread(contextType, contextId),
    staleTime: 5 * 60_000,
    /**
     * A 403 here means "not a member of this squad", which no amount of
     * retrying changes — it just delays the message by three backoffs.
     */
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
  });

  const threadId = thread?.id ?? null;

  const {
    data,
    isPending: messagesPending,
    isError: messagesFailed,
  } = useQuery({
    queryKey: qk.threadMessages(threadId ?? ''),
    queryFn: () => chatService.messages(threadId as string),
    enabled: Boolean(threadId),
    staleTime: 0,
  });

  /**
   * A *disabled* query reports `isPending: true` in React Query v5 — it has no
   * data and never will until it is enabled. Reading that as "loading" meant
   * that when thread resolution failed, `threadId` stayed null, the messages
   * query stayed disabled, and the skeleton rendered forever with no error and
   * no way out. That was the permanently-loading chat tab.
   */
  const loading = threadPending || (Boolean(threadId) && messagesPending);
  const failed = threadFailed || messagesFailed;

  const messages = useMemo(
    // The API returns newest-first for pagination; render oldest-first.
    () => [...(data?.items ?? [])].reverse(),
    [data],
  );

  /**
   * Tell the server the thread has been seen.
   *
   * `chatService.markRead` existed and was never called from anywhere, so
   * `ThreadReadState.lastReadAt` was never written and the unread count — which
   * is derived from it — could only ever go up. That is why a thread you had
   * just read still showed its badge.
   *
   * Re-run keyed on the newest message id, so a message arriving while the
   * thread is open is marked read too rather than counting against a
   * conversation the user is looking at. Invalidating the thread list is what
   * moves both the per-thread badge and the dock's total, from the same server
   * numbers — no local counter.
   */
  const newestMessageId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    void chatService
      .markRead(threadId)
      .then(() => {
        if (cancelled) return;
        void qc.invalidateQueries({ queryKey: qk.threads });
        void qc.invalidateQueries({ queryKey: qk.unreadCount });
      })
      .catch(() => {
        // A failed read receipt is not worth interrupting the conversation.
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, newestMessageId, qc]);

  // Live delivery. Only this thread's room is subscribed.
  useEffect(() => {
    if (!threadId) return;
    const leave = joinRoom(rooms.thread(threadId));

    const off = onEvent('chat:message', (incoming) => {
      if (incoming.threadId !== threadId) return;
      qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) => {
        if (!prev) return { items: [incoming], nextCursor: null };
        // Replace the optimistic copy if the server echoed our own message back.
        const withoutPending = prev.items.filter(
          (m) => !(m.pending && m.content === incoming.content),
        );
        if (withoutPending.some((m) => m.id === incoming.id)) return prev;
        return { ...prev, items: [incoming, ...withoutPending] };
      });
    });

    return () => {
      off();
      leave();
    };
  }, [threadId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  /**
   * Typing indicator.
   *
   * The server already relayed `chat:typing` to everyone else in the thread;
   * nothing on the client emitted it or listened for it, so the feature existed
   * end-to-end except for the two halves that make it visible.
   *
   * Keyed by user id with a timestamp rather than a boolean: a "stopped" event
   * is lost whenever someone closes the tab mid-word, and a flag set that way
   * never clears. Entries simply expire.
   */
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!threadId) return;
    return onEvent('chat:typing', (payload) => {
      if (payload.threadId !== threadId || payload.userId === profile?.id) return;
      setTypingUsers((current) => {
        if (!payload.typing) {
          const { [payload.userId]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [payload.userId]: Date.now() };
      });
    });
  }, [threadId, profile?.id]);

  // Sweep stale entries so a dropped "stopped" event cannot pin the indicator on.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTypingUsers((current) => {
        const cutoff = Date.now() - 4000;
        const next = Object.fromEntries(
          Object.entries(current).filter(([, at]) => at > cutoff),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  /** Throttled so a fast typist sends one event a second, not one per keystroke. */
  const lastTypingSent = useRef(0);
  const stopTypingTimer = useRef<number | null>(null);

  /**
   * Says "not typing any more", now, and cancels the pending timer.
   *
   * Every exit from typing routes through here — sending, blurring, emptying
   * the box, closing the thread — because the only other thing that clears the
   * indicator is a 1.8s timeout the recipient cannot see, and the sender
   * looking like they are still typing after they have sent the message is
   * exactly the stuck state that was reported.
   */
  const stopTyping = useCallback(() => {
    if (stopTypingTimer.current) {
      window.clearTimeout(stopTypingTimer.current);
      stopTypingTimer.current = null;
    }
    if (!threadId || lastTypingSent.current === 0) return;
    lastTypingSent.current = 0;
    const socket = getSocket();
    if (socket.connected) socket.emit('chat:typing', { threadId, typing: false });
  }, [threadId]);

  const signalTyping = useCallback(() => {
    if (!threadId) return;
    const socket = connectSocket();
    if (!socket.connected) return;

    const now = Date.now();
    if (now - lastTypingSent.current > 1000) {
      lastTypingSent.current = now;
      socket.emit('chat:typing', { threadId, typing: true });
    }

    if (stopTypingTimer.current) window.clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = window.setTimeout(() => {
      socket.emit('chat:typing', { threadId, typing: false });
      lastTypingSent.current = 0;
      stopTypingTimer.current = null;
    }, 1800);
  }, [threadId]);

  // Leaving the thread must not leave a "typing…" behind on everyone else's
  // screen for as long as their sweep takes to notice.
  useEffect(() => stopTyping, [stopTyping]);

  /**
   * Names come from the thread's participants, not from the messages.
   *
   * Reading them off `messages` meant a participant who had not yet sent
   * anything in this thread resolved to `undefined`, was filtered out, and the
   * indicator never appeared — so it worked only for people who had already
   * spoken. That is the inconsistency: it was never about the event, which
   * arrives fine, but about having no name to render it with.
   */
  const typingNames = Object.keys(typingUsers).map(
    (userId) =>
      thread?.participants.find((p) => p.id === userId)?.name ??
      messages.find((m) => m.senderId === userId)?.sender?.name ??
      'Someone',
  );

  const [sharingLocation, setSharingLocation] = useState(false);

  /**
   * Sends where the sender is right now.
   *
   * Read once on demand rather than watched: this is "here is where I am",
   * not a live feed. Continuous sharing is the squad map's job, and it is
   * opt-in and scoped to a squad — quietly turning a chat message into a
   * tracker would be a different promise entirely.
   */
  const shareLocation = useCallback(() => {
    if (!threadId || !profile) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    setSharingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharingLocation(false);
        const { latitude, longitude } = position.coords;
        const clientId = `local-${Date.now()}`;
        const metadata = { lat: latitude, lng: longitude, live: true };

        const optimistic: ChatMessage = {
          id: clientId,
          threadId,
          senderId: profile.id,
          sender: {
            id: profile.id,
            name: profile.name,
            username: profile.username,
            profilePhoto: profile.profilePhoto,
            college: profile.college,
          },
          // Text is a fallback for anything that cannot render the bubble.
          content: 'Shared a location',
          type: 'location',
          metadata,
          replyToId: null,
          createdAt: new Date().toISOString(),
          pending: true,
        };

        qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) =>
          prev
            ? { ...prev, items: [optimistic, ...prev.items] }
            : { items: [optimistic], nextCursor: null },
        );

        const socket = connectSocket();
        if (socket.connected) {
          socket.emit('chat:send', {
            threadId,
            clientId,
            content: 'Shared a location',
            type: 'location',
            metadata,
          });
        } else {
          void chatService
            .send(threadId, { clientId, content: 'Shared a location', type: 'location', metadata })
            .catch(() => {
              qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) =>
                prev
                  ? {
                      ...prev,
                      items: prev.items.map((m) =>
                        m.id === clientId ? { ...m, pending: false, failed: true } : m,
                      ),
                    }
                  : prev,
              );
            });
        }
      },
      () => {
        // Denied or unavailable. Silent by design — the user just declined a
        // permission prompt they can see; an error toast repeats it back.
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, [threadId, profile, qc]);

  const send = useCallback(() => {
    const content = draft.trim();
    if (!content || !threadId || !profile) return;

    const clientId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: clientId,
      threadId,
      senderId: profile.id,
      sender: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        profilePhoto: profile.profilePhoto,
        college: profile.college,
      },
      content,
      type: 'text',
      metadata: null,
      replyToId: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    // Optimistic append — the bubble appears instantly and reconciles when the
    // server echoes it back over the socket (Section 7.3).
    qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) =>
      prev ? { ...prev, items: [optimistic, ...prev.items] } : { items: [optimistic], nextCursor: null },
    );
    setDraft('');

    const socket = connectSocket();
    if (socket.connected) {
      socket.emit('chat:send', { threadId, clientId, content, type: 'text' });
    } else {
      // Offline or socket down — fall back to HTTP so the message is not lost.
      void chatService
        .send(threadId, { clientId, content, type: 'text' })
        .then((saved) => {
          qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) =>
            prev
              ? { ...prev, items: prev.items.map((m) => (m.id === clientId ? saved : m)) }
              : prev,
          );
        })
        .catch(() => {
          qc.setQueryData<Paginated<ChatMessage>>(qk.threadMessages(threadId), (prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((m) =>
                    m.id === clientId ? { ...m, pending: false, failed: true } : m,
                  ),
                }
              : prev,
          );
        });
    }
  }, [draft, threadId, profile, qc]);

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={cn('flex gap-2', i % 2 === 0 ? '' : 'flex-row-reverse')}>
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className={cn('h-9 rounded-lg', i % 2 === 0 ? 'w-48' : 'w-36')} />
          </div>
        ))}
      </div>
    );
  }

  /**
   * The state that used to be a permanent skeleton. A 403 is the common case
   * and means something specific — you are not in this squad — so it is worth
   * saying rather than showing a generic failure.
   */
  if (failed || !threadId) {
    const forbidden = threadError instanceof ApiError && threadError.status === 403;
    return (
      <div
        className={cn(
          'rounded-lg border border-line bg-surface p-8 text-center shadow-soft',
          className,
        )}
      >
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
          <MessageCircle className="h-4 w-4" />
        </span>
        <p className="mt-3 text-[14px] font-medium text-ink">
          {forbidden ? 'Members only' : "Couldn't open this conversation"}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {forbidden
            ? 'Join the squad and the leader has to approve you before the chat opens.'
            : threadError instanceof Error
              ? threadError.message
              : 'Something went wrong loading the messages.'}
        </p>
        {forbidden ? null : (
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => void retryThread()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft',
        // Fills the space left by the top bar and dock instead of a fixed
        // height that overflows small phones and wastes space on desktop.
        'h-[min(60vh,460px)] sm:h-[460px]',
        className,
      )}>
      {/* The transcript sits on the canvas, not the surface: white bubbles on a
          white panel have nothing to lift off, which is what made the thread
          read as a list of paragraphs rather than a conversation. */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
        {messages.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={<MessageCircle className="h-5 w-5" />}
            title="No messages yet"
            description="Say something — everyone in here will see it."
          />
        ) : (
          messages.map((message) => {
            const mine = message.senderId === profile?.id;
            return (
              <div
                key={message.id}
                className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}
              >
                {!mine ? (
                  <Avatar
                    src={message.sender?.profilePhoto}
                    name={message.sender?.name}
                    size="xs"
                  />
                ) : null}
                <div className={cn('max-w-[75%]', mine && 'text-right')}>
                  {!mine ? (
                    <p className="mb-0.5 px-1 text-[11px] text-ink-subtle">
                      {message.sender?.name}
                    </p>
                  ) : null}
                  {(() => {
                    /* A location message carries no useful text — its content
                       is the coordinate pair in metadata, so the bubble is a
                       map rather than a sentence. */
                    const place =
                      message.type === 'location' || message.type === 'live-location'
                        ? readLocation(message.metadata)
                        : null;
                    return place ? (
                      <LocationBubble location={place} mine={mine} />
                    ) : null;
                  })()}

                  <div
                    className={cn(
                      'inline-block px-3.5 py-2 text-[13.5px] leading-relaxed shadow-soft',
                      // Hidden when the map bubble replaced it.
                      (message.type === 'location' || message.type === 'live-location') &&
                        readLocation(message.metadata) &&
                        'hidden',
                      // Rounded except at the corner nearest its author — the
                      // shape alone tells you who spoke, before colour does.
                      'rounded-2xl',
                      mine
                        ? 'rounded-br-md bg-brand text-brand-fg'
                        : 'rounded-bl-md border border-line bg-surface text-ink',
                      message.pending && 'opacity-60',
                      message.failed && 'ring-1 ring-danger',
                    )}
                  >
                    {message.content}
                  </div>
                  <p className="mt-0.5 px-1 text-[10.5px] text-ink-subtle">
                    {message.failed
                      ? 'Not sent'
                      : message.pending
                        ? 'Sending…'
                        : formatRelative(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sits between the transcript and the composer so it does not push the
          last message off screen when it appears. */}
      {typingNames.length > 0 ? (
        <div className="flex items-center gap-2 border-t border-line bg-surface px-4 py-2">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span className="text-[12px] text-ink-muted" aria-live="polite">
            {typingNames.length === 1
              ? `${typingNames[0]} is typing…`
              : `${typingNames.length} people are typing…`}
          </span>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Sending ends typing by definition; say so before the message goes,
          // so the recipient never sees "typing…" above a message that has
          // already arrived.
          stopTyping();
          send();
        }}
        className="flex items-center gap-2 border-t border-line bg-surface p-3"
      >
        <input
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            // An empty box is not typing — clearing it should drop the
            // indicator immediately rather than waiting out the timer.
            if (next.trim()) signalTyping();
            else stopTyping();
          }}
          onBlur={stopTyping}
          placeholder="Message"
          aria-label="Message"
          className={cn(
            'h-10 flex-1 rounded-full border border-line bg-surface-sunken px-4 text-sm text-ink',
            'outline-none transition-colors placeholder:text-ink-subtle',
            'focus:border-brand focus:bg-surface',
          )}
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Share my location"
          title="Share my location"
          loading={sharingLocation}
          onClick={shareLocation}
          className="rounded-full"
        >
          <MapPin className="h-4 w-4" />
        </Button>

        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim()}
          aria-label="Send"
          className="rounded-full"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, MessageCircle } from 'lucide-react';

import { formatRelative } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ChatThreadView } from '@/components/chat/chat-thread';
import { useThreads } from '@/lib/hooks/queries';
import type { ChatContextType } from '@/types';

function ChatIndex() {
  const params = useSearchParams();
  const { data, isPending } = useThreads();

  // Deep link from a ride or squad card: /chat?context=ride&id=…
  const context = params.get('context') as ChatContextType | null;
  const contextId = params.get('id');

  if (context && contextId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
          {context === 'ride' ? 'Ride chat' : context === 'squad' ? 'Squad chat' : 'Chat'}
        </h1>
        <ChatThreadView contextType={context} contextId={contextId} />
      </div>
    );
  }

  const threads = data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">
          Chat
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Squads, rides, channels and direct messages in one place.
        </p>
      </header>

      {isPending ? (
        <SkeletonList count={4} />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-5 w-5" />}
          title="No conversations yet"
          description="Join a ride or a squad and its chat will appear here."
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {threads.map((thread) => {
            /**
             * A closed conversation stays in the list — that is the point of
             * it. You can still see who you travelled with; you just cannot
             * open it or read what was said.
             *
             * Rendered as a plain div rather than a disabled Link, because
             * there is no such thing as a disabled anchor: a Link with an
             * onClick that preventDefaults is still focusable, still announced
             * as a link, and still openable with a middle click.
             */
            const closed = thread.access === 'locked' || thread.access === 'erased';
            const row = (
              <>
                <Avatar src={thread.imageUrl} name={thread.title} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[14px] font-medium text-ink">{thread.title}</p>
                    <span className="shrink-0 text-[11px] text-ink-subtle">
                      {formatRelative(thread.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    {closed
                      ? 'This conversation has closed'
                      : (thread.lastMessage?.content ?? 'No messages yet')}
                  </p>
                </div>
                {closed ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />
                ) : thread.unreadCount > 0 ? (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-fg">
                    {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                  </span>
                ) : null}
              </>
            );

            return (
              <li key={thread.id}>
                {closed ? (
                  <div
                    className="flex cursor-not-allowed items-center gap-3 px-4 py-3.5 opacity-60"
                    aria-label={`${thread.title} — conversation closed`}
                  >
                    {row}
                  </div>
                ) : (
                  <Link
                    href={`/chat/${thread.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-sunken"
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<SkeletonList count={4} />}>
      <ChatIndex />
    </Suspense>
  );
}

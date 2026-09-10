'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatThreadView } from '@/components/chat/chat-thread';
import { useThread } from '@/lib/hooks/queries';

export default function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { data: thread, isPending } = useThread(threadId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/chat"
          aria-label="Back to chat"
          className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {isPending ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar src={thread?.imageUrl} name={thread?.title} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">
                {thread?.title ?? 'Conversation'}
              </p>
              <p className="truncate text-[12px] text-ink-subtle">
                {thread?.participants.length ?? 0} participants
              </p>
            </div>
          </div>
        )}
      </div>

      {/**
       * Typing the URL must not get you in either. The list already refuses to
       * link here, but a closed conversation reachable by address would make
       * the lock a matter of navigation rather than of access — and the API
       * would refuse the messages anyway, leaving an empty thread with a
       * composer and no explanation.
       */}
      {thread && (thread.access === 'locked' || thread.access === 'erased') ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface px-6 py-14 text-center">
          <Lock className="h-5 w-5 text-ink-subtle" aria-hidden />
          <p className="text-[14px] font-medium text-ink">This conversation has closed</p>
          <p className="max-w-xs text-[13px] leading-relaxed text-ink-muted">
            Squad chats close a few hours after the trip ends. You can still see who you
            travelled with.
          </p>
        </div>
      ) : thread ? (
        <ChatThreadView contextType={thread.contextType} contextId={thread.contextId} />
      ) : (
        <Skeleton className="h-[460px] w-full rounded-lg" />
      )}
    </div>
  );
}

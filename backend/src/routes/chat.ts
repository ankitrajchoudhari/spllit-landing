import { Router, Response } from 'express';

import prisma from '../utils/prisma.js';
import { identify } from '../middleware/identity.js';
import { AuthRequest } from '../types/express.js';
import { ok, fail } from '../utils/respond.js';
import {
  canAccessThread,
  canPostToThread,
  resolveThread,
  threadReadAccess,
  threadReadAccessMap,
  type ContextType,
} from '../services/threads.js';
import {
  CHAT_RETENTION,
  sweepErasedChatsInBackground,
} from '../services/squadChatRetention.js';
import { getIO } from '../services/live.js';
import { notify } from '../services/notifications.js';
import { markSquadActivity } from '../services/squadLifecycle.js';

const router = Router();

const USER_SUMMARY = {
  id: true,
  name: true,
  username: true,
  profilePhoto: true,
  college: true,
} as const;

const CONTEXTS: ContextType[] = ['squad', 'ride', 'channel', 'dm'];

async function withSenders(messages: { senderId: string }[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(messages.map((m) => m.senderId))] } },
    select: USER_SUMMARY,
  });
  return new Map(users.map((u) => [u.id, u]));
}

/** GET /api/chat/threads — every conversation the caller is part of. */
router.get('/threads', identify, async (req: AuthRequest, res: Response) => {
  try {
    const threads = await prisma.chatThread.findMany({
      where: { participantIds: { has: req.user!.userId } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const [lastMessages, readStates] = await Promise.all([
      prisma.threadMessage.findMany({
        where: { threadId: { in: threads.map((t) => t.id) }, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.threadReadState.findMany({
        where: { threadId: { in: threads.map((t) => t.id) }, userId: req.user!.userId },
      }),
    ]);

    // First message seen per thread wins — the list is already newest-first.
    const latest = new Map<string, (typeof lastMessages)[number]>();
    for (const message of lastMessages) {
      if (!latest.has(message.threadId)) latest.set(message.threadId, message);
    }

    const readAt = new Map(readStates.map((r) => [r.threadId, r.lastReadAt]));
    const senders = await withSenders([...latest.values()]);

    const participants = await prisma.user.findMany({
      where: { id: { in: [...new Set(threads.flatMap((t) => t.participantIds))] } },
      select: USER_SUMMARY,
    });
    const byId = new Map(participants.map((p) => [p.id, p]));

    // Retention runs from a read because there is no timer available on Cloud
    // Run. Throttled and never awaited — see squadChatRetention.
    sweepErasedChatsInBackground();

    // One query for every squad involved, not one per row — this is the
    // most-loaded screen in the app, and a per-row lookup turns a list of
    // twenty conversations into twenty-one round trips.
    const access = await threadReadAccessMap(threads);

    const items = await Promise.all(
      threads.map(async (thread) => {
        const since = readAt.get(thread.id);
        const unreadCount = await prisma.threadMessage.count({
          where: {
            threadId: thread.id,
            isDeleted: false,
            senderId: { not: req.user!.userId },
            ...(since ? { createdAt: { gt: since } } : {}),
          },
        });

        const last = latest.get(thread.id);
        const threadAccess = access.get(thread.id) ?? 'open';
        const closed = threadAccess !== 'open';

        /**
         * A closed conversation still appears, showing who you travelled with
         * — that is the point of leaving the row behind. What it must not do is
         * leak the conversation: the preview and the unread badge are dropped,
         * because a list that still shows the last message has not closed
         * anything, it has just made it harder to scroll to.
         */
        return {
          ...thread,
          unreadCount: closed ? 0 : unreadCount,
          access: threadAccess,
          participants: thread.participantIds
            .map((id) => byId.get(id))
            .filter((u): u is NonNullable<typeof u> => Boolean(u)),
          lastMessage:
            closed || !last ? null : { ...last, sender: senders.get(last.senderId) ?? null },
        };
      }),
    );

    return ok(res, items);
  } catch (error) {
    console.error('[chat/threads]', error);
    return fail(res, 500, 'Failed to load conversations');
  }
});

/** POST /api/chat/threads/resolve — find or create the thread for a context. */
router.post('/threads/resolve', identify, async (req: AuthRequest, res: Response) => {
  try {
    const contextType = String(req.body.contextType) as ContextType;
    const contextId = String(req.body.contextId ?? '');

    if (!CONTEXTS.includes(contextType) || !contextId) {
      return fail(res, 400, 'A valid chat context is required');
    }

    const thread = await resolveThread(contextType, contextId, req.user!.userId);
    if (!thread) {
      return fail(res, 403, 'You do not have access to this conversation');
    }

    const participants = await prisma.user.findMany({
      where: { id: { in: thread.participantIds } },
      select: USER_SUMMARY,
    });

    // `access` tells the client whether to render the composer and the message
    // list. Advisory only — the endpoints enforce it — but it saves the UI
    // re-deriving a rule that lives in squadChatRetention.
    const access = await threadReadAccess(thread);

    return ok(res, { ...thread, participants, unreadCount: 0, lastMessage: null, access });
  } catch (error) {
    console.error('[chat/threads/resolve]', error);
    return fail(res, 500, 'Failed to open the conversation');
  }
});

router.get('/threads/:id', identify, async (req: AuthRequest, res: Response) => {
  try {
    const thread = await canAccessThread(req.params.id, req.user!.userId);
    if (!thread) return fail(res, 404, 'Conversation not found');

    const participants = await prisma.user.findMany({
      where: { id: { in: thread.participantIds } },
      select: USER_SUMMARY,
    });

    // `access` tells the client whether to render the composer and the message
    // list. Advisory only — the endpoints enforce it — but it saves the UI
    // re-deriving a rule that lives in squadChatRetention.
    const access = await threadReadAccess(thread);

    return ok(res, { ...thread, participants, unreadCount: 0, lastMessage: null, access });
  } catch (error) {
    console.error('[chat/threads/:id]', error);
    return fail(res, 500, 'Failed to load the conversation');
  }
});

/** GET /api/chat/threads/:id/messages — newest first, cursor walks backwards. */
router.get('/threads/:id/messages', identify, async (req: AuthRequest, res: Response) => {
  try {
    const thread = await canAccessThread(req.params.id, req.user!.userId);
    if (!thread) return fail(res, 404, 'Conversation not found');

    /**
     * A closed conversation serves nothing, not even to a participant.
     *
     * Enforced here and not only in the client: a thread the list renders as
     * locked that still answers this endpoint when asked directly is not
     * locked, it is merely hidden — and the retention promise would be a UI
     * convention rather than something that actually holds.
     */
    if ((await threadReadAccess(thread)) !== 'open') {
      return fail(
        res,
        403,
        `This conversation closed ${CHAT_RETENTION.LOCK_HOURS} hours after the squad ended.`,
        'squad-chat-closed',
      );
    }

    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

    const messages = await prisma.threadMessage.findMany({
      where: {
        threadId: thread.id,
        isDeleted: false,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const senders = await withSenders(messages);

    return ok(res, {
      items: messages.map((m) => ({ ...m, sender: senders.get(m.senderId) ?? null })),
      nextCursor:
        messages.length === limit
          ? (messages[messages.length - 1]?.createdAt.toISOString() ?? null)
          : null,
    });
  } catch (error) {
    console.error('[chat/messages GET]', error);
    return fail(res, 500, 'Failed to load messages');
  }
});

/**
 * POST /api/chat/threads/:id/messages
 * HTTP send path. The socket path is preferred, but this exists so a message
 * is never silently lost when the socket is down.
 */
router.post('/threads/:id/messages', identify, async (req: AuthRequest, res: Response) => {
  try {
    // Write path: the squad must still be live and the sender still a member.
    // Being on `participantIds` is not enough — that list never shrinks.
    const { thread, denial } = await canPostToThread(req.params.id, req.user!.userId);
    if (denial || !thread) {
      return fail(
        res,
        denial?.status ?? 404,
        denial?.message ?? 'Conversation not found',
        denial?.code ?? 'not-found',
      );
    }

    const content = String(req.body.content ?? '').trim();
    if (!content) return fail(res, 400, 'Message cannot be empty');
    if (content.length > 4000) return fail(res, 400, 'Message is too long');

    const message = await prisma.threadMessage.create({
      data: {
        threadId: thread.id,
        senderId: req.user!.userId,
        content,
        type: typeof req.body.type === 'string' ? req.body.type : 'text',
        metadata: (req.body.metadata ?? null) as never,
      },
    });

    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: message.createdAt },
    });

    /**
     * A squad people are still talking in has not gone quiet, whatever the
     * clock says. This is the signal the lifecycle's inactivity rule most
     * depends on — position reports cover the members who are navigating, and
     * this covers everyone else.
     */
    if (thread.contextType === 'squad') {
      await markSquadActivity(thread.contextId, message.createdAt);
    }

    const sender = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: USER_SUMMARY,
    });

    const payload = { ...message, sender };
    getIO()?.to(`thread:${thread.id}`).emit('chat:message', payload);

    // Notify participants who are not in the room. Channels are excluded —
    // a busy channel would otherwise generate a notification per message.
    if (thread.contextType !== 'channel') {
      const senderName = sender?.name ?? 'Someone';

      await Promise.all(
        thread.participantIds
          .filter((id) => id !== req.user!.userId)
          .map(async (userId) => {
            /**
             * One notification per conversation, not per message.
             *
             * This used to insert a row for every message, with the message
             * text as the body. Two problems, and a chatty squad produced both
             * at once: the list filled with one entry per message until the
             * older notifications that actually needed acting on — a join
             * request, a ride invite — were pushed off the screen; and the
             * content of private messages was reproduced in a list that is
             * readable over someone's shoulder from the lock screen.
             *
             * So an unread notification for this thread is refreshed in place
             * instead. The list answers "who is waiting on you", which is what
             * a notification is for; the messages themselves live in the chat.
             */
            const existing = await prisma.notification.findFirst({
              where: {
                userId,
                type: 'chat.message',
                readAt: null,
                data: { equals: { threadId: thread.id } },
              },
              select: { id: true },
            });

            if (existing) {
              await prisma.notification.update({
                where: { id: existing.id },
                data: {
                  title: `New messages from ${senderName}`,
                  body: thread.title ? `In ${thread.title}` : 'Tap to open the conversation.',
                  // Re-dated so it sorts to the top as if it were new, which it
                  // effectively is — this is the most recent thing that happened.
                  createdAt: new Date(),
                },
              });
              getIO()?.to(`user:${userId}`).emit('notification:new', { id: existing.id });
              return;
            }

            await notify({
              userId,
              type: 'chat.message',
              title: `New message from ${senderName}`,
              body: thread.title ? `In ${thread.title}` : 'Tap to open the conversation.',
              href: `/chat/${thread.id}`,
              data: { threadId: thread.id },
            });
          }),
      );
    }

    return ok(res, payload, 201);
  } catch (error) {
    console.error('[chat/messages POST]', error);
    return fail(res, 500, 'Failed to send the message');
  }
});

router.post('/threads/:id/read', identify, async (req: AuthRequest, res: Response) => {
  try {
    const thread = await canAccessThread(req.params.id, req.user!.userId);
    if (!thread) return fail(res, 404, 'Conversation not found');

    await prisma.threadReadState.upsert({
      where: { threadId_userId: { threadId: thread.id, userId: req.user!.userId } },
      create: { threadId: thread.id, userId: req.user!.userId },
      update: { lastReadAt: new Date() },
    });

    return res.status(204).end();
  } catch (error) {
    console.error('[chat/read]', error);
    return fail(res, 500, 'Failed to mark as read');
  }
});

export default router;

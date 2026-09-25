import { Server, Socket } from 'socket.io';

import prisma from '../utils/prisma.js';
import { verifyAccessToken } from '../utils/helpers.js';
import { verifyFirebaseIdToken, isFirebaseAdminConfigured } from '../utils/firebaseAdmin.js';

/**
 * The live/ephemeral layer — what the original spec put in Firebase RTDB.
 *
 * Nothing here is persisted: positions, presence and typing indicators live in
 * memory and in the rooms they are broadcast to. Durable state (squad
 * membership, chat history, ride status) goes through the REST routes.
 */

interface LiveSocket extends Socket {
  userId?: string;
}

/** Last known position per user. Bounded by concurrent connections, not time. */
const positions = new Map<
  string,
  { lat: number; lng: number; heading: number | null; updatedAt: number }
>();

/** Rooms each socket has joined, so we can clean up precisely on disconnect. */
const socketRooms = new Map<string, Set<string>>();

let ioRef: Server | null = null;

export function getIO(): Server | null {
  return ioRef;
}

export function getLivePosition(userId: string) {
  return positions.get(userId) ?? null;
}

/** Rooms a user is implicitly allowed into, derived from real membership. */
/**
 * Mirrors ACTIVE_MEMBER_STATUSES in services/squads.ts.
 *
 * Declared here rather than imported: squads.ts already imports getIO from
 * this module, and importing back would close a cycle. Three string literals
 * are the cheaper half of that trade.
 */
const ACTIVE_MEMBER_STATUSES = ['active', 'travelling', 'arrived'] as const;

/** Mirrors LIVE_SQUAD_STATUSES in services/squads.ts, for the same reason. */
const LIVE_SQUAD_STATUSES = ['active', 'in_progress'] as const;

async function authorisedRooms(userId: string): Promise<Set<string>> {
  const [squads, hosted, joined] = await Promise.all([
    prisma.squadMember.findMany({
      // Not `status: 'active'`. A member who starts moving becomes
      // `travelling` and one who gets there becomes `arrived` — filtering on
      // 'active' alone would evict people from their own squad's room at
      // exactly the moment the live map matters to them.
      //
      // The squad's own status is checked too. Membership rows survive
      // cancellation, so without this a cancelled squad's room stayed
      // joinable — positions and roster events kept flowing through a squad
      // that had ended.
      where: {
        userId,
        status: { in: [...ACTIVE_MEMBER_STATUSES] },
        // Both live statuses: a member must not be evicted from their squad's
        // room the moment the meeting time passes.
        squad: { status: { in: [...LIVE_SQUAD_STATUSES] } },
      },
      select: { squadId: true },
    }),
    prisma.ride.findMany({ where: { userId }, select: { id: true } }),
    // Passengers, not just hosts. Accepting an invite puts someone on the ride
    // but not in `Ride.userId`, so without this the rider who just joined
    // cannot receive tracking or chat for the trip they are on.
    prisma.match.findMany({
      where: { user2Id: userId, status: 'accepted' },
      select: { rideId: true },
    }),
  ]);

  const allowed = new Set<string>([`user:${userId}`]);
  for (const s of squads) allowed.add(`squad:${s.squadId}`);
  for (const r of hosted) allowed.add(`ride:${r.id}`);
  for (const m of joined) allowed.add(`ride:${m.rideId}`);
  return allowed;
}

export type RoomKind = 'user' | 'thread' | 'squad' | 'ride';

/** Splits `kind:id`, or null for anything that is not a room clients may ask for. */
export function parseRoom(room: unknown): { kind: RoomKind; id: string } | null {
  if (typeof room !== 'string' || room.length > 120) return null;
  const match = /^(user|thread|squad|ride):([A-Za-z0-9_-]{1,100})$/.exec(room);
  return match ? { kind: match[1] as RoomKind, id: match[2] } : null;
}

/**
 * The room another user's position frames go to.
 *
 * `user:<id>` is that user's private channel — notifications, squad and ride
 * changes — and only their own sockets may be in it. Watching someone on the
 * map is a different, narrower right, so it gets its own room. Clients still
 * ask for `user:<id>`; the server decides which of the two they get.
 */
export const positionRoom = (userId: string) => `position:${userId}`;

/**
 * May `viewerId` see `targetId`'s live position?
 *
 * The same rule GET /api/users/nearby applies before it lists someone — same
 * campus, both active, neither has blocked the other — plus anyone they are
 * actually travelling with. The socket used to skip this entirely, so any
 * signed-in client could follow anyone whose id it knew.
 */
async function canWatchPosition(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return true;

  const [viewer, target, block] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, select: { college: true, isActive: true } }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: { college: true, isActive: true, onboarded: true },
    }),
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
  ]);

  if (!viewer?.isActive || !target?.isActive || !target.onboarded || block) return false;
  if (viewer.college && viewer.college === target.college) return true;

  // Different campus: only people on the same live squad or ride.
  const [mine, theirs] = await Promise.all([authorisedRooms(viewerId), authorisedRooms(targetId)]);
  for (const room of mine) {
    if (!room.startsWith('user:') && theirs.has(room)) return true;
  }
  return false;
}

/**
 * The Socket.IO room a join request resolves to, or null when it is refused.
 *
 * Every kind is checked against real data. `user:` and `thread:` used to be let
 * through for anyone signed in, which put any client in anyone's private
 * notifications and any conversation's live messages.
 */
async function resolveJoin(userId: string, room: string): Promise<string | null> {
  const parsed = parseRoom(room);
  if (!parsed) return null;

  switch (parsed.kind) {
    case 'user':
      if (parsed.id === userId) return room;
      return (await canWatchPosition(userId, parsed.id)) ? positionRoom(parsed.id) : null;

    case 'thread': {
      // Participants only — the same read gate the HTTP thread routes use.
      const { canAccessThread } = await import('./threads.js');
      return (await canAccessThread(parsed.id, userId)) ? room : null;
    }

    case 'squad':
    case 'ride':
      return (await authorisedRooms(userId)).has(room) ? room : null;
  }
}

export function setupLiveHandlers(io: Server) {
  ioRef = io;

  const live = io.of('/');

  live.use(async (socket: LiveSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next();

    // Same dual-scheme resolution as the HTTP middleware: backend JWT first,
    // Firebase ID token second.
    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      return next();
    } catch {
      // fall through
    }

    if (!isFirebaseAdminConfigured()) return next();

    try {
      const decoded = await verifyFirebaseIdToken(token);
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { firebaseUid: decoded.uid },
            ...(decoded.email ? [{ email: decoded.email }] : []),
          ],
        },
        select: { id: true },
      });
      if (user) socket.userId = user.id;
    } catch {
      // Unauthenticated sockets can still connect; they just cannot join
      // private rooms or publish a position.
    }
    return next();
  });

  live.on('connection', (socket: LiveSocket) => {
    socketRooms.set(socket.id, new Set());

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      socket.broadcast.emit('presence:update', {
        userId: socket.userId,
        state: 'online',
        lastSeen: Date.now(),
      });
    }

    /** What each requested room name was actually resolved to, for room:leave. */
    const joinedAs = new Map<string, string>();

    socket.on('room:join', async (room: string) => {
      if (!socket.userId) return;

      let target: string | null;
      try {
        target = await resolveJoin(socket.userId, room);
      } catch (error) {
        console.error('[live/room:join]', error);
        return;
      }
      if (!target) return;

      socket.join(target);
      joinedAs.set(room, target);
      socketRooms.get(socket.id)?.add(target);

      // Replay the last known position so a newly opened map is populated
      // immediately instead of waiting for the next movement tick.
      if (target.startsWith('position:')) {
        const userId = target.slice('position:'.length);
        const last = positions.get(userId);
        if (last) socket.emit('position:update', { userId, ...last });
      }
    });

    socket.on('room:leave', (room: string) => {
      const target = joinedAs.get(room);
      if (!target) return;
      // Never leave your own private room: notifications would stop arriving
      // for the rest of the connection.
      if (target === `user:${socket.userId}`) return;
      joinedAs.delete(room);
      socket.leave(target);
      socketRooms.get(socket.id)?.delete(target);
    });

    socket.on(
      'position:publish',
      (payload: { lat: number; lng: number; heading: number | null }) => {
        if (!socket.userId) return;
        const lat = Number(payload?.lat);
        const lng = Number(payload?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

        const frame = {
          lat,
          lng,
          heading: Number.isFinite(payload.heading) ? Number(payload.heading) : null,
          updatedAt: Date.now(),
        };
        positions.set(socket.userId, frame);

        const message = { userId: socket.userId, ...frame };

        // Fan out only to rooms this user is actually in — never a global
        // broadcast of everyone's location.
        // Own other tabs, plus whoever passed canWatchPosition.
        socket
          .to([`user:${socket.userId}`, positionRoom(socket.userId)])
          .emit('position:update', message);
        for (const room of socketRooms.get(socket.id) ?? []) {
          if (room.startsWith('squad:') || room.startsWith('ride:')) {
            socket.to(room).emit('position:update', message);
          }
        }
      },
    );

    /**
     * Socket send path — the fast one. Persists first, then echoes to the room,
     * so a message that appears to other clients is always one that survived
     * the write. The HTTP route is the fallback when this connection is down.
     */
    socket.on(
      'chat:send',
      async (payload: {
        threadId: string;
        clientId: string;
        content: string;
        type?: string;
        metadata?: Record<string, unknown>;
      }) => {
        if (!socket.userId || !payload?.threadId) return;
        const content = String(payload.content ?? '').trim();
        if (!content || content.length > 4000) return;

        try {
          /**
           * The same write gate the HTTP route uses.
           *
           * This is the path that actually mattered: a client whose squad was
           * cancelled still holds an open socket, and this handler only asked
           * whether they were ever a participant. So an ended squad kept
           * working as a live channel for anyone who already had the page open,
           * no matter what the UI showed them.
           */
          const { canPostToThread } = await import('./threads.js');
          const { thread, denial } = await canPostToThread(payload.threadId, socket.userId);
          if (denial || !thread) {
            // Told, not dropped: a message that silently vanishes reads as the
            // network failing, and the sender retries it forever.
            socket.emit('error', {
              code: denial?.code ?? 'not-found',
              message: denial?.message ?? 'Conversation not found',
            });
            return;
          }

          const message = await prisma.threadMessage.create({
            data: {
              threadId: thread.id,
              senderId: socket.userId,
              content,
              type: typeof payload.type === 'string' ? payload.type : 'text',
              metadata: (payload.metadata ?? null) as never,
            },
          });

          await prisma.chatThread.update({
            where: { id: thread.id },
            data: { lastMessageAt: message.createdAt },
          });

          const sender = await prisma.user.findUnique({
            where: { id: socket.userId },
            select: {
              id: true,
              name: true,
              username: true,
              profilePhoto: true,
              college: true,
            },
          });

          // Emitted to the whole room including the sender, so their optimistic
          // bubble is replaced by the authoritative row.
          live.to(`thread:${thread.id}`).emit('chat:message', { ...message, sender });
        } catch (error) {
          console.error('[live/chat:send]', error);
        }
      },
    );

    socket.on('chat:typing', (payload: { threadId: string; typing: boolean }) => {
      if (!socket.userId || typeof payload?.threadId !== 'string') return;
      // Only from inside the conversation; joining it is what checked access.
      const room = `thread:${payload.threadId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('chat:typing', {
        threadId: payload.threadId,
        userId: socket.userId,
        typing: Boolean(payload.typing),
      });
    });

    socket.on('disconnect', () => {
      socketRooms.delete(socket.id);
      if (socket.userId) {
        positions.delete(socket.userId);
        socket.broadcast.emit('presence:update', {
          userId: socket.userId,
          state: 'offline',
          lastSeen: Date.now(),
        });
      }
    });
  });
}

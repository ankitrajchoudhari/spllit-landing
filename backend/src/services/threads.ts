import type { ChatThread } from '@prisma/client';
import prisma from '../utils/prisma.js';
import { squadMemberHasAccess } from '../config/features.js';
import { ACTIVE_MEMBER_STATUSES, LIVE_SQUAD_STATUSES } from './squads.js';
import { CHAT_RETENTION, chatAccess, type ChatAccess } from './squadChatRetention.js';
import { STALE_AFTER_DEPARTURE_HOURS } from './rideVisibility.js';

/**
 * Thread resolution. A conversation is identified by what it is attached to,
 * not by an id the client has to remember — so opening chat from a ride card,
 * a squad page or a profile all land in the right place without the caller
 * knowing whether the thread already exists.
 */

export type ContextType = 'squad' | 'ride' | 'channel' | 'dm';

/** DM context ids are the two uids sorted, so both directions resolve equal. */
export function dmContextId(a: string, b: string): string {
  return [a, b].sort().join(':');
}

interface Resolved {
  title: string;
  imageUrl: string | null;
  participantIds: string[];
}

/**
 * Derives a thread's identity and membership from the thing it hangs off.
 * Returns null when the caller has no business being in that conversation —
 * this is the authorisation check for chat.
 */
async function describe(
  contextType: ContextType,
  contextId: string,
  userId: string,
): Promise<Resolved | null> {
  if (contextType === 'squad') {
    const squad = await prisma.squad.findUnique({ where: { id: contextId } });
    if (!squad) return null;
    /**
     * Every *active* status, not just 'active'.
     *
     * `travelling` and `arrived` are journey states, not membership states — a
     * member walking to the meeting point is still in the squad. Matching on
     * the literal 'active' silently ejected people from the group chat the
     * moment they started moving, which is precisely when they need it.
     */
    const members = await prisma.squadMember.findMany({
      where: { squadId: contextId, status: { in: [...ACTIVE_MEMBER_STATUSES] } },
      select: { userId: true, feePaid: true, role: true },
    });

    /**
     * Membership grants chat, not payment — while SQUAD_JOIN_PAYMENT_ENABLED
     * is false.
     *
     * This previously read `!viewer.feePaid`, which was correct only while the
     * fee was actually collectable. With payments unconfigured the order
     * endpoint answers 503, so an accepted member could not open the chat and
     * could not pay to unlock it either: admitted to the squad and silently
     * locked out of it, with nothing they could do. That is the live beta bug.
     *
     * The condition now lives in one helper so this surface, the participant
     * list below, and anything else members-only cannot drift apart — and so
     * turning the flag back on restores the paid gate everywhere at once.
     */
    const viewer = members.find((member) => member.userId === userId);
    if (!viewer) return null;
    if (!squadMemberHasAccess(viewer)) return null;

    // Participants are the people who can actually be in it.
    const ids = members.filter(squadMemberHasAccess).map((member) => member.userId);
    return { title: squad.name, imageUrl: squad.imageUrl, participantIds: ids };
  }

  if (contextType === 'ride') {
    const ride = await prisma.ride.findUnique({ where: { id: contextId } });
    if (!ride) return null;
    const matches = await prisma.match.findMany({
      where: { rideId: contextId, status: { in: ['pending', 'accepted'] } },
      select: { user2Id: true },
    });
    const ids = [ride.userId, ...matches.map((m) => m.user2Id)];
    if (!ids.includes(userId)) return null;
    return {
      title: `${ride.origin} → ${ride.destination}`,
      imageUrl: null,
      participantIds: [...new Set(ids)],
    };
  }

  if (contextType === 'channel') {
    const channel = await prisma.channel.findUnique({ where: { id: contextId } });
    if (!channel) return null;
    const members = await prisma.communityMember.findMany({
      where: { communityId: channel.communityId },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    if (!ids.includes(userId)) return null;
    return { title: `#${channel.name}`, imageUrl: null, participantIds: ids };
  }

  // DM: contextId is the other user's id on first open, or the sorted pair.
  const otherId = contextId.includes(':')
    ? contextId.split(':').find((id) => id !== userId)
    : contextId;
  if (!otherId || otherId === userId) return null;

  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, profilePhoto: true },
  });
  if (!other) return null;

  // Blocked in either direction means no thread.
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherId },
        { blockerId: otherId, blockedId: userId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return null;

  return {
    title: other.name,
    imageUrl: other.profilePhoto,
    participantIds: [userId, other.id],
  };
}

export async function resolveThread(
  contextType: ContextType,
  rawContextId: string,
  userId: string,
) {
  const described = await describe(contextType, rawContextId, userId);

  /**
   * A conversation you were in stays openable after you are out of it.
   *
   * `describe` answers "may this user be *added* to this thread", which needs
   * current membership. Using it as the gate for opening one meant that the
   * moment a squad was cancelled — every member becomes `left` — the thread
   * kept appearing in the list, with its unread badge, and 403'd when tapped.
   * The badge could never clear either, because marking read requires opening
   * the thread the user was being refused.
   *
   * So an existing thread the user is already a participant of resolves, and
   * they can read it. Sending is a separate question, answered by
   * `canPostToThread`, which refuses a cancelled squad and an ex-member.
   */
  if (!described) {
    const contextId =
      contextType === 'dm' ? dmContextId(userId, rawContextId) : rawContextId;
    const existing = await prisma.chatThread.findUnique({
      where: { contextType_contextId: { contextType, contextId } },
    });
    return existing && existing.participantIds.includes(userId) ? existing : null;
  }

  const contextId =
    contextType === 'dm'
      ? dmContextId(userId, described.participantIds.find((id) => id !== userId)!)
      : rawContextId;

  const existing = await prisma.chatThread.findUnique({
    where: { contextType_contextId: { contextType, contextId } },
  });

  if (existing) {
    // Membership can change after creation (someone joins a squad); keep the
    // denormalised participant list honest on every resolve.
    const changed =
      existing.participantIds.length !== described.participantIds.length ||
      described.participantIds.some((id) => !existing.participantIds.includes(id));

    if (changed || existing.title !== described.title) {
      return prisma.chatThread.update({
        where: { id: existing.id },
        data: { participantIds: described.participantIds, title: described.title },
      });
    }
    return existing;
  }

  return prisma.chatThread.create({
    data: {
      contextType,
      contextId,
      title: described.title,
      imageUrl: described.imageUrl,
      participantIds: described.participantIds,
    },
  });
}

/**
 * True when the user is listed on the thread. Cheap membership check.
 *
 * READ-SIDE ONLY. `participantIds` is a permanent record of who was ever in the
 * conversation, so this deliberately still passes for someone whose squad has
 * ended or who has left: history stays readable. Anything that *writes* must go
 * through `canPostToThread`, which is the gate that cares about the squad still
 * being alive.
 */
export async function canAccessThread(threadId: string, userId: string) {
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread || !thread.participantIds.includes(userId)) return null;
  return thread;
}

/** Why a write was refused, in the shape the HTTP and socket paths both need. */
export interface PostDenial {
  status: number;
  message: string;
  code: string;
}

/**
 * A plain record rather than a union discriminated on `ok`.
 *
 * The union version did not narrow at the call sites, so every `gate.status`
 * failed to compile. Two independent nullable fields need no narrowing at all:
 * callers test `denial` and are done, and `thread` is non-null exactly when
 * `denial` is null.
 */
export interface PostGate {
  thread: ChatThread | null;
  denial: PostDenial | null;
}

/**
 * The squad-chat write rule, with the database reads lifted out.
 *
 * Pure on purpose: this is the check that decides whether a cancelled squad can
 * still be used as a channel, and a rule that important should be executable in
 * a test rather than only reachable through a live Mongo connection.
 *
 * @param squad  null when the squad row is gone entirely
 * @param memberStatus  the caller's SquadMember.status, or null if no row
 */
export function squadPostDenial(
  squad: { name: string; status: string; endedAt: Date | null } | null,
  memberStatus: string | null,
  now: Date = new Date(),
): PostDenial | null {
  if (!squad) {
    return { status: 404, message: 'Conversation not found', code: 'not-found' };
  }

  /**
   * Past the grace window the conversation is closed outright — no reading, no
   * writing, for anybody.
   *
   * This used to cut writes off the instant the squad reached a terminal state.
   * That was too sharp: ending is exactly when people settle up, say where they
   * left a bag, and say goodbye. Chat now stays usable for
   * CHAT_RETENTION.LOCK_HOURS after the squad ends and then shuts completely.
   * See services/squadChatRetention.ts for the three states.
   */
  const access = chatAccess(squad, now);
  if (access !== 'open') {
    return {
      status: 403,
      message: `${squad.name} ended more than ${CHAT_RETENTION.LOCK_HOURS} hours ago. This conversation is closed.`,
      code: 'squad-chat-closed',
    };
  }

  /**
   * Membership is only required while the squad is live.
   *
   * Ending a squad releases every member — `releaseSquad` sets them all to
   * `left` — so re-checking active membership after that point would deny
   * everyone and close the grace window at the moment it opened. Inside the
   * window, having been in the squad is enough; `canAccessThread` has already
   * established that from `participantIds`.
   */
  if (LIVE_SQUAD_STATUSES.includes(squad.status as 'active')) {
    // Left or removed members keep their history and lose the microphone.
    if (!memberStatus || !ACTIVE_MEMBER_STATUSES.includes(memberStatus as 'active')) {
      return {
        status: 403,
        message: 'You are no longer a member of this squad.',
        code: 'not-a-member',
      };
    }
  }

  return null;
}

/**
 * Whether this user may put a NEW message into this thread, right now.
 *
 * `participantIds` alone was the only check, and it is a historical list — it
 * never shrinks. So once a squad was cancelled, or a member left, their client
 * kept posting to the thread and the server kept accepting: an ended squad went
 * on working as a private channel indefinitely. Hiding the composer did nothing
 * about it, because the socket and the HTTP route were both still open to
 * anyone who had ever been a participant.
 *
 * Squad threads therefore re-derive the right to speak on every write, from the
 * squad's own lifecycle and the sender's current membership. Read paths are
 * untouched.
 *
 * Only `squad` threads are gated here. Ride and DM threads have their own
 * lifecycles and are out of scope; narrowing by contextType keeps this from
 * silently changing behaviour it was not written for.
 */
export async function canPostToThread(threadId: string, userId: string): Promise<PostGate> {
  const thread = await canAccessThread(threadId, userId);
  if (!thread) {
    return { thread: null, denial: { status: 404, message: 'Conversation not found', code: 'not-found' } };
  }

  /**
   * A ride's chat closes on the same clock its listing does.
   *
   * Rides were exempt from the write gate entirely, so a ride that departed a
   * month ago still had a fully usable conversation — the ride had long since
   * vanished from search, and its chat had not noticed.
   */
  if (thread.contextType === 'ride') {
    const ride = await prisma.ride.findUnique({
      where: { id: thread.contextId },
      select: { status: true, departureTime: true },
    });
    if (ride && chatAccess(rideAsRetention(ride)) !== 'open') {
      return {
        thread: null,
        denial: {
          status: 403,
          message: 'This ride is over. The conversation is closed.',
          code: 'ride-chat-closed',
        },
      };
    }
    return { thread, denial: null };
  }

  if (thread.contextType !== 'squad') return { thread, denial: null };

  const [squad, membership] = await Promise.all([
    prisma.squad.findUnique({
      where: { id: thread.contextId },
      select: { name: true, status: true, endedAt: true, meetingAt: true, durationMinutes: true, updatedAt: true },
    }),
    prisma.squadMember.findUnique({
      where: { squadId_userId: { squadId: thread.contextId, userId } },
      select: { status: true },
    }),
  ]);

  const denial = squadPostDenial(squad, membership?.status ?? null);
  return denial ? { thread: null, denial } : { thread, denial: null };
}

/**
 * Read-side counterpart to `canPostToThread`: may this conversation be opened?
 *
 * Kept beside the write gate rather than inlined in the route, because the two
 * must agree. A thread the list renders as locked that still serves its
 * messages when asked directly is not locked at all — it is only hidden, and
 * the retention rule would be a UI convention rather than a guarantee.
 *
 * Non-squad threads have no lifecycle of their own here and are always open.
 */
export async function threadReadAccess(
  thread: ChatThread,
  now: Date = new Date(),
): Promise<ChatAccess> {
  if (thread.contextType === 'squad') {
    const squad = await prisma.squad.findUnique({
      where: { id: thread.contextId },
      select: { status: true, endedAt: true, meetingAt: true, durationMinutes: true, updatedAt: true },
    });

    // A squad row that no longer exists cannot be measured. Treat it as open
    // and let the ordinary not-found paths handle it, rather than inventing an
    // expiry for something whose end date is unknown.
    if (!squad) return 'open';

    return chatAccess(squad, now);
  }

  if (thread.contextType === 'ride') {
    const ride = await prisma.ride.findUnique({
      where: { id: thread.contextId },
      select: { status: true, departureTime: true },
    });
    if (!ride) return 'open';
    return chatAccess(rideAsRetention(ride), now);
  }

  // Channels and DMs have no trip to be over. They are conversations in their
  // own right, not the byproduct of a journey, so nothing here expires them.
  return 'open';
}

/**
 * Maps a ride onto the same retention shape a squad has.
 *
 * Rides have no `endedAt` — they were never given one, because until now
 * nothing measured from the end of a ride. Two things stand in for it:
 *
 *   - a terminal status, which is the ride equivalent of a squad ending;
 *   - departure plus the staleness window from services/rideVisibility.ts,
 *     which is already the point at which the rest of the app stops treating
 *     the ride as live. Reusing it means a ride disappears from search and its
 *     chat starts winding down on the same clock, rather than on two.
 *
 * Without this, a ride thread never closed at all: a ride that departed a month
 * ago still had a fully usable chat, because retention only knew about squads.
 */
function rideAsRetention(ride: { status: string; departureTime: Date | null }): {
  status: string;
  endedAt: Date | null;
} {
  const terminal = ['completed', 'cancelled'].includes(ride.status);

  if (!ride.departureTime) {
    // No departure to measure from. Only an explicit terminal status closes it,
    // and even then there is no timestamp — so it stays readable.
    return { status: ride.status, endedAt: null };
  }

  const staleAt = new Date(
    ride.departureTime.getTime() + STALE_AFTER_DEPARTURE_HOURS * 3600 * 1000,
  );

  // `chatAccess` only measures squads it considers terminal, so a ride past its
  // staleness window is reported as terminal with that moment as its end.
  return {
    status: terminal || staleAt <= new Date() ? 'completed' : ride.status,
    endedAt: staleAt,
  };
}

/**
 * Access for many threads at once, for the list endpoint.
 *
 * One query for every squad involved rather than one per row: the thread list
 * is the most-loaded screen in the app, and a per-row lookup there is how a
 * list of twenty conversations becomes twenty-one round trips.
 */
export async function threadReadAccessMap(
  threads: ChatThread[],
  now: Date = new Date(),
): Promise<Map<string, ChatAccess>> {
  const access = new Map<string, ChatAccess>();

  const squadThreads = threads.filter((t) => t.contextType === 'squad');
  const rideThreads = threads.filter((t) => t.contextType === 'ride');

  // Channels and DMs have no trip to be over, so nothing here expires them.
  for (const thread of threads) {
    if (thread.contextType !== 'squad' && thread.contextType !== 'ride') {
      access.set(thread.id, 'open');
    }
  }

  if (squadThreads.length > 0) {
    const squads = await prisma.squad.findMany({
      where: { id: { in: squadThreads.map((t) => t.contextId) } },
      select: { id: true, status: true, endedAt: true, meetingAt: true, durationMinutes: true, updatedAt: true },
    });
    const byId = new Map(squads.map((s) => [s.id, s]));
    for (const thread of squadThreads) {
      const squad = byId.get(thread.contextId);
      access.set(thread.id, squad ? chatAccess(squad, now) : 'open');
    }
  }

  if (rideThreads.length > 0) {
    const rides = await prisma.ride.findMany({
      where: { id: { in: rideThreads.map((t) => t.contextId) } },
      select: { id: true, status: true, departureTime: true },
    });
    const byId = new Map(rides.map((r) => [r.id, r]));
    for (const thread of rideThreads) {
      const ride = byId.get(thread.contextId);
      access.set(thread.id, ride ? chatAccess(rideAsRetention(ride), now) : 'open');
    }
  }

  return access;
}

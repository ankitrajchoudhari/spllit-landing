'use client';

import { io, type Socket } from 'socket.io-client';

import { config } from '@/lib/config';
import type { LivePosition, Presence, RideTracking, ChatMessage } from '@/types';

/**
 * The live/ephemeral layer. This is what the original spec put in Firebase RTDB;
 * on this stack it is Socket.IO rooms against the Express backend.
 *
 * Rule mirrored from that spec: subscribe only to the rooms relevant to what is
 * on screen (the active ride, the open squad, the visible map bounds) — never a
 * firehose of every position on the platform.
 */

export interface ServerToClient {
  'position:update': (payload: LivePosition) => void;
  'presence:update': (payload: Presence) => void;
  'ride:tracking': (payload: RideTracking) => void;
  'ride:status': (payload: { rideId: string; status: string }) => void;
  'chat:message': (payload: ChatMessage) => void;
  'chat:typing': (payload: { threadId: string; userId: string; typing: boolean }) => void;
  'squad:meeting-point': (payload: {
    squadId: string;
    lat: number;
    lng: number;
    label: string | null;
  }) => void;
  /**
   * A member moved, with the server's verdict on whether that puts them at the
   * meeting point. Arrival is decided server-side from the reported position,
   * so the client renders `arrived` rather than recomputing a radius the
   * server would disagree with.
   */
  'squad:member-position': (payload: {
    squadId: string;
    userId: string;
    lat: number;
    lng: number;
    distanceMetres: number | null;
    arrived: boolean;
    updatedAt: number;
  }) => void;
  /** Roster changed — joined, admitted, removed, left. Refetch, don't patch. */
  'squad:members-changed': (payload: { squadId: string }) => void;
  'squad:leadership': (payload: { squadId: string; leaderId: string }) => void;
  /**
   * A squad ended, or became discoverable.
   *
   * Rides had `ride:status` and squads had nothing, so a cancelled squad sat in
   * other people's lists until their cache expired — the server was already
   * excluding it from every query, but nobody was told to ask again. Carries
   * only the id and the new status: the client refetches rather than patching,
   * so a late event can never resurrect a squad that has since changed again.
   */
  'squad:status': (payload: { squadId: string; status: string }) => void;
  'notification:new': (payload: { id: string }) => void;
}

export interface ClientToServer {
  'room:join': (room: string) => void;
  'room:leave': (room: string) => void;
  'position:publish': (payload: {
    lat: number;
    lng: number;
    heading: number | null;
  }) => void;
  'chat:send': (payload: {
    threadId: string;
    clientId: string;
    content: string;
    type: string;
    metadata?: Record<string, unknown>;
  }) => void;
  'chat:typing': (payload: { threadId: string; typing: boolean }) => void;
}

export type SpllitSocket = Socket<ServerToClient, ClientToServer>;

let socket: SpllitSocket | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;

/** Reference-counted rooms so two components watching the same squad don't
 *  tear each other's subscription down on unmount. */
const roomRefCounts = new Map<string, number>();

/**
 * Set by the auth layer. Deliberately does not touch the connection: the effect
 * that sets this re-runs whenever the auth status changes and would pass a new
 * closure each time, so reconnecting from here would churn the socket for no
 * change of identity. Sign-out is handled explicitly by SocketBridge.
 */
export function setSocketTokenProvider(fn: (() => Promise<string | null>) | null) {
  tokenProvider = fn;
}

export function getSocket(): SpllitSocket {
  if (socket) return socket;

  socket = io(config.api.socketUrl, {
    autoConnect: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    auth: async (cb: (data: Record<string, unknown>) => void) => {
      const token = tokenProvider ? await tokenProvider() : null;
      cb({ token });
    },
  }) as SpllitSocket;

  // Re-join every room we were in before the drop; the server has no memory of
  // our subscriptions across a reconnect.
  socket.on('connect', () => {
    for (const room of roomRefCounts.keys()) {
      socket?.emit('room:join', room);
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return socket;
}

/**
 * How long a tab may sit in the background before its socket is closed.
 *
 * This is a billing decision. Cloud Run bills an instance for as long as any
 * request is open, and a websocket is one long request — so one signed-in tab
 * left open overnight kept api.spllit.app billed for the whole night, even at
 * min-instances 0 with CPU throttling. The testing days on the bill were 10-15
 * billed hours each for almost no traffic.
 *
 * Nothing is lost by closing it. Coming back reconnects, the `connect` handler
 * re-joins every room still held, and React Query's refetch-on-focus catches up
 * whatever arrived meanwhile (the open thread is staleTime 0). Sending never
 * depended on the socket either: chat falls back to HTTP when it is down.
 *
 * Long enough that flicking to another tab and back does not churn the
 * connection.
 */
const HIDDEN_GRACE_MS = 2 * 60_000;

let suspendTimer: ReturnType<typeof setTimeout> | null = null;
/** Closed by the background timer, as opposed to by sign-out. */
let suspended = false;
/**
 * Things that must keep publishing from a background tab — the location
 * publisher during a shared trip. While any is held, the tab is never
 * suspended.
 */
let backgroundHolds = 0;

function scheduleSuspend() {
  if (suspendTimer || backgroundHolds > 0) return;
  suspendTimer = setTimeout(() => {
    suspendTimer = null;
    if (!document.hidden || backgroundHolds > 0 || !socket?.connected) return;
    suspended = true;
    // disconnect(), not disconnectSocket(): the room ref-counts belong to
    // components that are still mounted and must be re-joined on return.
    socket.disconnect();
  }, HIDDEN_GRACE_MS);
}

function cancelSuspend() {
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = null;
}

function onVisibilityChange() {
  if (document.hidden) {
    if (socket?.connected) scheduleSuspend();
    return;
  }
  cancelSuspend();
  if (suspended) {
    suspended = false;
    connectSocket();
  }
}

/**
 * Keeps the socket open while the tab is in the background. Returns the
 * release function; always call it when the reason goes away.
 */
export function holdInBackground(): () => void {
  backgroundHolds += 1;
  cancelSuspend();
  if (suspended) {
    suspended = false;
    connectSocket();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    backgroundHolds -= 1;
    if (typeof document !== 'undefined' && document.hidden) scheduleSuspend();
  };
}

/**
 * Opens the connection, but never before we can prove who we are.
 *
 * The server resolves identity from the handshake `auth.token` once, at
 * connection time, and joins `user:<id>` from it (services/live.ts). A socket
 * that handshakes without a token is *accepted* — it simply never joins that
 * room, and `notification:new` is emitted only there. So it connects, looks
 * healthy, and silently receives nothing until something forces a reconnect.
 *
 * That is what was happening on every load. RealtimeBridge is a child of
 * SocketBridge, React runs child effects first, so `onEvent` → `connectSocket`
 * opened the handshake before `setSocketTokenProvider` had run. The auth
 * callback sent `{ token: null }`, and by the time the provider was set the
 * handshake was already in flight — `s.connected` was still false, so the
 * parent's `connect()` was a no-op and the tokenless session stuck.
 *
 * Gating here rather than reordering the providers: any caller may ask for the
 * socket at any time, and none of them should have to know that connecting too
 * early produces a connection that cannot receive anything.
 */
export function connectSocket() {
  const s = getSocket();
  if (!tokenProvider) return s;
  suspended = false;
  if (!s.connected) s.connect();
  // Opened from a background tab (a component mounting there): it gets the
  // same grace period as one that was open when the tab was hidden.
  if (typeof document !== 'undefined' && document.hidden) scheduleSuspend();
  return s;
}

export function disconnectSocket() {
  cancelSuspend();
  suspended = false;
  socket?.disconnect();
  roomRefCounts.clear();
}

/**
 * Join a room and return the matching leave function. Always call the returned
 * function on unmount — leaked rooms are the main cause of duplicate markers.
 */
export function joinRoom(room: string): () => void {
  const s = connectSocket();
  const next = (roomRefCounts.get(room) ?? 0) + 1;
  roomRefCounts.set(room, next);
  if (next === 1) s.emit('room:join', room);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (roomRefCounts.get(room) ?? 1) - 1;
    if (count <= 0) {
      roomRefCounts.delete(room);
      s.emit('room:leave', room);
    } else {
      roomRefCounts.set(room, count);
    }
  };
}

/** Room name helpers — keep every room string in one place. */
export const rooms = {
  ride: (rideId: string) => `ride:${rideId}`,
  squad: (squadId: string) => `squad:${squadId}`,
  event: (eventId: string) => `event:${eventId}`,
  thread: (threadId: string) => `thread:${threadId}`,
  user: (userId: string) => `user:${userId}`,
  /** Map viewport tile — the server fans out only positions inside it. */
  area: (geohash: string) => `area:${geohash}`,
} as const;

/** Typed on/off pair that guarantees the handler is removed. */
export function onEvent<K extends keyof ServerToClient>(
  event: K,
  handler: ServerToClient[K],
): () => void {
  const s = connectSocket();
  s.on(event, handler as never);
  return () => {
    s.off(event, handler as never);
  };
}
